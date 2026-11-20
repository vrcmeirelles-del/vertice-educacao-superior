export const RULES_VERSION = 'pei-alerts-v1';
export const ruleLabels: Record<string, string> = {
  R01: 'Revisão do PEI vencida', R02: 'Revisão do PEI se aproxima', R03: 'PEI sem data de revisão', R04: 'Validação parada',
  R05: 'Vigência do PEI encerrada', R06: 'PEI sem adaptações', R07: 'Adaptação sem responsável', R08: 'Caso sem plano', R09: 'Acolhimento atrasado', R10: 'Barreira sem estratégia',
};
export const severityLabels: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const severityRank: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
export interface PeiAlert { id: string; case_id: string; rule_id: string; severity: string; status: string; evidence: Record<string, unknown>; created_at: string }
export function sortAlerts<T extends { severity: string; created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || a.created_at.localeCompare(b.created_at));
}
export function describeEvidence(e: Record<string, unknown>): string {
  const parts: string[] = [];
  const date = (v: unknown) => { const s = String(v); const d = new Date(s.length === 10 ? s + 'T12:00:00' : s); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR'); };
  if (e.next_review_date) parts.push(`revisão em ${date(e.next_review_date)}`);
  if (e.effective_until) parts.push(`vigência até ${date(e.effective_until)}`);
  if (e.acolhimento_deadline) parts.push(`prazo de acolhimento ${date(e.acolhimento_deadline)}`);
  if (e.acolhimento_at) parts.push(`acolhido em ${date(e.acolhimento_at)}`);
  if (e.atualizado_em) parts.push(`sem alteração desde ${date(e.atualizado_em)}`);
  if (e.plano_status) parts.push(`plano ${String(e.plano_status).replaceAll('_', ' ')}`);
  if (e.adaptacao_status) parts.push(`adaptação ${String(e.adaptacao_status).replaceAll('_', ' ')}`);
  return parts.join(' · ');
}
