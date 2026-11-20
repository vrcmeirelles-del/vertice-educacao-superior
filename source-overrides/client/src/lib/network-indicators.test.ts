import { describe, it, expect } from 'vitest';
import { cell, totals, needsAttention, type NetworkRow } from './network-indicators';
const base: NetworkRow = { institution_id: 'a', escola: 'A', casos_ativos: 0, planos_ativos: 0, planos_aguardando_validacao: 0, alertas_alta: 0, alertas_media: 0, alertas_baixa: 0, acolhimento_atrasado: 0 };
describe('network-indicators', () => {
  it('mostra valor suprimido sem parecer zero', () => {
    expect(cell(null, 3)).toBe('< 3'); expect(cell(null, 1)).toBe('—'); expect(cell(0, 3)).toBe('0'); expect(cell(7)).toBe('7');
  });
  it('soma e marca total como piso quando há supressão', () => {
    const t = totals([{ ...base, casos_ativos: 4 }, { ...base, casos_ativos: null }, { ...base, casos_ativos: 6 }]);
    expect(t.sums.casos_ativos).toBe(10); expect(t.suppressed.casos_ativos).toBe(true); expect(t.suppressed.planos_ativos).toBe(false);
  });
  it('destaca escola com alerta alto ou acolhimento atrasado', () => {
    expect(needsAttention(base)).toBe(false);
    expect(needsAttention({ ...base, alertas_alta: 1 })).toBe(true);
    expect(needsAttention({ ...base, acolhimento_atrasado: 2 })).toBe(true);
  });
  it('lista não contém campos de identificação de aluno', () => {
    expect(Object.keys(base).some(k => /nome|name|cpf|email|student|aluno/i.test(k))).toBe(false);
  });
});
