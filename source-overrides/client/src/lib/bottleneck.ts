// Mapa de disciplinas-gargalo (20/11/2026). Algoritmo estatístico, sem IA.
//
// Fonte: vertice_offering_outcomes (uma linha por oferta: curso, disciplina, semestre, turma, docentes,
// aprovados, reprovações RF/RN/RA e demais status). Cada oferta é comparada às demais ofertas DO MESMO
// CURSO NO MESMO SEMESTRE (controla o perfil do curso e o semestre), pelo desvio binomial da taxa de
// reprovação entre os que tiveram resultado. Ofertas ainda em curso (CR) ou aguardando prova final (PF)
// acima de 10% ficam fora. Gargalo = reprovação acima dos pares de forma repetida; o ranking é pelo
// excesso de reprovações (quantas matrículas a mais reprovaram do que o esperado pelos pares).
// A cada leitura, verifica nos próprios dados se o desvio de uma oferta antecipa o da oferta seguinte
// da mesma disciplina; sem isso, o mapa não é publicado.

export type OfferingRow = {
  course_code: string | null; discipline: string | null; semester: string; teachers?: string | null;
  passed_direct: number | null; passed_final: number | null; source_failures: number | null;
  rf?: number | null; rn?: number | null; ra?: number | null; other_status?: string | null;
};
export type ScoredOffering = {
  course: string; discipline: string; key: string; semester: string; teachers: string;
  n: number; failures: number; byAbsence: number; rate: number; peerRate: number; expected: number; z: number;
};
export type BottleneckLevel = "persistente" | "recente" | "atencao" | "normal";
export type TeacherPattern = "varios_docentes" | "um_docente" | "indefinido";
export type Bottleneck = {
  course: string; discipline: string; level: BottleneckLevel; offerings: ScoredOffering[];
  failures: number; expected: number; excess: number; pooledZ: number; strong: number;
  absenceShare: number; teacherPattern: TeacherPattern;
};
export type BottleneckValidation = {
  ready: boolean; reason: string; pairs: number; corr: number | null; alerts: number;
  hitRate: number | null; baseRate: number | null; repeatRate: number | null; baseRepeat: number | null;
};

export const MIN_DECIDED = 10;   // matrículas com resultado na oferta
export const MAX_PENDING = 0.1;  // cursando + prova final, em proporção dos com resultado
export const MIN_PEERS = 5;      // ofertas do curso no semestre
export const Z_STRONG = 2;
export const WINDOW = 6;         // semestres com resultado considerados no mapa
export const MIN_PAIRS = 30, MIN_ALERTS = 5, MIN_LIFT = 0.2;

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const statusCount = (status: string | null | undefined, code: string) =>
  String(status ?? "").split("|").reduce((s, part) => { const [c, q] = part.split(":"); return c?.trim() === code ? s + num(q) : s; }, 0);

/** Desvio de cada oferta em relação às demais ofertas do mesmo curso e semestre. */
export function scoreOfferings(rows: OfferingRow[]): ScoredOffering[] {
  type Base = Omit<ScoredOffering, "rate" | "peerRate" | "expected" | "z">;
  const merged = new Map<string, Base>();
  for (const r of rows) {
    const failures = num(r.source_failures), n = num(r.passed_direct) + num(r.passed_final) + failures;
    const pending = statusCount(r.other_status, "CR") + statusCount(r.other_status, "PF");
    if (n < 1 || pending > MAX_PENDING * n || !r.discipline || !r.course_code) continue;
    const course = String(r.course_code), discipline = String(r.discipline).trim(), key = course + "|" + norm(discipline);
    const id = key + "|" + r.semester, prev = merged.get(id);
    const teachers = String(r.teachers ?? "").trim();
    // Turmas da mesma disciplina no mesmo semestre são somadas numa oferta.
    if (prev) { prev.n += n; prev.failures += failures; prev.byAbsence += num(r.rf); if (teachers && !prev.teachers.includes(teachers)) prev.teachers += (prev.teachers ? " / " : "") + teachers; }
    else merged.set(id, { course, discipline, key, semester: String(r.semester), teachers, n, failures, byAbsence: num(r.rf) });
  }
  const offers = [...merged.values()].filter((o) => o.n >= MIN_DECIDED);
  const groups = new Map<string, Base[]>();
  for (const o of offers) { const g = o.course + "|" + o.semester; groups.set(g, [...(groups.get(g) ?? []), o]); }
  const out: ScoredOffering[] = [];
  for (const g of groups.values()) {
    if (g.length < MIN_PEERS) continue;
    const N = g.reduce((s, o) => s + o.n, 0), K = g.reduce((s, o) => s + o.failures, 0);
    for (const o of g) {
      const p = (K - o.failures + 0.5) / (N - o.n + 1); // pares sem a própria oferta, suavizado
      out.push({ ...o, rate: o.failures / o.n, peerRate: p, expected: o.n * p, z: (o.failures - o.n * p) / Math.sqrt(o.n * p * (1 - p)) });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key) || a.semester.localeCompare(b.semester));
}

function pearson(a: number[], b: number[]) {
  const n = a.length; if (n < 3) return null;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : null;
}

/** O desvio de uma oferta antecipa o da oferta seguinte da mesma disciplina? */
export function validateBottlenecks(scored: ScoredOffering[]): BottleneckValidation {
  const pairs: [ScoredOffering, ScoredOffering][] = [];
  for (let i = 0; i + 1 < scored.length; i++) if (scored[i].key === scored[i + 1].key) pairs.push([scored[i], scored[i + 1]]);
  const alerts = pairs.filter(([a]) => a.z >= Z_STRONG);
  const share = (xs: typeof pairs, f: (b: ScoredOffering) => boolean) => (xs.length ? round(xs.filter(([, b]) => f(b)).length / xs.length) : null);
  const hitRate = share(alerts, (b) => b.z > 0), baseRate = share(pairs, (b) => b.z > 0);
  const repeatRate = share(alerts, (b) => b.z >= Z_STRONG), baseRepeat = share(pairs, (b) => b.z >= Z_STRONG);
  const c = pearson(pairs.map(([a]) => a.z), pairs.map(([, b]) => b.z));
  let reason = "";
  if (pairs.length < MIN_PAIRS) reason = `Histórico insuficiente: ${pairs.length} de ${MIN_PAIRS} ofertas consecutivas da mesma disciplina.`;
  else if (alerts.length < MIN_ALERTS) reason = `Poucos desvios fortes no histórico (${alerts.length} de ${MIN_ALERTS}).`;
  else if ((hitRate ?? 0) - (baseRate ?? 0) < MIN_LIFT) reason = `O desvio de uma oferta não antecipou a seguinte melhor que o acaso (${Math.round((hitRate ?? 0) * 100)}% contra ${Math.round((baseRate ?? 0) * 100)}%).`;
  else if ((repeatRate ?? 0) < 2 * (baseRepeat ?? 0)) reason = "O desvio forte não se repetiu na oferta seguinte com frequência suficiente.";
  return { ready: !reason, reason: reason || "Mapa validado nos dados da própria instituição.", pairs: pairs.length, corr: c == null ? null : round(c), alerts: alerts.length, hitRate, baseRate, repeatRate, baseRepeat };
}

/** Classificação por disciplina nos semestres recentes, ordenada pelo excesso de reprovações. */
export function bottlenecks(scored: ScoredOffering[]): Bottleneck[] {
  const sems = [...new Set(scored.map((s) => s.semester))].sort();
  const window = new Set(sems.slice(-WINDOW)), last = sems[sems.length - 1];
  const byKey = new Map<string, ScoredOffering[]>();
  for (const s of scored) if (window.has(s.semester)) byKey.set(s.key, [...(byKey.get(s.key) ?? []), s]);
  const rank: Record<BottleneckLevel, number> = { persistente: 0, recente: 1, atencao: 2, normal: 3 };
  return [...byKey.values()].map((offerings) => {
    const failures = offerings.reduce((s, o) => s + o.failures, 0), expected = offerings.reduce((s, o) => s + o.expected, 0);
    const variance = offerings.reduce((s, o) => s + o.n * o.peerRate * (1 - o.peerRate), 0);
    const pooledZ = variance > 0 ? (failures - expected) / Math.sqrt(variance) : 0;
    const strongOffers = offerings.filter((o) => o.z >= Z_STRONG), latest = offerings[offerings.length - 1];
    const level: BottleneckLevel = strongOffers.length >= 2 && pooledZ >= Z_STRONG ? "persistente"
      : latest.semester === last && latest.z >= Z_STRONG ? "recente"
      : offerings.length >= 2 && pooledZ >= 1.5 ? "atencao" : "normal";
    const teacherSets = new Set(strongOffers.map((o) => norm(o.teachers)).filter(Boolean));
    const teacherPattern: TeacherPattern = strongOffers.length < 2 || !teacherSets.size ? "indefinido" : teacherSets.size >= 2 ? "varios_docentes" : "um_docente";
    return { course: latest.course, discipline: latest.discipline, level, offerings, failures, expected: round(expected, 1), excess: round(failures - expected, 1), pooledZ: round(pooledZ), strong: strongOffers.length,
      absenceShare: failures ? round(offerings.reduce((s, o) => s + o.byAbsence, 0) / failures) : 0, teacherPattern };
  }).sort((a, b) => rank[a.level] - rank[b.level] || b.excess - a.excess);
}

export function bottleneckMap(rows: OfferingRow[]) {
  const scored = scoreOfferings(rows);
  return { validation: validateBottlenecks(scored), disciplines: bottlenecks(scored), offerings: scored.length };
}
