export interface NetworkRow {
  institution_id: string; escola: string;
  casos_ativos: number | null; planos_ativos: number | null; planos_aguardando_validacao: number | null;
  alertas_alta: number | null; alertas_media: number | null; alertas_baixa: number | null; acolhimento_atrasado: number | null;
}
export const NETWORK_NUMERIC_KEYS = ['casos_ativos', 'planos_ativos', 'planos_aguardando_validacao', 'alertas_alta', 'alertas_media', 'alertas_baixa', 'acolhimento_atrasado'] as const;
export type NetworkKey = typeof NETWORK_NUMERIC_KEYS[number];
/** Valor suprimido (null) aparece como "<n" para não induzir a achar que é zero. */
export function cell(v: number | null | undefined, minCell = 1): string {
  if (v === null || v === undefined) return minCell > 1 ? `< ${minCell}` : '—';
  return String(v);
}
/** Soma só valores conhecidos; informa se algum foi suprimido (total é piso, não valor exato). */
export function totals(rows: NetworkRow[]): { sums: Record<NetworkKey, number>; suppressed: Record<NetworkKey, boolean> } {
  const sums = {} as Record<NetworkKey, number>; const suppressed = {} as Record<NetworkKey, boolean>;
  for (const k of NETWORK_NUMERIC_KEYS) {
    sums[k] = rows.reduce((a, r) => a + (r[k] ?? 0), 0);
    suppressed[k] = rows.some(r => r[k] === null);
  }
  return { sums, suppressed };
}
/** Escolas com algum alerta de severidade alta ou acolhimento atrasado, para destacar na tela. */
export function needsAttention(r: NetworkRow): boolean {
  return (r.alertas_alta ?? 0) > 0 || (r.acolhimento_atrasado ?? 0) > 0;
}
