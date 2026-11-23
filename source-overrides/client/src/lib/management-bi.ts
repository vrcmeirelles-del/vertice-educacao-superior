// BI da Gestão — catálogo de indicadores por módulo do painel institucional.
//
// Cada módulo declara de quais tabelas reais vêm os gráficos. Toda consulta é filtrada pela
// instituição e passa pelo RLS do usuário logado: nenhum dado é inventado e nenhuma outra IES
// aparece. Tabela sem registro (ou sem permissão para o perfil) aparece como vazia, nunca com
// número fictício.
import { supabase } from '@/lib/supabase';

export type ChartKind = 'pie' | 'donut' | 'prism' | 'bars' | 'radial';

export interface Facet {
  table: string;
  column: string;
  title: string;
  chart: ChartKind;
  /** Ordem das etapas para o gráfico de prisma (funil). Valores fora da lista vão para o fim. */
  order?: string[];
}

export interface ModuleBI {
  key: string;          // aba do Workspace
  label: string;
  icon: string;
  color: string;
  /** Tabela cujo total representa o volume do módulo no BI Geral. */
  volume: { table: string; label: string };
  facets: Facet[];
}

export const PALETTE = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444', '#84cc16',
  '#f97316', '#14b8a6', '#3b82f6', '#d946ef', '#eab308', '#22c55e', '#0ea5e9', '#a855f7',
];

const STAGES_TCC = ['proposal', 'proposta', 'project', 'projeto', 'development', 'desenvolvimento', 'writing', 'qualification', 'qualificacao', 'defense', 'defesa', 'approved', 'aprovado', 'finished', 'concluido'];
const STAGES_AC = ['draft', 'submitted', 'extracting', 'suggestion_ready', 'under_review', 'adjustments_requested', 'approved', 'partially_approved', 'credited', 'report_sent', 'posting_confirmed', 'denied', 'rejected'];
const STAGES_EST = ['draft', 'pending', 'requested', 'documents', 'approved', 'active', 'in_progress', 'completed', 'finished', 'cancelled'];
const STAGES_GENERIC = ['draft', 'rascunho', 'planned', 'planejado', 'pending', 'pendente', 'open', 'aberto', 'in_progress', 'em_andamento', 'em andamento', 'review', 'under_review', 'em_analise', 'approved', 'aprovado', 'active', 'ativo', 'done', 'completed', 'concluido', 'concluída', 'closed', 'encerrado', 'cancelled', 'cancelado'];

export const MODULES: ModuleBI[] = [
  { key: 'metas', label: 'Metas', icon: '🎯', color: '#6366f1', volume: { table: 'vertice_goals', label: 'metas' }, facets: [
    { table: 'vertice_goals', column: 'status', title: 'Metas por situação', chart: 'donut' },
    { table: 'vertice_goals', column: 'origin_type', title: 'Origem das metas', chart: 'pie' },
    { table: 'vertice_actions', column: 'status', title: 'Ações por etapa', chart: 'prism', order: STAGES_GENERIC },
    { table: 'vertice_actions', column: 'priority', title: 'Ações por prioridade', chart: 'pie' },
  ] },
  { key: 'plano', label: 'Plano de Ação', icon: '🗺', color: '#ec4899', volume: { table: 'vertice_actions', label: 'ações' }, facets: [
    { table: 'vertice_actions', column: 'status', title: 'Ações por etapa', chart: 'prism', order: STAGES_GENERIC },
    { table: 'vertice_actions', column: 'priority', title: 'Prioridade', chart: 'donut' },
    { table: 'vertice_actions', column: 'origin_type', title: 'Origem das ações', chart: 'pie' },
  ] },
  { key: 'diagnostico', label: 'Diagnóstico', icon: '🩺', color: '#f59e0b', volume: { table: 'vertice_diagnosis_items', label: 'itens' }, facets: [
    { table: 'vertice_diagnosis_items', column: 'dimension', title: 'Itens por dimensão', chart: 'pie' },
    { table: 'vertice_diagnosis_items', column: 'priority', title: 'Prioridade', chart: 'donut' },
    { table: 'vertice_diagnosis_items', column: 'status', title: 'Andamento', chart: 'prism', order: STAGES_GENERIC },
  ] },
  { key: 'cadastro', label: 'Cursos', icon: '🏛', color: '#10b981', volume: { table: 'vertice_courses', label: 'cursos' }, facets: [
    { table: 'vertice_courses', column: 'modality', title: 'Cursos por modalidade', chart: 'pie' },
    { table: 'vertice_courses', column: 'degree', title: 'Cursos por grau', chart: 'donut' },
    { table: 'vertice_courses', column: 'status', title: 'Situação dos cursos', chart: 'bars' },
  ] },
  { key: 'geral', label: 'Acadêmico', icon: '📚', color: '#06b6d4', volume: { table: 'vertice_enrollment_snapshots', label: 'registros de matrícula' }, facets: [
    { table: 'vertice_enrollment_snapshots', column: 'student_status', title: 'Situação dos estudantes', chart: 'donut' },
    { table: 'vertice_turma_stats', column: 'modalidade', title: 'Turmas por modalidade', chart: 'pie' },
    { table: 'vertice_risco_agregado', column: 'status_risco', title: 'Risco de evasão', chart: 'prism', order: ['baixo', 'moderado', 'medio', 'médio', 'alto', 'critico', 'crítico'] },
  ] },
  { key: 'repositorio', label: 'Repositório de Evidências', icon: '🗂', color: '#8b5cf6', volume: { table: 'vertice_repository_files', label: 'arquivos' }, facets: [
    { table: 'vertice_repository_files', column: 'status', title: 'Arquivos por situação', chart: 'donut' },
    { table: 'vertice_repository_files', column: 'document_category', title: 'Tipos de documento', chart: 'pie' },
  ] },
  { key: 'validacao', label: 'Validação Documental', icon: '🔎', color: '#ef4444', volume: { table: 'vertice_doc_prevalidation', label: 'pré-validações' }, facets: [
    { table: 'vertice_doc_prevalidation', column: 'processing_stage', title: 'Etapa da pré-validação', chart: 'prism' },
    { table: 'vertice_doc_prevalidation', column: 'ai_status', title: 'Resultado da IA', chart: 'donut' },
    { table: 'vertice_doc_prevalidation', column: 'ai_nature', title: 'Natureza identificada', chart: 'pie' },
  ] },
  { key: 'documentos', label: 'Documentos', icon: '📄', color: '#84cc16', volume: { table: 'vertice_documents', label: 'documentos' }, facets: [
    { table: 'vertice_documents', column: 'status', title: 'Documentos por situação', chart: 'donut' },
    { table: 'vertice_documents', column: 'category_code', title: 'Categorias', chart: 'pie' },
    { table: 'vertice_documents', column: 'ai_status', title: 'Análise por IA', chart: 'bars' },
  ] },
  { key: 'avaliacao', label: 'Instrumento de Avaliação', icon: '📋', color: '#f97316', volume: { table: 'vertice_instrumento_checklist', label: 'itens do checklist' }, facets: [
    { table: 'vertice_instrumento_checklist', column: 'status', title: 'Checklist do instrumento', chart: 'donut' },
  ] },
  { key: 'enade', label: 'ENADE', icon: '🎓', color: '#14b8a6', volume: { table: 'vertice_enade_eligibility', label: 'estudantes avaliados' }, facets: [
    { table: 'vertice_enade_eligibility', column: 'situacao', title: 'Situação de habilitação', chart: 'donut' },
    { table: 'vertice_enade_eligibility', column: 'elegibility_type', title: 'Tipo de habilitação', chart: 'pie' },
    { table: 'vertice_enade360_records', column: 'validation_status', title: 'Registros ENADE 360°', chart: 'bars' },
  ] },
  { key: 'avalia360', label: 'Avalia 360°', icon: '📝', color: '#3b82f6', volume: { table: 'vertice_avalia_bank', label: 'questões no banco' }, facets: [
    { table: 'vertice_avalia_bank', column: 'status', title: 'Banco de questões', chart: 'donut' },
    { table: 'vertice_avalia_assessments', column: 'status', title: 'Avaliações', chart: 'prism', order: STAGES_GENERIC },
    { table: 'vertice_avalia_risk_signals', column: 'level', title: 'Sinais de risco', chart: 'pie' },
  ] },
  { key: 'atividades-ensino', label: 'Atividades de Ensino', icon: '🧑‍🏫', color: '#d946ef', volume: { table: 'vertice_teaching_activities', label: 'atividades' }, facets: [
    { table: 'vertice_teaching_activities', column: 'status', title: 'Atividades por etapa', chart: 'prism', order: STAGES_GENERIC },
    { table: 'vertice_teaching_activities', column: 'category', title: 'Categorias', chart: 'pie' },
  ] },
  { key: 'extensao', label: 'Extensão', icon: '🤝', color: '#eab308', volume: { table: 'vertice_extension_projects', label: 'projetos' }, facets: [
    { table: 'vertice_extension_projects', column: 'status', title: 'Projetos por etapa', chart: 'prism', order: STAGES_GENERIC },
    { table: 'vertice_extension_projects', column: 'modality', title: 'Modalidade', chart: 'donut' },
    { table: 'vertice_extension_projects', column: 'thematic_area', title: 'Área temática', chart: 'pie' },
    { table: 'vertice_extension_students', column: 'status', title: 'Estudantes na extensão', chart: 'bars' },
  ] },
  { key: 'tcc', label: 'TCC e Pesquisa', icon: '✍', color: '#22c55e', volume: { table: 'vertice_tcc_works', label: 'trabalhos' }, facets: [
    { table: 'vertice_tcc_works', column: 'stage', title: 'Trabalhos por etapa', chart: 'prism', order: STAGES_TCC },
    { table: 'vertice_tcc_works', column: 'modality', title: 'Modalidade', chart: 'donut' },
    { table: 'vertice_tcc_defenses', column: 'result', title: 'Resultado das bancas', chart: 'pie' },
  ] },
  { key: 'atividades-complementares', label: 'Atividades Complementares', icon: '📜', color: '#0ea5e9', volume: { table: 'vertice_ac_submissions', label: 'solicitações' }, facets: [
    { table: 'vertice_ac_submissions', column: 'status', title: 'Solicitações por etapa', chart: 'prism', order: STAGES_AC },
    { table: 'vertice_ac_submissions', column: 'modality', title: 'Modalidade', chart: 'donut' },
    { table: 'vertice_student_registry', column: 'academic_status', title: 'Base de estudantes', chart: 'pie' },
  ] },
  { key: 'estagio', label: 'Estágio', icon: '🏢', color: '#a855f7', volume: { table: 'vertice_internship_placements', label: 'estágios' }, facets: [
    { table: 'vertice_internship_placements', column: 'lifecycle', title: 'Estágios por etapa', chart: 'prism', order: STAGES_EST },
    { table: 'vertice_internship_placements', column: 'nature', title: 'Natureza', chart: 'donut' },
    { table: 'vertice_internship_placements', column: 'location_type', title: 'Local', chart: 'pie' },
    { table: 'vertice_internship_organizations', column: 'status', title: 'Concedentes', chart: 'bars' },
  ] },
  { key: 'egressos', label: 'Egressos', icon: '🎓', color: '#6366f1', volume: { table: 'vertice_alumni_education', label: 'formações registradas' }, facets: [
    { table: 'vertice_alumni_education', column: 'academic_status', title: 'Situação acadêmica', chart: 'donut' },
    { table: 'vertice_alumni_education', column: 'degree', title: 'Grau', chart: 'pie' },
    { table: 'vertice_alumni_education', column: 'modality', title: 'Modalidade', chart: 'bars' },
  ] },
  { key: 'governanca', label: 'Governança', icon: '⚖', color: '#ec4899', volume: { table: 'governance_deliberations', label: 'deliberações' }, facets: [
    { table: 'governance_bodies', column: 'body_type', title: 'Órgãos colegiados', chart: 'pie' },
    { table: 'governance_meetings', column: 'status', title: 'Reuniões', chart: 'donut' },
    { table: 'governance_deliberations', column: 'status', title: 'Deliberações por etapa', chart: 'prism', order: STAGES_GENERIC },
    { table: 'governance_deliberations', column: 'nature', title: 'Natureza das deliberações', chart: 'bars' },
  ] },
  { key: 'cpa-autoavaliacao', label: 'CPA', icon: '🗳', color: '#f59e0b', volume: { table: 'vertice_cpa_findings', label: 'achados' }, facets: [
    { table: 'vertice_cpa_campaigns', column: 'status', title: 'Campanhas', chart: 'donut' },
    { table: 'vertice_cpa_findings', column: 'dimension', title: 'Achados por dimensão', chart: 'pie' },
    { table: 'vertice_cpa_actions', column: 'status', title: 'Ações da CPA', chart: 'prism', order: STAGES_GENERIC },
  ] },
  { key: 'inclusao', label: 'Inclusão', icon: '♿', color: '#10b981', volume: { table: 'student_support_cases', label: 'casos' }, facets: [
    { table: 'student_support_cases', column: 'status', title: 'Casos por etapa', chart: 'prism', order: STAGES_GENERIC },
    { table: 'student_support_cases', column: 'priority', title: 'Prioridade', chart: 'donut' },
    { table: 'student_support_requests', column: 'needs_type', title: 'Tipos de necessidade', chart: 'pie' },
  ] },
  { key: 'acompanhamento-especial', label: 'Acompanhamento Especial', icon: '🫶', color: '#06b6d4', volume: { table: 'student_special_cases', label: 'casos' }, facets: [
    { table: 'student_special_cases', column: 'status', title: 'Casos por etapa', chart: 'prism', order: STAGES_GENERIC },
    { table: 'student_special_cases', column: 'classification', title: 'Classificação', chart: 'donut' },
    { table: 'student_special_cases', column: 'category_code', title: 'Categoria', chart: 'pie' },
  ] },
  { key: 'aquisicoes', label: 'Aquisições', icon: '🛒', color: '#8b5cf6', volume: { table: 'vertice_purchase_requests', label: 'pedidos de compra' }, facets: [
    { table: 'vertice_purchase_requests', column: 'status', title: 'Pedidos por etapa', chart: 'prism', order: STAGES_GENERIC },
    { table: 'vertice_purchase_requests', column: 'category', title: 'Categoria', chart: 'pie' },
    { table: 'vertice_purchase_orders', column: 'payment_status', title: 'Pagamento das ordens', chart: 'donut' },
  ] },
  { key: 'equipe', label: 'Equipe', icon: '👥', color: '#ef4444', volume: { table: 'vertice_memberships', label: 'pessoas com acesso' }, facets: [
    { table: 'vertice_memberships', column: 'role', title: 'Perfis de acesso', chart: 'donut' },
  ] },
  { key: 'sync', label: 'Integrações', icon: '⇄', color: '#84cc16', volume: { table: 'vertice_roster_imports', label: 'importações' }, facets: [
    { table: 'vertice_roster_imports', column: 'status', title: 'Importações de alunos', chart: 'donut' },
    { table: 'vertice_onedrive_documentos', column: 'status', title: 'Espelhamento de documentos', chart: 'pie' },
    { table: 'vertice_data_connections', column: 'status', title: 'Conexões de dados', chart: 'bars' },
  ] },
  { key: 'escola-bi', label: 'Desempenho Escolar', icon: '🏫', color: '#f97316', volume: { table: 'vertice_school_classes', label: 'turmas' }, facets: [
    { table: 'vertice_school_classes', column: 'status', title: 'Turmas', chart: 'donut' },
    { table: 'vertice_school_indicators', column: 'indicator_type', title: 'Indicadores', chart: 'pie' },
    { table: 'vertice_school_indicators', column: 'segment', title: 'Segmentos', chart: 'bars' },
  ] },
  { key: 'escola-planejamento-prof', label: 'Planejamento do Professor', icon: '🗓', color: '#14b8a6', volume: { table: 'teacher_lesson_plans', label: 'planos de aula' }, facets: [
    { table: 'teacher_lesson_plans', column: 'status', title: 'Planos por situação', chart: 'prism', order: STAGES_GENERIC },
    { table: 'teacher_lesson_plans', column: 'stage', title: 'Etapa de ensino', chart: 'pie' },
  ] },
  { key: 'escola-enem', label: 'ENEM & Vestibular', icon: '🎯', color: '#3b82f6', volume: { table: 'vertice_enem_escola', label: 'resultados' }, facets: [
    { table: 'vertice_enem_escola', column: 'area', title: 'Resultados por área', chart: 'pie' },
    { table: 'vertice_enem_simulado_resultado', column: 'area', title: 'Simulados por área', chart: 'donut' },
  ] },
  { key: 'escola-captacao', label: 'Captação Escolar', icon: '📣', color: '#d946ef', volume: { table: 'vertice_captacao_leads', label: 'leads' }, facets: [
    { table: 'vertice_captacao_leads', column: 'origem', title: 'Leads por origem', chart: 'pie' },
    { table: 'vertice_captacao_campaigns', column: 'status', title: 'Campanhas', chart: 'donut' },
  ] },
];

export const MODULE_BY_TAB: Record<string, ModuleBI> = Object.fromEntries(MODULES.map((m) => [m.key, m]));

const LABELS: Record<string, string> = {
  // situações gerais
  draft: 'Rascunho', rascunho: 'Rascunho', planned: 'Planejado', planejado: 'Planejado', pending: 'Pendente', pendente: 'Pendente',
  open: 'Aberto', aberto: 'Aberto', in_progress: 'Em andamento', em_andamento: 'Em andamento', ongoing: 'Em andamento',
  review: 'Em revisão', under_review: 'Em análise', em_analise: 'Em análise', submitted: 'Enviado', extracting: 'Em leitura',
  suggestion_ready: 'Sugestão pronta', adjustments_requested: 'Ajustes solicitados', approved: 'Aprovado', aprovado: 'Aprovado',
  partially_approved: 'Aprovado parcialmente', denied: 'Indeferido', rejected: 'Rejeitado', credited: 'Creditado',
  report_sent: 'Enviado à secretaria', posting_confirmed: 'Lançado', active: 'Ativo', ativo: 'Ativo', inactive: 'Inativo',
  done: 'Concluído', completed: 'Concluído', concluido: 'Concluído', finished: 'Finalizado', closed: 'Encerrado',
  encerrado: 'Encerrado', cancelled: 'Cancelado', canceled: 'Cancelado', cancelado: 'Cancelado', suspended: 'Suspenso',
  archived: 'Arquivado', published: 'Publicado', scheduled: 'Agendado', held: 'Realizado', valid: 'Válido', invalid: 'Inválido',
  validated: 'Validado', verified: 'Verificado', failed: 'Falhou', error: 'Erro', success: 'Sucesso', ok: 'OK', queued: 'Na fila',
  processing: 'Processando', processed: 'Processado', expired: 'Expirado', paid: 'Pago', unpaid: 'Em aberto', overdue: 'Vencido',
  achieved: 'Atingida', not_achieved: 'Não atingida', at_risk: 'Em risco', on_track: 'No prazo', late: 'Atrasado', delayed: 'Atrasado',
  // prioridade e risco
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica', urgent: 'Urgente', baixo: 'Baixo', medio: 'Médio',
  moderado: 'Moderado', alto: 'Alto', critico: 'Crítico',
  // modalidade e grau
  presencial: 'Presencial', ead: 'EAD', hibrido: 'Híbrido', hybrid: 'Híbrido', online: 'On-line', remote: 'Remoto', in_person: 'Presencial',
  bacharelado: 'Bacharelado', licenciatura: 'Licenciatura', tecnologo: 'Tecnólogo', tecnologico: 'Tecnológico',
  graduacao: 'Graduação', pos_graduacao: 'Pós-graduação', especializacao: 'Especialização', mestrado: 'Mestrado', doutorado: 'Doutorado',
  internal: 'Interno', external: 'Externo', interno: 'Interno', externo: 'Externo', mandatory: 'Obrigatório', optional: 'Não obrigatório',
  // estudantes
  graduated: 'Formado', transferred: 'Transferido', locked: 'Trancado', matriculado: 'Matriculado', formado: 'Formado',
  trancado: 'Trancado', evadido: 'Evadido',
  // origens e siglas
  pdi: 'PDI', ppc: 'PPC', cpa_origem: 'CPA', avaliacao_externa: 'Avaliação externa', avaliacao_interna: 'Avaliação interna',
  diagnostico: 'Diagnóstico', regulatorio: 'Regulatório', mec: 'MEC', inep: 'INEP', enade: 'ENADE', manual: 'Manual', import: 'Importação',
  ata: 'Ata', portaria: 'Portaria', relatorio: 'Relatório', relatorio_cpa: 'Relatório da CPA', regulamento: 'Regulamento', plano: 'Plano',
  // perfis
  master: 'Master', reitor: 'Reitor', diretor_geral: 'Diretor geral', diretor_pedagogico: 'Diretor pedagógico', gestor: 'Gestor',
  coordenador: 'Coordenador', nde: 'NDE', cpa: 'CPA', procurador: 'Procurador', equipe: 'Equipe', leitor: 'Leitor',
};

export function labelOf(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Não informado';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  const raw = String(value).trim();
  const key = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]+/g, '_');
  if (LABELS[key]) return LABELS[key];
  const text = raw.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface Slice { name: string; value: number; raw: string }
export interface FacetResult { facet: Facet; slices: Slice[]; total: number; denied: boolean; truncated: boolean }

const MAX_ROWS = 5000;

/** Distribuição real de uma coluna, só da instituição informada (RLS do usuário aplica). */
export async function loadFacet(institutionId: string, facet: Facet): Promise<FacetResult> {
  const { data, error } = await supabase.from(facet.table).select(facet.column).eq('institution_id', institutionId).limit(MAX_ROWS);
  if (error) return { facet, slices: [], total: 0, denied: true, truncated: false };
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const v = row[facet.column];
    const k = v === null || v === undefined || v === '' ? '' : String(v);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let slices = [...counts.entries()].map(([raw, value]) => ({ raw, value, name: labelOf(raw) }));
  if (facet.chart === 'prism' && facet.order) {
    const norm = (s: string) => s.toLowerCase();
    const pos = (s: string) => { const i = facet.order!.map(norm).indexOf(norm(s)); return i === -1 ? 999 : i; };
    slices.sort((a, b) => pos(a.raw) - pos(b.raw) || b.value - a.value);
  } else {
    slices.sort((a, b) => b.value - a.value);
  }
  if (slices.length > 9 && facet.chart !== 'prism') {
    const top = slices.slice(0, 8);
    const rest = slices.slice(8).reduce((s, x) => s + x.value, 0);
    slices = [...top, { name: 'Outros', value: rest, raw: '__outros' }];
  }
  return { facet, slices, total: rows.length, denied: false, truncated: rows.length >= MAX_ROWS };
}

/** Total de registros do módulo (contagem exata, sem trazer linhas). */
export async function loadVolume(institutionId: string, table: string): Promise<number | null> {
  const { count, error } = await supabase.from(table).select('institution_id', { count: 'exact', head: true }).eq('institution_id', institutionId);
  return error ? null : count ?? 0;
}
