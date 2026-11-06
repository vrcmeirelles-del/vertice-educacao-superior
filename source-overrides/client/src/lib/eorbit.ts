import { supabase } from "@/lib/supabase";

// --------------------------------------------------------------------------
// e-ORBIT data layer — queries Supabase tables loaded with academic data
// --------------------------------------------------------------------------

export type EorbitSemestre = { id: string; institution_id: string; semestre: string; ano: number; periodo: number };
export type EorbitCurso = { id: string; institution_id: string; nome: string; codigo: string; grau?: string };
export type EorbitQuantitativo = {
  id: string; institution_id: string; semestre: string; curso: string;
  turma: string; matriculados: number; capacidade: number; vagas_disponiveis: number;
};
export type ComplianceNota = {
  id: string; institution_id: string; semestre: string; indicador: string;
  nota: number; conceito: string; peso?: number; dimensao?: string;
};
export type ComplianceDetalhe = {
  id: string; compliance_nota_id?: string; institution_id: string; semestre: string;
  indicador: string; criterio: string; valor?: string; observacao?: string;
};
export type DiarioClasse = {
  id: string; institution_id: string; semestre: string; curso: string;
  disciplina: string; professor: string; aulas_previstas: number;
  aulas_registradas: number; percentual_preenchimento: number;
};
export type EnadeRegistro = {
  id: string; institution_id: string; ano: number; curso: string;
  conceito_enade?: number; conceito_continuo?: number;
  nota_bruta?: number; num_participantes?: number; num_concluintes?: number;
};
export type Professor = {
  id: string; institution_id: string; nome: string; titulacao: string;
  regime: string; curso?: string; lattes?: string; semestre?: string;
};
export type VestibularEdital = {
  id: string; institution_id: string; edital: string; ano: number;
  semestre: string; data_prova?: string;
};
export type VestibularCurso = {
  id: string; institution_id: string; edital_id?: string; semestre: string;
  curso: string; vagas_ofertadas: number; inscritos: number;
  aprovados?: number; matriculados?: number;
};
export type BibliotecaCDD = {
  id: string; institution_id: string; classe_cdd: string; descricao: string; quantidade: number;
};
export type BibliotecaDecada = {
  id: string; institution_id: string; decada: string; quantidade: number;
};
export type BibliotecaResumo = {
  id: string; institution_id: string; total_titulos: number;
  total_exemplares: number; acervo_digital?: number;
};
export type FrequenciaConteudo = {
  id: string; institution_id: string; semestre: string; curso: string;
  disciplina: string; conteudo_previsto: number; conteudo_ministrado: number;
  percentual: number;
};

// --------------------------------------------------------------------------
// Generic paginated fetch
// --------------------------------------------------------------------------
async function fetchAll<T>(table: string, institutionId: string, filters?: Record<string, string>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select("*").eq("institution_id", institutionId);
    if (filters) for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    q = q.order("id", { ascending: true });
    const { data, error } = await q.range(from, from + 999);
    if (error) { console.error(`eorbit fetch ${table}:`, error); break; }
    all.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return all;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------
export async function fetchEorbitSemestres(institutionId: string): Promise<EorbitSemestre[]> {
  return fetchAll<EorbitSemestre>("vertice_eorbit_semestres", institutionId);
}

export async function fetchEorbitCursos(institutionId: string): Promise<EorbitCurso[]> {
  return fetchAll<EorbitCurso>("vertice_eorbit_cursos", institutionId);
}

export async function fetchEorbitQuantitativo(institutionId: string, semestre?: string): Promise<EorbitQuantitativo[]> {
  return fetchAll<EorbitQuantitativo>("vertice_eorbit_quantitativo", institutionId, semestre ? { semestre } : undefined);
}

export async function fetchEorbitCompliance(institutionId: string, semestre?: string): Promise<ComplianceNota[]> {
  return fetchAll<ComplianceNota>("vertice_compliance_notas", institutionId, semestre ? { semestre } : undefined);
}

export async function fetchComplianceDetalhe(institutionId: string, semestre?: string): Promise<ComplianceDetalhe[]> {
  return fetchAll<ComplianceDetalhe>("vertice_compliance_detalhe", institutionId, semestre ? { semestre } : undefined);
}

export async function fetchEorbitDiarioClasse(institutionId: string, semestre?: string): Promise<DiarioClasse[]> {
  return fetchAll<DiarioClasse>("vertice_diario_classe", institutionId, semestre ? { semestre } : undefined);
}

export async function fetchEorbitEnade(institutionId: string): Promise<EnadeRegistro[]> {
  return fetchAll<EnadeRegistro>("vertice_enade", institutionId);
}

export async function fetchEorbitProfessores(institutionId: string, semestre?: string): Promise<Professor[]> {
  return fetchAll<Professor>("vertice_professores", institutionId, semestre ? { semestre } : undefined);
}

export async function fetchEorbitVestibularEditais(institutionId: string): Promise<VestibularEdital[]> {
  return fetchAll<VestibularEdital>("vertice_vestibular_editais", institutionId);
}

export async function fetchEorbitVestibularCursos(institutionId: string, semestre?: string): Promise<VestibularCurso[]> {
  return fetchAll<VestibularCurso>("vertice_vestibular_cursos", institutionId, semestre ? { semestre } : undefined);
}

export async function fetchEorbitBibliotecaCDD(institutionId: string): Promise<BibliotecaCDD[]> {
  return fetchAll<BibliotecaCDD>("vertice_biblioteca_cdd", institutionId);
}

export async function fetchEorbitBibliotecaDecada(institutionId: string): Promise<BibliotecaDecada[]> {
  return fetchAll<BibliotecaDecada>("vertice_biblioteca_decada", institutionId);
}

export async function fetchEorbitBibliotecaResumo(institutionId: string): Promise<BibliotecaResumo[]> {
  return fetchAll<BibliotecaResumo>("vertice_biblioteca_resumo", institutionId);
}

export async function fetchEorbitFrequenciaConteudo(institutionId: string, semestre?: string): Promise<FrequenciaConteudo[]> {
  return fetchAll<FrequenciaConteudo>("vertice_frequencia_conteudo", institutionId, semestre ? { semestre } : undefined);
  }

// --------------------------------------------------------------------------
// Aggregation helpers
// --------------------------------------------------------------------------
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    (map[k] ??= []).push(item);
  }
  return map;
}

export function conceitoColor(conceito: string): string {
  switch (conceito?.toUpperCase()) {
    case "A": return "#1baf7a";
    case "B": return "#2678a8";
    case "C": return "#eda100";
    case "D": return "#eb6834";
    case "E": return "#d43d51";
    default: return "#757a80";
  }
}

export function titulacaoLabel(t: string): string {
  const map: Record<string, string> = {
    doutor: "Doutor(a)", mestre: "Mestre", especialista: "Especialista", graduado: "Graduado(a)",
    "doutorado": "Doutor(a)", "mestrado": "Mestre", "especializacao": "Especialista", "graduacao": "Graduado(a)",
  };
  return map[t?.toLowerCase()] ?? t ?? "—";
}

export function regimeLabel(r: string): string {
  const map: Record<string, string> = {
    integral: "Integral", parcial: "Parcial", horista: "Horista",
    ti: "Integral", tp: "Parcial",
  };
  return map[r?.toLowerCase()] ?? r ?? "—";
}
