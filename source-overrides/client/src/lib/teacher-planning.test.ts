import { describe, it, expect } from 'vitest';
import { buildPlanPayload, emptyPlan, safeSearch, toForm, COMPONENTS, YEARS } from './teacher-planning';
const ok = () => ({ ...emptyPlan(), stage: 'EF' as const, year_label: '6º ano', component: 'Matemática', title: 'Frações no cotidiano' });
describe('teacher-planning', () => {
  it('monta payload válido e normaliza vazios para null', () => {
    const p = buildPlanPayload(ok(), 'inst-1');
    expect(p.institution_id).toBe('inst-1'); expect(p.objectives).toBeNull(); expect(p.class_id).toBeNull(); expect(p.title).toBe('Frações no cotidiano');
  });
  it('recusa ano ou componente fora da etapa', () => {
    expect(() => buildPlanPayload({ ...ok(), year_label: '1ª série' }, 'i')).toThrow(/ano\/série/);
    expect(() => buildPlanPayload({ ...ok(), component: 'Linguagens e suas Tecnologias' }, 'i')).toThrow(/componente curricular/);
  });
  it('cada etapa tem anos e componentes', () => {
    for (const s of ['EI', 'EF', 'EM'] as const) { expect(YEARS[s].length).toBeGreaterThan(0); expect(COMPONENTS[s].length).toBeGreaterThan(0); }
  });
  it('valida título, datas e limites', () => {
    expect(() => buildPlanPayload({ ...ok(), title: 'ab' }, 'i')).toThrow(/título/i);
    expect(() => buildPlanPayload({ ...ok(), start_date: '2026-05-10', end_date: '2026-05-01' }, 'i')).toThrow(/anterior/);
    expect(() => buildPlanPayload({ ...ok(), start_date: '31/02/2026' }, 'i')).toThrow(/inválida/);
    expect(() => buildPlanPayload({ ...ok(), objectives: 'x'.repeat(4001) }, 'i')).toThrow(/limite/);
  });
  it('observação de inclusão exige o caso', () => {
    expect(() => buildPlanPayload({ ...ok(), inclusion_note: 'usar fonte ampliada' }, 'i')).toThrow(/escolha o caso/);
    expect(buildPlanPayload({ ...ok(), inclusion_note: 'usar fonte ampliada', inclusion_case_id: 'c1' }, 'i').inclusion_case_id).toBe('c1');
  });
  it('safeSearch remove curingas e vírgulas', () => {
    expect(safeSearch('  fra%ções,(x)_  ')).toBe('fra ções x');
  });
  it('toForm aceita nulos', () => {
    expect(toForm({ id: 'a', stage: 'EM', title: null }).title).toBe('');
  });
});
