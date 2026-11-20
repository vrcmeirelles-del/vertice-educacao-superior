import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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

function displayDate(date?: string | null) {
  return date ? date.split('-').reverse().join('/') : 'Não informado';
}

export interface TeachingPdfInput {
  activity: Activity;
  institutionName: string;
  courseName: string;
  students: Student[];
  goalTitle?: string;
  evidenceTitle?: string;
  author: string;
}

export async function buildTeachingPdf(input: TeachingPdfInput): Promise<Uint8Array> {
  const { activity: a, institutionName, courseName, students, goalTitle, evidenceTitle, author } = input;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = (s: string) => Array.from(String(s || '').normalize('NFC')).map(c => { try { font.encodeText(c); return c; } catch { return '?'; } }).join('');
  let page = pdf.addPage([595.28, 841.89]), y = 790;
  const newPage = () => { page = pdf.addPage([595.28, 841.89]); y = 790; };
  const line = (s: string, heading = false) => {
    const face = heading ? bold : font, size = heading ? 12 : 10;
    for (const p of safe(s).split(/\r?\n/)) {
      let current = '';
      const emit = () => { if (y < 65) newPage(); page.drawText(current, { x: 52, y, size, font: face, color: rgb(.10, .16, .24) }); y -= 15; current = ''; };
      for (const word of p.split(/\s+/)) {
        const candidate = current ? current + ' ' + word : word;
        if (face.widthOfTextAtSize(candidate, size) <= 490) { current = candidate; continue; }
        if (current) emit();
        if (face.widthOfTextAtSize(word, size) <= 490) { current = word; continue; }
        for (const char of word) { if (face.widthOfTextAtSize(current + char, size) > 490) emit(); current += char; }
      }
      emit();
    }
    y -= 5;
  };
  const field = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return;
    line(label, true);
    line(String(value));
  };
  const phase = String(a.report_phase || 'projeto');
  const isReport = phase === 'relatorio' || phase === 'finalizado';

  // === CAPA ===
  line('VERTICE | ATIVIDADES DE ENSINO', true);
  line(isReport ? 'PROJETO E RELATORIO FINAL' : 'PROJETO DA ATIVIDADE', true);
  y -= 10;
  line(String(a.title || 'Sem titulo'), true);
  line(`${institutionName} | ${courseName}`);
  line(`Fase: ${phase === 'projeto' ? 'Projeto' : phase === 'relatorio' ? 'Relatorio em edicao' : 'Finalizado'}`);
  line(`Responsavel pelo envio: ${author}`);
  line(`Emissao: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  line('Registro declarado pelo responsavel. Validacao institucional pendente.');
  y -= 15;

  // === SEÇÃO 1: IDENTIFICAÇÃO ===
  line('IDENTIFICACAO E PLANEJAMENTO', true);
  field('Titulo', a.title);
  field('Tipo de atividade', TYPES[String(a.category)] || a.category);
  field('Quem organizou', ORGANIZERS[String(a.organizer_role)] || a.organizer_role);
  field('Data', displayDate(String(a.activity_date || '')));
  field('Carga total (minutos)', a.total_minutes);
  field('Horario', a.activity_time);
  field('Local', a.location);
  field('Descricao', a.description);

  // === SEÇÃO 2: DADOS DO PROJETO ===
  if (y < 130) newPage();
  line('DADOS DO PROJETO', true);
  field('Unidade', a.unit_name);
  field('Curso(s) proponente(s)', a.courses_involved);
  field('Docente(s) participante(s)', a.teachers_involved);
  field('Tecnico(s) envolvido(s)', a.technicians);
  field('Alunos envolvidos', a.students_involved_desc);
  field('Programacao detalhada', a.schedule_detail);
  if (a.qty_students || a.qty_technicians || a.qty_teachers) {
    line('Quantidade de pessoas envolvidas', true);
    line(`Alunos: ${a.qty_students || 0} | Tecnicos: ${a.qty_technicians || 0} | Professores: ${a.qty_teachers || 0}`);
  }
  field('Parcerias e forma de apoio', a.partnerships);
  field('Modo de confirmacao de presenca', a.attendance_method);
  if (a.proposed_budget || a.approved_budget) {
    line('Orcamento', true);
    line(`Proposto: R$ ${Number(a.proposed_budget || 0).toFixed(2)} | Aprovado: R$ ${Number(a.approved_budget || 0).toFixed(2)}`);
  }

  // === SEÇÃO 3: OBJETIVOS ===
  if (y < 130) newPage();
  line('OBJETIVOS', true);
  field('Objetivo geral', a.general_objective);
  field('Objetivos especificos', a.specific_objectives);

  // === SEÇÃO 4: INFRAESTRUTURA E AVALIAÇÃO ===
  field('Infraestrutura', a.infrastructure);
  field('Formas de avaliacao', a.evaluation_methods);
  field('Publico-alvo', a.target_audience);
  field('Divulgacao: alcance', a.marketing_scope);
  field('Divulgacao: canais', a.marketing_channels);

  // === SEÇÃO 5: VÍNCULOS ===
  if (y < 130) newPage();
  line('VINCULOS E COMPROVACAO', true);
  if (goalTitle) field('Meta do PDI', goalTitle);
  if (evidenceTitle) field('Evidencia da Mesa Digital', evidenceTitle);
  if (a.ods_goal) {
    field(`ODS ${a.ods_goal}: ${ODS[Number(a.ods_goal) - 1] || ''}`, a.ods_rationale);
  }
  if (a.exam_module) field('Exame ou carreira', a.exam_module);

  // === SEÇÃO 6: PARTICIPANTES ===
  if (students.length) {
    if (y < 130) newPage();
    line('ORGANIZADORES E PARTICIPANTES', true);
    line(`Total: ${students.length} estudante(s)`);
    y -= 5;
    for (const s of students) {
      if (y < 65) newPage();
      const role = s.participant_role === 'organizador' ? 'Organizacao' : 'Participacao';
      line(`${s.student_name}${s.enrollment_code ? ' | Matricula: ' + s.enrollment_code : ''} | ${role} | ${s.minutes ?? '-'} min`);
    }
  }

  // === SEÇÃO 7: RELATÓRIO (só se fase != projeto) ===
  if (isReport) {
    if (y < 130) newPage();
    line('RELATORIO FINAL', true);
    field('Apresentacao do projeto executado', a.report_presentation);
    field('Resultados alcancados', a.report_results);
    field('Envolvimento dos participantes', a.report_engagement);
    if (a.report_budget_staff || a.report_budget_materials) {
      line('Valor investido', true);
      line(`Pessoal: R$ ${Number(a.report_budget_staff || 0).toFixed(2)} | Materiais: R$ ${Number(a.report_budget_materials || 0).toFixed(2)}`);
    }
    field('Descricao dos materiais', a.report_materials_desc);
    field('Divulgacao efetiva', a.report_dissemination);
    field('Agradecimentos', a.report_thanks);
    field('Consideracoes finais', a.final_remarks);
  }

  // === ANEXOS (referências) ===
  const photos = Array.isArray(a.evidence_photos) ? a.evidence_photos as { name: string }[] : [];
  const attendance = Array.isArray(a.evidence_attendance) ? a.evidence_attendance as { name: string }[] : [];
  const clippings = Array.isArray(a.evidence_clippings) ? a.evidence_clippings as { name: string }[] : [];
  const hasAttachments = photos.length || attendance.length || clippings.length || a.roster_spreadsheet_name;

  if (hasAttachments) {
    if (y < 130) newPage();
    line('ANEXOS', true);
    if (photos.length) { line('Registro fotografico:', true); photos.forEach((f, i) => line(`  ${i + 1}. ${f.name}`)); }
    if (attendance.length) { line('Listas de frequencia:', true); attendance.forEach((f, i) => line(`  ${i + 1}. ${f.name}`)); }
    if (clippings.length) { line('Clipagens:', true); clippings.forEach((f, i) => line(`  ${i + 1}. ${f.name}`)); }
    if (a.roster_spreadsheet_name) { line('Planilha de conciliacao:', true); line(`  ${a.roster_spreadsheet_name}`); }
    line('Os arquivos originais permanecem no portal. Este PDF lista as referencias.');
  }

  // === RODAPÉ ===
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const { width } = p.getSize();
    p.drawText(`Vertice | ${i + 1}/${pages.length}`, { x: Math.max(10, width - 115), y: 18, size: 8, font, color: rgb(.35, .4, .45) });
  });

  pdf.setTitle(String(a.title || 'Atividade de Ensino'));
  pdf.setAuthor(author);
  pdf.setSubject('Projeto e relatorio de atividade de ensino');
  pdf.setLanguage('pt-BR');
  return pdf.save();
}
