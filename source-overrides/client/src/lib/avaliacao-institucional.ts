import dados from "./avaliacao-institucional.json";

export type Criterio = { "1": string; "2": string; "3": string; "4": string; "5": string };

export type IndicadorAvaliacao = {
  code: string;
  axis: number;
  dim: number;
  title: string;
  applicability: string;
  nota: string;
  criteria: Criterio;
  obrig: string[];
  compl: string[];
  resultado: string[];
  alerta: string;
};

export type EixoAvaliacao = { code: number; name: string; weight: number };

export type InstrumentoAvaliacao = {
  instrument: string;
  edition: string;
  publisher: string;
  axes: EixoAvaliacao[];
  total: number;
  indicators: IndicadorAvaliacao[];
};

export const instrumento = dados as InstrumentoAvaliacao;

export const NIVEIS: (keyof Criterio)[] = ["1", "2", "3", "4", "5"];

const ACENTOS = new RegExp("[\u0300-\u036f]", "g");

/** Normaliza para busca: sem acento, minúsculo. */
export function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(ACENTOS, "").toLocaleLowerCase("pt-BR");
}

export function pesoDoEixo(code: number): number {
  return instrumento.axes.find((eixo) => eixo.code === code)?.weight ?? 0;
}

export function nomeDoEixo(code: number): string {
  return instrumento.axes.find((eixo) => eixo.code === code)?.name ?? `Eixo ${code}`;
}

/**
 * Conceito institucional: media ponderada dos conceitos dos eixos.
 * So devolve numero quando todos os eixos receberam nota.
 */
export function conceitoInstitucional(
  notasPorEixo: Partial<Record<number, number | null>>
): number | null {
  let somaPesos = 0;
  let soma = 0;
  for (const eixo of instrumento.axes) {
    const nota = notasPorEixo[eixo.code];
    if (nota === null || nota === undefined || Number.isNaN(nota)) return null;
    soma += nota * eixo.weight;
    somaPesos += eixo.weight;
  }
  return somaPesos ? soma / somaPesos : null;
}

export function filtrarIndicadores(
  indicadores: IndicadorAvaliacao[],
  filtro: { busca: string; eixo: string; somenteRestritos: boolean }
): IndicadorAvaliacao[] {
  const termos = normalizar(filtro.busca).trim().split(/\s+/).filter(Boolean);
  return indicadores.filter((indicador) => {
    if (filtro.eixo && String(indicador.axis) !== filtro.eixo) return false;
    if (filtro.somenteRestritos && !indicador.applicability) return false;
    if (!termos.length) return true;
    const alvo = normalizar(
      [indicador.code, indicador.title, indicador.criteria["5"], indicador.alerta].join(" ")
    );
    return termos.every((termo) => alvo.includes(termo));
  });
}
