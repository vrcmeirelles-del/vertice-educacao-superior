import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { painel } from './fixture';

const I = '00000000-0000-4000-8000-000000000101', C = '00000000-0000-4000-8000-000000000201', C2 = '00000000-0000-4000-8000-000000000202';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), institutions: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ order: mocks.institutions }) }) }) } }));
import CentralAutomacao from './CentralAutomacao';

let host: HTMLDivElement, root: Root;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.resetAllMocks(); });
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
async function render(el: React.ReactElement) { await act(async () => { root.render(el); await flush(); }); }
async function change(el: HTMLSelectElement | HTMLInputElement, value: string) {
  await act(async () => { const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); await flush(); });
}
async function click(el: Element) { await act(async () => { (el as HTMLElement).click(); await flush(); }); }
const dash = (over = {}, course: string | null = null) => ({ data: painel({ courseId: course, ...over }), error: null });

describe('Central de Automação — painel da IES', () => {
  it('mostra estados reais, fila não verificada e nenhuma execução, sem zeros inventados', async () => {
    mocks.rpc.mockResolvedValue(dash());
    await render(<CentralAutomacao institutionId={I} role="gestor" courses={[{ id: C, name: 'Direito' }]} />);
    expect(mocks.rpc).toHaveBeenCalledWith('vertice_automation_dashboard', { p_institution: I, p_course: null });
    expect(host.textContent).toContain('Sem execução registrada.');
    expect(host.textContent).toContain('Fila não verificada');
    expect(host.textContent).toContain('Nenhuma configuração aprovada');
    expect(host.textContent).toContain('Documentos do Repositório com prazo vencido');
    expect(host.textContent).not.toContain('repo.overdue');
    expect(host.querySelector('caption')).not.toBeNull();
    expect(host.querySelectorAll('th[scope="col"]').length).toBe(7);
  });

  it('estrutura não instalada aparece como indisponível, não como zero', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.vertice_automation_dashboard' } });
    await render(<CentralAutomacao institutionId={I} role="gestor" />);
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/ainda não foi instalada/);
    expect(host.querySelector('.a360-cards')).toBeNull();
  });

  it('resposta com escopo divergente é descartada', async () => {
    mocks.rpc.mockResolvedValue({ data: painel({ institutionId: C }), error: null });
    await render(<CentralAutomacao institutionId={I} role="gestor" />);
    expect(host.textContent).toMatch(/não pôde ser verificada/);
  });

  it('coordenador vê só os próprios cursos e nunca o escopo institucional', async () => {
    mocks.rpc.mockImplementation(async (_: string, a: { p_course: string | null }) => dash({}, a.p_course));
    await render(<CentralAutomacao institutionId={I} role="coordenador" courseFunctionIds={[C]} courses={[{ id: C, name: 'Direito' }, { id: C2, name: 'Medicina' }]} />);
    const options = [...host.querySelectorAll('select')[0].querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual(['Direito']);
    expect(mocks.rpc).toHaveBeenCalledWith('vertice_automation_dashboard', { p_institution: I, p_course: C });
    expect(mocks.rpc).not.toHaveBeenCalledWith('vertice_automation_dashboard', { p_institution: I, p_course: null });
  });

  it('leitor não recebe controles de configuração', async () => {
    mocks.rpc.mockResolvedValue(dash());
    await render(<CentralAutomacao institutionId={I} role="leitor" />);
    expect(host.textContent).toContain('Nenhum curso atribuído');
    expect(host.querySelector('button')).toBeNull();
  });

  it('propõe revisão somente em modo sombra e com a revisão esperada', async () => {
    mocks.rpc.mockResolvedValueOnce(dash()).mockResolvedValueOnce({ data: 1, error: null }).mockResolvedValue(dash({ pendingConfig: { id: 1, revision: 1 } }));
    await render(<CentralAutomacao institutionId={I} role="gestor" />);
    const proposeButton = () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Propor nova revisão')!;
    expect(proposeButton().disabled).toBe(true); // nada alterado ainda
    await click(host.querySelector('input[aria-label^="Incluir Documentos do Repositório com prazo vencido"]')!);
    await click(proposeButton());
    expect(mocks.rpc).toHaveBeenCalledWith('vertice_automation_propose_config', expect.objectContaining({
      p_institution: I, p_course: null, p_rule_ids: ['repo.overdue'], p_mode: 'shadow', p_expected_revision: 0 }));
    expect(host.textContent).toMatch(/só passa a valer após aprovação por outra pessoa/);
    expect(host.textContent).toMatch(/Revisão 1 aguardando aprovação independente/);
  });

  it('autoaprovação recusada no servidor aparece com mensagem institucional', async () => {
    mocks.rpc.mockResolvedValueOnce(dash({ pendingConfig: { id: 7, revision: 1 } })).mockResolvedValueOnce({ data: null, error: { message: 'autoaprovação proibida' } });
    await render(<CentralAutomacao institutionId={I} role="gestor" />);
    await click([...host.querySelectorAll('button')].find((b) => b.textContent === 'Aprovar revisão 1')!);
    expect(mocks.rpc).toHaveBeenCalledWith('vertice_automation_approve_config', { p_config_id: 7, p_reason: expect.any(String) });
    expect(host.textContent).toMatch(/outra pessoa autorizada/);
  });

  it('filtros e estado vazio da tabela', async () => {
    mocks.rpc.mockResolvedValue(dash());
    await render(<CentralAutomacao institutionId={I} role="gestor" />);
    await change(host.querySelector('input:not([type=checkbox])') as HTMLInputElement, 'inexistente');
    expect(host.textContent).toContain('Nenhuma regra corresponde ao filtro.');
  });
});

describe('Central de Automação — Master', () => {
  it('aguarda a seleção explícita da instituição antes de consultar', async () => {
    mocks.institutions.mockResolvedValue({ data: [{ id: I, name: 'IES sintética' }], error: null });
    mocks.rpc.mockResolvedValue(dash());
    await render(<CentralAutomacao master />);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Selecione uma instituição');
    await change(host.querySelector('select')!, I);
    expect(mocks.rpc).toHaveBeenCalledWith('vertice_automation_dashboard', { p_institution: I, p_course: null });
  });
});
