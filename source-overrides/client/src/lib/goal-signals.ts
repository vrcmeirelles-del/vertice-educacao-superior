import type { Row } from './area';

export type GoalSignal = 'red' | 'amber' | 'green' | 'gray';
export const GOAL_SIGNALS = [
  { key: 'red', label: 'Intervir', color: '#b42332', hint: 'Prazo vencido' },
  { key: 'amber', label: 'Atenção', color: '#b77908', hint: 'Prazo próximo ou pendências' },
  { key: 'green', label: 'Em dia / concluídas', color: '#14785c', hint: 'Sem alertas nas regras' },
  { key: 'gray', label: 'Canceladas', color: '#83909f', hint: 'Fora do acompanhamento' },
] as const;

export function finiteGoalValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const result = Number(typeof value === 'string' ? value.replace(',', '.') : value);
  return Number.isFinite(result) ? result : null;
}

function day(value: unknown): number | null {
  const text = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const n = Date.parse(text + 'T00:00:00Z');
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === text ? n / 86400000 : null;
}

export function goalSignalDate(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function goalSignals(goals: Row[], measurements: Row[], date = goalSignalDate()) {
  const now = day(date)!;
  const byGoal = new Map<string, Row[]>();
  for (const m of measurements) {
    const key = String(m.goal_id);
    if (!byGoal.has(key)) byGoal.set(key, []);
    byGoal.get(key)!.push(m);
  }
  return goals.map(goal => {
    const history = (byGoal.get(goal.id) ?? []).slice().sort((a, b) =>
      String(a.measured_on ?? '').localeCompare(String(b.measured_on ?? '')) ||
      String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || a.id.localeCompare(b.id));
    const latest = history.filter(m => day(m.measured_on) !== null && day(m.measured_on)! <= now).at(-1);
    const value = finiteGoalValue(latest?.value);
    const target = finiteGoalValue(goal.target);
    const baseline = finiteGoalValue(goal.baseline);
    const due = day(goal.due_date);
    const daysLeft = due === null ? null : due - now;
    const hasOwner = [goal.owner_user_id, goal.owner_name, goal.owner_email].some(v => String(v ?? '').trim());
    const hasMeasurement = value !== null;
    const knownDirection = ['aumentar', 'reduzir', 'manter'].includes(String(goal.direction));
    const hit = value !== null && target !== null && knownDirection && (goal.direction === 'reduzir' ? value <= target : goal.direction === 'manter' ? Math.abs(value - target) <= (Math.abs(target) * .05 || .5) : value >= target);
    const progress = !hasMeasurement || target === null || !knownDirection ? null : goal.direction === 'manter' ? (hit ? 100 : 50) : baseline === null || baseline === target ? (hit ? 100 : 0) : Math.max(0, Math.min(100, Math.round((value! - baseline) / (target - baseline) * 100)));
    const intervals: Record<string, number> = { mensal: 31, bimestral: 62, trimestral: 93, semestral: 186, anual: 366 };
    const interval = intervals[String(goal.frequency)];
    const stale = Boolean(latest && interval && now - day(latest.measured_on)! > interval);
    const reasons: string[] = [];
    let signal: GoalSignal;
    if (goal.status === 'cancelada') {
      signal = 'gray'; reasons.push('Meta cancelada; fora do acompanhamento.');
    } else if (goal.status === 'concluida') {
      signal = 'green'; reasons.push('Conclusão registrada no cadastro; confira as evidências.');
    } else {
      if (daysLeft !== null && daysLeft < 0) reasons.push(`Prazo vencido há ${Math.abs(daysLeft)} dia(s).`);
      else if (daysLeft !== null && daysLeft <= 14) reasons.push(daysLeft === 0 ? 'O prazo vence hoje.' : `Prazo vence em ${daysLeft} dia(s).`);
      if (goal.status === 'planejada') reasons.push('Meta planejada: pactuar e iniciar o acompanhamento.');
      if (!hasOwner) reasons.push('Responsável ainda não definido.');
      if (!hasMeasurement) reasons.push('Sem medição numérica válida até a data de referência.');
      if (stale) reasons.push('Medição desatualizada para a periodicidade cadastrada.');
      if (due === null) reasons.push('Prazo não informado ou inválido.');
      if (target === null || !knownDirection) reasons.push('Completar o alvo e o sentido do indicador.');
      if (goal.direction === 'manter' && hasMeasurement && !hit && target !== null) reasons.push('Última medição fora da faixa de manutenção (±5% do alvo; ±0,5 quando o alvo é zero).');
      if (!['ativa', 'planejada'].includes(String(goal.status))) reasons.push('Revisar a situação cadastrada.');
      signal = daysLeft !== null && daysLeft < 0 ? 'red' : reasons.length ? 'amber' : 'green';
      if (!reasons.length) reasons.push(hit ? 'Alvo atingido na última medição; manter o acompanhamento.' : 'Prazo, responsável e medição registrados; sem alertas nestas regras.');
    }
    return { goal, signal, reasons, history, latest, value, target, progress, daysLeft, hasOwner, hasMeasurement, stale };
  });
}

export type GoalSignalEntry = ReturnType<typeof goalSignals>[number];

export function summarizeGoalSignals(entries: GoalSignalEntry[]) {
  const counts: Record<GoalSignal, number> = { red: 0, amber: 0, green: 0, gray: 0 };
  entries.forEach(e => counts[e.signal]++);
  const active = entries.filter(e => !['concluida', 'cancelada'].includes(String(e.goal.status)));
  return { counts, total: entries.length, active: active.length, measured: active.filter(e => e.hasMeasurement).length, owners: active.filter(e => e.hasOwner).length, deadlines: active.filter(e => e.daysLeft !== null).length, near: active.filter(e => e.daysLeft !== null && e.daysLeft >= 0 && e.daysLeft <= 14).length };
}
