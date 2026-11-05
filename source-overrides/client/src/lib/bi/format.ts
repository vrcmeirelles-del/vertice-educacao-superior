/**
 * Painel Executivo de BI — Formatação pt-BR
 *
 * Funções únicas de formatação para toda a tela.
 * Nunca use toFixed espalhado pelo código.
 */

const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function fmtInt(v: number): string {
  return intFmt.format(v);
}

export function fmtPct(v: number): string {
  return pctFmt.format(v) + '%';
}

export function fmtBRL(v: number): string {
  return brlFmt.format(v);
}

export function fmtVariacao(v: number | null, direcao: 'cima' | 'baixo'): { texto: string; sinal: 'bom' | 'atencao' | 'critico' | 'neutro' } {
  if (v === null) return { texto: 'sem base', sinal: 'neutro' };
  const texto = (v >= 0 ? '+' : '') + pctFmt.format(v) + '%';
  // direção desejada: se "cima", subir é bom; se "baixo", cair é bom
  const favoravel = direcao === 'cima' ? v >= 0 : v <= 0;
  const sinal = Math.abs(v) < 0.5 ? 'neutro' : favoravel ? 'bom' : Math.abs(v) > 10 ? 'critico' : 'atencao';
  return { texto, sinal };
}

export function fmtKPI(valor: number | null, unidade: 'brl' | 'pct' | 'qtd' | 'dias'): string {
  if (valor === null) return '—';
  switch (unidade) {
    case 'brl': return fmtBRL(valor);
    case 'pct': return fmtPct(valor);
    case 'qtd': return fmtInt(valor);
    case 'dias': return fmtInt(valor) + ' dias';
  }
}
