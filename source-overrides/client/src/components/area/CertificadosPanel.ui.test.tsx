// Painel de certificados: chama as RPCs com o tipo e a origem; emitir exige signatário; revogar exige justificativa.
import { it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
const fx = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: fx.rpc } }));
import CertificadosPanel from './CertificadosPanel';
let root: Root | undefined, el: HTMLDivElement;
afterEach(async () => { if (root) await act(async () => root!.unmount()); el?.remove(); fx.rpc.mockReset(); });
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
const cert = { id: 'c1', code: 'ABCD-EFGH-JKLM', minutes: 840, issuedAt: '2026-11-25T13:00:00Z', signerName: 'Maria', signerRole: 'Coordenadora', holderName: 'Ana Souza',
  activityTitle: 'Projeto', periodStart: null, periodEnd: null, outdated: false };
const roster = (withCert: boolean) => ({ data: { title: 'Projeto', institution: 'IES X', eligible: [
  { holderRef: 'a', holderName: 'Ana Souza', minutes: 840, certificate: withCert ? cert : null }, { holderRef: 'b', holderName: 'Caio Reis', minutes: 120, certificate: null }] }, error: null });
async function render(kind: 'extensao' | 'ensino' = 'extensao') {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; el = document.createElement('div'); document.body.append(el); root = createRoot(el);
  await act(async () => root!.render(<CertificadosPanel kind={kind} sourceId="src-1" />));
  await act(async () => { (el.querySelector('button') as HTMLButtonElement).click(); await flush(); });
}
const button = (t: RegExp) => [...el.querySelectorAll('button')].find((b) => t.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
async function type(label: RegExp, v: string) {
  const i = [...el.querySelectorAll('label')].find((l) => label.test(l.textContent ?? ''))!.querySelector('input') as HTMLInputElement;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); await flush(); });
}

it('lista elegíveis, emite só com signatário e informa quantos', async () => {
  fx.rpc.mockImplementation(async (name: string) => name === 'vertice_certificate_roster' ? roster(true) : { data: 1, error: null });
  await render();
  expect(fx.rpc).toHaveBeenCalledWith('vertice_certificate_roster', { p_kind: 'extensao', p_source: 'src-1' });
  expect(el.textContent).toContain('Emitidos: 1. Faltam: 1.');
  expect(el.textContent).toContain('ABCD-EFGH-JKLM');
  expect(el.querySelector('a')!.getAttribute('href')).toBe('https://www.verticesuperior.com.br/verificar-certificado?codigo=ABCD-EFGH-JKLM');
  expect(button(/^Emitir 1/)!.disabled).toBe(true);
  await type(/Quem assina/, 'Maria Silva'); await type(/Cargo/, 'Coordenadora de Extensão');
  await act(async () => { button(/^Emitir 1/)!.click(); await flush(); });
  expect(fx.rpc).toHaveBeenCalledWith('vertice_certificate_issue', { p_kind: 'extensao', p_source: 'src-1', p_signer_name: 'Maria Silva', p_signer_role: 'Coordenadora de Extensão' });
  expect(el.textContent).toContain('1 certificado(s) emitido(s).');
});

it('revogar exige justificativa; sem permissão aparece mensagem e nada é listado', async () => {
  fx.rpc.mockImplementation(async (name: string) => name === 'vertice_certificate_roster' ? roster(true) : { data: null, error: null });
  await render();
  expect(button(/^Revogar$/)!.disabled).toBe(true);
  await type(/Justificativa para revogar/, 'Horas corrigidas');
  await act(async () => { button(/^Revogar$/)!.click(); await flush(); });
  expect(fx.rpc).toHaveBeenCalledWith('vertice_certificate_revoke', { p_certificate: 'c1', p_reason: 'Horas corrigidas' });
  await act(async () => root!.unmount()); root = undefined; el.remove();
  fx.rpc.mockResolvedValue({ data: null, error: { message: 'acesso negado ou MFA pendente' } });
  await render('ensino');
  expect(el.querySelector('[role="alert"]')!.textContent).toMatch(/gestão do módulo/);
  expect(el.querySelector('table')).toBeNull();
});
