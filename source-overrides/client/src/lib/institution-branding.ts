export type InstitutionBranding = { header_text: string; theme_color: string | null; logo_data: string | null };
export const EMPTY_BRANDING: InstitutionBranding = { header_text: '', theme_color: null, logo_data: null };
export const HEX = /^#[0-9a-f]{6}$/i;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export function luminance(hex: string) {
  const c = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
export function contrast(a: string, b = '#FFFFFF') {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + .05) / (low + .05);
}
export function textColor(color: string | null) {
  let rgb = (color && HEX.test(color) ? color : '#222222').slice(1).match(/../g)!.map(v => parseInt(v, 16));
  const hex = () => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  while (contrast(hex()) < 4.5) rgb = rgb.map(v => Math.floor(v * .95));
  return hex();
}
export function validateBranding(value: InstitutionBranding) {
  if ([...value.header_text].length > 600 || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value.header_text)) throw new Error('Use até 600 caracteres válidos no cabeçalho.');
  if (value.theme_color !== null && !HEX.test(value.theme_color)) throw new Error('Informe a cor no formato #RRGGBB.');
  if (value.logo_data !== null && (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.logo_data) || value.logo_data.length > 2800000)) throw new Error('Logo PNG inválida.');
  return { ...value, theme_color: value.theme_color?.toUpperCase() ?? null };
}
export function suggestColor(pixels: Uint8ClampedArray): string | null {
  const bins = new Map<string, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = pixels.slice(i, i + 4);
    if (a < 128 || Math.min(r, g, b) > 240 || Math.max(r, g, b) < 20) continue;
    const key = [r, g, b].map(v => Math.min(255, Math.round(v / 32) * 32).toString(16).padStart(2, '0')).join('');
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  const winner = [...bins].sort((a, b) => b[1] - a[1])[0];
  return winner ? '#' + winner[0].toUpperCase() : null;
}
export function imageDimensions(bytes: Uint8Array, png: boolean): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (png) {
    if (bytes.length < 33) throw new Error('PNG incompleto.');
    return [view.getUint32(16), view.getUint32(20)];
  }
  for (let offset = 2; offset + 9 < bytes.length;) {
    if (bytes[offset++] !== 255) break;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xD9 || marker === 0xDA) break;
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue;
    const size = view.getUint16(offset);
    if (size < 2 || offset + size > bytes.length) break;
    if ([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker)) return [view.getUint16(offset+5),view.getUint16(offset+3)];
    offset += size;
  }
  throw new Error('Dimensões JPEG inválidas.');
}
export async function normalizeLogo(file: File): Promise<{ data: string; suggested: string | null }> {
  if (!['image/png', 'image/jpeg'].includes(file.type) || !file.size || file.size > MAX_LOGO_BYTES) throw new Error('Selecione PNG ou JPEG de até 2 MB. SVG não é aceito.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!(file.type === 'image/png' ? png : jpeg)) throw new Error('O conteúdo não corresponde a uma imagem PNG/JPEG.');
  const [width, height] = imageDimensions(bytes, png);
  if (!width || !height || width * height > 40000000) throw new Error('Imagem muito grande ou inválida.');
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000) throw new Error('Imagem muito grande ou inválida.');
    const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 120;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Não foi possível preparar a logo.');
    const scale = Math.min(300 / bitmap.width, 120 / bitmap.height);
    const w = bitmap.width * scale, h = bitmap.height * scale;
    ctx.drawImage(bitmap, (300 - w) / 2, (120 - h) / 2, w, h);
    return { data: canvas.toDataURL('image/png'), suggested: suggestColor(ctx.getImageData(0, 0, 300, 120).data) };
  } finally { bitmap.close(); }
}
/** Each load/save/image operation captures a generation; obsolete responses cannot publish. */
export function responseGate() {
  let generation = 0;
  return { invalidate: () => { generation++; }, ticket: () => { const current = ++generation; return () => current === generation; } };
}
