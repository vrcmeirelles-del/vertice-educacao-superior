import { describe, expect, it } from 'vitest';
import { diagnosisScore, summarizeDiagnosis, diagnosisRecommendation } from '../client/src/lib/diagnosis-summary';

const dimensions = ['Organização didático-pedagógica', 'Corpo docente e tutorial', 'Infraestrutura'];
const row = (id: string, score: unknown, extra = {}) => ({ id, score, dimension: dimensions[0], ...extra });

describe('fechamento do diagnóstico por dimensão', () => {
  it('mantém todas as dimensões sem inventar avaliações ou nota zero', () => {
    const groups = summarizeDiagnosis([], dimensions);
    expect(groups.map(g => g.dimension)).toEqual(dimensions);
    expect(groups.every(g => g.average === null && g.status === 'Sem avaliação')).toBe(true);
  });
  it('exclui notas ausentes, inválidas e fora da escala da média', () => {
    const scores = [null, undefined, '', ' ', 'NSA', 0, 6, NaN, Infinity, true, 2, '4,5'];
    const group = summarizeDiagnosis(scores.map((s, i) => row(String(i), s)), dimensions)[0];
    expect(group.average).toBe(3.25);
    expect(group.assessed).toHaveLength(2);
    expect(group.missing).toBe(10);
    expect(group.conclusion).toContain('fechamento parcial');
  });
  it('destaca a nota baixa mesmo com média favorável e achado resolvido', () => {
    const group = summarizeDiagnosis([row('a', 2, { status: 'resolvido' }), row('b', 5), row('c', 5)], dimensions)[0];
    expect(group.average).toBe(4);
    expect(group.tone).toBe('red');
    expect(group.low.map(r => r.id)).toEqual(['a']);
  });
  it('separa as faixas sem arredondar antes de classificar', () => {
    const group = summarizeDiagnosis([row('a', 2.9), row('b', 3), row('c', 3.9), row('d', 4), row('e', 1)], dimensions)[0];
    expect(group.low.map(r => r.id)).toEqual(['e', 'a']);
    expect(group.improvement.map(r => r.id)).toEqual(['b', 'c']);
  });
  it('não mistura notas de dimensões distintas e preserva dimensões legadas', () => {
    const groups = summarizeDiagnosis([row('a', 1), row('b', 5, { dimension: dimensions[1] }), row('c', 3, { dimension: 'Legada' }), row('d', 4, { dimension: null })], dimensions);
    expect(groups.map(g => g.average)).toEqual([1, 5, null, 3, 4]);
    expect(groups[4].dimension).toBe('Dimensão não informada');
  });
  it('diferencia registros sem nota de notas baixas', () => {
    const group = summarizeDiagnosis([row('a', null)], dimensions)[0];
    expect(group.average).toBeNull();
    expect(group.low).toHaveLength(0);
    expect(group.status).toBe('Sem avaliação');
    expect(diagnosisScore('2,5')).toBe(2.5);
  });
  it('apresenta orientação da dimensão e trata a ausência de evidência', () => {
    expect(diagnosisRecommendation(row('a', 2))).toContain('NDE');
    expect(diagnosisRecommendation(row('a', 2))).toContain('Reunir evidências');
    expect(diagnosisRecommendation(row('a', 2, { dimension: 'Infraestrutura', evidence: 'Vistoria' }))).toContain('Atualizar a evidência');
  });
});
