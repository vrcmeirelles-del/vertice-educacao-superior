import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const fixtures = vi.hoisted(() => ({ results: new Map<string, {data: unknown; count?: number} | Error>(), calls: [] as {table: string; method: string; args: unknown[]}[] }));
vi.mock('@/lib/supabase', () => {
  // Supabase builders are PromiseLike: deliberately no catch/finally, even after then.
  function thenable<T>(promise: Promise<T>): PromiseLike<T> {
    return { then(onfulfilled, onrejected) { return thenable(promise.then(onfulfilled, onrejected)); } };
  }
  function query(table: string) {
    const result = fixtures.results.get(table) ?? {data: []};
    const builder: Record<string, unknown> = {
      then(onfulfilled: (value: unknown) => unknown, onrejected: (reason: unknown) => unknown) {
        const promise = result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
        return thenable(promise.then(onfulfilled, onrejected));
      },
    };
    for (const method of ['select','eq','not','in','is','gte','or','order','limit','maybeSingle']) {
      builder[method] = (...args: unknown[]) => { fixtures.calls.push({table, method, args}); return builder; };
    }
    return builder;
  }
  return {supabase: {from: query, rpc: query}};
});

import AcademicModulesBI from './AcademicModulesBI';
import EvasionRiskPanel from './EvasionRiskPanel';
import DireitoBIDashboard from './DireitoBIDashboard';
import CourseRaioX from '../area/CourseRaioX';
import CourseShowcase from '../area/CourseShowcase';

let container: HTMLDivElement, root: Root;
const courses = [{id:'course-test', name:'Direito sintético', code:'027'}];
beforeEach(() => {
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
  fixtures.results.clear(); fixtures.calls.length = 0;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text));
  expect(button).toBeDefined();
  await act(async () => button!.dispatchEvent(new MouseEvent('click', {bubbles:true})));
}
function assertInstitutionFilter(table: string) {
  expect(fixtures.calls).toContainEqual({table, method:'eq', args:['institution_id','ies-test']});
}

describe('academic loaders with PromiseLike-only query builders', () => {
  for (const [module, view, title, row] of [
    ['tcc','v_tcc_course_summary','TCC e Pesquisa', {works_active:3, works_deposited:2}],
    ['ac','v_ac_course_summary','Atividades Complementares', {submissions_total:4, total_credited_minutes:120}],
    ['estagio','v_internship_course_summary','Estágio Obrigatório', {placements_total:5, external_count:2}],
  ] as const) it(`loads and displays ${module} summaries without catch/finally on the builder`, async () => {
    fixtures.results.set(view, {data:[{course_id:'course-test',course_name:'Direito sintético',...row}]});
    await act(async () => root.render(<AcademicModulesBI institutionId="ies-test" module={module} />));
    expect(container.textContent).toContain(title);
    expect(container.textContent).toContain('Direito sintético');
    expect(container.textContent).not.toContain('Carregando');
    assertInstitutionFilter(view);
  });
  it('keeps the existing fallback when the summary query rejects', async () => {
    fixtures.results.set('v_tcc_course_summary', new Error('Synthetic network failure'));
    await act(async () => root.render(<AcademicModulesBI institutionId="ies-test" module="tcc" />));
    expect(container.textContent).toContain('Nenhum dado disponível');
  });
  it('finishes loading the risk panel with PromiseLike-only results', async () => {
    fixtures.results.set('v_student_evasion_risk', {data:[{student_id:'s1',full_name:'Aluno sintético',course_id:'course-test',risk_level:'high',risk_score:50}]});
    await act(async () => root.render(<EvasionRiskPanel institutionId="ies-test" courses={courses} />));
    expect(container.textContent).toContain('Aluno sintético');
    expect(container.textContent).not.toContain('Carregando');
    assertInstitutionFilter('v_student_evasion_risk');
  });
  it('passes evolution data into the semester drill-down', async () => {
    fixtures.results.set('vertice_academic_reports', {data:[{payload:{semestre:'2026/02',matriculados:123,trancados:7,cancelados:4},source_report_at:'2026-11-13'}]});
    await act(async () => root.render(<DireitoBIDashboard institutionId="ies-test" courseId="course-test" courseCode="027" vacancies={200} />));
    const row = container.querySelector('tbody tr'); expect(row).not.toBeNull();
    await act(async () => row!.dispatchEvent(new MouseEvent('click', {bubbles:true})));
    expect(container.textContent).toContain('Semestre 2026/02');
    expect(container.textContent).toContain('123 matriculados');
    expect(container.textContent).toContain('7 trancados');
    expect(container.textContent).toContain('4 cancelados');
  });
  it('loads the course Raio-X and retains TCC, AC, internship and governance queries', async () => {
    fixtures.results.set('v_course_raio_x', {data:{course_name:'Direito sintético',...Object.fromEntries('docentes_total docentes_doutores docentes_mestres docentes_integral docentes_parcial docentes_horista alunos_risco reprovacoes_total reprovacoes_falta reprovacoes_nota orgaos_colegiados deliberacoes_pendentes cpa_achados cpa_fragilidades egressos_total extensao_projetos extensao_alunos metas_total metas_concluidas acoes_total acoes_concluidas diagnostico_total diagnostico_media diagnostico_frageis evidencias_total evidencias_validadas'.split(' ').map(key => [key,0]))}});
    fixtures.results.set('v_ac_course_summary', {data:{submissions_total:5,total_credited_minutes:120}});
    fixtures.results.set('v_internship_course_summary', {data:{placements_total:2,placements_active:1}});
    await act(async () => root.render(<CourseRaioX institutionId="ies-test" courses={courses} role="master" />));
    await click('Direito sintético');
    expect(container.textContent).not.toContain('Carregando');
    for (const table of ['vertice_tcc_works','v_ac_course_summary','v_internship_course_summary','vertice_governance_bodies']) assertInstitutionFilter(table);
    expect(container.textContent).toContain('TCC');
    expect(container.textContent).toContain('Estágio');
  });
  it('loads the showcase and preserves RPC fallbacks on rejected thenables', async () => {
    fixtures.results.set('count_meetings_by_course', new Error('Synthetic RPC rejection'));
    fixtures.results.set('count_deliberations_by_course', new Error('Synthetic RPC rejection'));
    await act(async () => root.render(<CourseShowcase institutionId="ies-test" courses={courses} role="master" />));
    await click('Direito sintético');
    expect(container.textContent).not.toContain('Preparando vitrine');
    expect(container.textContent).toContain('VITRINE DO CURSO');
    for (const table of ['vertice_tcc_works','v_ac_course_summary','v_internship_course_summary']) assertInstitutionFilter(table);
  });
});
