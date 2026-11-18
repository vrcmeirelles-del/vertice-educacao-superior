export const REPORT_FIELDS = [
  { key: 'event_name', label: 'Nome do evento', limit: 250 },
  { key: 'coordinator', label: 'Coordenador do projeto', limit: 1000 },
  { key: 'teachers', label: 'Docente(s) envolvido(s)', limit: 4000 },
  { key: 'technicians', label: 'Técnico(s) envolvido(s)', limit: 4000 },
  { key: 'presentation', label: 'Apresentação', limit: 30000, help: 'Apresente o projeto executado, a justificativa e os objetivos alcançados. Mínimo de uma folha, a ser conferido no documento formatado pela pessoa responsável pela validação.' },
  { key: 'results', label: 'Resultados alcançados', limit: 20000, help: 'Descreva o envolvimento dos participantes e o desenvolvimento sócio cidadão. Vincule a ata com assinaturas no campo próprio abaixo.' },
  { key: 'acknowledgments', label: 'Agradecimentos', limit: 6000, help: 'Registre os agradecimentos aos apoiadores do projeto.' },
  { key: 'partners_support', label: 'Parceiros e forma de apoio', limit: 6000 },
  { key: 'schedule', label: 'Programação', limit: 10000 },
  { key: 'personnel', label: 'Pessoal', limit: 6000, help: 'Descreva os recursos humanos e as despesas com pessoal.' },
  { key: 'materials', label: 'Materiais', limit: 6000, help: 'Descreva os materiais utilizados e as respectivas despesas.' },
  { key: 'publicity', label: 'Divulgação', limit: 6000, help: 'Descreva os meios de divulgação e as respectivas despesas.' },
] as const;
export type ReportKey = typeof REPORT_FIELDS[number]['key'];
export type TeachingReportDraft = Record<ReportKey | 'investment_amount', string>;
export function readTeachingReport(value: unknown): TeachingReportDraft {
  const report = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries([
    ...REPORT_FIELDS.map(({ key }) => [key, typeof report[key] === 'string' ? report[key] : '']),
    ['investment_amount', typeof report.investment_amount === 'number' ? String(report.investment_amount) : ''],
  ]) as TeachingReportDraft;
}
export function reportPayload(draft: TeachingReportDraft) {
  return { ...Object.fromEntries(REPORT_FIELDS.map(({ key }) => [key, draft[key].trim()])),
    investment_amount: draft.investment_amount.trim() === '' ? null : Number(draft.investment_amount.replace(',', '.')) };
}
export function reportProblems(draft: TeachingReportDraft, final = false, minutesDocument?: string | null) {
  const problems: string[] = [];
  for (const field of REPORT_FIELDS) {
    if (final && !draft[field.key].trim()) problems.push(field.label);
    if (draft[field.key].length > field.limit) problems.push(`${field.label}: limite de ${field.limit.toLocaleString('pt-BR')} caracteres`);
  }
  const amount = draft.investment_amount.trim();
  if ((final && !amount) || (amount && (!/^\d+(?:[.,]\d{1,2})?$/.test(amount) || Number(amount.replace(',', '.')) > 1_000_000_000)))
    problems.push('Valor investido: informe um valor de 0 a 1.000.000.000 com até duas casas decimais');
  if (final && !minutesDocument) problems.push('Ata com assinaturas dos participantes');
  return problems;
}
