import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import TeachingFatoOrdem from './TeachingFatoOrdem';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));

const sample = {
  semester: '2026/2', subject_code: 'D001', module: 'oab', competency: 'Civil',
  participants: 5, attempts: 20, graded: 10, correct: 7, updated_at: '2026-11-18T12:00:00Z',
};
const renderFixture = () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const node = document.createElement('div');
  document.body.appendChild(node);
  const root = createRoot(node);
  const render = (courseId: string) => act(async () => root.render(<TeachingFatoOrdem institutionId="ies-a" courseId={courseId} />));
  cleanup.push(async () => { await act(async () => root.unmount()); node.remove(); });
  return { node, render };
};
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
  vi.resetAllMocks();
});

describe('F&O no painel de ensino', () => {
  it('consulta IES e curso exatos, filtra no servidor e exibe só agregados', async () => {
    rpc.mockResolvedValue({ data: [sample], error: null });
    const { node, render } = renderFixture();
    await render('curso-a');
    expect(rpc).toHaveBeenLastCalledWith('vertice_teaching_fo_metrics', { p_institution: 'ies-a', p_course: 'curso-a' });
    expect(node.querySelector('tbody')?.textContent).toMatch(/D001.*Civil.*70\s*%/);
    await act(async () => {
      const control = node.querySelector('select')!;
      control.value = 'oab';
      control.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(rpc).toHaveBeenLastCalledWith('vertice_teaching_fo_metrics', { p_institution: 'ies-a', p_course: 'curso-a', p_module: 'oab' });
    expect(node.textContent).not.toContain('ENEM');
  });

  it('não reapresenta dados atrasados de outro curso e distingue consulta vazia de erro', async () => {
    let finishOld!: (value: { data: typeof sample[]; error: null }) => void;
    rpc.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    rpc.mockResolvedValueOnce({ data: [], error: null });
    rpc.mockResolvedValueOnce({ data: null, error: new Error('falha') });
    const { node, render } = renderFixture();
    await render('curso-a');
    await render('curso-b');
    expect(node.textContent).toContain('Nenhum resultado agregado');
    await act(async () => finishOld({ data: [sample], error: null }));
    expect(node.textContent).not.toContain('D001');
    await render('curso-c');
    expect(node.querySelector('[role=alert]')?.textContent).toContain('Não foi possível consultar');
    expect(node.textContent).not.toContain('Nenhum resultado agregado');
  });
});
