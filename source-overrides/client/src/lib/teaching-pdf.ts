/**
 * teaching-pdf.ts — Gerador de PDF unificado (Projeto + Relatório) para Atividades de Ensino.
 * Layout com tabelas, logo da IES, e todas as seções dos formulários de projeto e relatório.
 * Usa pdf-lib (client-side, sem servidor).
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

type Activity = Record<string, unknown>;
type Student = { student_name: string; enrollment_code: string | null; participant_role: string | null; minutes: number | null };

const TYPES: Record<string, string> = {
  evento: 'Evento formativo: palestra, seminário ou minicurso', pratica: 'Prática, oficina ou laboratório',
  monitoria: 'Monitoria, tutoria ou grupo de estudos', visita: 'Visita técnica',
  avaliacao: 'Simulado ou resolução de questões', estudo: 'Estudo de caso, projeto ou produção acadêmica', outra: 'Outra atividade de ensino',
};
const ORGANIZERS: Record<string, string> = { docente: 'Docente', discente: 'Estudantes', coordenacao: 'Coordenação', outro: 'Outro' };
const ODS = [
  'Erradicação da pobreza', 'Fome zero', 'Saúde e bem-estar', 'Educação de qualidade', 'Igualdade de gênero',
  'Água potável', 'Energia limpa', 'Trabalho decente', 'Indústria e inovação', 'Redução das desigualdades',
  'Cidades sustentáveis', 'Consumo responsável', 'Ação climática', 'Vida na água', 'Vida terrestre',
  'Paz e justiça', 'Parcerias',
];

function fmtDate(date?: string | null) { return date ? date.split('-').reverse().join('/') : ''; }
function str(v: unknown) { return String(v ?? '').trim(); }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function money(v: unknown) { return `R$ ${num(v).toFixed(2).replace('.', ',')}`; }

export interface TeachingPdfInput {
  activity: Activity;
  institutionName: string;
  courseName: string;
  students: Student[];
  goalTitle?: string;
  evidenceTitle?: string;
  author: string;
  logoBytes?: Uint8Array | null;
}

// ─── PDF Builder ────────────────────────────────────────────────
const PAGE_W = 595.28, PAGE_H = 841.89;
const MARGIN_L = 48, MARGIN_R = 48, CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const NAVY = rgb(.10, .16, .24);
const DARK = rgb(.20, .24, .30);
const MUTED = rgb(.40, .44, .50);
const ACCENT = rgb(.14, .30, .52);
const LINE_COLOR = rgb(.78, .82, .86);
const HEADER_BG = rgb(.14, .30, .52);
const HEADER_TEXT = rgb(1, 1, 1);
const CELL_BG = rgb(.96, .97, .98);
const WHITE = rgb(1, 1, 1);

class PdfBuilder {
  pdf!: PDFDocument;
  font!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  y = 0;

  async init() {
    this.pdf = await PDFDocument.create();
    this.font = await this.pdf.embedFont(StandardFonts.Helvetica);
    this.bold = await this.pdf.embedFont(StandardFonts.HelveticaBold);
    this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - 50;
  }

  ensureSpace(needed: number) { if (this.y < needed + 50) this.newPage(); }

  safe(s: string) {
    return Array.from(s.normalize('NFC')).map(c => { try { this.font.encodeText(c); return c; } catch { return '?'; } }).join('');
  }

  // ─── Primitives ───

  text(s: string, x: number, maxW: number, size: number, face: PDFFont, color = DARK) {
    const txt = this.safe(s);
    const words = txt.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (face.widthOfTextAtSize(candidate, size) <= maxW) { current = candidate; continue; }
      if (current) { this.page.drawText(current, { x, y: this.y, size, font: face, color }); this.y -= size + 4; }
      current = word;
    }
    if (current) { this.page.drawText(current, { x, y: this.y, size, font: face, color }); this.y -= size + 4; }
  }

  // ─── Section header ───

  sectionHeader(title: string) {
    this.ensureSpace(30);
    this.y -= 8;
    this.page.drawRectangle({ x: MARGIN_L, y: this.y - 4, width: CONTENT_W, height: 22, color: HEADER_BG });
    this.page.drawText(this.safe(title.toUpperCase()), { x: MARGIN_L + 8, y: this.y, size: 10, font: this.bold, color: HEADER_TEXT });
    this.y -= 30;
  }

  // ─── Table row (label: value) ───

  tableRow(label: string, value: string, shade = false) {
    if (!value) return;
    const lineH = 16;
    // Wrap value text
    const maxValW = CONTENT_W - 160;
    const valWords = this.safe(value).split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of valWords) {
      const c = cur ? cur + ' ' + w : w;
      if (this.font.widthOfTextAtSize(c, 9) <= maxValW) { cur = c; continue; }
      if (cur) lines.push(cur);
      cur = w;
    }
    if (cur) lines.push(cur);
    if (!lines.length) lines.push('');

    const rowH = Math.max(lineH, lines.length * 13 + 6);
    this.ensureSpace(rowH);

    if (shade) {
      this.page.drawRectangle({ x: MARGIN_L, y: this.y - rowH + 12, width: CONTENT_W, height: rowH, color: CELL_BG });
    }
    // Border bottom
    this.page.drawLine({ start: { x: MARGIN_L, y: this.y - rowH + 12 }, end: { x: MARGIN_L + CONTENT_W, y: this.y - rowH + 12 }, thickness: 0.5, color: LINE_COLOR });
    // Vertical separator
    this.page.drawLine({ start: { x: MARGIN_L + 155, y: this.y + 12 }, end: { x: MARGIN_L + 155, y: this.y - rowH + 12 }, thickness: 0.5, color: LINE_COLOR });

    this.page.drawText(this.safe(label), { x: MARGIN_L + 6, y: this.y - 2, size: 8.5, font: this.bold, color: ACCENT });
    for (let i = 0; i < lines.length; i++) {
      this.page.drawText(lines[i], { x: MARGIN_L + 162, y: this.y - 2 - i * 13, size: 9, font: this.font, color: DARK });
    }
    this.y -= rowH - 12;
  }

  // ─── Multi-line text block ───

  textBlock(label: string, value: string) {
    if (!value) return;
    this.ensureSpace(40);
    this.y -= 4;
    this.page.drawText(this.safe(label), { x: MARGIN_L + 6, y: this.y, size: 8.5, font: this.bold, color: ACCENT });
    this.y -= 14;
    this.page.drawLine({ start: { x: MARGIN_L, y: this.y + 10 }, end: { x: MARGIN_L + CONTENT_W, y: this.y + 10 }, thickness: 0.5, color: LINE_COLOR });
    const paras = value.split(/\r?\n/);
    for (const p of paras) {
      this.text(p || ' ', MARGIN_L + 6, CONTENT_W - 12, 9, this.font, DARK);
    }
    this.y -= 6;
  }

  // ─── Approval/signature row ───

  signatureRow(label: string) {
    this.ensureSpace(40);
    this.page.drawLine({ start: { x: MARGIN_L, y: this.y }, end: { x: MARGIN_L + CONTENT_W, y: this.y }, thickness: 0.5, color: LINE_COLOR });
    this.y -= 14;
    this.page.drawText(this.safe(label), { x: MARGIN_L + 6, y: this.y, size: 9, font: this.bold, color: DARK });
    this.y -= 10;
    this.page.drawText('Assinatura: ____________________________', { x: MARGIN_L + 6, y: this.y, size: 8, font: this.font, color: MUTED });
    this.page.drawText('Data: ____/____/______', { x: MARGIN_L + 310, y: this.y, size: 8, font: this.font, color: MUTED });
    this.y -= 18;
  }

  // ─── Finalize ───

  async finalize(title: string, author: string) {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => {
      const { width } = p.getSize();
      p.drawText(`Vertice Educacao Superior | ${i + 1}/${pages.length}`, { x: Math.max(10, width - 180), y: 18, size: 7, font: this.font, color: MUTED });
    });
    this.pdf.setTitle(title); this.pdf.setAuthor(author);
    this.pdf.setSubject('Projeto e relatorio de atividade de ensino');
    this.pdf.setLanguage('pt-BR');
    return this.pdf.save();
  }
}

// ─── Main export ────────────────────────────────────────────────

export async function buildTeachingPdf(input: TeachingPdfInput): Promise<Uint8Array> {
  const { activity: a, institutionName, courseName, students, goalTitle, evidenceTitle, author, logoBytes } = input;
  const b = new PdfBuilder();
  await b.init();

  const phase = str(a.report_phase) || 'projeto';
  const isReport = phase === 'relatorio' || phase === 'finalizado';

  // ═══ CAPA ═══
  // Logo
  if (logoBytes?.length) {
    try {
      let img;
      // Detect PNG vs JPG
      if (logoBytes[0] === 0x89 && logoBytes[1] === 0x50) img = await b.pdf.embedPng(logoBytes);
      else img = await b.pdf.embedJpg(logoBytes);
      const scale = Math.min(80 / img.width, 80 / img.height);
      const imgW = img.width * scale, imgH = img.height * scale;
      b.page.drawImage(img, { x: (PAGE_W - imgW) / 2, y: b.y - imgH, width: imgW, height: imgH });
      b.y -= imgH + 12;
    } catch { /* logo failed, continue without */ }
  }

  b.page.drawText(b.safe(institutionName.toUpperCase()), { x: MARGIN_L, y: b.y, size: 14, font: b.bold, color: ACCENT });
  b.y -= 20;
  b.page.drawText(b.safe(courseName), { x: MARGIN_L, y: b.y, size: 11, font: b.font, color: DARK });
  b.y -= 24;
  b.page.drawRectangle({ x: MARGIN_L, y: b.y, width: CONTENT_W, height: 2, color: ACCENT });
  b.y -= 20;

  const docTitle = isReport ? 'PROJETO E RELATORIO FINAL DE ATIVIDADE DE ENSINO' : 'PROJETO DE ATIVIDADE DE ENSINO';
  b.page.drawText(b.safe(docTitle), { x: MARGIN_L, y: b.y, size: 13, font: b.bold, color: NAVY });
  b.y -= 22;
  b.page.drawText(b.safe(str(a.title)), { x: MARGIN_L, y: b.y, size: 12, font: b.bold, color: DARK });
  b.y -= 18;
  b.page.drawText(b.safe(`Responsavel: ${author} | Emissao: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`), { x: MARGIN_L, y: b.y, size: 8, font: b.font, color: MUTED });
  b.y -= 10;
  b.page.drawText(b.safe(`Fase: ${phase === 'projeto' ? 'Projeto' : phase === 'relatorio' ? 'Relatorio em edicao' : 'Finalizado'}`), { x: MARGIN_L, y: b.y, size: 8, font: b.font, color: MUTED });
  b.y -= 20;

  // ═══ DADOS DO PROJETO ═══
  b.sectionHeader('Dados do Projeto');
  let shade = false;
  const row = (l: string, v: string) => { b.tableRow(l, v, shade); shade = !shade; };
  row('Titulo da atividade', str(a.title));
  row('Unidade', str(a.unit_name));
  row('Curso(s) proponente(s)', str(a.courses_involved) || courseName);
  row('Tipo de atividade', TYPES[str(a.category)] || str(a.category));
  row('Docente(s) participante(s)', str(a.teachers_involved));
  row('Tecnico(s) envolvido(s)', str(a.technicians));
  row('Periodo / Data', fmtDate(str(a.activity_date)));
  row('Carga horaria', a.total_minutes ? `${a.total_minutes} minutos` : '');
  row('Horario', str(a.activity_time));
  row('Local', str(a.location));

  // Quantidade de pessoas
  if (a.qty_students || a.qty_technicians || a.qty_teachers) {
    b.sectionHeader('Quantidade de Pessoas Envolvidas');
    shade = false;
    row('Alunos', String(num(a.qty_students)));
    row('Tecnicos', String(num(a.qty_technicians)));
    row('Professores', String(num(a.qty_teachers)));
  }

  row('Parcerias / Apoio', str(a.partnerships));
  row('Confirmacao de presenca', str(a.attendance_method));

  if (a.proposed_budget || a.approved_budget) {
    shade = false;
    row('Valor proposto', money(a.proposed_budget));
    row('Valor aprovado', money(a.approved_budget));
  }

  // ═══ OBJETIVO GERAL ═══
  b.textBlock('Objetivo geral', str(a.general_objective));

  // ═══ OBJETIVOS ESPECÍFICOS ═══
  b.textBlock('Objetivos especificos', str(a.specific_objectives));

  // ═══ PROGRAMAÇÃO ═══
  b.textBlock('Programacao detalhada', str(a.schedule_detail));

  // ═══ INFRAESTRUTURA ═══
  b.sectionHeader('Infraestrutura e Avaliacao');
  shade = false;
  row('Infraestrutura', str(a.infrastructure));
  row('Formas de avaliacao', str(a.evaluation_methods));
  row('Publico-alvo', str(a.target_audience));
  row('Alunos envolvidos', str(a.students_involved_desc));

  // ═══ DIVULGAÇÃO ═══
  b.sectionHeader('Divulgacao');
  shade = false;
  row('Alcance', str(a.marketing_scope));
  row('Canais', str(a.marketing_channels));

  // ═══ VÍNCULOS ═══
  if (goalTitle || evidenceTitle || a.ods_goal || a.exam_module) {
    b.sectionHeader('Vinculos Institucionais');
    shade = false;
    if (goalTitle) row('Meta do PDI', goalTitle);
    if (evidenceTitle) row('Evidencia da Mesa Digital', evidenceTitle);
    if (a.exam_module) row('Exame ou carreira', str(a.exam_module));
    if (a.ods_goal) row(`ODS ${a.ods_goal}: ${ODS[num(a.ods_goal) - 1] || ''}`, str(a.ods_rationale));
  }

  // ═══ ORGANIZADORES E PARTICIPANTES ═══
  if (students.length) {
    b.sectionHeader(`Organizadores e Participantes (${students.length})`);
    // Table header
    b.ensureSpace(20);
    b.page.drawRectangle({ x: MARGIN_L, y: b.y - 4, width: CONTENT_W, height: 16, color: ACCENT });
    const cols = [MARGIN_L + 6, MARGIN_L + 220, MARGIN_L + 340, MARGIN_L + 420];
    const headers = ['Nome', 'Matricula', 'Papel', 'Minutos'];
    headers.forEach((h, i) => b.page.drawText(b.safe(h), { x: cols[i], y: b.y, size: 8, font: b.bold, color: WHITE }));
    b.y -= 18;

    students.forEach((s, i) => {
      b.ensureSpace(16);
      if (i % 2 === 0) b.page.drawRectangle({ x: MARGIN_L, y: b.y - 2, width: CONTENT_W, height: 14, color: CELL_BG });
      b.page.drawText(b.safe(s.student_name.slice(0, 35)), { x: cols[0], y: b.y, size: 8, font: b.font, color: DARK });
      b.page.drawText(b.safe(s.enrollment_code || '-'), { x: cols[1], y: b.y, size: 8, font: b.font, color: DARK });
      b.page.drawText(b.safe(s.participant_role === 'organizador' ? 'Organizacao' : 'Participacao'), { x: cols[2], y: b.y, size: 8, font: b.font, color: DARK });
      b.page.drawText(b.safe(s.minutes != null ? String(s.minutes) : '-'), { x: cols[3], y: b.y, size: 8, font: b.font, color: DARK });
      b.y -= 14;
    });
    b.y -= 6;
  }

  // ═══ RELATÓRIO FINAL (só se fase != projeto) ═══
  if (isReport) {
    b.sectionHeader('Relatorio Final');
    b.textBlock('Apresentacao do projeto executado', str(a.report_presentation));
    b.textBlock('Resultados alcancados', str(a.report_results));
    b.textBlock('Envolvimento dos participantes', str(a.report_engagement));

    if (a.report_budget_staff || a.report_budget_materials) {
      shade = false;
      b.tableRow('Valor investido: pessoal', money(a.report_budget_staff), shade); shade = !shade;
      b.tableRow('Valor investido: materiais', money(a.report_budget_materials), shade);
    }
    b.tableRow('Descricao dos materiais', str(a.report_materials_desc), false);
    b.tableRow('Divulgacao efetiva', str(a.report_dissemination), true);
    b.textBlock('Agradecimentos', str(a.report_thanks));
    b.textBlock('Consideracoes finais', str(a.final_remarks));
  }

  // ═══ ANEXOS ═══
  const photos = Array.isArray(a.evidence_photos) ? a.evidence_photos as { name: string }[] : [];
  const attendance = Array.isArray(a.evidence_attendance) ? a.evidence_attendance as { name: string }[] : [];
  const clippings = Array.isArray(a.evidence_clippings) ? a.evidence_clippings as { name: string }[] : [];
  const hasAttachments = photos.length || attendance.length || clippings.length || a.roster_spreadsheet_name;

  if (hasAttachments) {
    b.sectionHeader('Anexos');
    shade = false;
    if (photos.length) {
      b.tableRow('Registro fotografico', photos.map((f, i) => `${i + 1}. ${f.name}`).join('\n'), shade); shade = !shade;
    }
    if (attendance.length) {
      b.tableRow('Listas de frequencia', attendance.map((f, i) => `${i + 1}. ${f.name}`).join('\n'), shade); shade = !shade;
    }
    if (clippings.length) {
      b.tableRow('Clipagens', clippings.map((f, i) => `${i + 1}. ${f.name}`).join('\n'), shade); shade = !shade;
    }
    if (a.roster_spreadsheet_name) {
      b.tableRow('Planilha de conciliacao (AC)', str(a.roster_spreadsheet_name), shade);
    }
    b.y -= 6;
    b.text('Os arquivos originais permanecem no portal. Este PDF lista as referencias.', MARGIN_L + 6, CONTENT_W - 12, 7, b.font, MUTED);
  }

  // ═══ APROVAÇÕES ═══
  b.sectionHeader('Aprovacoes');
  b.signatureRow('Aprovacao do Coordenador do Curso');
  b.signatureRow('Aprovacao do Diretor da Unidade');
  if (isReport) {
    b.signatureRow('Recebimento do Relatorio Pos-Evento');
  }

  return b.finalize(str(a.title) || 'Atividade de Ensino', author);
}
