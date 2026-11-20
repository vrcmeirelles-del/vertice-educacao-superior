// Alerta precoce de evasão por curso (20/11/2026). Algoritmo estatístico, sem IA.
//
// Os dados de vertice_course_semester_stats são um retrato único da situação atual de cada
// coorte de ingresso. Por isso NÃO há previsão da taxa do próximo semestre: coortes recentes
// tiveram menos tempo para evadir e sempre parecem melhores. O que é válido é a comparação
// dentro da mesma coorte (mesmo tempo de exposição): quais cursos evadem muito acima dos pares
// da mesma modalidade. Um curso que destoa numa coorte tende a destoar na seguinte; isso é
// verificado nos próprios dados a cada leitura (validate) e o alerta só é publicado se passar.
//
// Evasão definitiva = abandono + cancelado + transferido + troca de curso. Trancamento é
// reversível e aparece em indicador separado (houve trancamentos em massa administrativos).

export type CohortRow = {
  codigo: string; curso?: string | null; modalidade?: string | null; semestre: string;
  total_registros: number | null; abandono: number | null; cancelado: number | null;
  transferido: number | null; troca_curso: number | null; trancado: number | null;
};
export type Scored = {
  codigo: string; curso: string; modalidade: string; cohort: string; n: number;
  dropouts: number; locked: number; rate: number; peerRate: number; z: number; lockZ: number;
};
export type Validation = {
  ready: boolean; reason: string; pairs: number; corr: number | null;
  alerts: number; hitRate: number | null; baseRate: number | null; repeatRate: number | null; baseRepeat: number | null;
};
export type Level = "alerta" | "atencao" | "normal";
export type CourseAlert = {
  codigo: string; curso: string; modalidade: string; level: Level; recent: Scored[];
  meanZ: number; last: Scored; lockAtypical: boolean;
};

export const MIN_N = 10;        // registros mínimos do curso na coorte
export const MIN_PEERS = 4;     // cursos mínimos (com o próprio) no grupo de comparação
export const Z_ALERT = 2;       // desvio forte
export const Z_WATCH = 1;       // desvio moderado e persistente
export const RECENT = 4;        // coortes recentes consideradas no nível do curso
export const MIN_PAIRS = 30;    // validação: pares coorte → coorte seguinte
export const MIN_ALERTS = 5;    // validação: alertas observados no histórico
export const MIN_LIFT = 0.2;    // validação: acerto do alerta acima da base (pontos)

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const binomZ = (k: number, n: number, p: number) => (p > 0 && p < 1 ? (k - n * p) / Math.sqrt(n * p * (1 - p)) : 0);

/** Desvio de cada curso em relação aos pares da mesma coorte e modalidade (pares sem o próprio curso). */
export function scoreCohorts(rows: CohortRow[]): Scored[] {
  const base = rows
    .map((r) => ({
      codigo: String(r.codigo), curso: String(r.curso ?? r.codigo), modalidade: String(r.modalidade ?? "—"), cohort: String(r.semestre),
      n: num(r.total_registros), dropouts: num(r.abandono) + num(r.cancelado) + num(r.transferido) + num(r.troca_curso), locked: num(r.trancado),
    }))
    .filter((r) => r.n >= MIN_N);
  const groups = new Map<string, typeof base>();
  for (const r of base) {
    const key = r.cohort + "|" + r.modalidade;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: Scored[] = [];
  for (const g of groups.values()) {
    if (g.length < MIN_PEERS) continue;
    const N = g.reduce((s, r) => s + r.n, 0), K = g.reduce((s, r) => s + r.dropouts, 0), L = g.reduce((s, r) => s + r.locked, 0);
    for (const r of g) {
      // Taxa dos pares suavizada ((casos + 0,5) / (registros + 1)): nunca zera, então um curso
      // com evasão ou trancamento entre pares que não têm nenhum caso também é detectado.
      const pn = N - r.n, p = (K - r.dropouts + 0.5) / (pn + 1), pl = (L - r.locked + 0.5) / (pn + 1);
      out.push({ ...r, rate: r.dropouts / r.n, peerRate: p, z: binomZ(r.dropouts, r.n, p), lockZ: binomZ(r.locked, r.n, pl) });
    }
  }
  return out.sort((a, b) => a.cohort.localeCompare(b.cohort) || a.codigo.localeCompare(b.codigo));
}

function pearson(a: number[], b: number[]) {
  const n = a.length; if (n < 3) return null;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : null;
}

/** Verifica nos próprios dados se o desvio numa coorte antecipa o da coorte seguinte. */
export function validate(scored: Scored[]): Validation {
  const cohorts = [...new Set(scored.map((s) => s.cohort))].sort();
  const next = new Map(cohorts.map((c, i) => [c, cohorts[i + 1]]));
  const byKey = new Map(scored.map((s) => [s.codigo + "|" + s.cohort, s]));
  const pairs: [Scored, Scored][] = [];
  for (const s of scored) {
    const nx = next.get(s.cohort);
    const t = nx ? byKey.get(s.codigo + "|" + nx) : undefined;
    if (t) pairs.push([s, t]);
  }
  const alerts = pairs.filter(([a]) => a.z >= Z_ALERT);
  const share = (xs: [Scored, Scored][], f: (b: Scored) => boolean) => (xs.length ? xs.filter(([, b]) => f(b)).length / xs.length : null);
  const hitRate = share(alerts, (b) => b.z > 0), baseRate = share(pairs, (b) => b.z > 0);
  const repeatRate = share(alerts, (b) => b.z >= Z_ALERT), baseRepeat = share(pairs, (b) => b.z >= Z_ALERT);
  const corr = pearson(pairs.map(([a]) => a.z), pairs.map(([, b]) => b.z));
  const v = { pairs: pairs.length, corr: corr == null ? null : round(corr), alerts: alerts.length,
    hitRate: hitRate == null ? null : round(hitRate), baseRate: baseRate == null ? null : round(baseRate),
    repeatRate: repeatRate == null ? null : round(repeatRate), baseRepeat: baseRepeat == null ? null : round(baseRepeat) };
  let reason = "";
  if (pairs.length < MIN_PAIRS) reason = `Histórico insuficiente: ${pairs.length} de ${MIN_PAIRS} comparações entre coortes consecutivas.`;
  else if (alerts.length < MIN_ALERTS) reason = `Poucos desvios fortes no histórico (${alerts.length} de ${MIN_ALERTS}) para medir o acerto do alerta.`;
  else if ((hitRate ?? 0) - (baseRate ?? 0) < MIN_LIFT) reason = `O alerta não antecipou a coorte seguinte melhor que o acaso (${Math.round((hitRate ?? 0) * 100)}% contra ${Math.round((baseRate ?? 0) * 100)}%).`;
  else if ((repeatRate ?? 0) < 2 * (baseRepeat ?? 0)) reason = "O desvio forte não se repetiu na coorte seguinte com frequência suficiente.";
  return { ready: !reason, reason: reason || "Alerta validado nos dados da própria instituição.", ...v };
}

/** Nível de cada curso nas coortes recentes. Só é publicado se a validação passar. */
export function courseAlerts(scored: Scored[]): CourseAlert[] {
  const cohorts = [...new Set(scored.map((s) => s.cohort))].sort();
  const recentSet = new Set(cohorts.slice(-RECENT));
  const lastTwo = new Set(cohorts.slice(-2));
  const byCourse = new Map<string, Scored[]>();
  for (const s of scored) if (recentSet.has(s.cohort)) byCourse.set(s.codigo, [...(byCourse.get(s.codigo) ?? []), s]);
  const rank: Record<Level, number> = { alerta: 0, atencao: 1, normal: 2 };
  return [...byCourse.values()].map((recent) => {
    const meanZ = recent.reduce((s, r) => s + r.z, 0) / recent.length;
    const last = recent[recent.length - 1];
    const strong = recent.some((r) => lastTwo.has(r.cohort) && r.z >= Z_ALERT);
    const level: Level = strong ? "alerta" : recent.length >= 2 && meanZ >= Z_WATCH ? "atencao" : "normal";
    return { codigo: last.codigo, curso: last.curso, modalidade: last.modalidade, level, recent, meanZ: round(meanZ), last, lockAtypical: recent.some((r) => r.lockZ >= Z_ALERT) };
  }).sort((a, b) => rank[a.level] - rank[b.level] || b.meanZ - a.meanZ);
}

export function evasionAlert(rows: CohortRow[]) {
  const scored = scoreCohorts(rows);
  const validation = validate(scored);
  return { validation, courses: courseAlerts(scored), scoredRows: scored.length };
}
