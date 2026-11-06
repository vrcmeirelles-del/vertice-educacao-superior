/**
 * Painel Executivo de BI — Tipos do domínio
 *
 * Adaptado ao modelo real do Vértice Superior (Supabase).
 * Campos inexistentes no banco foram omitidos (sem receita, sem docentes,
 * sem frequência individual, sem turmas com calendário detalhado).
 */

// ---------- filtro global ----------
export interface FiltroBI {
  instituicaoId: string;
  semestre?: string;       // ex: "2026/01"
  cursoId?: string;
  grau?: string;           // bacharelado | licenciatura | tecnologo | ...
}

// ---------- KPI ----------
export type UnidadeKPI = 'pct' | 'qtd' | 'brl' | 'dias';
export type DirecaoDesejada = 'cima' | 'baixo';

export interface KpiResumo {
  chave: string;
  rotulo: string;
  valor: number | null;
  unidade: UnidadeKPI;
  variacaoPct: number | null;
  meta: number | null;
  atingimentoMeta: number | null;
  tendencia: number[];
  direcaoDesejada: DirecaoDesejada;
  definicao: string;         // fórmula legível, acessível via ícone (i)
  comparativos?: {
    homologo: { semestre: string; valor: number | null; variacaoPct: number | null };
    anterior: { semestre: string | null; valor: number | null; variacaoPct: number | null };
  };
}

// ---------- série temporal ----------
export interface PontoSerie {
  data: string;              // "2026/01" ou "2026-03"
  valor: number;
  meta?: number;
}
export interface SerieTemporal {
  chave: string;
  rotulo: string;
  pontos: PontoSerie[];
}

// ---------- composição ----------
export interface FatiaCategoria {
  chave: string;
  rotulo: string;
  valor: number;
  participacaoPct: number;
}

// ---------- funil ----------
export interface EtapaFunil {
  etapa: string;
  volume: number;
  conversaoPct: number | null; // taxa vs. etapa anterior
}

// ---------- alertas ----------
export type Severidade = 'critico' | 'atencao' | 'ok';
export interface Alerta {
  severidade: Severidade;
  descricao: string;
  href?: string;
}

// ---------- turma/curso em risco (tabela densa) ----------
export interface CursoRisco {
  id: string;
  nome: string;
  grau: string;
  ocupacaoPct: number | null;
  tendencia: 'subindo' | 'estavel' | 'caindo';
  sinal: Severidade;
}

// ---------- mapa de calor ----------
export interface CelulaHeatmap {
  linha: string;   // ex: curso ou unidade
  coluna: string;  // ex: semestre
  valor: number;
}

// ---------- saúde do período ----------
export interface SaudeIndicador {
  rotulo: string;
  sinal: Severidade;
  valor: string;
}

// ---------- estado de consulta ----------
export type EstadoConsulta = 'carregando' | 'ok' | 'vazio' | 'erro' | 'parcial';
