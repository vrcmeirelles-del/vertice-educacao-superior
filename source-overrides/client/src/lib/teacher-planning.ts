export type Stage = 'EI' | 'EF' | 'EM';
export const STAGES: { value: Stage; label: string }[] = [
  { value: 'EI', label: 'Educação Infantil' },
  { value: 'EF', label: 'Ensino Fundamental' },
  { value: 'EM', label: 'Ensino Médio' },
];
// Estrutura da BNCC (etapas, anos, componentes, áreas, campos de experiência). Não são códigos de habilidade:
// os códigos e textos vêm do catálogo importado do documento oficial do MEC.
export const YEARS: Record<Stage, string[]> = {
  EI: ['Bebês (0 a 1a6m)', 'Crianças bem pequenas (1a7m a 3a11m)', 'Crianças pequenas (4a a 5a11m)'],
  EF: ['1º ano', '2º ano', '3º ano', '4º ano', '5º ano', '6º ano', '7º ano', '8º ano', '9º ano'],
  EM: ['1ª série', '2ª série', '3ª série'],
};
export const COMPONENTS: Record<Stage, string[]> = {
  EI: ['O eu, o outro e o nós', 'Corpo, gestos e movimentos', 'Traços, sons, cores e formas', 'Escuta, fala, pensamento e imaginação', 'Espaços, tempos, quantidades, relações e transformações'],
  EF: ['Língua Portuguesa', 'Arte', 'Educação Física', 'Língua Inglesa', 'Matemática', 'Ciências', 'Geografia', 'História', 'Ensino Religioso'],
  EM: ['Linguagens e suas Tecnologias', 'Matemática e suas Tecnologias', 'Ciências da Natureza e suas Tecnologias', 'Ciências Humanas e Sociais Aplicadas'],
};
export const COMPONENT_LABEL: Record<Stage, string> = { EI: 'Campo de experiência', EF: 'Componente curricular', EM: 'Área do conhecimento' };
export const PLAN_STATUSES = ['rascunho', 'publicado', 'arquivado'] as const;
export type PlanStatus = typeof PLAN_STATUSES[number];

export interface PlanForm {
  id?: string; stage: Stage; year_label: string; component: string; title: string; period_label: string;
  start_date: string; end_date: string; objectives: string; content: string; methodology: string; resources: string;
  assessment: string; class_id: string; inclusion_case_id: string; inclusion_note: string; status: PlanStatus;
}
export const emptyPlan = (): PlanForm => ({ stage: 'EF', year_label: '', component: '', title: '', period_label: '', start_date: '', end_date: '', objectives: '', content: '', methodology: '', resources: '', assessment: '', class_id: '', inclusion_case_id: '', inclusion_note: '', status: 'rascunho' });

const LIMITS = { objectives: 4000, content: 4000, methodology: 4000, resources: 2000, assessment: 4000, inclusion_note: 1000, period_label: 60, title: 200 } as const;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T12:00:00').getTime());

/** Valida e normaliza. Lança Error com mensagem em português para a tela. */
export function buildPlanPayload(f: PlanForm, institutionId: string): Record<string, unknown> {
  if (!STAGES.some(s => s.value === f.stage)) throw new Error('Escolha a etapa.');
  if (!YEARS[f.stage].includes(f.year_label)) throw new Error('Escolha o ano/série da etapa selecionada.');
  if (!COMPONENTS[f.stage].includes(f.component)) throw new Error(`Escolha ${COMPONENT_LABEL[f.stage].toLowerCase()} da etapa selecionada.`);
  const title = f.title.trim();
  if (title.length < 3) throw new Error('Informe o título do planejamento (ao menos 3 caracteres).');
  if (title.length > LIMITS.title) throw new Error('Título muito longo.');
  for (const k of ['objectives', 'content', 'methodology', 'resources', 'assessment', 'inclusion_note', 'period_label'] as const) {
    if (f[k].length > LIMITS[k]) throw new Error('Algum campo de texto passou do limite de tamanho.');
  }
  if (f.start_date && !isDate(f.start_date)) throw new Error('Data de início inválida.');
  if (f.end_date && !isDate(f.end_date)) throw new Error('Data de fim inválida.');
  if (f.start_date && f.end_date && f.end_date < f.start_date) throw new Error('A data de fim não pode ser anterior à de início.');
  if (f.inclusion_note.trim() && !f.inclusion_case_id) throw new Error('Para registrar observação de inclusão, escolha o caso.');
  if (!PLAN_STATUSES.includes(f.status)) throw new Error('Status inválido.');
  const t = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    institution_id: institutionId, stage: f.stage, year_label: f.year_label, component: f.component, title,
    period_label: t(f.period_label), start_date: f.start_date || null, end_date: f.end_date || null,
    objectives: t(f.objectives), content: t(f.content), methodology: t(f.methodology), resources: t(f.resources), assessment: t(f.assessment),
    class_id: f.class_id || null, inclusion_case_id: f.inclusion_case_id || null, inclusion_note: t(f.inclusion_note), status: f.status,
  };
}
export function toForm(row: Record<string, unknown>): PlanForm {
  const s = (k: string) => (row[k] == null ? '' : String(row[k]));
  return { id: s('id'), stage: (s('stage') || 'EF') as Stage, year_label: s('year_label'), component: s('component'), title: s('title'), period_label: s('period_label'), start_date: s('start_date'), end_date: s('end_date'), objectives: s('objectives'), content: s('content'), methodology: s('methodology'), resources: s('resources'), assessment: s('assessment'), class_id: s('class_id'), inclusion_case_id: s('inclusion_case_id'), inclusion_note: s('inclusion_note'), status: (s('status') || 'rascunho') as PlanStatus };
}
/** Texto de busca seguro para ilike (remove curingas e vírgulas que quebrariam o filtro .or()). */
export function safeSearch(q: string): string { return q.replace(/[%_,()\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); }
