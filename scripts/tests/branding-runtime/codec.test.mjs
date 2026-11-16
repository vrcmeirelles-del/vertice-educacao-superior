// JSDOM FileReader + native image/canvas codecs exercise the unmodified panel
// function. This does not run a real browser or enforce the published CSP.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { createCanvas, Image, loadImage } from '@napi-rs/canvas';

const panel = readFileSync(new URL('../../../source-overrides/client/src/components/area/BrandingPanel.tsx', import.meta.url), 'utf8');
const code = ts.transpile(panel, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX });

function runtime() {
  const dom = new JSDOM();
  const exports = {};
  const context = {
    exports, require: name => name === '@/lib/area' ? { explain: () => 'Falha sintética' } : {},
    FileReader: dom.window.FileReader, Image,
    document: { createElement: tag => { assert.equal(tag, 'canvas'); return createCanvas(1, 1); } },
    // A regression to blob URLs fails locally; no object URL is needed.
    URL: { createObjectURL: () => assert.fail('Image preparation must not require blob URLs') },
  };
  vm.runInNewContext(code, context);
  return { normalize: exports.normalizeDocumentLogo, Blob: dom.window.Blob, dom };
}

for (const [format, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
  test(`${format}: reads synthetic bytes and produces a proportional, centered 300 × 120 PNG`, async () => {
    const { normalize, Blob, dom } = runtime();
    try {
      const input = createCanvas(400, 100); input.getContext('2d').fillStyle = '#ee1100'; input.getContext('2d').fillRect(0, 0, 400, 100);
      const result = await normalize(new Blob([input.toBuffer(mime)], { type: mime }));
      assert.match(result, /^data:image\/png;base64,/);
      const image = await loadImage(result); assert.equal(image.width, 300); assert.equal(image.height, 120);
      const out = createCanvas(300, 120); const ctx = out.getContext('2d'); ctx.drawImage(image, 0, 0);
      assert.equal(ctx.getImageData(150, 0, 1, 1).data[3], 0);
      assert.equal(ctx.getImageData(150, 60, 1, 1).data[3], 255);
      assert.equal(ctx.getImageData(150, 119, 1, 1).data[3], 0);
    } finally { dom.window.close(); }
  });
}

test('portrait image is centered without filling the side margins', async () => {
  const { normalize, Blob, dom } = runtime();
  try {
    const input = createCanvas(100, 400); input.getContext('2d').fillRect(0, 0, 100, 400);
    const image = await loadImage(await normalize(new Blob([input.toBuffer('image/png')], { type: 'image/png' })));
    const out = createCanvas(300, 120); const ctx = out.getContext('2d'); ctx.drawImage(image, 0, 0);
    assert.equal(ctx.getImageData(0, 60, 1, 1).data[3], 0); assert.equal(ctx.getImageData(150, 60, 1, 1).data[3], 255);
  } finally { dom.window.close(); }
});

test('files above 2 MB and unsupported MIME types are rejected before decoding', async () => {
  const { normalize, Blob, dom } = runtime();
  try {
    await assert.rejects(normalize(new Blob([new Uint8Array(2097153)], { type: 'image/png' })), /2 MB/);
    await assert.rejects(normalize(new Blob(['<svg/>'], { type: 'image/svg+xml' })), /PNG, JPG ou WebP/);
  } finally { dom.window.close(); }
});

test('corrupted input is rejected instead of producing a preview', async () => {
  const { normalize, Blob, dom } = runtime();
  try { await assert.rejects(normalize(new Blob(['not an image'], { type: 'image/png' })), /ler a imagem/); }
  finally { dom.window.close(); }
});
