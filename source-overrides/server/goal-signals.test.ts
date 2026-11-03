import { describe, expect, it } from 'vitest';
import { goalSignals, summarizeGoalSignals, finiteGoalValue, goalSignalDate } from '../client/src/lib/goal-signals';

const goal = (extra = {}) => ({ id: 'g1', status: 'ativa', direction: 'aumentar', baseline: 0, target: 100, due_date: '2026-12-15', owner_name: 'Coordenação', frequency: 'mensal', ...extra });
const measurement = (extra = {}) => ({ id: 'm1', goal_id: 'g1', measured_on: '2026-11-02', value: 50, ...extra });
const signal = (g = {}, m = [measurement()]) => goalSignals([goal(g)], m, '2026-11-03')[0];

describe('semáforo das metas', () => {
  it('marca prazo vencido como vermelho mesmo sem medição', () => {
    const e = signal({ due_date: '2026-11-02' }, []);
    expect(e.signal).toBe('red');
    expect(e.reasons.join(' ')).toContain('vencido há 1');
    expect(e.hasMeasurement).toBe(false);
  });
  it('trata hoje e o limite de 14 dias como atenção, sem antecipar o atraso', () => {
    expect(signal({ due_date: '2026-11-03' }).signal).toBe('amber');
    expect(signal({ due_date: '2026-11-17' }).signal).toBe('amber');
    expect(signal({ due_date: '2026-11-18' }).signal).toBe('green');
  });
  it('distingue conclusão declarada e cancelamento de prazo vencido', () => {
    expect(signal({ status: 'concluida', due_date: '2026-01-01' }, []).signal).toBe('green');
    expect(signal({ status: 'concluida' }, []).reasons[0]).toContain('registrada no cadastro');
    expect(signal({ status: 'cancelada', due_date: '2026-01-01' }).signal).toBe('gray');
  });
  it('não trata ausência de medição como resultado zero ou verde', () => {
    for (const value of [null, '', ' ', undefined, NaN, Infinity, true]) {
      const e = signal({}, [measurement({ value })]);
      expect(e.value).toBeNull(); expect(e.progress).toBeNull(); expect(e.signal).toBe('amber');
    }
    expect(signal({}, [measurement({ value: 0 })]).hasMeasurement).toBe(true);
  });
  it('seleciona a última medição cronologicamente e ignora datas futuras', () => {
    const e = signal({}, [measurement({ id: 'future', measured_on: '2026-11-04', value: 100 }), measurement(), measurement({ id: 'old', measured_on: '2026-10-01', value: 10 })]);
    expect(e.value).toBe(50); expect(e.history).toHaveLength(3);
  });
  it('não confunde medições de metas diferentes', () => {
    const e = signal({}, [measurement({ goal_id: 'other' })]);
    expect(e.hasMeasurement).toBe(false); expect(e.signal).toBe('amber');
  });
  it('aponta planejamento, responsável e prazo ausentes', () => {
    const e = signal({ status: 'planejada', owner_name: '', due_date: null });
    expect(e.signal).toBe('amber'); expect(e.reasons).toHaveLength(3);
  });
  it('considera a periodicidade da última medição', () => {
    expect(signal({}, [measurement({ measured_on: '2026-10-02' })]).stale).toBe(true);
    expect(signal({}, [measurement({ measured_on: '2026-10-03' })]).stale).toBe(false);
    expect(signal({ frequency: 'trimestral' }, [measurement({ measured_on: '2026-10-02' })]).stale).toBe(false);
  });
  it('não conta designação pendente como responsável definido', () => {
    expect(signal({ owner_name: 'Coordenação do curso — designação pendente' }).hasOwner).toBe(false);
    expect(signal({ owner_name: 'A definir' }).hasOwner).toBe(false);
    expect(signal({ owner_name: 'Coordenação do curso — designação pendente', owner_user_id: 'account-1' }).hasOwner).toBe(true);
  });
  it('calcula o progresso para aumentar e reduzir sem misturar unidades', () => {
    expect(signal().progress).toBe(50);
    expect(signal({ baseline: 100, target: 0, direction: 'reduzir' }, [measurement({ value: 25 })]).progress).toBe(75);
    expect(signal({}, [measurement({ value: 120 })]).progress).toBe(100);
    expect(signal({ target: null }).progress).toBeNull();
    expect(finiteGoalValue('2,5')).toBe(2.5);
  });
  it('sinaliza manutenção fora da tolerância', () => {
    expect(signal({ direction: 'manter' }, [measurement({ value: 100 })]).signal).toBe('green');
    expect(signal({ direction: 'manter' }, [measurement({ value: 90 })]).signal).toBe('amber');
  });
  it('totais são exclusivos e cobertura exclui metas encerradas', () => {
    const rows = goalSignals([goal(), goal({ id: 'g2', status: 'cancelada' }), goal({ id: 'g3', status: 'concluida' }), goal({ id: 'g4', due_date: '2026-11-01' })], [measurement()], '2026-11-03');
    const summary = summarizeGoalSignals(rows);
    expect(summary.counts).toEqual({ red: 1, amber: 0, green: 2, gray: 1 });
    expect(summary.total).toBe(4); expect(summary.active).toBe(2); expect(summary.measured).toBe(1);
    expect(summarizeGoalSignals([]).total).toBe(0);
  });
  it('usa a virada do dia em Brasília e rejeita datas inválidas', () => {
    expect(goalSignalDate(new Date('2026-11-04T01:00:00Z'))).toBe('2026-11-03');
    expect(signal({ due_date: '2026-02-31' }).daysLeft).toBeNull();
  });
});
