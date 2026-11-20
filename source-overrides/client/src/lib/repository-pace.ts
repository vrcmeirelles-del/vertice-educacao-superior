// Ritmo de entregas do Repositório (20/11/2026). Algoritmo determinístico, sem IA.
//
// Ainda não há histórico de prazos vencidos para treinar ou validar um modelo de risco de atraso
// (todos os pedidos foram criados a partir de 31/10/2026, com prazos de 15/12/2026 em diante).
// O que os dados sustentam é a comparação de ritmo: para cada prazo e curso, quantas entregas
// faltam, quantas por semana seriam necessárias até o prazo e quantas por semana estão chegando.
// O ritmo observado considera só pedidos COM prazo, nos últimos 28 dias, para que importações
// em lote de documentos antigos (pedidos sem prazo) não deem falsa sensação de avanço.

export type PaceRequest = { id: string; course_id?: string | null; due_date?: string | null; active?: boolean | null; not_applicable?: boolean | null };
export type PaceFile = { request_id: string; created_at: string; status?: string | null };
export type PaceStatus = "concluido" | "no_ritmo" | "em_risco" | "critico" | "vencido";
export type PaceGroup = {
  key: string; due: string; courseId: string | null; total: number; delivered: number; pending: number;
  daysLeft: number; requiredPerWeek: number; observedPerWeek: number; projectedDate: string | null; status: PaceStatus;
};

export const OBSERVATION_DAYS = 28;
export const RISK_RATIO = 1;      // ritmo observado abaixo do necessário: em risco
export const CRITICAL_RATIO = 0.5; // abaixo da metade do necessário: crítico

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (s: string) => new Date(s.slice(0, 10) + "T00:00:00Z").getTime();

/** Ritmo por prazo e, dentro de cada prazo, por curso. Pedidos inativos ou "não se aplica" ficam fora. */
export function repositoryPace(requests: PaceRequest[], files: PaceFile[], today = new Date()) {
  const now = startOfDay(isoDay(today));
  const dated = requests.filter((r) => r.due_date && r.active !== false && !r.not_applicable);
  const firstUpload = new Map<string, number>();
  for (const f of files) {
    if (f.status === "devolvido" || f.status === "rejeitado") continue;
    const t = new Date(f.created_at).getTime();
    if (!Number.isFinite(t)) continue;
    const prev = firstUpload.get(f.request_id);
    if (prev === undefined || t < prev) firstUpload.set(f.request_id, t);
  }
  const datedIds = new Set(dated.map((r) => r.id));
  const recent = (ids: Set<string>) => [...firstUpload].filter(([id, t]) => ids.has(id) && t >= now - OBSERVATION_DAYS * DAY && t <= now + DAY).length;
  // Ritmo observado da instituição em pedidos com prazo (base para cada grupo).
  const observedAll = (recent(datedIds) / OBSERVATION_DAYS) * 7;

  const build = (key: string, due: string, courseId: string | null, items: PaceRequest[], observedPerWeek: number): PaceGroup => {
    const delivered = items.filter((r) => firstUpload.has(r.id)).length, total = items.length, pending = total - delivered;
    const daysLeft = Math.round((startOfDay(due) - now) / DAY);
    const requiredPerWeek = pending && daysLeft > 0 ? (pending / daysLeft) * 7 : pending ? Infinity : 0;
    const projectedDate = pending === 0 ? isoDay(today) : observedPerWeek > 0 ? isoDay(new Date(now + (pending / observedPerWeek) * 7 * DAY)) : null;
    const status: PaceStatus = pending === 0 ? "concluido" : daysLeft < 0 ? "vencido"
      : observedPerWeek >= requiredPerWeek * RISK_RATIO ? "no_ritmo" : observedPerWeek >= requiredPerWeek * CRITICAL_RATIO ? "em_risco" : "critico";
    return { key, due, courseId, total, delivered, pending, daysLeft, requiredPerWeek, observedPerWeek, projectedDate, status };
  };

  const byDue = new Map<string, PaceRequest[]>();
  for (const r of dated) byDue.set(String(r.due_date).slice(0, 10), [...(byDue.get(String(r.due_date).slice(0, 10)) ?? []), r]);
  const deadlines = [...byDue].sort(([a], [b]) => a.localeCompare(b)).map(([due, items]) => build(due, due, null, items, observedAll));

  const rank: Record<PaceStatus, number> = { vencido: 0, critico: 1, em_risco: 2, no_ritmo: 3, concluido: 4 };
  const courses: PaceGroup[] = [];
  for (const [due, items] of byDue) {
    const byCourse = new Map<string, PaceRequest[]>();
    for (const r of items) byCourse.set(String(r.course_id ?? ""), [...(byCourse.get(String(r.course_id ?? "")) ?? []), r]);
    for (const [courseId, list] of byCourse) {
      const observed = (recent(new Set(list.map((r) => r.id))) / OBSERVATION_DAYS) * 7;
      courses.push(build(due + "|" + courseId, due, courseId || null, list, observed));
    }
  }
  courses.sort((a, b) => a.due.localeCompare(b.due) || rank[a.status] - rank[b.status] || b.pending - a.pending);
  return { deadlines, courses, observedPerWeek: observedAll, undated: requests.length - dated.length };
}
