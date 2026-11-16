// Real Edge handler and DOCX ZIP processing; Supabase/auth/storage are synthetic.
// No network, real identities, audit entries or production writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { deflateSync } from 'node:zlib';
import { test } from 'node:test';
import ts from 'typescript';
import JSZip from 'jszip';

const sourcePath = process.env.VERTICE_LIBRARY_EDGE_SOURCE || fileURLToPath(new URL('../../../supabase/functions/vertice-inep-library/index.ts', import.meta.url));
const source = readFileSync(sourcePath, 'utf8').replace(/^import .*\n/gm, '');
const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None });
const institution = '00000000-0000-4000-8000-000000000011';
const document = '00000000-0000-4000-8000-000000000021';
const supabaseUrl = 'https://fixture.supabase.co';
const origin = 'https://www.verticesuperior.com.br';
const canonicalName = 'Instituição sintética & testes';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(kind, bytes) {
  const data = Buffer.concat([Buffer.from(kind), bytes]);
  const out = Buffer.alloc(bytes.length + 12);
  out.writeUInt32BE(bytes.length); data.copy(out, 4); out.writeUInt32BE(crc32(data), out.length - 4);
  return out;
}
function png(width = 300, height = 120) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height, 0))), chunk('IEND', Buffer.alloc(0))]);
}
const logo = png();
const branding = { header_text: canonicalName, theme_color: '#087f8c', logo_data: 'data:image/png;base64,' + logo.toString('base64') };
const header = '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>[LOGO DA INSTITUIÇÃO]</w:t></w:r><w:r><w:t>[NOME DA INSTITUIÇÃO]</w:t></w:r></w:p><w:p><w:r><w:rPr><w:color w:val="1F3864"/></w:rPr><w:t>Modelo sintético</w:t></w:r></w:p></w:hdr>';

async function setup(options = {}) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
  zip.file('word/document.xml', '<w:document>Corpo sintético preservado</w:document>');
  zip.file('word/header1.xml', header); zip.file('word/header2.xml', header);
  const template = await zip.generateAsync({ type: 'uint8array' });
  const events = [];
  let handler;
  const client = {
    auth: { getUser: async () => ({ data: { user: options.badAuth ? null : { id: 'synthetic-actor', is_anonymous: Boolean(options.anonymous) } }, error: null }) },
    from(table) {
      const q = {
        select() { return q; }, eq(key, value) { events.push(['filter', table, key, value]); return q; },
        maybeSingle: async () => ({ data: options.denied ? null : { id: document, institution_id: institution, format: options.format || 'docx', file_name: 'sintetico.' + (options.format || 'docx'), object_path: 'synthetic/template.docx' }, error: null }),
        single: async () => ({ data: { name: 'IES sintética cadastrada', document_branding: options.branding === undefined ? branding : options.branding }, error: options.institutionError ? { message: 'synthetic read failure' } : null }),
        insert: async () => { events.push(['audit']); return { error: null }; },
      };
      return q;
    },
    storage: { from: () => ({
      download: async () => { events.push(['download']); return { data: new Blob([template]), error: null }; },
      createSignedUrl: async () => { events.push(['signed']); return { data: { signedUrl: 'https://fixture.invalid/synthetic' }, error: null }; },
    }) },
  };
  vm.runInNewContext(code, {
    Deno: { env: { get: key => ({ SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: 'synthetic-anon', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-secret' })[key] }, serve: fn => { handler = fn; } },
    createClient: () => client, JSZip, Blob, Request, Response, URL, atob, Uint8Array, DataView, AbortController, setTimeout, clearTimeout,
    fetch: async (url, settings) => { events.push(['fetch', String(url), settings?.redirect]); return new Response(logo, { headers: { 'Content-Type': 'image/png' } }); },
  });
  const response = await handler(new Request('https://fixture.invalid/edge', { method: 'POST', headers: { origin: options.origin || origin, Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, body: JSON.stringify({ institutionId: institution, id: document }) }));
  return { response, events };
}

test('canonical fields produce a DOCX with the same PNG, name and color in every header', async () => {
  const { response, events } = await setup();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /wordprocessingml/);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  for (const path of ['word/header1.xml', 'word/header2.xml']) {
    const xml = await zip.file(path).async('string');
    assert.match(xml, /Instituição sintética &amp; testes/); assert.match(xml, /087F8C/);
    assert.match(xml, /r:embed="rIdLogoInst"/); assert.doesNotMatch(xml, /\[LOGO|\[NOME/);
    const extent = xml.match(/wp:extent cx="(\d+)" cy="(\d+)"/);
    assert.ok(extent); assert.equal(Number(extent[1]) / Number(extent[2]), 2.5);
  }
  assert.deepEqual(await zip.file('word/media/logo_inst.png').async('nodebuffer'), logo);
  assert.match(await zip.file('word/_rels/header1.xml.rels').async('string'), /media\/logo_inst.png/);
  assert.match(await zip.file('[Content_Types].xml').async('string'), /image\/png/);
  assert.equal(await zip.file('word/document.xml').async('string'), '<w:document>Corpo sintético preservado</w:document>');
  assert.equal(events.filter(e => e[0] === 'fetch').length, 0);
});

test('empty canonical header uses the registered institution name', async () => {
  const { response } = await setup({ branding: { ...branding, header_text: '' } });
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.match(await zip.file('word/header1.xml').async('string'), /IES sintética cadastrada/);
});

test('explicit logo removal does not revive a legacy URL', async () => {
  const { response, events } = await setup({ branding: { ...branding, logo_data: null, logo_url: supabaseUrl + '/storage/v1/object/public/vertice-institution-logos/legacy.png' } });
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.equal(zip.file('word/media/logo_inst.png'), null);
  assert.equal(events.filter(e => e[0] === 'fetch').length, 0);
});

test('malformed, oversized and wrong-size inline images fail without a download fallback', async () => {
  for (const invalid of ['data:image/png;base64,AAAA', 'data:image/png;base64,' + png(30, 12).toString('base64'), 'data:image/png;base64,' + 'A'.repeat(2800004)]) {
    const { response, events } = await setup({ branding: { ...branding, logo_data: invalid } });
    assert.equal(response.status, 422);
    assert.equal(events.filter(e => ['signed', 'fetch'].includes(e[0])).length, 0);
  }
});

test('legacy own-storage branding stays compatible and retains redirect protection', async () => {
  const { response, events } = await setup({ branding: { display_name: 'Nome legado', brand_color: '#112233', logo_url: supabaseUrl + '/storage/v1/object/public/vertice-institution-logos/legacy.png' } });
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.match(await zip.file('word/header1.xml').async('string'), /Nome legado/);
  assert.deepEqual(events.filter(e => e[0] === 'fetch'), [['fetch', supabaseUrl + '/storage/v1/object/public/vertice-institution-logos/legacy.png', 'error']]);
});

test('external legacy logo URLs never trigger a fetch', async () => {
  const { response, events } = await setup({ branding: { display_name: 'Legado', logo_url: 'https://untrusted.invalid/logo.png' } });
  assert.equal(response.status, 200); assert.equal(events.filter(e => e[0] === 'fetch').length, 0);
});

test('denied document access does not reach administrative storage or audit', async () => {
  const { response, events } = await setup({ denied: true });
  assert.equal(response.status, 403); assert.equal(events.filter(e => ['download', 'signed', 'audit'].includes(e[0])).length, 0);
});

test('invalid and anonymous sessions are rejected', async () => {
  for (const options of [{ badAuth: true }, { anonymous: true }]) {
    const { response, events } = await setup(options); assert.equal(response.status, 401); assert.equal(events.length, 0);
  }
});

test('non-DOCX downloads keep the existing signed-URL behavior', async () => {
  const { response, events } = await setup({ format: 'pdf' });
  assert.equal(response.status, 200); assert.equal((await response.json()).expiresIn, 300);
  assert.equal(events.filter(e => e[0] === 'download').length, 0);
});

test('institution read failure is explicit instead of silently returning an unbranded original', async () => {
  const { response, events } = await setup({ institutionError: true });
  assert.equal(response.status, 503); assert.equal(events.filter(e => ['signed', 'download'].includes(e[0])).length, 0);
});
