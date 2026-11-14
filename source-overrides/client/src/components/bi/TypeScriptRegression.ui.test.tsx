import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AcademicModulesBI from './AcademicModulesBI';
import EvasionRiskPanel from './EvasionRiskPanel';
import DireitoBIDashboard from './DireitoBIDashboard';
import CourseRaioX from '../area/CourseRaioX';
import CourseShowcase from '../area/CourseShowcase';
import { visibleTabs, can } from '@/lib/area';

const state = vi.hoisted(() => ({
  queries: [] as { table: string; filters: [string, unknown][] }[],
  rows: {} as Record<string, unknown[]>,
  rejected: new Set<string>(),
}));

vi.mock('@/lib/supabase', () => {
  // Deliberately exposes only `then`: catch/finally on this SDK contract must fail.
  function thenable<T>(promise: Promise<T>): PromiseLike<T> {
    return { then: (yes, no) => thenable(promise.then(yes, no)) };
  }
  function query(table: string) {
    const record = { table, filters: [] as [string, unknown][] };
    state.queries.push(record);
    let single = false;
    const builder: any = new Proxy({}, {
      get: (_, method) => {
        if (method === 'catch' || method === 'finally') return undefined;
        if (method === 'then') return (yes: any, no: any) => {
          const rows = state.rows[table] ?? [];
          const result = state.rejected.has(table) ? Promise.reject(new Error('synthetic transport failure')) : Promise.resolve({ data: single ? rows[0] ?? null : rows, count: rows.length, error: null });
          return thenable(result.then(yes, no));
        };
        return (...args: any[]) => {
          if (method === 'eq') record.filters.push([args[0], args[1]]);
          if (method === 'maybeSingle' || method === 'single') single = true;
          return builder;
        };
      },
    });
    return builder;
  }
  return { supabase: { from: query, rpc: (name: string, args: Record<string, unknown>) => {
    const builder = query(name);
    state.queries.at(-1)!.filters.push(...Object.entries(args));
    return builder;
  } } };
});

let root: Root;
let host: HTMLDivElement;
const courses = [{ id: 'course-a', name: 'Curso sintético', code: '027' }];
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  state.queries = []; state.rows = {}; state.rejected.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const click = async (element: Element | null) => {
  expect(element).not.toBeNull();
  await act(async () => element!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

describe('PromiseLike consumers and scope', () => {
  it.each(['tcc', 'ac', 'estagio'] as const)('loads %s summaries with the institution filter', async module => {
    const view = module === 'tcc' ? 'v_tcc_course_summary' : module === 'ac' ? 'v_ac_course_summary' : 'v_internship_course_summary';
    state.rows[view] = [{ course_id: 'course-a', course_name: 'Curso sintético' }];
    await render(<AcademicModulesBI institutionId="ies-a" module={module} />);
    expect(host.textContent).toContain('Curso sintético');
    expect(host.textContent).not.toContain('Carregando');
    expect(state.queries[0].filters).toContainEqual(['institution_id', 'ies-a']);
  });
  it('finishes loading when a summary query rejects', async () => {
    state.rejected.add('v_ac_course_summary');
    await render(<AcademicModulesBI institutionId="ies-a" module="ac" />);
    expect(host.textContent).toContain('Nenhum dado disponível');
    expect(host.textContent).not.toContain('Carregando');
  });
  it('uses the new institution filter when switching institutions', async () => {
    await render(<AcademicModulesBI institutionId="ies-a" module="ac" />);
    await render(<AcademicModulesBI institutionId="ies-b" module="ac" />);
    expect(state.queries.map(q => q.filters)).toEqual([[['institution_id', 'ies-a']], [['institution_id', 'ies-b']]]);
  });
  it('loads the risk panel with a then-only query', async () => {
    await render(<EvasionRiskPanel institutionId="ies-a" courses={courses} />);
    expect(host.textContent).not.toContain('Carregando');
    expect(state.queries[0].filters).toContainEqual(['institution_id', 'ies-a']);
  });
  it('opens the semester drill-down using the loaded enrollment data', async () => {
    state.rows.vertice_academic_reports = [{ payload: { semestre: '2026/02', matriculados: 42, total: 45 }, source_report_at: '2026-11-14' }];
    await render(<DireitoBIDashboard institutionId="ies-a" courseId="course-a" courseCode="027" vacancies={50} />);
    expect(host.textContent).toContain('Evolução Semestral');
    await click(host.querySelector('tbody tr'));
    expect(host.textContent).toContain('Semestre 2026/02');
    expect(host.textContent).toContain('42 matriculados');
    const reports = state.queries.find(q => q.table === 'vertice_academic_reports')!;
    expect(reports.filters).toContainEqual(['institution_id', 'ies-a']);
    expect(reports.filters).toContainEqual(['course_id', 'course-a']);
  });
  it.each([CourseRaioX, CourseShowcase])('loads course modules without native Promise methods on the SDK', async Component => {
    state.rows.v_course_raio_x = [{ ...Object.fromEntries('docentes_total docentes_doutores docentes_mestres docentes_integral docentes_parcial docentes_horista alunos_risco reprovacoes_total reprovacoes_falta reprovacoes_nota orgaos_colegiados deliberacoes_pendentes cpa_achados cpa_fragilidades egressos_total extensao_projetos extensao_alunos metas_total metas_concluidas acoes_total acoes_concluidas diagnostico_total diagnostico_frageis evidencias_total evidencias_validadas'.split(' ').map(key => [key, 0])), course_name: 'Curso sintético', diagnostico_media: null }];
    await render(<Component institutionId="ies-a" courses={courses} role="master" />);
    await click([...host.querySelectorAll('button')].find(b => b.textContent?.includes('Curso sintético')) ?? null);
    expect(host.textContent).not.toContain('Carregando');
    for (const table of ['vertice_tcc_works', 'v_ac_course_summary', 'v_internship_course_summary']) {
      const q = state.queries.find(q => q.table === table)!;
      expect(q).toBeDefined();
      expect(q.filters).toContainEqual(['institution_id', 'ies-a']);
      expect(q.filters).toContainEqual(['course_id', 'course-a']);
    }
  });
});

describe('navigation and permission contracts', () => {
  it('retains the role restrictions while typing all existing module destinations', () => {
    expect(visibleTabs(null)).toEqual([]);
    expect(visibleTabs('leitor')).toEqual(['geral', 'visao', 'biblioteca']);
    for (const role of ['coordenador', 'nde'] as const) {
      expect(visibleTabs(role)).not.toContain('billing');
      expect(can.viewFinancials(role)).toBe(false);
    }
    expect(visibleTabs('master')).toEqual(expect.arrayContaining(['tcc', 'atividades-complementares', 'estagio', 'vitrine-curso']));
  });

});
