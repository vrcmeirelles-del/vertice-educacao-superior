import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import JSZip from 'npm:jszip@3.10.1';

// v21 (13/11/2026) — correção de segurança: logo_url restrito ao Storage próprio (anti-SSRF),
// sem redirecionamento, com teto de tamanho e timeout; brand_color validado antes de entrar no XML.
// v22 — contrato canônico do painel: logo_data/header_text/theme_color.
// Fonte v21 recuperada da função publicada; esta proposta não executa o deploy.

const ORIGINS = new Set([
  'https://www.verticesuperior.com.br', 'https://verticesuperior.com.br',
  'https://vertice-educacao-superior-jlri.onrender.com',
  'https://vertice-educacao-superior-site.onrender.com',
]);
const BUCKET = 'vertice-biblioteca-inep';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_PUBLIC_PREFIX = '/storage/v1/object/public/vertice-institution-logos/';

/** Aceita somente https no host do próprio projeto Supabase, no bucket público de logos. */
function trustedLogoUrl(raw: string | null | undefined, supabaseUrl: string): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const base = new URL(supabaseUrl);
    if (u.protocol !== 'https:') return null;
    if (u.hostname !== base.hostname || (u.port && u.port !== '443')) return null;
    if (!u.pathname.startsWith(LOGO_PUBLIC_PREFIX) || u.pathname.includes('..')) return null;
    return u;
  } catch { return null; }
}

/* ── branding helpers ────────────────────────────────────────────── */

function replaceName(xml: string, name: string): string {
  return xml.replace(/\[NOME DA INSTITUI[ÇC][ÃA]O\]/gi, escapeXml(name));
}

/** Aplica a cor somente se for hexadecimal válido de 6 dígitos (evita injeção no XML). */
function applyColor(xml: string, hex: string): string {
  const c = String(hex || '').replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(c)) return xml;
  return xml.replace(/1F3864/g, c);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Detecta o tipo da imagem; SVG não é aceito (pode conter script/referências externas). */
function detectImageType(buf: Uint8Array): { mime: string; ext: string } | null {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { mime: 'image/png', ext: 'png' };
  if (buf[0] === 0xFF && buf[1] === 0xD8) return { mime: 'image/jpeg', ext: 'jpeg' };
  if (buf[0] === 0x47 && buf[1] === 0x49) return { mime: 'image/gif', ext: 'gif' };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50)
    return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** PNG normalizado pelo painel; não acessa URLs nem aceita formatos ativos. */
function inlineDocumentLogo(raw: unknown): Uint8Array | null {
  if (typeof raw !== 'string' || raw.length > 2800000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(raw)) return null;
  try {
    const binary = atob(raw.slice(22));
    if (binary.length < 57 || binary.length > LOGO_MAX_BYTES) return null;
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const expected = [137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82];
    if (!expected.every((value, i) => bytes[i] === value)) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(16) !== 300 || view.getUint32(20) !== 120 || bytes[24] !== 8 || ![2,6].includes(bytes[25]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) return null;
    const end = [0,0,0,0,73,69,78,68,174,66,96,130];
    if (!end.every((value, i) => bytes[bytes.length - 12 + i] === value)) return null;
    return bytes;
  } catch { return null; }
}

const LOGO_RID = 'rIdLogoInst';

function logoDrawingXml(rId: string, cxEmu = 900000, cyEmu = 900000): string {
  return `<w:drawing>`
    + `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">`
    + `<wp:extent cx="${cxEmu}" cy="${cyEmu}"/>`
    + `<wp:docPr id="999" name="Logo Institucional"/>`
    + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`
    + `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
    + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`
    + `<pic:nvPicPr><pic:cNvPr id="999" name="Logo"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill>`
    + `<a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>`
    + `<a:stretch><a:fillRect/></a:stretch>`
    + `</pic:blipFill>`
    + `<pic:spPr>`
    + `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm>`
    + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`
    + `</pic:spPr>`
    + `</pic:pic>`
    + `</a:graphicData>`
    + `</a:graphic>`
    + `</wp:inline>`
    + `</w:drawing>`;
}

function replaceLogoPlaceholder(xml: string, rId: string, size?: [number, number]): string {
  const placeholder = /\[LOGO DA INSTITUI[ÇC][ÃA]O\]/i;
  if (!placeholder.test(xml)) return xml;
  const runWithPlaceholder = new RegExp(
    `<w:r>(?:<w:rPr>[\\s\\S]*?</w:rPr>)?\\s*<w:t[^>]*>\\[LOGO DA INSTITUI[ÇC][ÃA]O\\]</w:t>\\s*</w:r>`,
    'i'
  );
  const drawing = logoDrawingXml(rId, size?.[0], size?.[1]);
  const imageRun = `<w:r>${drawing}</w:r>`;
  if (runWithPlaceholder.test(xml)) return xml.replace(runWithPlaceholder, imageRun);
  return xml.replace(
    /\[LOGO DA INSTITUI[ÇC][ÃA]O\]/i,
    `</w:t></w:r><w:r>${drawing}</w:r><w:r><w:t>`
  );
}

function addImageRelationship(rels: string | null, rId: string, ext: string): string {
  const target = `media/logo_inst.${ext}`;
  const rel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;
  if (!rels) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + rel
      + `</Relationships>`;
  }
  return rels.replace('</Relationships>', rel + '</Relationships>');
}

function ensureContentType(ct: string, ext: string, mime: string): string {
  const extPattern = new RegExp(`Extension="${ext}"`, 'i');
  if (extPattern.test(ct)) return ct;
  const entry = `<Default Extension="${ext}" ContentType="${mime}"/>`;
  return ct.replace('</Types>', entry + '</Types>');
}

/** Baixa o logo com timeout, sem seguir redirecionamentos e com teto de tamanho. */
async function fetchLogo(u: URL): Promise<Uint8Array | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(u.toString(), { redirect: 'error', signal: ctrl.signal });
    if (!res.ok || !res.body) return null;
    const declared = Number(res.headers.get('content-length') || '0');
    if (declared > LOGO_MAX_BYTES) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > LOGO_MAX_BYTES) { ctrl.abort(); return null; }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.byteLength; }
    return out;
  } catch { return null; } finally { clearTimeout(timer); }
}

/* ── main handler ──────────────────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors: Record<string, string> = {
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin',
  };
  if (origin && ORIGINS.has(origin)) cors['Access-Control-Allow-Origin'] = origin;
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' };
  const respond = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), { status, headers: jsonHeaders });
  if (origin && !ORIGINS.has(origin)) return respond(403, { error: 'Origem não autorizada.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return respond(405, { error: 'Método não permitido.' });
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return respond(401, { error: 'Entre para acessar a biblioteca.' });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser(authorization.slice(7));
    if (authError || !user || user.is_anonymous) return respond(401, { error: 'Sessão inválida.' });

    const body = await req.json();
    if (!UUID.test(body.institutionId || '') || !UUID.test(body.id || ''))
      return respond(400, { error: 'Documento inválido.' });

    const { data: doc, error } = await userClient.from('vertice_inep_library')
      .select('id,institution_id,file_name,object_path,format')
      .eq('institution_id', body.institutionId).eq('id', body.id).eq('active', true).maybeSingle();
    if (error || !doc) return respond(403, { error: 'Documento indisponível para este acesso.' });

    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!secret) return respond(503, { error: 'Biblioteca temporariamente indisponível.' });
    const admin = createClient(url, secret, { auth: { persistSession: false } });

    const { error: auditError } = await admin.from('vertice_audit').insert({
      actor: user.id, table_name: 'vertice_inep_library', action: 'download', record_id: doc.id,
    });
    if (auditError) return respond(503, { error: 'Não foi possível registrar o download.' });

    const { data: inst, error: institutionError } = await admin.from('vertice_institutions')
      .select('name,document_branding').eq('id', doc.institution_id).single();
    if (institutionError || !inst) return respond(503, { error: 'Não foi possível consultar a identidade visual da instituição.' });
    const stored = inst.document_branding as {
      logo_data?: string | null; header_text?: string | null; theme_color?: string | null;
      logo_url?: string | null; display_name?: string | null; brand_color?: string | null;
    } | null;
    const branding = stored ? {
      display_name: 'header_text' in stored ? stored.header_text?.trim() || String(inst.name || '') : stored.display_name,
      brand_color: 'theme_color' in stored ? stored.theme_color : stored.brand_color,
      logo_data: stored.logo_data,
      // Null no contrato canônico representa remoção explícita da logo.
      logo_url: 'logo_data' in stored ? null : stored.logo_url,
    } : null;

    const isDocx = doc.format === 'docx' || doc.file_name.endsWith('.docx');
    const hasBranding = branding && (branding.display_name || branding.logo_data || branding.logo_url || branding.brand_color);

    if (!isDocx || !hasBranding) {
      const { data: signed, error: signError } = await admin.storage.from(BUCKET)
        .createSignedUrl(doc.object_path, 300, { download: doc.file_name });
      if (signError || !signed?.signedUrl)
        return respond(503, { error: 'Não foi possível preparar o download.' });
      return respond(200, { url: signed.signedUrl, filename: doc.file_name, expiresIn: 300 });
    }

    const { data: fileBlob, error: dlError } = await admin.storage
      .from(BUCKET).download(doc.object_path);
    if (dlError || !fileBlob)
      return respond(503, { error: 'Não foi possível obter o arquivo para processamento.' });

    const zip = await JSZip.loadAsync(await fileBlob.arrayBuffer());

    let logoBytes: Uint8Array | null = null;
    let logoType: { mime: string; ext: string } | null = null;
    const inlineLogo = branding.logo_data !== null && branding.logo_data !== undefined;
    if (inlineLogo) {
      logoBytes = inlineDocumentLogo(branding.logo_data);
      if (!logoBytes) return respond(422, { error: 'A logo cadastrada não é um PNG válido de 300 × 120 pixels. Reabra a identidade visual para revisá-la.' });
      logoType = { mime: 'image/png', ext: 'png' };
    }
    const logoUrl = inlineLogo ? null : trustedLogoUrl(branding.logo_url, url);
    if (logoUrl) {
      logoBytes = await fetchLogo(logoUrl);
      logoType = logoBytes ? detectImageType(logoBytes) : null;
      if (!logoType) logoBytes = null;
    }

    const headerPattern = /^word\/header\d*\.xml$/;
    for (const path of Object.keys(zip.files)) {
      if (!headerPattern.test(path)) continue;
      let xml = await zip.files[path].async('string');
      if (branding.display_name) xml = replaceName(xml, String(branding.display_name).slice(0, 200));
      if (logoBytes && logoType) {
        xml = replaceLogoPlaceholder(xml, LOGO_RID, inlineLogo ? [1800000, 720000] : undefined);
        zip.file(`word/media/logo_inst.${logoType.ext}`, logoBytes);
        const relsPath = path.replace('word/', 'word/_rels/') + '.rels';
        const existingRels = zip.files[relsPath] ? await zip.files[relsPath].async('string') : null;
        zip.file(relsPath, addImageRelationship(existingRels, LOGO_RID, logoType.ext));
        if (zip.files['[Content_Types].xml']) {
          const ct = await zip.files['[Content_Types].xml'].async('string');
          zip.file('[Content_Types].xml', ensureContentType(ct, logoType.ext, logoType.mime));
        }
      }
      if (branding.brand_color) xml = applyColor(xml, branding.brand_color);
      zip.file(path, xml);
    }

    const processed = await zip.generateAsync({
      type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 },
    });

    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`;
    return new Response(Uint8Array.from(processed).buffer, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': disposition,
        'Content-Length': String(processed.byteLength),
      },
    });
  } catch {
    return respond(400, { error: 'Não foi possível processar o download.' });
  }
});
