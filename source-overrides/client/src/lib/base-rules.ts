// Assistente da Base por regras (auditoria de 20/11/2026, V1). Sem IA e sem cota:
// responde com os cruzamentos agregados da organização (vertice_ai_crosschecks) e com a
// ajuda local dos módulos (MODULE_HELP). Nada sai da instituição.
import { MODULE_HELP } from './module-help';

export type Crosschecks = {
  observed_at?: string;
  matriculas?: { semester?: string; eorbit_quantitativo?: number | null; legacy_snapshots?: number | null; difference?: number | null; year_prior_same_semester?: number | null; extraction_date?: string | null };
  governanca?: { metas?: number | null; metas_sem_conta_vinculada?: number | null; medicoes?: number | null; acoes_5w2h?: number | null };
  documentos?: { enviados?: number | null; validados?: number | null; solicitacoes_ativas_sem_executor?: number | null };
  aquisicoes?: { mandatos_visiveis_autorizados?: number | null };
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set('para pela pelo como quais qual quero sobre entre esta este essa esse onde quando organizacao instituicao fazer existe existem podem pode'.split(' '));
const stems = (s: string) => new Set((fold(s).match(/[a-z]{4,}/g) || []).filter(w => !STOP.has(w)).map(w => w.slice(0, 6)));
const n = (v: number | null | undefined) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : 'sem dado');

/** Achados objetivos dos cruzamentos, em ordem de prioridade. */
export function crosscheckFindings(c: Crosschecks): string[] {
  const out: string[] = [];
  const m = c.matriculas || {}, g = c.governanca || {}, d = c.documentos || {};
  if (m.eorbit_quantitativo == null && m.legacy_snapshots == null) out.push(`Matrículas ${m.semester || ''}: nenhuma das duas fontes tem dado carregado. Importe o quantitativo do e-Orbit ou os retratos de matrícula.`);
  else if (m.eorbit_quantitativo == null || m.legacy_snapshots == null) out.push(`Matrículas ${m.semester || ''}: só uma fonte tem dado (e-Orbit ${n(m.eorbit_quantitativo)}; retratos ${n(m.legacy_snapshots)}). Não há como cruzar.`);
  else if (m.difference) out.push(`Matrículas ${m.semester || ''}: e-Orbit ${n(m.eorbit_quantitativo)} e retratos ${n(m.legacy_snapshots)} divergem em ${n(Math.abs(m.difference))}. Compare grão, cobertura e status antes de afirmar o número de alunos únicos.`);
  else out.push(`Matrículas ${m.semester || ''}: as duas fontes coincidem (${n(m.eorbit_quantitativo)}).`);
  if (g.metas_sem_conta_vinculada) out.push(`${n(g.metas_sem_conta_vinculada)} de ${n(g.metas)} meta(s) sem responsável vinculado: defina quem responde por cada uma.`);
  if (g.metas && !g.medicoes) out.push(`${n(g.metas)} meta(s) e nenhuma medição registrada: sem medição o semáforo não avalia a trajetória.`);
  if (g.metas && !g.acoes_5w2h) out.push('Há metas sem nenhuma ação 5W2H cadastrada: cada meta precisa de ao menos uma ação com responsável e prazo.');
  if (d.solicitacoes_ativas_sem_executor) out.push(`${n(d.solicitacoes_ativas_sem_executor)} solicitação(ões) de documento ativa(s) sem executor designado.`);
  if (d.enviados) out.push(`${n(d.enviados)} documento(s) enviado(s) aguardando validação (${n(d.validados)} já validados).`);
  if (!out.slice(1).length) out.push('Metas, ações e documentos: nenhuma lacuna nos cruzamentos agregados.');
  return out;
}

export function helpMatches(message: string, limit = 2) {
  const q = stems(message);
  return MODULE_HELP.map(h => ({ h, score: [...stems(`${h.term} ${h.text}`)].filter(w => q.has(w)).length + ([...stems(h.term)].some(w => q.has(w)) ? 2 : 0) }))
    .filter(x => x.score >= 2).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.h);
}

const CROSSCHECK_INTENT = /matricul|inconsist|fonte|cruz|lacuna|meta|acao|acoes|5w2h|document|respons|prioriz|problema|providenc|cnpj|segreg|pendenc|diagnost/;

export function ruleAnswer(message: string, crosschecks: Crosschecks | null): string {
  const parts: string[] = [];
  if (CROSSCHECK_INTENT.test(fold(message))) {
    if (crosschecks) {
      const findings = crosscheckFindings(crosschecks);
      parts.push(`Cruzamentos da organização${crosschecks.observed_at ? ` (${new Date(crosschecks.observed_at).toLocaleString('pt-BR')})` : ''}, em ordem de prioridade:\n${findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}`);
      if (/cnpj|segreg/.test(fold(message))) parts.push('CNPJ: os mandatos de aquisição são segregados. O CNPJ-raiz indica correspondência potencial, mas não autoriza troca de documentos entre mandatos.');
    } else parts.push('Os cruzamentos agregados exigem perfil de gestor com segundo fator (MFA) ativo nesta sessão.');
  }
  const help = helpMatches(message);
  if (help.length) parts.push(help.map(h => `${h.term}: ${h.text}`).join('\n\n'));
  if (!parts.length) parts.push('Não encontrei orientação específica para essa pergunta. Pergunte sobre matrículas, metas, ações 5W2H, documentos, diagnóstico, equipe ou e-MEC, ou use os botões de sugestão acima.');
  return parts.join('\n\n');
}
