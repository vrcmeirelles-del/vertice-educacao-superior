import { supabase } from './supabase';

// ---------- types ----------
export type Semestre = { id: number; semestre: string };
export type CursoQuantitativo = {
  id: number;
  semestre_id: number;
  curso_id: number;
  grade_id: number | null;
  total_vinculos: number;
  total_matriculados: number;
  total_turmas: number;
  data_extracao: string;
};
export type CursoInfo = {
  id: number;
  nome: string;
  modalidade: string;
  ativo: boolean;
};
// A tabela vertice_academic_reports guarda o conteúdo na coluna JSONB `payload`.
export type AcademicReportRow = {
  id: string;
  institution_id: string;
  kind: string;
  dedupe_key: string | null;
  payload: Record<string, any>;
  source_report_at: string | null;
  imported_at: string | null;
};

// ---------- queries ----------
async function fetchAllFrom<T>(table: string, order = 'id'): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(order)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function fetchSemestres() {
  return fetchAllFrom<Semestre>('vertice_eorbit_semestres');
}
export async function fetchCursos() {
  return fetchAllFrom<CursoInfo>('vertice_eorbit_cursos');
}
export async function fetchQuantitativo() {
  return fetchAllFrom<CursoQuantitativo>('vertice_eorbit_quantitativo');
}

// Mapa course_id (UUID de vertice_courses) -> nome do curso, para os indicadores por curso.
export async function fetchCourseNames(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('vertice_courses')
      .select('id,name')
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as any[]) m.set(String(r.id), String(r.name ?? 'Curso'));
    if (!data || data.length < 1000) break;
  }
  return m;
}

// Lê registros de vertice_academic_reports por institution + kinds (pagina de 1000).
export async function fetchReports(institutionId: string, kinds: string[]) {
  const rows: AcademicReportRow[] = [];
  for (const kind of kinds) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('vertice_academic_reports')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('kind', kind)
        .order('id')
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...((data ?? []) as AcademicReportRow[]));
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}

// ---------- parsers (payload -> typed) ----------
export type ProfReprova = {
  ranking: number; nome: string; total: number;
  disciplinas?: number; ofertas?: number;
  raApos?: number; rfFaltas?: number; rnNotas?: number;
  semestres?: number; vinculos?: number; taxa?: number;
};
export type DiscReprova = { ranking: number; disciplina: string; total: number };
export type FluxoSemestre = {
  semestre: string; matriculados: number; pre: number; trancados: number;
  abandono: number; concluidos: number; cancelados: number;
  transferidos: number; trocaCurso: number; graduados: number; total: number;
};
export type ReprovaSemestre = { semestre: string; reprovacoes: number; matriculas: number; pct: number };

const pctToNum = (v: any): number | undefined => {
  if (v == null) return undefined;
  const n = parseFloat(String(v).replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

export function parseProfReprova(rows: AcademicReportRow[]): ProfReprova[] {
  return rows.map(r => {
    const p = r.payload || {};
    return {
      ranking: Number(p.r ?? 0),
      nome: String(p.n ?? '—'),
      total: Number(p.t ?? 0),
      disciplinas: p.di != null ? Number(p.di) : undefined,
      ofertas: p.of != null ? Number(p.of) : undefined,
      raApos: p.ra != null ? Number(p.ra) : undefined,
      rfFaltas: p.rf != null ? Number(p.rf) : undefined,
      rnNotas: p.rn != null ? Number(p.rn) : undefined,
      semestres: p.se != null ? Number(p.se) : undefined,
      vinculos: p.tv != null ? Number(p.tv) : undefined,
      taxa: pctToNum(p.tx),
    };
  }).sort((a, b) => a.ranking - b.ranking);
}

export function parseDiscReprova(rows: AcademicReportRow[]): DiscReprova[] {
  return rows.map(r => {
    const p = r.payload || {};
    return { ranking: Number(p.r ?? 0), disciplina: String(p.d ?? '—'), total: Number(p.t ?? 0) };
  }).sort((a, b) => a.ranking - b.ranking);
}

export function parseFluxo(rows: AcademicReportRow[]): FluxoSemestre[] {
  return rows.map(r => {
    const p = r.payload || {};
    return {
      semestre: String(p.s ?? ''),
      matriculados: Number(p.mat ?? 0),
      pre: Number(p.pre ?? 0),
      trancados: Number(p.tranc ?? 0),
      abandono: Number(p.aband ?? 0),
      concluidos: Number(p.concl ?? 0),
      cancelados: Number(p.canc ?? 0),
      transferidos: Number(p.transf ?? 0),
      trocaCurso: Number(p.troca ?? 0),
      graduados: Number(p.grad ?? 0),
      total: Number(p.total ?? 0),
    };
  }).sort((a, b) => a.semestre.localeCompare(b.semestre));
}

export function parseReprovaSemestre(rows: AcademicReportRow[]): ReprovaSemestre[] {
  return rows.map(r => {
    const p = r.payload || {};
    return {
      semestre: String(p.s ?? ''),
      reprovacoes: Number(p.reprovacoes ?? 0),
      matriculas: Number(p.matriculas ?? 0),
      pct: pctToNum(p.pct_reprovacao) ?? 0,
    };
  }).sort((a, b) => a.semestre.localeCompare(b.semestre));
}

// ---------- aggregations (visão geral) ----------
export type KPIsAcademico = {
  totalVinculos: number;
  totalMatriculados: number;
  cursosAtivos: number;
  taxaMatricula: number;
};
export type CursoResumo = {
  cursoId: number;
  nome: string;
  modalidade: string;
  vinculos: number;
  matriculados: number;
  turmas: number;
  taxaMatricula: number;
};
export type ModalidadeDistribuicao = {
  modalidade: string;
  vinculos: number;
  matriculados: number;
};
export type EvolucaoSemestral = {
  semestre: string;
  semestreId: number;
  vinculos: number;
  matriculados: number;
};

export function aggregateAcademico(
  quantitativo: CursoQuantitativo[],
  cursos: CursoInfo[],
  semestres: Semestre[],
  semestreId: number | null,
) {
  const cursoMap = new Map(cursos.map(c => [c.id, c]));
  const semestreMap = new Map(semestres.map(s => [s.id, s]));

  const filtered = semestreId
    ? quantitativo.filter(q => q.semestre_id === semestreId)
    : quantitativo;

  const byCurso = new Map<number, { vinculos: number; matriculados: number; turmas: number }>();
  for (const q of filtered) {
    const prev = byCurso.get(q.curso_id) ?? { vinculos: 0, matriculados: 0, turmas: 0 };
    byCurso.set(q.curso_id, {
      vinculos: prev.vinculos + q.total_vinculos,
      matriculados: prev.matriculados + q.total_matriculados,
      turmas: prev.turmas + q.total_turmas,
    });
  }

  let totalVinculos = 0, totalMatriculados = 0, cursosAtivos = 0;
  for (const [, v] of byCurso) {
    totalVinculos += v.vinculos;
    totalMatriculados += v.matriculados;
    if (v.vinculos > 0) cursosAtivos++;
  }
  const taxaMatricula = totalVinculos > 0 ? (totalMatriculados / totalVinculos) * 100 : 0;
  const kpis: KPIsAcademico = { totalVinculos, totalMatriculados, cursosAtivos, taxaMatricula };

  const cursosResumo: CursoResumo[] = [...byCurso]
    .map(([cursoId, v]) => {
      const info = cursoMap.get(cursoId);
      return {
        cursoId,
        nome: info?.nome ?? `Curso ${cursoId}`,
        modalidade: info?.modalidade ?? 'presencial',
        vinculos: v.vinculos,
        matriculados: v.matriculados,
        turmas: v.turmas,
        taxaMatricula: v.vinculos > 0 ? (v.matriculados / v.vinculos) * 100 : 0,
      };
    })
    .sort((a, b) => b.vinculos - a.vinculos);

  const modMap = new Map<string, { vinculos: number; matriculados: number }>();
  for (const c of cursosResumo) {
    const mod = c.modalidade.charAt(0).toUpperCase() + c.modalidade.slice(1);
    const prev = modMap.get(mod) ?? { vinculos: 0, matriculados: 0 };
    modMap.set(mod, {
      vinculos: prev.vinculos + c.vinculos,
      matriculados: prev.matriculados + c.matriculados,
    });
  }
  const modalidades: ModalidadeDistribuicao[] = [...modMap]
    .map(([modalidade, v]) => ({ modalidade, ...v }))
    .sort((a, b) => b.vinculos - a.vinculos);

  const bySem = new Map<number, { vinculos: number; matriculados: number }>();
  for (const q of quantitativo) {
    const prev = bySem.get(q.semestre_id) ?? { vinculos: 0, matriculados: 0 };
    bySem.set(q.semestre_id, {
      vinculos: prev.vinculos + q.total_vinculos,
      matriculados: prev.matriculados + q.total_matriculados,
    });
  }
  const evolucao: EvolucaoSemestral[] = [...bySem]
    .map(([sid, v]) => ({
      semestre: semestreMap.get(sid)?.semestre ?? `${sid}`,
      semestreId: sid,
      ...v,
    }))
    .sort((a, b) => a.semestre.localeCompare(b.semestre));

  const inativos = cursos
    .filter(c => !byCurso.has(c.id) || (byCurso.get(c.id)?.vinculos ?? 0) === 0)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return { kpis, cursosResumo, modalidades, evolucao, inativos };
}

// ---------- simulações: comparador de semestres ----------
export type CursoDelta = {
  cursoId: number;
  nome: string;
  modalidade: string;
  vinculosA: number;
  vinculosB: number;
  matriculadosA: number;
  matriculadosB: number;
  deltaVinculos: number;
  deltaMatriculados: number;
  variacaoPct: number; // variação % de vínculos
};
export type ComparacaoSemestres = {
  semestreA: string;
  semestreB: string;
  totalVinculosA: number;
  totalVinculosB: number;
  totalMatriculadosA: number;
  totalMatriculadosB: number;
  deltaVinculos: number;
  deltaMatriculados: number;
  variacaoVinculosPct: number;
  cursos: CursoDelta[];
  ganhos: CursoDelta[];
  perdas: CursoDelta[];
};

function somaPorCurso(quantitativo: CursoQuantitativo[], semestreId: number) {
  const m = new Map<number, { v: number; mat: number }>();
  for (const q of quantitativo) {
    if (q.semestre_id !== semestreId) continue;
    const prev = m.get(q.curso_id) ?? { v: 0, mat: 0 };
    m.set(q.curso_id, { v: prev.v + q.total_vinculos, mat: prev.mat + q.total_matriculados });
  }
  return m;
}

export function compararSemestres(
  quantitativo: CursoQuantitativo[],
  cursos: CursoInfo[],
  semestres: Semestre[],
  semIdA: number,
  semIdB: number,
): ComparacaoSemestres {
  const cursoMap = new Map(cursos.map(c => [c.id, c]));
  const semMap = new Map(semestres.map(s => [s.id, s.semestre]));
  const a = somaPorCurso(quantitativo, semIdA);
  const b = somaPorCurso(quantitativo, semIdB);
  const ids = new Set<number>([...a.keys(), ...b.keys()]);

  const cursosDelta: CursoDelta[] = [];
  for (const id of ids) {
    const va = a.get(id)?.v ?? 0, vb = b.get(id)?.v ?? 0;
    const ma = a.get(id)?.mat ?? 0, mb = b.get(id)?.mat ?? 0;
    if (va === 0 && vb === 0) continue;
    const info = cursoMap.get(id);
    cursosDelta.push({
      cursoId: id,
      nome: info?.nome ?? `Curso ${id}`,
      modalidade: info?.modalidade ?? 'presencial',
      vinculosA: va, vinculosB: vb,
      matriculadosA: ma, matriculadosB: mb,
      deltaVinculos: vb - va,
      deltaMatriculados: mb - ma,
      variacaoPct: va > 0 ? ((vb - va) / va) * 100 : (vb > 0 ? 100 : 0),
    });
  }
  cursosDelta.sort((x, y) => y.deltaVinculos - x.deltaVinculos);

  const totalVinculosA = [...a.values()].reduce((s, x) => s + x.v, 0);
  const totalVinculosB = [...b.values()].reduce((s, x) => s + x.v, 0);
  const totalMatriculadosA = [...a.values()].reduce((s, x) => s + x.mat, 0);
  const totalMatriculadosB = [...b.values()].reduce((s, x) => s + x.mat, 0);

  return {
    semestreA: semMap.get(semIdA) ?? String(semIdA),
    semestreB: semMap.get(semIdB) ?? String(semIdB),
    totalVinculosA, totalVinculosB, totalMatriculadosA, totalMatriculadosB,
    deltaVinculos: totalVinculosB - totalVinculosA,
    deltaMatriculados: totalMatriculadosB - totalMatriculadosA,
    variacaoVinculosPct: totalVinculosA > 0 ? ((totalVinculosB - totalVinculosA) / totalVinculosA) * 100 : 0,
    cursos: cursosDelta,
    ganhos: cursosDelta.filter(c => c.deltaVinculos > 0).slice(0, 8),
    perdas: cursosDelta.filter(c => c.deltaVinculos < 0).sort((x, y) => x.deltaVinculos - y.deltaVinculos).slice(0, 8),
  };
}

// ---------- simulações: retenção (what-if) ----------
export type SimulacaoRetencao = {
  reprovacoesBase: number;
  reducaoPct: number;
  alunosRetidos: number;
  mensalidade: number;
  receitaSemestral: number;
  receitaAnual: number;
  receitaCiclo: number; // projeção até o fim de um ciclo médio (anos restantes)
};

// Estima o impacto de reduzir reprovações: cada reprovação evitada = 1 vínculo retido
// (aproximação gerencial — uma reprovação é um gatilho forte de evasão).
export function simularRetencao(
  reprovacoesBase: number,
  reducaoPct: number,
  mensalidade: number,
  anosRestantesMedia = 2,
): SimulacaoRetencao {
  const alunosRetidos = Math.round(reprovacoesBase * (reducaoPct / 100));
  const receitaSemestral = alunosRetidos * mensalidade * 6;
  const receitaAnual = alunosRetidos * mensalidade * 12;
  return {
    reprovacoesBase,
    reducaoPct,
    alunosRetidos,
    mensalidade,
    receitaSemestral,
    receitaAnual,
    receitaCiclo: receitaAnual * anosRestantesMedia,
  };
}

// ---------- evasão e renovação (coortes) ----------
// Fonte: vertice_academic_reports kind='cohorts'. Coorte = primeiro vínculo observado
// (uma contagem por CPF na origem). AV1 positiva = nota > 0 localizada.
export type Coorte = {
  cohort: string;
  entrants: number;          // ingressantes
  nextLink: number;          // renovaram (vínculo no semestre seguinte)
  noNext: number;            // não renovaram (sinal de evasão)
  positiveAv1: number;       // tiveram AV1 positiva (desempenho)
  returnedAfterGap: number;  // retornaram após intervalo
  noNextPositiveAv1: number; // evadiram APESAR de desempenho (indício não-acadêmico)
  noNextNoPositiveAv1: number; // evadiram sem desempenho (associado a dificuldade acadêmica)
};
export type CohortsReport = { asOf: string; method: string; coortes: Coorte[] };

export function parseCohorts(rows: AcademicReportRow[]): CohortsReport | null {
  const row = rows[0];
  if (!row) return null;
  const p = row.payload || {};
  const list: any[] = Array.isArray(p.cohorts) ? p.cohorts : [];
  const coortes: Coorte[] = list.map(c => ({
    cohort: String(c.cohort ?? ''),
    entrants: Number(c.entrants ?? 0),
    nextLink: Number(c.next_link ?? 0),
    noNext: Number(c.no_next ?? 0),
    positiveAv1: Number(c.positive_av1 ?? 0),
    returnedAfterGap: Number(c.returned_after_gap ?? 0),
    noNextPositiveAv1: Number(c.no_next_positive_av1 ?? 0),
    noNextNoPositiveAv1: Number(c.no_next_no_positive_av1 ?? 0),
  })).filter(c => c.cohort);
  return { asOf: String(p.as_of ?? ''), method: String(p.method ?? ''), coortes };
}

// Consolidado de evasão/renovação sobre coortes fechadas (com no_next conhecido).
export type EvasaoResumo = {
  ingressantes: number;
  renovaram: number;
  evadiram: number;
  taxaRenovacao: number;
  taxaEvasao: number;
  evadiramComDesempenho: number;    // no_next_positive_av1
  evadiramSemDesempenho: number;    // no_next_no_positive_av1
  pctEvasaoNaoAcademica: number;    // % dos evadidos que tinham desempenho
  retornaram: number;
};
export function resumirEvasao(coortes: Coorte[]): EvasaoResumo {
  // considera apenas coortes com no_next apurado (coorte mais recente ainda em aberto)
  const fechadas = coortes.filter(c => c.noNext > 0 || c.nextLink > 0);
  const ingressantes = fechadas.reduce((s, c) => s + c.entrants, 0);
  const renovaram = fechadas.reduce((s, c) => s + c.nextLink, 0);
  const evadiram = fechadas.reduce((s, c) => s + c.noNext, 0);
  const comDes = fechadas.reduce((s, c) => s + c.noNextPositiveAv1, 0);
  const semDes = fechadas.reduce((s, c) => s + c.noNextNoPositiveAv1, 0);
  const retornaram = fechadas.reduce((s, c) => s + c.returnedAfterGap, 0);
  const baseMov = renovaram + evadiram;
  return {
    ingressantes, renovaram, evadiram,
    taxaRenovacao: baseMov > 0 ? (renovaram / baseMov) * 100 : 0,
    taxaEvasao: baseMov > 0 ? (evadiram / baseMov) * 100 : 0,
    evadiramComDesempenho: comDes,
    evadiramSemDesempenhn: semDes,
    pctEvasaoNaoAcademica: (comDes + semDes) > 0 ? (comDes / (comDes + semDes)) * 100 : 0,
    retornaram,
  };
}

// ---------- indicadores por curso (course_indicators) ----------
// Fonte: vertice_academic_reports kind='course_indicators'. RF (falta), RN (nota),
// RA (após exame) somados por matrícula em disciplina — não por aluno único.
export type ReprovaCursoSem = {
  semestre: string;
  rf: number; rn: number; ra: number;
  reprovacoes: number;           // failures
  matriculasDisciplina: number;  // discipline_enrollments
  mediaNota: number;             // diary_weighted_mean
};
export type CourseIndicator = {
  courseId: string;
  nome: string;
  alunosEmRisco: number | null;  // risk_roster.listed
  series: ReprovaCursoSem[];
  method: string;
  totalReprovacoes: number;
  totalRf: number; totalRn: number; totalRa: number;
};

export function parseCourseIndicators(rows: AcademicReportRow[], nomePorCourseId: Map<string, string>): CourseIndicator[] {
  return rows.map(r => {
    const p = r.payload || {};
    const serie: any[] = Array.isArray(p.reprobation_series) ? p.reprobation_series : [];
    const series: ReprovaCursoSem[] = serie.map(s => ({
      semestre: String(s.semester ?? ''),
      rf: Number(s.RF ?? 0), rn: Number(s.RN ?? 0), ra: Number(s.RA ?? 0),
      reprovacoes: Number(s.failures ?? 0),
      matriculasDisciplina: Number(s.discipline_enrollments ?? 0),
      mediaNota: Number(s.diary_weighted_mean ?? 0),
    })).sort((a, b) => a.semestre.localeCompare(b.semestre));
    const totalRf = series.reduce((s, x) => s + x.rf, 0);
    const totalRn = series.reduce((s, x) => s + x.rn, 0);
    const totalRa = series.reduce((s, x) => s + x.ra, 0);
    const risk = p.risk_roster?.listed;
    return {
      courseId: String((r as any).course_id ?? ''),
      nome: nomePorCourseId.get(String((r as any).course_id ?? '')) ?? 'Curso',
      alunosEmRisco: risk == null ? null : Number(risk),
      series, method: String(p.method ?? ''),
      totalReprovacoes: totalRf + totalRn + totalRa,
      totalRf, totalRn, totalRa,
    };
  }).filter(c => c.totalReprovacoes > 0 || c.alunosEmRisco)
    .sort((a, b) => b.totalReprovacoes - a.totalReprovacoes);
}

// Composição institucional da reprovação por tipo e por semestre (soma dos cursos).
export type ReprovaTipoSem = { semestre: string; rf: number; rn: number; ra: number; total: number };
export function agregarReprovaTipo(indicadores: CourseIndicator[]): { porSemestre: ReprovaTipoSem[]; totalRf: number; totalRn: number; totalRa: number } {
  const m = new Map<string, { rf: number; rn: number; ra: number }>();
  for (const ci of indicadores) {
    for (const s of ci.series) {
      const prev = m.get(s.semestre) ?? { rf: 0, rn: 0, ra: 0 };
      m.set(s.semestre, { rf: prev.rf + s.rf, rn: prev.rn + s.rn, ra: prev.ra + s.ra });
    }
  }
  const porSemestre: ReprovaTipoSem[] = [...m].map(([semestre, v]) => ({
    semestre, ...v, total: v.rf + v.rn + v.ra,
  })).sort((a, b) => a.semestre.localeCompare(b.semestre));
  return {
    porSemestre,
    totalRf: porSemestre.reduce((s, x) => s + x.rf, 0),
    totalRn: porSemestre.reduce((s, x) => s + x.rn, 0),
    totalRa: porSemestre.reduce((s, x) => s + x.ra, 0),
  };
}
