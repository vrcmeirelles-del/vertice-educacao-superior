/**
 * certificate-pdf.ts — Certificados de Extensão e de Atividades de Ensino emitidos pelo banco.
 * O PDF só imprime o que o banco registrou (nome, atividade, carga, período, signatário e código);
 * o QR leva à verificação pública. Nada é calculado ou redigido aqui além da frase-padrão.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';

export type CertificateKind = 'extensao' | 'ensino';
export type CertificateData = {
  code: string; holderName: string; activityTitle: string; minutes: number;
  periodStart: string | null; periodEnd: string | null; issuedAt: string; signerName: string; signerRole: string;
};
export const VERIFY_BASE = 'https://www.verticesuperior.com.br/verificar-certificado';
export const verifyUrl = (code: string) => `${VERIFY_BASE}?codigo=${encodeURIComponent(code)}`;

/** 840 min -> "14 horas"; 150 min -> "2 horas e 30 minutos"; 30 min -> "30 minutos". */
export function cargaHoraria(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  const hs = h === 1 ? '1 hora' : `${h} horas`, ms = m === 1 ? '1 minuto' : `${m} minutos`;
  return h && m ? `${hs} e ${ms}` : h ? hs : ms;
}
const data = (iso: string | null) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
/** Período por extenso, sem inventar datas ausentes. */
export function periodo(start: string | null, end: string | null): string {
  if (start && end && start.slice(0, 10) !== end.slice(0, 10)) return `no período de ${data(start)} a ${data(end)}`;
  if (start || end) return `em ${data(start ?? end)}`;
  return '';
}
export function fraseCertificado(kind: CertificateKind, c: CertificateData, institution: string): string {
  const what = kind === 'extensao' ? `do projeto de extensão "${c.activityTitle}"` : `da atividade de ensino "${c.activityTitle}"`;
  const when = periodo(c.periodStart, c.periodEnd);
  return `Certificamos que ${c.holderName} participou ${what}, promovido por ${institution}${when ? ', ' + when : ''}, com carga horária de ${cargaHoraria(c.minutes)}.`;
}
// Helvetica padrão usa WinAnsi: troca o que não cabe nela (aspas tipográficas, travessão etc.).
const safe = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/[^\x20-\x7E -ÿ]/g, '');

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []; let cur = '';
  for (const w of text.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
function center(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = rgb(0.1, 0.16, 0.25)) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

export async function buildCertificatesPdf(input: { kind: CertificateKind; institution: string; certificates: CertificateData[] }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.certificates.length === 1 ? `Certificado ${input.certificates[0].code}` : 'Certificados');
  doc.setProducer('Vértice'); doc.setCreator('Vértice');
  const regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 841.89, H = 595.28, azul = rgb(0.12, 0.31, 0.56);
  for (const c of input.certificates) {
    const page = doc.addPage([W, H]);
    page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: azul, borderWidth: 2 });
    center(page, safe(input.institution.toUpperCase()), H - 90, bold, 14, azul);
    center(page, 'CERTIFICADO', H - 150, bold, 34);
    let y = H - 220;
    for (const line of wrap(safe(fraseCertificado(input.kind, c, input.institution)), regular, 15, W - 220)) { center(page, line, y, regular, 15); y -= 22; }
    center(page, safe(`Emitido em ${data(c.issuedAt)}.`), y - 14, regular, 11, rgb(0.3, 0.37, 0.45));
    const sy = 150;
    page.drawLine({ start: { x: W / 2 - 150, y: sy }, end: { x: W / 2 + 150, y: sy }, thickness: 0.8, color: rgb(0.2, 0.2, 0.2) });
    center(page, safe(c.signerName), sy - 18, bold, 12);
    center(page, safe(c.signerRole), sy - 34, regular, 11);
    const qr = await doc.embedPng(await QRCode.toDataURL(verifyUrl(c.code), { width: 240, margin: 0, errorCorrectionLevel: 'M' }));
    page.drawImage(qr, { x: W - 150, y: 52, width: 90, height: 90 });
    page.drawText(`Código de verificação: ${c.code}`, { x: 56, y: 70, size: 10, font: bold, color: azul });
    page.drawText(safe(`Confira a autenticidade em ${VERIFY_BASE}`), { x: 56, y: 54, size: 9, font: regular, color: rgb(0.3, 0.37, 0.45) });
  }
  return doc.save();
}
