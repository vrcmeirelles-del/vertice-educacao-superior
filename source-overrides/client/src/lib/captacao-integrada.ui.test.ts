import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
const api = vi.hoisted(() => ({ access: vi.fn(), fetch: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: {} }));
vi.mock('./captacao-integrada', async importOriginal => ({
  ...await importOriginal<typeof import('./captacao-integrada')>(),
  canManageCaptacao: api.access, fetchCaptacaoIntegrada: api.fetch,
  createCaptacaoConnection: api.create, createCaptacaoAsset: api.create, createCaptacaoCampaign: api.create,
  updateCaptacaoConnection: api.update, updateCaptacaoAsset: api.update, updateCaptacaoCampaign: api.update,
}));
import CaptacaoIntegrada from '../components/area/CaptacaoIntegrada';
const iesA = 'bb000000-0000-4000-8000-000000000001', iesB = 'bb000000-0000-4000-8000-000000000002';
const account = { id: 'cc000000-0000-4000-8000-000000000001', institution_id: iesA, provider: 'meta', label: 'Conta A', public_url: 'https://instagram.com/synthetic', account_external_id: '123', status: 'prepared', version: 1 };
const empty = () => ({ connections: [], assets: [], campaigns: [] });
let container: HTMLDivElement, root: Root;
function button(name: string): HTMLButtonElement {
  const element = [...container.querySelectorAll('button')].find(element => element.textContent === name);
  if (!element) throw Error(`Missing button ${name}`);
  return element;
}
async function click(name: string) { await act(async () => { button(name).click(); }); }
async function render(ies = iesA) {
  await act(async () => { root.render(createElement(CaptacaoIntegrada, { institutionId: ies, institutionName: ies === iesA ? 'IES A' : 'IES B', overview: createElement('p', null, 'Indicadores legados preservados') })); });
}
function fill(name: string, value: string) {
  const field = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
async function submit(times = 1) {
  await act(async () => { for (let i = 0; i < times; i++) container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  api.access.mockResolvedValue(true); api.fetch.mockResolvedValue({ connections: [account], assets: [], campaigns: [] });
  api.create.mockResolvedValue(account); api.update.mockResolvedValue(account);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
describe('interface institucional (DOM sintético, sem provedor)', () => {
  it('preserva a visão legada mesmo quando a preparação está indisponível', async () => {
    api.access.mockRejectedValue(Error('Missing migration')); await render();
    expect(container.textContent).toContain('Indicadores legados preservados');
    expect(container.querySelector('[role=alert]')).toBeNull();
    await click('Conexões'); expect(container.querySelector('[role=alert]')?.textContent).toContain('Configuração indisponível');
    expect(container.textContent).not.toContain('Nenhuma conta preparada');
  });
  it('mostra referência não autorizada e datas de fonte ausentes', async () => {
    await render(); await click('Conexões');
    expect(container.textContent).toContain('Preparação salva · não autorizada');
    expect(container.textContent).toContain('Última sincronização com provedores: não informada');
    expect(container.textContent).toContain('Não executado');
  });
  it('mantém campos após falha, bloqueia clique repetido e reutiliza ID no retry', async () => {
    let reject!: (reason: Error) => void;
    api.create.mockReturnValueOnce(new Promise((_, no) => { reject = no; }));
    await render(); await click('Conexões'); await click('Preparar conta');
    expect(document.activeElement?.getAttribute('name')).toBe('provider');
    fill('label', 'Rascunho A'); fill('url', 'https://instagram.com/synthetic2');
    await submit(2); expect(api.create).toHaveBeenCalledTimes(1);
    await act(async () => reject(Error('Sessão expirada')));
    expect(container.querySelector<HTMLInputElement>('[name=label]')?.value).toBe('Rascunho A');
    expect(container.querySelector('[role=alert]')?.textContent).toBe('Sessão expirada');
    await submit(); expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.create.mock.calls[1][1]).toBe(api.create.mock.calls[0][1]);
    expect(api.create.mock.calls[0][0]).toBe(iesA);
    expect(container.querySelector('form')).toBeNull();
  });
  it('não sobrescreve alteração concorrente e preserva rascunho', async () => {
    api.update.mockRejectedValue(Error('Versão desatualizada'));
    await render(); await click('Conexões'); await click('Editar conta Conta A'); fill('label', 'Edição pendente');
    await submit(); expect(container.querySelector('[role=alert]')?.textContent).toBe('Versão desatualizada');
    expect(container.querySelector<HTMLInputElement>('[name=label]')?.value).toBe('Edição pendente');
    expect(api.update.mock.calls[0][0].version).toBe(1);
    await click('Cancelar'); expect(document.activeElement?.textContent).toBe('Da campanha ao vínculo com a IES');
  });
  it('descarta resposta antiga e formulário ao trocar de IES', async () => {
    let resolve!: (value: unknown) => void;
    api.fetch.mockReturnValueOnce(new Promise(yes => { resolve = yes; })).mockResolvedValueOnce(empty());
    await render(); await click('Conexões'); expect(container.textContent).toContain('Consultando');
    await render(iesB); await click('Conexões');
    await act(async () => resolve({ connections: [account], assets: [], campaigns: [] }));
    expect(container.textContent).toContain('Nenhuma conta preparada para esta IES');
    expect(container.textContent).not.toContain('Conta A');
    expect(container.querySelector('form')).toBeNull();
  });
  it('um salvamento iniciado na IES A não escreve aviso na IES B', async () => {
    let resolve!: (value: unknown) => void;
    api.create.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
    await render(); await click('Conexões'); await click('Preparar conta'); fill('label', 'Somente A'); fill('url', 'https://instagram.com/synthetic2');
    await submit(); api.fetch.mockResolvedValue(empty()); await render(iesB); await click('Conexões');
    await act(async () => resolve(account));
    expect(container.textContent).not.toContain('Preparação salva. A referência'); expect(container.textContent).not.toContain('Somente A');
    expect(api.create.mock.calls[0][0]).toBe(iesA);
  });
  it('nega gestão sem consultar cadastros quando o servidor recusa a permissão', async () => {
    api.access.mockResolvedValue(false); await render(); await click('Conexões');
    expect(api.fetch).not.toHaveBeenCalled();
    expect(container.textContent).toContain('A configuração exige MFA');
    expect([...container.querySelectorAll('button')].some(element => element.textContent === 'Preparar conta')).toBe(false);
  });
  it('limita opções do formulário nativo aos ativos da conexão selecionada', async () => {
    api.fetch.mockResolvedValue({ connections: [account], assets: [
      { id:'form-a', connection_id:account.id, kind:'form', label:'Formulário A' },
      { id:'form-b', connection_id:'other', kind:'form', label:'Formulário B' },
      { id:'page-a', connection_id:account.id, kind:'page', label:'Página A' },
    ], campaigns: [] });
    await render(); await click('Campanhas'); await click('Preparar campanha');
    const select = [...container.querySelectorAll('select')].find(element => element.textContent?.includes('Página de destino'))!;
    await act(async () => { select.value = 'native'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    const forms = container.querySelector<HTMLSelectElement>('select[name=form]')!;
    expect(forms.textContent).toContain('Formulário A'); expect(forms.textContent).not.toContain('Formulário B'); expect(forms.textContent).not.toContain('Página A');
  });
});
