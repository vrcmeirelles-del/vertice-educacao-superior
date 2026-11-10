import { describe, it, expect } from 'vitest';
import { latestSemesterSummary, reitorCompliance, sourceDate } from './reitor-summary';
import type { ResumoCompliance } from '../eorbit/types';
describe('resumos da Reitoria por período da fonte', () => {
  it('seleciona o período mais recente sem somar semestres ou depender da ordem da resposta', () => {
    const rows = [{ semestre: '2026/02', totalVinculos: 0 }, { semestre: '2024/2', totalVinculos: 900 }, { semestre: '2026/1', totalVinculos: 100 }];
    expect(latestSemesterSummary(rows)).toBe(rows[0]);
    expect(latestSemesterSummary(rows.slice().reverse())).toBe(rows[0]);
  });
  it('não usa ID de semestre como prova de cronologia; preserva ausência', () => {
    expect(latestSemesterSummary([])).toBeNull();
    expect(latestSemesterSummary([{ semestre: 'sem_999' }])).toBeNull();
    expect(latestSemesterSummary([{ semestre: 'sem_999' }, { semestre: '2025/01' }])).toEqual({ semestre: '2025/01' });
  });
  it('não mistura notas de um período antigo com planos do atual', () => {
    const rows: ResumoCompliance[] = [
      { tipo: 'plano', semestre: '2026/02', semestreId: 4, totalDisciplinas: 100, conformes: 75, naoConformes: 25, percentual: 75 },
      { tipo: 'notas', semestre: '2026/01', semestreId: 3, totalDisciplinas: 100, conformes: 100, naoConformes: 0, percentual: 100 },
    ];
    expect(reitorCompliance(rows)).toEqual({ semestre: '2026/02', plano: 75, notas: null });
  });
  it('diferencia taxa zero observada de falta de denominador', () => {
    const rows: ResumoCompliance[] = [
      { tipo: 'plano', semestre: '2026/2', semestreId: 4, totalDisciplinas: 100, conformes: 0, naoConformes: 100, percentual: 0 },
      { tipo: 'notas', semestre: '2026/02', semestreId: 4, totalDisciplinas: 0, conformes: 0, naoConformes: 0, percentual: 0 },
    ];
    expect(reitorCompliance(rows)).toEqual({ semestre: '2026/2', plano: 0, notas: null });
    expect(reitorCompliance([])).toBeNull();
  });
  it('recusa percentual não finito em vez de mostrar NaN', () => {
    expect(reitorCompliance([{ tipo: 'plano', semestre: '2026/2', semestreId: 4, totalDisciplinas: 1, conformes: 0, naoConformes: 1, percentual: NaN }])?.plano).toBeNull();
  });
  it('mantém a data do edital e a ausência de data, sem inventar ano', () => {
    expect(sourceDate('2026-11-10')).toBe('10/11/2026');
    expect(sourceDate(null)).toBe('Não informada');
    expect(sourceDate('invalid')).toBe('Não informada');
  });
});
