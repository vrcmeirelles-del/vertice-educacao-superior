// Titulação do corpo docente: cálculo e simulação do indicador 4.1 (20/11/2026). Algoritmo determinístico.
//
// As faixas NÃO são digitadas aqui: são lidas do texto oficial dos critérios do indicador 4.1 no
// instrumento cadastrado (avaliacao-institucional.json: "ao menos 25%", "ao menos 40%"...). Se o texto
// mudar e não for possível ler as quatro faixas, o cálculo é recusado em vez de adivinhado.
// Trava de qualidade: se o cadastro tem cara de valor padrão de importação (todos com a mesma
// titulação, o mesmo regime, a mesma carga e nenhum curso vinculado), o conceito é marcado como não
// confiável. É uma estimativa de apoio à gestão, não o conceito atribuído pela comissão avaliadora.

export type FacultyRow = { titulacao?: string | null; regime?: string | null; ch_semanal?: number | null; cursos_vinculados?: string[] | null };
export type Degree = "doutor" | "mestre" | "especialista" | "graduado" | "nao_informado";
export type Threshold = { level: number; min: number };
export type Mix = Record<Degree, number>;

// Arredonda para cima tolerando erro de ponto flutuante (4 / 0,2 = 20,000000000000004 deve dar 20).
const ceil = (v: number) => Math.ceil(v - 1e-9);
const fold = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function degreeOf(v: unknown): Degree {
  const s = fold(v);
  if (/doutor|phd|pos-?doutor/.test(s)) return "doutor";
  if (/mestr/.test(s)) return "mestre";
  if (/especiali|lato/.test(s)) return "especialista";
  if (/gradua|bacharel|licenciad|tecnolog/.test(s)) return "graduado";
  return "nao_informado";
}

/** Lê as faixas mínimas (níveis 2 a 5) do texto dos critérios. Devolve null se não conseguir ler as quatro. */
export function thresholdsFrom(criteria: Record<string, string>): Threshold[] | null {
  const out: Threshold[] = [];
  for (const level of [2, 3, 4, 5]) {
    const m = fold(criteria[String(level)]).match(/ao menos\s+(\d{1,3})\s*%/);
    if (!m) return null;
    out.push({ level, min: Number(m[1]) / 100 });
  }
  return out.every((t, i) => i === 0 || t.min > out[i - 1].min) ? out : null;
}

export function conceptFor(share: number, thresholds: Threshold[]): number {
  return thresholds.reduce((c, t) => (share >= t.min ? t.level : c), 1);
}

export function mixOf(rows: FacultyRow[]): Mix {
  const mix: Mix = { doutor: 0, mestre: 0, especialista: 0, graduado: 0, nao_informado: 0 };
  for (const r of rows) mix[degreeOf(r.titulacao)]++;
  return mix;
}

export function titulationIndicator(rows: FacultyRow[], thresholds: Threshold[] | null) {
  const mix = mixOf(rows), total = rows.length, md = mix.doutor + mix.mestre;
  const share = total ? md / total : 0;
  const suspicious = total >= 10 && new Set(rows.map((r) => fold(r.titulacao))).size === 1
    && new Set(rows.map((r) => fold(r.regime))).size === 1 && new Set(rows.map((r) => r.ch_semanal ?? null)).size === 1
    && rows.every((r) => !r.cursos_vinculados?.length);
  const concept = thresholds && total ? conceptFor(share, thresholds) : null;
  const next = thresholds?.find((t) => t.level === (concept ?? 1) + 1) ?? null;
  // Menor número de mestres/doutores a contratar (sem desligar ninguém) para alcançar a próxima faixa.
  const hiresToNext = next ? Math.max(0, ceil((next.min * total - md) / (1 - next.min))) : null;
  // Ou: quantos docentes atuais precisariam concluir mestrado/doutorado.
  const upgradesToNext = next ? Math.max(0, ceil(next.min * total - md)) : null;
  return { mix, total, share, concept, next, hiresToNext, upgradesToNext, reliable: !suspicious && mix.nao_informado === 0, suspicious };
}

/** Simulação: soma (ou subtrai, com valor negativo) docentes por titulação e recalcula o conceito. */
export function simulate(mix: Mix, delta: Partial<Mix>, thresholds: Threshold[]) {
  const m = { ...mix };
  for (const k of Object.keys(delta) as Degree[]) m[k] = Math.max(0, m[k] + (delta[k] ?? 0));
  const total = Object.values(m).reduce((s, v) => s + v, 0), share = total ? (m.doutor + m.mestre) / total : 0;
  return { mix: m, total, share, concept: total ? conceptFor(share, thresholds) : null };
}
