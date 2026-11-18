import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';

type Row = Record<string, unknown>;
type Call = { table: string; action: string; where: [string, unknown][]; payload?: Row };
const db = vi.hoisted(() => ({
  data: {} as Record<string, Row[]>,
  calls: [] as Call[],
  rpc: [] as { name: string; args: Row }[],
  denyWrite: false,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from(table: string) {
      const call: Call = { table, action: 'read', where: [] };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { call.where.push([key, value]); return query; },
        is: (key: string, value: unknown) => { call.where.push([key, value]); return query; },
        not: () => query,
        order: () => query,
        range: async () => {
          db.calls.push(call);
          return { data: (db.data[table] ?? []).filter(row => call.where.every(([key, value]) => row[key] === value)), error: null };
        },
        insert: (payload: Row) => { call.action = 'insert'; call.payload = payload; return query; },
        update: (payload: Row) => { call.action = 'update'; call.payload = payload; return query; },
        single: async () => {
          db.calls.push(call);
          if (db.denyWrite) return { data: null, error: { code: 'PGRST116' } };
          if (call.action === 'insert') {
            const record = { ...call.payload, id: 'added', ...(table === 'vertice_teaching_activities' ? { status: 'rascunho', updated_at: 'revision-a' } : {}) };
            (db.data[table] ??= []).push(record);
            return { data: { id: record.id }, error: null };
          }
          const found = db.data[table]?.find(row => call.where.every(([key, value]) => row[key] === value));
          if (!found) return { data: null, error: { code: 'PGRST116' } };
          Object.assign(found, call.payload);
          return { data: { id: found.id }, error: null };
        },
      };
      return query;
    },
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'staff-a' } } })) },
    rpc: vi.fn(async (name: string, args: Row) => {
      db.rpc.push({ name, args });
      if (name === 'vertice_teaching_course_options') return { data: [{ id: 'curso-a', name: 'Pós-graduação sintética' }], error: null };
      if (name === 'vertice_teaching_fo_metrics') return { data: [], error: null };
      if (name === 'vertice_teaching_evidence_options') return { data: [{ id: 'doc-a', title: 'Relatório didático sintético' }], error: null };
      return { data: null, error: { message: 'Operação não prevista no teste' } };
    }),
  },
}));
vi.mock('@/lib/institution-directory', () => ({ syncInstitutionDirectory: vi.fn() }));

import TeachingPdiPanel from './TeachingPdiPanel';

let container: HTMLDivElement;
let root: Root;
const draft = {
  id: 'activity-a', institution_id: 'ies-a', course_id: 'curso-a', title: 'Oficina simulada', category: 'pratica',
  description: 'Exercício sintético', activity_date: '2026-11-18', organizer_role: 'discente', goal_id: 'goal-a',
  evidence_doc_id: 'doc-a', ods_goal: 12, ods_rationale: 'Redução de resíduos', status: 'rascunho', exam_module: null, updated_at: 'revision-a',
};
const courses = [{ id: 'curso-a', name: 'Pós-graduação sintética' }, { id: 'curso-b', name: 'Curso não autorizado' }];
async function render(props: Partial<ComponentProps<typeof TeachingPdiPanel>> = {}) {
  await act(async () => root.render(<TeachingPdiPanel institutionId="ies-a" courses={courses} mode="academico" role="coordenador" {...props} />));
}
async function fill(label: string, value: string) {
  const field = [...container.querySelectorAll('label')].find(l => l.querySelector('span')?.textContent === label)?.querySelector('input,select,textarea');
  expect(field).toBeDefined();
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value);
    field!.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
async function submit(index = 0) {
  await act(async () => container.querySelectorAll('form')[index].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  db.calls = [];
  db.rpc = [];
  db.denyWrite = false;
  db.data = {
    vertice_pdi_programs: [{ id: 'program-a', institution_id: 'ies-a', title: 'Sustentabilidade', description: null }],
    vertice_goals: [{ id: 'goal-a', institution_id: 'ies-a', course_id: null, title: 'Reduzir desperdício', pdi_program_id: 'program-a', indicator: 'Resíduos', target: 20, unit: '%', direction: 'reduzir', status: 'planejada', owner_name: 'Coordenação', due_date: '2026-12-15', pdi_expected_result: 'Menor geração de resíduos' }],
    vertice_teaching_activities: [{ ...draft }, { ...draft, id: 'activity-b', course_id: 'curso-b', title: 'Não deve aparecer' }],
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('Atividades de Ensino e PDI', () => {
  it('limita a seleção aos cursos autorizados pelo RPC e escopa consultas de atividade e evidência', async () => {
    await render();
    expect(container.textContent).toContain('Oficina simulada');
    expect(container.textContent).not.toContain('Curso não autorizado');
    expect(container.textContent).not.toContain('Não deve aparecer');
    expect(db.calls.find(c => c.table === 'vertice_teaching_activities')?.where).toEqual([['institution_id', 'ies-a'], ['course_id', 'curso-a']]);
    expect(db.rpc).toContainEqual({ name: 'vertice_teaching_evidence_options', args: { p_institution: 'ies-a', p_course: 'curso-a' } });
  });

  it('exige justificativa ODS e salva apenas uma referência documental e a origem declarada', async () => {
    await render();
    await fill('Título da atividade', 'Simulado para teste');
    await fill('Tipo de atividade', 'avaliacao');
    await fill('Exame ou carreira (opcional)', 'enade');
    await fill('Descrição do que foi feito', 'Questões discutidas em sala');
    await fill('Meta do PDI (opcional)', 'goal-a');
    await fill('Evidência da Mesa Digital (opcional)', 'doc-a');
    await fill('ODS (opcional)', '4');
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Justifique a relação com o ODS');
    expect(db.calls.some(c => c.action === 'insert')).toBe(false);
    await fill('Justificativa do vínculo com o ODS', 'Prática voltada à qualidade do ensino');
    await submit();
    const write = db.calls.filter(c => c.action !== 'read');
    expect(write).toHaveLength(1);
    expect(write[0]).toMatchObject({
      table: 'vertice_teaching_activities', action: 'insert', payload: {
        institution_id: 'ies-a', course_id: 'curso-a', goal_id: 'goal-a', evidence_doc_id: 'doc-a', ods_goal: 4,
        exam_module: 'enade',
      },
    });
    expect(container.textContent).toContain('Nenhuma hora foi creditada');
  });

  it('edita o rascunho no curso original sem enviar a coluna imutável e não mostra link sem permissão', async () => {
    const navigate = vi.fn();
    await render({ onNavigate: navigate });
    expect([...container.querySelectorAll('button')].some(button => button.textContent === 'Programas e metas do PDI')).toBe(false);
    await click('Editar rascunho');
    await fill('Título da atividade', 'Oficina revisada');
    await submit();
    const write = db.calls.find(c => c.action === 'update');
    expect(write?.where).toContainEqual(['course_id', 'curso-a']);
    expect(write?.payload).not.toHaveProperty('course_id');
    expect(write?.payload?.title).toBe('Oficina revisada');
  });

  it('só valida após confirmação e não grava medição nem atividade complementar', async () => {
    await render();
    await click('Revisar validação');
    expect(db.calls.some(c => c.action === 'update')).toBe(false);
    await click('Confirmar validação');
    const writes = db.calls.filter(c => c.action !== 'read');
    expect(writes).toEqual([{
      table: 'vertice_teaching_activities', action: 'update',
      where: [['institution_id', 'ies-a'], ['id', 'activity-a'], ['course_id', 'curso-a'], ['updated_at', 'revision-a'], ['status', 'rascunho']],
      payload: { status: 'validada' },
    }]);
    expect(container.textContent).toContain('Não houve crédito de horas nem medição automática');
    expect(container.textContent).not.toContain('Editar rascunho');
    expect(container.textContent).toContain('Encaminhar para Atividades Complementares');
    expect(db.rpc.some(c => c.name.startsWith('vertice_teaching_ac_'))).toBe(false);
  });

  it('busca o documento exato da contribuição apenas ao abrir a evidência', async () => {
    await render({ mode: 'gestao', role: 'diretor_pedagogico' });
    expect(db.rpc.some(c => c.name === 'vertice_teaching_evidence_options')).toBe(false);
    const summary = [...container.querySelectorAll('summary')].find(element => element.textContent === 'Evidência da Mesa Digital vinculada');
    expect(summary).toBeDefined();
    const details = summary!.parentElement as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
    expect(db.rpc).toContainEqual({
      name: 'vertice_teaching_evidence_options', args: { p_institution: 'ies-a', p_course: 'curso-a', p_document: 'doc-a' },
    });
    expect(details.textContent).toContain('Relatório didático sintético');
    expect(details.textContent).not.toContain('doc-a');
  });

  it('abre os indicadores do Fato & Ordem sem consulta fora do curso selecionado', async () => {
    await render();
    expect(db.rpc.some(c => c.name === 'vertice_teaching_fo_metrics')).toBe(false);
    const summary = [...container.querySelectorAll('summary')].find(element => element.textContent === 'Desempenho do Fato & Ordem');
    expect(summary).toBeDefined();
    const details = summary!.parentElement as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
    expect(db.rpc).toContainEqual({
      name: 'vertice_teaching_fo_metrics', args: { p_institution: 'ies-a', p_course: 'curso-a' },
    });
    expect(details.textContent).toContain('Nenhum resultado agregado disponível');
  });

  it('deixa NDE em leitura e permite à equipe editar somente seus próprios rascunhos, sem validar', async () => {
    await render({ role: 'nde' });
    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).not.toContain('Revisar validação');
    const [activity] = db.data.vertice_teaching_activities;
    activity.created_by = 'staff-a';
    db.data.vertice_teaching_activities.push({ ...draft, id: 'draft-with-other-owner', title: 'Rascunho de outro integrante', created_by: 'staff-b' });
    await render({ role: 'equipe' });
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.textContent).toContain('Rascunho de outro integrante');
    expect([...container.querySelectorAll('button')].filter(button => button.textContent === 'Editar rascunho')).toHaveLength(1);
    expect(container.textContent).not.toContain('Revisar validação');
    expect(db.calls.some(c => c.action !== 'read')).toBe(false);
  });

  it('não confirma sucesso quando a versão não é atual ou falta acesso', async () => {
    await render();
    db.denyWrite = true;
    await click('Revisar validação');
    await click('Confirmar validação');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível confirmar a alteração');
    expect(container.textContent).not.toContain('Atividade validada.');
  });

  it('mostra contribuição separada da medição e reutiliza o cadastro institucional de metas', async () => {
    await render({ mode: 'gestao', role: 'diretor_pedagogico' });
    expect(container.textContent).toContain('Contribuições de ensino: 0 validadas de 2 vinculadas');
    expect(container.textContent).toContain('não alteram o indicador');
    await fill('Programa da meta', 'program-a');
    await fill('Título da meta', 'Reduzir consumo de água');
    await fill('Indicador', 'Consumo');
    await fill('Valor-alvo', '10');
    await fill('Direção desejada', 'reduzir');
    await fill('Prazo', '2027-04-30');
    await fill('Responsável', 'Gestão');
    await fill('Resultado esperado', 'Redução do consumo de água');
    await submit(1);
    expect(db.calls.find(c => c.action === 'insert')).toMatchObject({
      table: 'vertice_goals', payload: { course_id: null, institution_id: 'ies-a', pdi_program_id: 'program-a', direction: 'reduzir', status: 'planejada', target: 10 },
    });
    await render({ mode: 'gestao', role: 'coordenador' });
    expect(container.querySelector('form')).toBeNull();
  });
});
