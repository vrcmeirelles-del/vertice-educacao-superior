import { Buffer } from "node:buffer";
import { unzipSync, zipSync, strFromU8, strToU8 } from 'npm:fflate@0.8.3';
import { DOMParser, XMLSerializer } from 'npm:@xmldom/xmldom@0.9.12';
import { PNG } from 'npm:pngjs@7.0.0';

export type Branding = { header_text: string; theme_color: string | null; logo_data: string | null };
export type Manifest = {
  classification: 'reviewed-template'; source_sha256: string; review_ref: string;
  replace_headers: string[]; clear_footers: string[]; theme_style_ids: string[];
  // Exact hashes acknowledge editorial review of retained metadata, media and embeddings.
  preserved_parts_review: Record<string, string>;
  remove_parts?: string[]; // Only explicitly reviewed orphan media or document metadata.
};
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const META = 'vertice/template.json';
const LOGO = 'word/media/vertice-branding-logo.png';
const SHA = /^[a-f0-9]{64}$/;
export async function sha256(bytes: Uint8Array) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))].map(v => v.toString(16).padStart(2, '0')).join(''); }
export function unpack(bytes: Uint8Array) {
  if (bytes.length > 30 * 1024 * 1024) throw new Error('DOCX exceeds limit');
  let total = 0, count = 0;
  const names = new Set<string>();
  const files = unzipSync(bytes, { filter: entry => {
    if (++count > 2000 || names.has(entry.name) || entry.name.includes('..') || entry.name.startsWith('/') || entry.name.includes('\\')) throw new Error('Unsafe ZIP entry');
    names.add(entry.name); total += entry.originalSize;
    if (entry.originalSize > 16 * 1024 * 1024 || total > 64 * 1024 * 1024) throw new Error('Expanded DOCX exceeds limit');
    return true;
  } });
  for (const required of ['word/document.xml', '[Content_Types].xml', 'word/_rels/document.xml.rels']) if (!files[required]) throw new Error('Not a supported DOCX');
  for (const [name, data] of Object.entries(files)) {
    if (/vbaProject|activeX|customUI|_xmlsignatures/i.test(name)) throw new Error('Active content is unsupported');
    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      const doc = parse(data);
      validateWordFields(doc);
      if (name.endsWith('.rels')) for (const rel of Array.from(doc.getElementsByTagNameNS(R, 'Relationship'))) {
        const type = rel.getAttribute('Type') ?? '';
        if (/attachedTemplate|aFChunk|oleObject/i.test(type)) throw new Error('Embedded/linked active objects unsupported');
        if (rel.getAttribute('TargetMode') === 'External' && !type.endsWith('/hyperlink')) throw new Error('External resource unsupported');
      }
    }
  }
  return files;
}
function parse(bytes: Uint8Array) {
  const xml = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD is not permitted');
  return new DOMParser({ onError: (level, message) => { if (level !== 'warning') throw new Error(message); } }).parseFromString(xml, 'application/xml');
}
/** Fail-closed Word field grammar. Only non-nested pagination with known format switches.
 * Called for every XML part on BOTH preparation and download; never rewrites field/body bytes.
 */
function validateWordFields(doc: ReturnType<typeof parse>) {
  const passive = /^\s*(?:PAGE|NUMPAGES|SECTION|SECTIONPAGES)(?:\s+\\\*\s+(?:ARABIC|ROMAN|ALPHABETIC|MERGEFORMAT|CHARFORMAT))*\s*$/i;
  const validate = (instruction: string) => {
    if (instruction.length > 512 || !passive.test(instruction)) throw new Error('Unsupported Word field instruction');
  };
  let field: { instruction: string; code: boolean } | null = null;
  const tokens = new Set(['fldSimple','fldChar','instrText','delInstrText','fldData','ffData']);
  const visit = (node: ReturnType<typeof parse>['documentElement'], inSimple = false): void => {
    if (!node) return;
    const kind = node.localName ?? '';
    if (tokens.has(kind)) {
      if (![W, 'http://purl.oclc.org/ooxml/wordprocessingml/main'].includes(node.namespaceURI ?? '')) throw new Error('Unsupported field namespace');
      const ns = node.namespaceURI!;
      if (kind === 'fldSimple') {
        if (field || inSimple) throw new Error('Nested Word fields are unsupported');
        validate(node.getAttributeNS(ns, 'instr') ?? '');
        for (const child of Array.from(node.childNodes)) if (child.nodeType === 1) visit(child as typeof node, true);
        return;
      }
      if (kind === 'instrText') {
        if (inSimple || !field || !field.code) throw new Error('Orphan or result-phase Word instruction');
        field.instruction += node.textContent ?? '';
        if (field.instruction.length > 512) throw new Error('Word instruction exceeds limit');
      } else if (kind === 'fldChar') {
        if (inSimple) throw new Error('Nested Word fields are unsupported');
        const type = node.getAttributeNS(ns, 'fldCharType');
        if (type === 'begin') {
          if (field) throw new Error('Nested Word fields are unsupported');
          field = { instruction: '', code: true };
        } else if (type === 'separate') {
          if (!field || !field.code) throw new Error('Unbalanced Word field');
          validate(field.instruction); field.code = false;
        } else if (type === 'end') {
          if (!field) throw new Error('Unbalanced Word field');
          validate(field.instruction); field = null;
        } else throw new Error('Unknown Word field marker');
      } else throw new Error('Deleted instructions and embedded field data are unsupported');
    }
    for (const child of Array.from(node.childNodes)) if (child.nodeType === 1) visit(child as typeof node, inSimple);
  };
  visit(doc.documentElement);
  if (field) throw new Error('Unclosed Word field');
}
function serialize(doc: ReturnType<typeof parse>) { return strToU8(new XMLSerializer().serializeToString(doc)); }
function relPath(part: string) { const slash = part.lastIndexOf('/'); return part.slice(0, slash) + '/_rels/' + part.slice(slash + 1) + '.rels'; }
function esc(s: string) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!)); }
function textColor(hex: string) {
  let rgb = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16));
  const luminance = () => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
  while (1.05 / (luminance() + .05) < 4.5) rgb = rgb.map(v => Math.floor(v * .95));
  return rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function validateBranding(b: Branding) {
  if (!b || typeof b.header_text !== 'string' || [...b.header_text].length > 600 || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(b.header_text)) throw new Error('Invalid header text');
  if (b.theme_color !== null && (typeof b.theme_color !== 'string' || !/^#[a-f0-9]{6}$/i.test(b.theme_color))) throw new Error('Invalid theme color');
  if (b.logo_data !== null) {
    if (typeof b.logo_data !== 'string' || b.logo_data.length > 2800000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(b.logo_data)) throw new Error('Invalid PNG');
    const bytes = Uint8Array.from(atob(b.logo_data.split(',')[1]), c => c.charCodeAt(0));
    if (bytes.length < 33 || new DataView(bytes.buffer).getUint32(16) !== 300 || new DataView(bytes.buffer).getUint32(20) !== 120) throw new Error('Logo must be 300x120');
    // Canvas output: only 8-bit truecolor RGB/RGBA, standard compression/filter, no Adam7.
    // Reject before pngjs: its interlaced path inflates without a hard output bound.
    if (bytes[24] !== 8 || ![2, 6].includes(bytes[25]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) throw new Error('Unsupported normalized PNG encoding');
    const png = PNG.sync.read(Buffer.from(bytes), { checkCRC: true });
    if (png.width !== 300 || png.height !== 120) throw new Error('Invalid PNG dimensions');
    // Decode/re-encode removes ancillary metadata from every returned logo.
    return new Uint8Array(PNG.sync.write(png));
  }
  return null;
}
function header(b: Branding, hasLogo: boolean, index: number) {
  const color = textColor(b.theme_color ?? '#222222');
  const drawing = hasLogo ? `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1371600" cy="548640"/><wp:docPr id="${900000 + index}" name="Logo institucional"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="Logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdVerticeLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1371600" cy="548640"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>` : '';
  const text = b.header_text.split('\n').map(line => `<w:r><w:rPr><w:color w:val="${color}"/></w:rPr><w:t xml:space="preserve">${esc(line)}</w:t></w:r>`).join('<w:r><w:br/></w:r>');
  return strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="2250"/><w:gridCol w:w="6750"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="1250" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr><w:p>${drawing}</w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="3750" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr><w:p>${text}</w:p></w:tc></w:tr></w:tbl><w:p/></w:hdr>`);
}
function ensureContentType(files: Record<string, Uint8Array>, part: string, type: string) {
  const doc = parse(files['[Content_Types].xml']);
  const existing = Array.from(doc.getElementsByTagNameNS(CT, 'Override')).find(e => e.getAttribute('PartName') === '/' + part);
  if (!existing) { const e = doc.createElementNS(CT, 'Override'); e.setAttribute('PartName', '/' + part); e.setAttribute('ContentType', type); doc.documentElement!.appendChild(e); }
  files['[Content_Types].xml'] = serialize(doc);
}
export function validateManifest(m: Manifest) {
  if (m.classification !== 'reviewed-template' || !SHA.test(m.source_sha256) || typeof m.review_ref !== 'string' || !m.review_ref.trim() || m.review_ref.length > 500) throw new Error('Explicit editorial review required');
  for (const [key, pattern] of [['replace_headers', /^word\/header[\w-]*\.xml$/], ['clear_footers', /^word\/footer[\w-]*\.xml$/], ['theme_style_ids', /^[\w-]{1,100}$/]] as const) {
    if (!Array.isArray(m[key]) || m[key].length > 100 || new Set(m[key]).size !== m[key].length || m[key].some(x => typeof x !== 'string' || !pattern.test(x))) throw new Error('Invalid manifest list: ' + key);
  }
  if (m.remove_parts !== undefined && (!Array.isArray(m.remove_parts) || m.remove_parts.length > 200 || new Set(m.remove_parts).size !== m.remove_parts.length || m.remove_parts.some(p => typeof p !== 'string' || !/^(docProps\/[^/]+\.xml|word\/media\/[^/]+)$/.test(p)))) throw new Error('Invalid removal list');
  if (!m.replace_headers.length || !m.preserved_parts_review || typeof m.preserved_parts_review !== 'object' || Array.isArray(m.preserved_parts_review)) throw new Error('Header and retained parts review required');
}
export async function prepareTemplate(source: Uint8Array, m: Manifest) {
  validateManifest(m);
  if (await sha256(source) !== m.source_sha256) throw new Error('Source hash mismatch');
  const files = unpack(source);
  if (files[META] || files[LOGO]) throw new Error('Source is already prepared');
  const relationships = parse(files['word/_rels/document.xml.rels']);
  const referenced = new Set(Array.from(relationships.getElementsByTagNameNS(R, 'Relationship')).filter(e => /\/(header|footer)$/.test(e.getAttribute('Type') ?? '')).map(e => 'word/' + e.getAttribute('Target')));
  for (const name of [...m.replace_headers, ...m.clear_footers]) if (!files[name] || !referenced.has(name)) throw new Error('Part is absent or not referenced: ' + name);
  for (const [name, bytes] of Object.entries(files)) if (/^(docProps\/|word\/(media|embeddings)\/)/.test(name) && m.preserved_parts_review[name] !== await sha256(bytes)) throw new Error('Retained metadata/media needs hash-bound review: ' + name);
  for (const name of Object.keys(m.preserved_parts_review)) if (!files[name] || m.preserved_parts_review[name] !== await sha256(files[name])) throw new Error('Stale part review: ' + name);
  m.replace_headers.forEach((name, index) => { files[name] = header({ header_text: '', theme_color: null, logo_data: null }, false, index); delete files[relPath(name)]; });
  m.clear_footers.forEach(name => { files[name] = strToU8(`<w:ftr xmlns:w="${W}"><w:p/></w:ftr>`); delete files[relPath(name)]; });
  for (const removed of m.remove_parts ?? []) {
    if (!files[removed] || !m.preserved_parts_review[removed]) throw new Error('Removal needs exact hash review');
    for (const [name, bytes] of Object.entries(files)) if (name.endsWith('.rels')) {
      const rels = parse(bytes);
      const directory = name === '_rels/.rels' ? '' : name.slice(0,name.lastIndexOf('/_rels/')+1);
      let changed = false;
      for (const rel of Array.from(rels.getElementsByTagNameNS(R, 'Relationship'))) {
        if (rel.getAttribute('TargetMode') === 'External') continue;
        const target = decodeURIComponent(new URL(rel.getAttribute('Target') ?? '', 'https://package.invalid/'+directory).pathname.slice(1));
        if (target !== removed) continue;
        if (name === '_rels/.rels' && removed.startsWith('docProps/')) { rel.parentNode!.removeChild(rel); changed = true; }
        else throw new Error('Cannot remove referenced media: '+removed);
      }
      if (changed) files[name] = serialize(rels);
    }
    delete files[removed];
    const types = parse(files['[Content_Types].xml']);
    for (const entry of Array.from(types.getElementsByTagNameNS(CT,'Override'))) if (entry.getAttribute('PartName') === '/'+removed) entry.parentNode!.removeChild(entry);
    files['[Content_Types].xml'] = serialize(types);
  }
  if (m.theme_style_ids.length) {
    if (!files['word/styles.xml']) throw new Error('Missing styles');
    const styles = parse(files['word/styles.xml']);
    for (const id of m.theme_style_ids) if (!Array.from(styles.getElementsByTagNameNS(W, 'style')).some(e => e.getAttributeNS(W, 'styleId') === id)) throw new Error('Unknown theme style: ' + id);
  }
  files[META] = strToU8(JSON.stringify(m));
  ensureContentType(files, META, 'application/json');
  return zipSync(files, { level: 6, mtime: new Date('2000-01-01T00:00:00Z') });
}
export async function personalizeTemplate(template: Uint8Array, b: Branding, expected: { template_sha256: string; template_source_sha256: string; template_review_ref: string }) {
  if (!SHA.test(expected.template_sha256) || await sha256(template) !== expected.template_sha256) throw new Error('Template hash mismatch');
  const files = unpack(template);
  if (!files[META]) throw new Error('Not a reviewed template');
  const m = JSON.parse(strFromU8(files[META])) as Manifest; validateManifest(m);
  if (m.source_sha256 !== expected.template_source_sha256 || m.review_ref !== expected.template_review_ref) throw new Error('Review/source mismatch');
  const logo = validateBranding(b);
  m.replace_headers.forEach((name, index) => {
    if (!files[name]) throw new Error('Missing approved header');
    files[name] = header(b, Boolean(logo), index);
    if (logo) files[relPath(name)] = strToU8(`<Relationships xmlns="${R}"><Relationship Id="rIdVerticeLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/vertice-branding-logo.png"/></Relationships>`);
    else delete files[relPath(name)];
  });
  if (logo) { files[LOGO] = logo; ensureContentType(files, LOGO, 'image/png'); }
  if (b.theme_color && m.theme_style_ids.length) {
    const doc = parse(files['word/styles.xml']);
    for (const id of m.theme_style_ids) {
      const style = Array.from(doc.getElementsByTagNameNS(W, 'style')).find(e => e.getAttributeNS(W, 'styleId') === id);
      if (!style) throw new Error('Missing approved style');
      let rPr = Array.from(style.childNodes).find(e => e.nodeType === 1 && e.localName === 'rPr');
      if (!rPr) {
        rPr = doc.createElementNS(W, 'w:rPr');
        const next = Array.from(style.childNodes).find(e => e.nodeType === 1 && ['tblPr','trPr','tcPr','tblStylePr'].includes(e.localName ?? ''));
        style.insertBefore(rPr, next ?? null);
      }
      const oldColors = Array.from(rPr.childNodes).filter(e => e.nodeType === 1 && e.localName === 'color');
      oldColors.forEach(e => rPr!.removeChild(e));
      const shading = Array.from(style.getElementsByTagNameNS(W, 'shd'));
      for (const fill of shading) {
        for (const attribute of ['themeFill','themeFillTint','themeFillShade']) fill.removeAttributeNS(W, attribute);
        fill.setAttributeNS(W, 'w:fill', b.theme_color.slice(1).toUpperCase());
        fill.setAttributeNS(W, 'w:val', 'clear');
      }
      // On a themed fill, choose black/white by relative luminance; otherwise darken on white.
      const channels = b.theme_color.slice(1).match(/../g)!.map(v => parseInt(v,16)/255).map(v => v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
      const lum = channels.reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const foreground = shading.length ? (lum > .179 ? '000000' : 'FFFFFF') : textColor(b.theme_color);
      const color = doc.createElementNS(W, 'w:color'); color.setAttributeNS(W, 'w:val', foreground); rPr.appendChild(color);
    }
    files['word/styles.xml'] = serialize(doc);
  }
  // Always derives a fresh archive from the immutable reviewed template.
  return zipSync(files, { level: 6, mtime: new Date('2000-01-01T00:00:00Z') });
}
