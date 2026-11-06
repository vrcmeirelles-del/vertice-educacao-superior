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
export type AcademicReportRow = {
  id: string;
  institution_id: string;
  kind: string;
  dedupe_key: string | null;
  data: Record<string, any>;
  source_report_at: string | null;
  created_at: string;
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

export async function fetchAcademicReports(institutionId: string, kinds: string[]) {
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

// ---------- aggregations ----------
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
  const kpis = { totalVinculos, totalMatriculados, cursosAtivos, taxaMatricula };
  const cursosResumo = [...byCurso]
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
  const modalidades = [...modMap]
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
  const evolucao = [...bySem]
    .map(([semestreId, v]) => ({
      semestre: semestreMap.get(semestreId)?.semestre ?? `${semestreId}`,
      semestreId,
      ...v,
    }))
    .sort((a, b) => a.semestre.localeCompare(b.semestre));
  const inativos = cursos
    .filter(c => !byCurso.has(c.id) || (byCurso.get(c.id)?.vinculos ?? 0) === 0)
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return { kpis, cursosResumo, modalidades, evolucao, inativos };
}
