// Modelo da Central de Automação 360°. Lê a RPC vertice_automation_dashboard (migração candidata
// 20261124210000_automacao360_nucleo). Resposta inesperada vira "fonte não verificada", nunca zero.
export type EstadoRegra = 'inactive' | 'shadow' | 'active' | 'blocked';
export type Regra = { id: string; version: string; module: string; priority: 'P0' | 'P1' | 'P2'; cadence: string; sourceStatus: 'validada' | 'identificada' | 'pendente'; state: EstadoRegra };
export type Painel = {
  institutionId: string; courseId: string | null;
  config: { revision: number; enabled: boolean; mode: 'shadow' | 'operational'; ruleIds: string[]; approvedAt: string } | null;
  pendingConfig: { id: number; revision: number } | null;
  rules: Regra[];
  lastRun: { at: string; asOf: string; status: 'evaluated' | 'partial'; mode: string; alerts: number; durationMs: number | null } | null;
  pending: { id: string; ruleId: string; priority: string; status: string; revision: number }[] | null;
  events: { at: string; entity: string; action: string; to: string | null }[];
};

export const estados: Record<EstadoRegra, string> = { inactive: 'Inativa', shadow: 'Modo sombra', active: 'Ativa', blocked: 'Bloqueada (fonte não validada)' };
export const fontes = { validada: 'Fonte validada', identificada: 'Fonte identificada, não validada', pendente: 'Fonte pendente' } as const;
export const cadencias: Record<string, string> = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' };
export const acoes: Record<string, string> = { propose: 'Revisão proposta', approve: 'Aprovado', reject: 'Rejeitado', start: 'Execução iniciada', complete: 'Concluído', verify: 'Verificado', close: 'Encerrado com justificativa', '5w2h_draft': 'Rascunho 5W2H criado' };

// Rótulos institucionais das 46 regras (sem identificadores técnicos na tela).
export const rotulos: Record<string, string> = {
  'repo.overdue': 'Documentos do Repositório com prazo vencido', 'repo.due': 'Documentos do Repositório com prazo em até 7 dias',
  'sapiens.low': 'Competência com acerto abaixo de 50% (Sapiens)', 'curriculum.gap': 'Competências do currículo sem disciplina vinculada',
  'avalia.recovery': 'Recuperações pendentes (Avalia 360°)', 'enade.gap': 'Competências do ENADE sem cobertura', 'enamed.gap': 'Competências do ENAMED sem cobertura',
  'cpa.pending': 'Ações da CPA executadas sem evidência', 'retention.alert': 'Alertas confirmados de permanência', 'pei.overdue': 'Ações do Planejamento Estratégico vencidas',
  'extension.pending': 'Evidências de extensão pendentes', 'teaching.pending': 'Certificados de atividades de ensino pendentes', 'internship.due': 'Estágio com prazo em até 7 dias',
  'tcc.overdue': 'TCC com etapa vencida', 'ac.duplicate': 'Possível duplicidade em Atividades Complementares', 'alumni.pending': 'Pesquisas de egressos sem resposta',
  'capture.stale': 'Leads sem atendimento no prazo', 'market.new': 'Publicações de mercado a revisar', 'due.pending': 'Evidências pendentes na Due Diligence',
  'school.attendance': 'Alertas de frequência escolar', 'finance.overdue': 'Faturas vencidas', 'internship.overdue': 'Estágio com prazo vencido',
  'internship.hours': 'Carga horária de estágio insuficiente', 'internship.documents': 'Documentos de estágio faltantes', 'tcc.due': 'TCC com etapa em até 7 dias',
  'tcc.documents': 'Documentos de TCC faltantes', 'extension.hours': 'Carga horária de extensão insuficiente', 'extension.certificates': 'Certificados de extensão pendentes',
  'teaching.hours': 'Carga horária de atividades de ensino insuficiente', 'teaching.documents': 'Documentos de atividades de ensino faltantes', 'ac.hours': 'Horas de Atividades Complementares insuficientes',
  'ac.documents': 'Comprovantes de Atividades Complementares faltantes', 'capture.conversion': 'Conversão de captação abaixo de 10%', 'capture.sla': 'Atendimentos de captação fora do prazo',
  'competition.change': 'Mudança confirmada em concorrente', 'market.transaction': 'Operação de mercado confirmada', 'due.blocker': 'Bloqueio confirmado na Due Diligence',
  'finance.arrears': 'Inadimplência acima de 10%', 'finance.cashgap': 'Compromissos acima do caixa disponível', 'alumni.response': 'Resposta de egressos abaixo de 30%',
  'instrument.evidence': 'Indicadores do instrumento sem evidência validada', 'instrument.stalled': 'Documentos enviados há 15 dias sem validação',
  'instrument.uncovered': 'Indicadores do instrumento sem solicitação nem "não se aplica"', 'instrument.unbacked': 'Conceito simulado 3 ou mais sem evidência validada',
  'instrument.unassigned': 'Itens não conformes do Novo Instrumento sem responsável', 'instrument.milestone': 'Marcos do ciclo avaliativo atrasados',
};
export const rotulo = (id: string) => rotulos[id] ?? 'Regra não catalogada';

const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const isoOk = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));

/** Valida a resposta da RPC. Lança erro se o contrato não for o esperado. */
export function parsePainel(raw: unknown, institutionId: string, courseId: string | null): Painel {
  const d = raw as Painel;
  if (!d || typeof d !== 'object' || d.institutionId !== institutionId || (d.courseId ?? null) !== courseId) throw Error('escopo divergente');
  if (!Array.isArray(d.rules) || d.rules.length === 0) throw Error('catálogo ausente');
  for (const r of d.rules) {
    if (typeof r.id !== 'string' || !(r.state in estados) || !(r.sourceStatus in fontes) || !['P0', 'P1', 'P2'].includes(r.priority)) throw Error('regra inválida');
  }
  if (d.config !== null && (typeof d.config !== 'object' || !Number.isInteger(d.config.revision) || !Array.isArray(d.config.ruleIds))) throw Error('configuração inválida');
  if (d.lastRun !== null && (!isoOk(d.lastRun?.at) || !Number.isInteger(d.lastRun?.alerts))) throw Error('execução inválida');
  if (d.pending !== null && !Array.isArray(d.pending)) throw Error('fila inválida');
  if (!Array.isArray(d.events)) throw Error('histórico inválido');
  if (d.pending) for (const p of d.pending) if (!uuid(p.id)) throw Error('alerta inválido');
  return d;
}

export function resumo(p: Painel) {
  const porEstado = Object.fromEntries(Object.keys(estados).map((k) => [k, p.rules.filter((r) => r.state === k).length])) as Record<EstadoRegra, number>;
  const porFonte = Object.fromEntries(Object.keys(fontes).map((k) => [k, p.rules.filter((r) => r.sourceStatus === k).length])) as Record<keyof typeof fontes, number>;
  return { porEstado, porFonte, total: p.rules.length };
}

export function filtrar(regras: Regra[], { busca = '', estado = '', prioridade = '' }: { busca?: string; estado?: string; prioridade?: string }) {
  const q = busca.toLocaleLowerCase('pt-BR').trim();
  return regras.filter((r) => (!estado || r.state === estado) && (!prioridade || r.priority === prioridade)
    && (!q || `${rotulo(r.id)} ${r.module}`.toLocaleLowerCase('pt-BR').includes(q)));
}

/** Traduz erros do servidor para mensagens institucionais, sem expor detalhes internos. */
export function mensagemErro(e: { code?: string; message?: string } | null | undefined): string {
  const m = e?.message ?? '';
  if (e?.code === 'PGRST202' || /does not exist|não existe|schema cache/i.test(m)) return 'A estrutura da Automação 360° ainda não foi instalada neste ambiente.';
  if (/autoaprovação/.test(m)) return 'A aprovação precisa ser feita por outra pessoa autorizada.';
  if (/concorrente|superada/.test(m)) return 'Outra alteração foi registrada antes desta. Atualize o painel e revise.';
  if (/MFA|acesso negado/.test(m)) return 'Seu perfil não tem permissão para esta operação ou o segundo fator não foi confirmado.';
  return 'Não foi possível concluir a operação. Nada foi alterado.';
}
