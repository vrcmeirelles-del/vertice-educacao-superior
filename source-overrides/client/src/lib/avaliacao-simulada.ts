/**
 * Avaliação Simulada — lógica de conceito por indicador para Reconhecimento de Curso.
 *
 * Cada indicador recebe um conceito atual (1–5) e um conceito viável,
 * além de parecer, lacunas e perguntas prováveis da comissão.
 * O conceito da dimensão é a média aritmética dos indicadores avaliados.
 * O conceito do curso (CC) é a média aritmética das 3 dimensões.
 */

import { supabase } from "@/lib/supabase";
import indicatorNames from "@/lib/repository-indicators.json";

// ================================================================ tabela
export const AVS_TABLE = "vertice_avaliacao_simulada";

// ================================================================ tipos
export type AvaliacaoSimulada = {
  id: string;
  institution_id: string;
  course_id: string;
  indicador: string;          // "1.10", "2.3", etc.
  dimensao: number;           // 1, 2 ou 3
  conceito_atual: number | null;   // 1–5 ou null
  conceito_viavel: number | null;  // 1–5 ou null
  parecer: string;
  lacunas: string;
  plano_nde: string;
  perguntas_comissao: string;
  updated_by: string | null;
  updated_at: string | null;
};

export type AvsRow = Record<string, unknown>;

// ================================================================ indicadores do instrumento 2017
const names = indicatorNames as Record<string, string>;

export type IndicadorReconhecimento = {
  code: string;
  name: string;
  dimension: number;
};

/** Lista plana de indicadores com sua dimensão. */
export function listarIndicadores(): IndicadorReconhecimento[] {
  return Object.entries(names)
    .map(([code, name]) => ({
      code,
      name,
      dimension: parseInt(code.split(".")[0], 10),
    }))
    .sort((a, b) => {
      if (a.dimension !== b.dimension) return a.dimension - b.dimension;
      const na = parseFloat(a.code);
      const nb = parseFloat(b.code);
      return na - nb;
    });
}

export const DIMENSOES: [number, string][] = [
  [1, "Organização Didático-Pedagógica"],
  [2, "Corpo Docente e Tutorial"],
  [3, "Infraestrutura"],
];

export const CONCEITOS = [1, 2, 3, 4, 5] as const;

// ================================================================ cálculo do conceito
export type ResumoDimensao = {
  dimensao: number;
  nome: string;
  total: number;
  avaliados: number;
  media: number | null;
  distribuicao: Record<number, number>; // conceito → qtd
};

export type ResumoGeral = {
  dimensoes: ResumoDimensao[];
  conceitoCurso: number | null;
  totalIndicadores: number;
  totalAvaliados: number;
};

export function calcularResumo(
  avaliacoes: Map<string, number | null>,
  indicadores: IndicadorReconhecimento[],
): ResumoGeral {
  const dimensoes: ResumoDimensao[] = DIMENSOES.map(([dim, nome]) => {
    const inds = indicadores.filter(i => i.dimension === dim);
    const notas = inds.map(i => avaliacoes.get(i.code) ?? null).filter((n): n is number => n !== null);
    const distribuicao: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const n of notas) distribuicao[n] = (distribuicao[n] ?? 0) + 1;
    return {
      dimensao: dim,
      nome,
      total: inds.length,
      avaliados: notas.length,
      media: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null,
      distribuicao,
    };
  });

  const medias = dimensoes.map(d => d.media).filter((m): m is number => m !== null);
  const conceitoCurso = medias.length === 3 ? medias.reduce((s, m) => s + m, 0) / 3 : null;

  return {
    dimensoes,
    conceitoCurso,
    totalIndicadores: indicadores.length,
    totalAvaliados: dimensoes.reduce((s, d) => s + d.avaliados, 0),
  };
}

// ================================================================ cor por conceito
export function corConceito(nota: number | null): string {
  if (nota === null) return "#a9b6c4";
  if (nota >= 4) return "#4f9a76";
  if (nota >= 3) return "#d1a54a";
  return "#c0594f";
}

export function faixaConceito(nota: number | null): string {
  if (nota === null) return "Sem nota";
  if (nota >= 4) return "Muito bom / Excelente";
  if (nota >= 3) return "Suficiente";
  if (nota >= 2) return "Insuficiente";
  return "Não existe";
}

export function formatarConceito(valor: number | null): string {
  return valor === null ? "—" : valor.toFixed(2).replace(".", ",");
}

// ================================================================ dados Supabase
export async function carregarAvaliacoes(institutionId: string, courseId: string): Promise<AvsRow[]> {
  const { data, error } = await supabase
    .from(AVS_TABLE)
    .select("*")
    .eq("institution_id", institutionId)
    .eq("course_id", courseId)
    .order("indicador");
  if (error) throw error;
  return data ?? [];
}

export async function salvarAvaliacao(
  institutionId: string,
  courseId: string,
  indicador: string,
  dimensao: number,
  patch: Partial<AvaliacaoSimulada>,
  userId: string | null,
): Promise<void> {
  const { data: existing } = await supabase
    .from(AVS_TABLE)
    .select("id")
    .eq("institution_id", institutionId)
    .eq("course_id", courseId)
    .eq("indicador", indicador)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from(AVS_TABLE)
      .update({ ...patch, updated_by: userId, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(AVS_TABLE)
      .insert({
        institution_id: institutionId,
        course_id: courseId,
        indicador,
        dimensao,
        conceito_atual: null,
        conceito_viavel: null,
        parecer: "",
        lacunas: "",
        plano_nde: "",
        perguntas_comissao: "",
        ...patch,
        updated_by: userId,
      });
    if (error) throw error;
  }
}
