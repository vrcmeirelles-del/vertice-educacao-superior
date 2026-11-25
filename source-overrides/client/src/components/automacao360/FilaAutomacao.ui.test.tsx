// Fila operacional: a tela só coleta a decisão humana e chama as RPCs existentes com a revisão esperada.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { painel } from './fixture';

const I = '00000000-0000-4000-8000-000000000101', A = '00000000-0000-4000-8000-000000000901', U = '00000000-0000-4000-8000-000000000007';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }) } }));
import FilaAutomacao from './FilaAutomacao';
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
const button = (t: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === t) as HTMLButtonElement | undefined;
const input = (label: RegExp) => [...host.querySelectorAll('label')].find((l) => label.test(l.textContent ?? ''))!.querySelector('input,select') as HTMLInputElement;
const prop = (over = {}) => ({ id: A, ruleId: 'repo.overdue', priority: 'P0', status: 'pending_review', revision: 0, ownerId: null, dueAt: null, actionId: null, sourceCleared: false, ...over });

describe('Fila operacional da Automação 360°', () => {
  it('aprovar exige justificativa, responsável e prazo, e envia a revisão esperada', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'vertice_team' ? { data: [{ user_id: U, email: 'responsavel@ies.edu' }], error: null } : { data: 1, error: null });
    const changed = vi.fn();
    await render(<FilaAutomacao institutionId={I} pending={[prop()]} onChanged={changed} />);
    expect(host.textContent).toContain('Documentos do Repositório com prazo vencido');
    expect(host.textContent).not.toContain('repo.overdue');
    await click(button('Decidir')!);
    expect(button('Aprovar e atribuir')!.disabled).toBe(true);
    await change(input(/Justificativa/), 'Pendência confirmada');
    expect(button('Aprovar e atribuir')!.disabled).toBe(true);
    await change(input(/Responsável/) as unknown as HTMLSelectElement, U);
    await change(input(/Prazo/), '2026-12-10');
    await click(button('Aprovar e atribuir')!);
    expect(mocks.rpc).toHaveBeenCalledWith('vertice_automation_decide', expect.objectContaining({ p_alert: A, p_action: 'approve', p_expected_revision: 0,
      p_reason: 'Pendência confirmada', p_owner: U, p_evidence_ref: null }));
    const due = mocks.rpc.mock.calls.find((c) => c[0] === 'vertice_automation_decide')![1].p_due_at;
    expect(new Date(due).toISOString().slice(0, 10)).toBe('2026-12-11'); // 23h59 de Brasília
    expect(changed).toHaveBeenCalled();
  });

  it('alerta aprovado: encaminha ao 5W2H uma vez; com ação criada, o botão some', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await render(<FilaAutomacao institutionId={I} pending={[prop({ status: 'approved', revision: 1 })]} onChanged={vi.fn()} />);
    await click(button('Decidir')!);
    await change(input(/O quê/), 'Atualizar o PPC no Repositório');
    await click(button('Encaminhar ao 5W2H')!);
    expect(mocks.rpc).toHaveBeenCalledWith('vertice_automation_handoff_5w2h', { p_alert: A, p_goal: null, p_what: 'Atualizar o PPC no Repositório', p_why: null });
    await render(<FilaAutomacao institutionId={I} pending={[prop({ status: 'approved', revision: 1, actionId: '00000000-0000-4000-8000-000000000555' })]} onChanged={vi.fn()} />);
    expect(host.textContent).toContain('ação 5W2H criada');
    expect(button('Encaminhar ao 5W2H')).toBeUndefined();
  });

  it('concluir pede evidência; fonte normalizada aparece como aviso, sem mudar a decisão', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'vertice_team' ? { data: [], error: null } : { data: null, error: { message: 'verificação independente obrigatória' } });
    await render(<FilaAutomacao institutionId={I} pending={[prop({ status: 'completed', revision: 3, sourceCleared: true })]} onChanged={vi.fn()} />);
    expect(host.textContent).toContain('não aparece mais na fonte');
    await click(button('Decidir')!);
    await change(input(/Justificativa/), 'Conferido no Repositório');
    expect(button('Verificar (outra pessoa)')!.disabled).toBe(true);
    await change(input(/Evidência/), 'repositorio:ppc-2026');
    await click(button('Verificar (outra pessoa)')!);
    expect(mocks.rpc).toHaveBeenCalledWith('vertice_automation_decide', expect.objectContaining({ p_action: 'verify', p_expected_revision: 3, p_evidence_ref: 'repositorio:ppc-2026' }));
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/outra pessoa/);
  });
});

describe('Central: modo operacional e homologação da fonte', () => {
  it('Master homologa a fonte com justificativa; a revisão pode ser proposta em modo operacional', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'vertice_automation_dashboard' ? { data: painel(), error: null } : { data: 'validada', error: null });
    await render(<CentralAutomacao institutionId={I} master role="master" />);
    const homologar = button('Homologar fonte')!;
    expect(homologar.disabled).toBe(true);
    await change(input(/Justificativa da homologação/), 'Conferida em modo sombra por 30 dias');
    await click(button('Homologar fonte')!);
    expect(mocks.rpc).toHaveBeenCalledWith('vertice_automation_validate_source', { p_rule: 'repo.overdue', p_validate: true, p_reason: 'Conferida em modo sombra por 30 dias' });
    await change(input(/^Modo/) as unknown as HTMLSelectElement, 'operational');
    await click(host.querySelector('input[aria-label^="Incluir"]')!);
    await click(button('Propor nova revisão')!);
    expect(mocks.rpc).toHaveBeenCalledWith('vertice_automation_propose_config', expect.objectContaining({ p_mode: 'operational' }));
  });

  it('gestor da IES não vê a homologação de fonte', async () => {
    mocks.rpc.mockResolvedValue({ data: painel(), error: null });
    await render(<CentralAutomacao institutionId={I} role="gestor" />);
    expect(button('Homologar fonte')).toBeUndefined();
    expect(host.textContent).not.toContain('Justificativa da homologação');
  });
});
