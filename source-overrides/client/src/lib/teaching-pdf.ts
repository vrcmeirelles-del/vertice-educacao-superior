/**
 * teaching-pdf.ts — PDF unificado (Projeto + Relatório) para Atividades de Ensino.
 * Layout com tabelas, logo da IES, espaçamento limpo.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

type Activity = Record<string, unknown>;
type Student = { student_name: string; enrollment_code: string | null; participant_role: string | null; minutes: number | null };

const TYPES: Record<string, string> = {
  evento: 'Evento formativo: palestra, seminario ou minicurso', pratica: 'Pratica, oficina ou laboratorio',
  monitoria: 'Monitoria, tutoria ou grupo de estudos', visita: 'Visita tecnica',
  avaliacao: 'Simulado ou resolucao de questoes', estudo: 'Estudo de caso, projeto ou producao academica', outra: 'Outra atividade de ensino',
};
const ORGANIZERS: Record<string, string> = { docente: 'Docente', discente: 'Estudantes', coordenacao: 'Coordenacao', outro: 'Outro' };
const ODS = [
  'Erradicacao da pobreza', 'Fome zero', 'Saude e bem-estar', 'Educacao de qualidade', 'Igualdade de genero',
  'Agua potavel', 'Energia limpa', 'Trabalho decente', 'Industria e inovacao', 'Reducao das desigualdades',
  'Cidades sustentaveis', 'Consumo responsavel', 'Acao climatica', 'Vida na agua', 'Vida terrestre',
  'Paz e justica', 'Parcerias',
];

function fmtDate(date?: string | null) { return date ? date.split('-').reverse().join('/') : ''; }
function s(v: unknown) { return String(v ?? '').trim(); }
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

const W = 595.28, H = 841.89, ML = 50, MR = 50, CW = W - ML - MR;
const LABEL_W = 160;
const NAVY = rgb(.09, .15, .22);
const DARK = rgb(.15, .18, .22);
const MUTED = rgb(.45, .48, .52);
const ACCENT = rgb(.12, .28, .50);
const LINE = rgb(.80, .83, .87);
const HDR_BG = rgb(.12, .28, .50);
const HDR_FG = rgb(1, 1, 1);
const ZEBRA = rgb(.95, .96, .97);

export async function buildTeachingPdf(input: TeachingPdfInput): Promise<Uint8Array> {
  const { activity: a, institutionName, courseName, students, goalTitle, evidenceTitle, author, logoBytes } = input;
  const pdf = await PDFDocument.create();
  const R = await pdf.embedFont(StandardFonts.Helvetica);
  const B = await pdf.embedFont(StandardFonts.HelveticaBold);

  const safe = (t: string) => Array.from(String(t).normalize('NFC')).map(c => { try { R.encodeText(c); return c; } catch { return '?'; } }).join('');

  let pg: PDFPage = pdf.addPage([W, H]);
  let y = H - 55;
  const newPg = () => { pg = pdf.addPage([W, H]); y = H - 55; };
  const need = (n: number) => { if (y < n + 60) newPg(); };

  // ── wrap helper: returns lines ──
  const wrap = (text: string, font: PDFFont, size: number, maxW: number): string[] => {
    const result: string[] = [];
    for (const para of safe(text).split(/\r?\n/)) {
      if (!para.trim()) { result.push(''); continue; }
      let cur = '';
      for (const word of para.split(/\s+/)) {
        const try_ = cur ? cur + ' ' + word : word;
        if (font.widthOfTextAtSize(try_, size) <= maxW) { cur = try_; }
        else { if (cur) result.push(cur); cur = word; }
      }
      if (cur) result.push(cur);
    }
    return result.length ? result : [''];
  };

  // ── draw wrapped text ──
  const drawText = (text: string, x: number, maxW: number, size: number, font: PDFFont, color = DARK) => {
    for (const line of wrap(text, font, size, maxW)) {
      need(size + 6);
      pg.drawText(line, { x, y, size, font, color });
      y -= size + 6;
    }
  };

  // ── section header bar ──
  const header = (title: string) => {
    need(36);
    y -= 12;
    pg.drawRectangle({ x: ML, y: y - 6, width: CW, height: 24, color: HDR_BG });
    pg.drawText(safe(title.toUpperCase()), { x: ML + 10, y: y - 1, size: 10, font: B, color: HDR_FG });
    y -= 32;
  };

  // ── table row (label | value) ──
  let rowIdx = 0;
  const tRow = (label: string, value: string) => {
    if (!value) return;
    const lines = wrap(value, R, 9, CW - LABEL_W - 20);
    const rowH = Math.max(20, lines.length * 14 + 8);
    need(rowH);
    // zebra
    if (rowIdx % 2 === 0) pg.drawRectangle({ x: ML, y: y - rowH + 14, width: CW, height: rowH, color: ZEBRA });
    // bottom border
    pg.drawLine({ start: { x: ML, y: y - rowH + 14 }, end: { x: ML + CW, y: y - rowH + 14 }, thickness: .5, color: LINE });
    // vertical separator
    pg.drawLine({ start: { x: ML + LABEL_W, y: y + 14 }, end: { x: ML + LABEL_W, y: y - rowH + 14 }, thickness: .5, color: LINE });
    // label
    pg.drawText(safe(label), { x: ML + 8, y: y - 1, size: 8.5, font: B, color: ACCENT });
    // value lines
    lines.forEach((ln, i) => pg.drawText(ln, { x: ML + LABEL_W + 10, y: y - 1 - i * 14, size: 9, font: R, color: DARK }));
    y -= rowH - 14;
    rowIdx++;
  };

  // ── text block (label above, text below) ──
  const tBlock = (label: string, value: string) => {
    if (!value) return;
    need(50);
    y -= 8;
    pg.drawText(safe(label.toUpperCase()), { x: ML + 8, y, size: 8, font: B, color: ACCENT });
    y -= 4;
    pg.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: .5, color: LINE });
    y -= 14;
    drawText(value, ML + 8, CW - 16, 9, R, DARK);
    y -= 8;
  };

  // ── signature row ──
  const sig = (label: string) => {
    need(50);
    pg.drawLine({ start: { x: ML, y: y + 4 }, end: { x: ML + CW, y: y + 4 }, thickness: .5, color: LINE });
    y -= 2;
    pg.drawText(safe(label), { x: ML + 8, y, size: 9, font: B, color: DARK });
    y -= 18;
    pg.drawText('Assinatura: ________________________________', { x: ML + 8, y, size: 8, font: R, color: MUTED });
    pg.drawText('Data: ____/____/______', { x: ML + 320, y, size: 8, font: R, color: MUTED });
    y -= 22;
  };

  const phase = s(a.report_phase) || 'projeto';
  const isReport = phase === 'relatorio' || phase === 'finalizado';

  // ════════════════════════════════════════════
  // CAPA
  // ════════════════════════════════════════════

  if (logoBytes?.length) {
    try {
      const isPng = logoBytes[0] === 0x89 && logoBytes[1] === 0x50;
      const img = isPng ? await pdf.embedPng(logoBytes) : await pdf.embedJpg(logoBytes);
      const sc = Math.min(90 / img.width, 90 / img.height);
      const iw = img.width * sc, ih = img.height * sc;
      pg.drawImage(img, { x: (W - iw) / 2, y: y - ih, width: iw, height: ih });
      y -= ih + 16;
    } catch { /* skip logo */ }
  }

  pg.drawText(safe(institutionName.toUpperCase()), { x: ML, y, size: 15, font: B, color: ACCENT });
  y -= 22;
  pg.drawText(safe(courseName), { x: ML, y, size: 11, font: R, color: DARK });
  y -= 20;
  pg.drawRectangle({ x: ML, y, width: CW, height: 3, color: ACCENT });
  y -= 24;

  const docTitle = isReport ? 'PROJETO E RELATORIO FINAL DE ATIVIDADE DE ENSINO' : 'PROJETO DE ATIVIDADE DE ENSINO';
  pg.drawText(safe(docTitle), { x: ML, y, size: 13, font: B, color: NAVY });
  y -= 24;
  pg.drawText(safe(s(a.title)), { x: ML, y, size: 12, font: B, color: DARK });
  y -= 22;
  pg.drawText(safe(`Responsavel: ${author}`), { x: ML, y, size: 8, font: R, color: MUTED });
  y -= 14;
  pg.drawText(safe(`Emissao: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`), { x: ML, y, size: 8, font: R, color: MUTED });
  y -= 14;
  pg.drawText(safe(`Fase: ${phase === 'projeto' ? 'Projeto' : phase === 'relatorio' ? 'Relatorio em edicao' : 'Finalizado'}`), { x: ML, y, size: 8, font: R, color: MUTED });
  y -= 24;

  // ════════════════════════════════════════════
  // DADOS DO PROJETO
  // ════════════════════════════════════════════
  header('Dados do Projeto');
  rowIdx = 0;
  tRow('Titulo', s(a.title));
  tRow('Unidade', s(a.unit_name));
  tRow('Curso(s)', s(a.courses_involved) || courseName);
  tRow('Tipo de atividade', TYPES[s(a.category)] || s(a.category));
  tRow('Quem organizou', ORGANIZERS[s(a.organizer_role)] || s(a.organizer_role));
  tRow('Data', fmtDate(s(a.activity_date)));
  tRow('Carga total', a.total_minutes ? `${a.total_minutes} minutos` : '');
  tRow('Horario', s(a.activity_time));
  tRow('Local', s(a.location));
  tRow('Docente(s)', s(a.teachers_involved));
  tRow('Tecnico(s)', s(a.technicians));
  tRow('Alunos envolvidos', s(a.students_involved_desc));

  // QUANTIDADES
  if (a.qty_students || a.qty_technicians || a.qty_teachers) {
    header('Pessoas Envolvidas');
    rowIdx = 0;
    tRow('Alunos', String(num(a.qty_students)));
    tRow('Tecnicos', String(num(a.qty_technicians)));
    tRow('Professores', String(num(a.qty_teachers)));
  }

  tRow('Parcerias', s(a.partnerships));
  tRow('Presenca', s(a.attendance_method));
  if (a.proposed_budget || a.approved_budget) {
    tRow('Valor proposto', money(a.proposed_budget));
    tRow('Valor aprovado', money(a.approved_budget));
  }

  // OBJETIVOS
  tBlock('Objetivo geral', s(a.general_objective));
  tBlock('Objetivos especificos', s(a.specific_objectives));
  tBlock('Programacao detalhada', s(a.schedule_detail));

  // INFRAESTRUTURA
  header('Infraestrutura, Avaliacao e Publico');
  rowIdx = 0;
  tRow('Infraestrutura', s(a.infrastructure));
  tRow('Avaliacao', s(a.evaluation_methods));
  tRow('Publico-alvo', s(a.target_audience));

  // DIVULGAÇÃO
  header('Divulgacao');
  rowIdx = 0;
  tRow('Alcance', s(a.marketing_scope));
  tRow('Canais', s(a.marketing_channels));

  // VÍNCULOS
  if (goalTitle || evidenceTitle || a.ods_goal || a.exam_module) {
    header('Vinculos Institucionais');
    rowIdx = 0;
    if (goalTitle) tRow('Meta do PDI', goalTitle);
    if (evidenceTitle) tRow('Evidencia (Mesa Digital)', evidenceTitle);
    if (a.exam_module) tRow('Exame/carreira', s(a.exam_module));
    if (a.ods_goal) tRow(`ODS ${a.ods_goal}`, `${ODS[num(a.ods_goal) - 1] || ''} - ${s(a.ods_rationale)}`);
  }

  // ════════════════════════════════════════════
  // PARTICIPANTES (tabela)
  // ════════════════════════════════════════════
  if (students.length) {
    header(`Participantes (${students.length})`);
    // col header
    need(22);
    pg.drawRectangle({ x: ML, y: y - 6, width: CW, height: 20, color: ACCENT });
    const cx = [ML + 8, ML + 230, ML + 345, ML + 420];
    ['Nome', 'Matricula', 'Papel', 'Minutos'].forEach((h, i) =>
      pg.drawText(safe(h), { x: cx[i], y: y - 2, size: 8, font: B, color: HDR_FG }));
    y -= 24;

    students.forEach((st, i) => {
      need(18);
      if (i % 2 === 0) pg.drawRectangle({ x: ML, y: y - 4, width: CW, height: 16, color: ZEBRA });
      pg.drawText(safe(st.student_name.slice(0, 38)), { x: cx[0], y, size: 8, font: R, color: DARK });
      pg.drawText(safe(st.enrollment_code || '-'), { x: cx[1], y, size: 8, font: R, color: DARK });
      pg.drawText(safe(st.participant_role === 'organizador' ? 'Org.' : 'Part.'), { x: cx[2], y, size: 8, font: R, color: DARK });
      pg.drawText(safe(st.minutes != null ? String(st.minutes) : '-'), { x: cx[3], y, size: 8, font: R, color: DARK });
      y -= 16;
    });
    y -= 10;
  }

  // ════════════════════════════════════════════
  // RELATÓRIO FINAL
  // ════════════════════════════════════════════
  if (isReport) {
    header('Relatorio Final');
    tBlock('Apresentacao do projeto executado', s(a.report_presentation));
    tBlock('Resultados alcancados', s(a.report_results));
    tBlock('Envolvimento dos participantes', s(a.report_engagement));
    if (a.report_budget_staff || a.report_budget_materials) {
      rowIdx = 0;
      tRow('Investido: pessoal', money(a.report_budget_staff));
      tRow('Investido: materiais', money(a.report_budget_materials));
    }
    tRow('Materiais', s(a.report_materials_desc));
    tRow('Divulgacao efetiva', s(a.report_dissemination));
    tBlock('Agradecimentos', s(a.report_thanks));
    tBlock('Consideracoes finais', s(a.final_remarks));
  }

  // ════════════════════════════════════════════
  // ANEXOS
  // ════════════════════════════════════════════
  const photos = Array.isArray(a.evidence_photos) ? a.evidence_photos as { name: string }[] : [];
  const attend = Array.isArray(a.evidence_attendance) ? a.evidence_attendance as { name: string }[] : [];
  const clips = Array.isArray(a.evidence_clippings) ? a.evidence_clippings as { name: string }[] : [];
  const sheet = s(a.roster_spreadsheet_name);
  const hasAtt = photos.length > 0 || attend.length > 0 || clips.length > 0 || !!sheet;

  if (hasAtt) {
    header('Anexos');
    rowIdx = 0;
    if (photos.length) tRow('Registro fotografico', photos.map((f, i) => `${i + 1}. ${f.name}`).join(' | '));
    if (attend.length) tRow('Listas de frequencia', attend.map((f, i) => `${i + 1}. ${f.name}`).join(' | '));
    if (clips.length) tRow('Clipagens', clips.map((f, i) => `${i + 1}. ${f.name}`).join(' | '));
    if (sheet) tRow('Planilha conciliacao AC', sheet);
    y -= 8;
    drawText('Arquivos originais permanecem no portal. Este PDF lista as referencias.', ML + 8, CW - 16, 7, R, MUTED);
  }

  // ════════════════════════════════════════════
  // APROVAÇÕES
  // ════════════════════════════════════════════
  header('Aprovacoes');
  sig('Coordenador do Curso');
  sig('Diretor da Unidade');
  if (isReport) sig('Recebimento do Relatorio');

  // ── Rodapé ──
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const { width } = p.getSize();
    p.drawText(`Vertice Educacao Superior | ${i + 1}/${pages.length}`, {
      x: Math.max(10, width - 200), y: 20, size: 7, font: R, color: MUTED,
    });
  });

  pdf.setTitle(s(a.title) || 'Atividade de Ensino');
  pdf.setAuthor(author);
  pdf.setSubject('Projeto e relatorio - Atividades de Ensino');
  pdf.setLanguage('pt-BR');
  return pdf.save();
}
