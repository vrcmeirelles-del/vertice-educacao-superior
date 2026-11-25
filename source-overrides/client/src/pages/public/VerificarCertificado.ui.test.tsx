import { it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
const fx = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: fx.rpc } }));
import VerificarCertificado from './VerificarCertificado';
let root: Root | undefined, el: HTMLDivElement;
afterEach(async () => { if (root) await act(async () => root!.unmount()); el?.remove(); fx.rpc.mockReset(); window.history.replaceState(null, '', '/'); });
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
async function render() { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; el = document.createElement('div'); document.body.append(el); root = createRoot(el); await act(async () => { root!.render(<VerificarCertificado />); await flush(); }); }
const ok = { found: true, status: 'emitido', kind: 'extensao', holderName: 'Ana Souza', activityTitle: 'Projeto Cidadania', minutes: 840, periodStart: '2026-03-01',
  periodEnd: '2026-06-30', issuedAt: '2026-11-25T13:00:00Z', signerName: 'Maria', signerRole: 'Coordenadora', institution: 'IES X', contentSha256: 'a'.repeat(64), revokedAt: null };

it('código do QR na URL é consultado e o resultado mostra só o impresso', async () => {
  window.history.replaceState(null, '', '/verificar-certificado?codigo=abcd-efgh-jklm');
  fx.rpc.mockResolvedValue({ data: ok, error: null });
  await render();
  expect(fx.rpc).toHaveBeenCalledWith('vertice_certificate_verify', { p_code: 'ABCD-EFGH-JKLM' });
  expect(el.textContent).toContain('Certificado válido'); expect(el.textContent).toContain('14 horas');
  expect(el.textContent).toContain('no período de 01/03/2026 a 30/06/2026');
});

it('revogado e inexistente são ditos com clareza; código malformado não consulta', async () => {
  window.history.replaceState(null, '', '/verificar-certificado?codigo=ABCD-EFGH-JKLM');
  fx.rpc.mockResolvedValue({ data: { ...ok, status: 'revogado', revokedAt: '2026-11-26T10:00:00Z' }, error: null });
  await render();
  expect(el.textContent).toContain('Certificado revogado'); expect(el.textContent).toContain('não tem validade');
  await act(async () => root!.unmount()); root = undefined; el.remove(); fx.rpc.mockReset();
  window.history.replaceState(null, '', '/verificar-certificado?codigo=123');
  await render();
  expect(fx.rpc).not.toHaveBeenCalled(); expect(el.querySelector('[role="alert"]')!.textContent).toMatch(/12 caracteres/);
  await act(async () => root!.unmount()); root = undefined; el.remove();
  window.history.replaceState(null, '', '/verificar-certificado?codigo=ZZZZ-ZZZZ-ZZZZ');
  fx.rpc.mockResolvedValue({ data: { found: false }, error: null });
  await render();
  expect(el.textContent).toContain('Nenhum certificado encontrado');
});
