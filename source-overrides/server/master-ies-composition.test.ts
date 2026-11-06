import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ createClient: vi.fn((..._args: unknown[]) => ({})) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.createClient }));
const id = '11111111-1111-4111-8111-111111111111';
const master = `master_invitation=${id}&master_token=${'a'.repeat(43)}`;
const ies = `ies_invitation=${id}&ies_token=${'b'.repeat(64)}`;
const head = readFileSync('client/public/ies-invitation-bootstrap.js', 'utf8');
beforeEach(() => { vi.resetModules(); sdk.createClient.mockClear(); });
afterEach(() => { vi.unstubAllGlobals(); });
function page(hash: string, search = '', runHead = true) {
  const location = { hash, search, pathname: '/master' };
  const target = { location, localStorage: {}, addEventListener: vi.fn(), history: { replaceState: vi.fn((_a: unknown, _b: string, url: string) => {
    const parsed = new URL(url, 'https://example.invalid'); location.hash = parsed.hash; location.search = parsed.search;
  }) } };
  vi.stubGlobal('window', target);
  if (runHead) runInNewContext(head, { window: target, URLSearchParams });
  return target as typeof target & { __verticeIesInvitation: { peek(): unknown; invalid(): boolean } };
}
async function load() {
  const auth = await import('../client/src/lib/supabase');
  const bootstrap = await import('../client/src/lib/master-invitation-bootstrap');
  const options = sdk.createClient.mock.calls[0][2] as { auth: { detectSessionInUrl: boolean } };
  return { auth, credential: bootstrap.getPendingMasterInvitation(), options };
}
it('preserves the blocking IES head script before the module entry', () => {
  const html = readFileSync('client/index.html', 'utf8');
  expect(html).toContain('<script src="/ies-invitation-bootstrap.js"></script>');
  expect(html.indexOf('/ies-invitation-bootstrap.js')).toBeLessThan(html.indexOf('/src/main.tsx'));
});
it('captures valid IES only in the IES vault before Master and SDK', async () => {
  const target = page(`#${ies}`); const result = await load();
  expect(target.__verticeIesInvitation.peek()).toEqual({ id, token: 'b'.repeat(64) });
  expect(result.credential).toBeNull(); expect(target.location.hash).toBe('#ies=1');
});
it('leaves Master-only credentials for Master and scrubs them before SDK', async () => {
  const target = page(`#${master}`); sdk.createClient.mockImplementationOnce(() => { expect(target.location.hash).toBe(''); return {}; });
  const result = await load(); expect(target.__verticeIesInvitation.peek()).toBeNull();
  expect(result.credential).toEqual({ invitation: id, rawToken: 'a'.repeat(43) });
});
it.each(['code', 'token_hash', 'access_token', 'refresh_token', 'academic_token', 'master_token'])('rejects IES mixed with %s in hash and query', async key => {
  for (const inQuery of [false, true]) {
    vi.resetModules(); sdk.createClient.mockClear();
    const target = page(`#${ies}${inQuery ? '' : `&${key}=synthetic`}`, inQuery ? `?keep=1&${key}=synthetic` : '?keep=1');
    const result = await load(); expect(result.credential).toBeNull(); expect(target.__verticeIesInvitation.peek()).toBeNull();
    expect(target.__verticeIesInvitation.invalid()).toBe(true); expect(target.location.hash).toBe('#ies=1'); expect(target.location.search).toBe('?keep=1');
  }
});
it.each(['code', 'token_hash', 'access_token', 'refresh_token', 'ies_token', 'academic_token'])('rejects Master mixed with %s in hash and query', async key => {
  for (const inQuery of [false, true]) {
    vi.resetModules(); sdk.createClient.mockClear();
    const target = page(`#${master}${inQuery ? '' : `&${key}=synthetic`}`, inQuery ? `?keep=1&${key}=synthetic` : '?keep=1');
    const result = await load(); expect(result.credential).toBeNull(); expect(target.__verticeIesInvitation.peek()).toBeNull();
    expect(target.location.hash).not.toContain('token'); expect(target.location.search).toBe('?keep=1');
  }
});
it.each(['code', 'token_hash'])('preserves independent Auth query %s', async key => {
  const target = page('#type=recovery', `?${key}=synthetic`); const result = await load();
  expect(target.location.hash).toBe('#type=recovery'); expect(target.location.search).toBe(`?${key}=synthetic`);
  expect(result.credential).toBeNull(); expect(result.options.auth.detectSessionInUrl).toBe(true);
});
it('preserves independent recovery tokens and ordinary navigation', async () => {
  for (const hash of ['#access_token=synthetic&refresh_token=synthetic&type=recovery', '#ies=1', '#masters=1', '#instituicao=fixture&aba=biblioteca']) {
    vi.resetModules(); sdk.createClient.mockClear(); const target = page(hash); const result = await load();
    expect(target.location.hash).toBe(hash); expect(result.credential).toBeNull();
    if (hash.includes('access_token')) { expect(result.auth.passwordCallback).toBe(true); expect(result.auth.callbackToken).toBe('synthetic'); }
  }
});
it('runs fallback IES guard before direct Master bootstrap and disables SDK URL detection', async () => {
  const target = page(`#${master}`, `?keep=1&ies_token=${'b'.repeat(64)}&code=synthetic`, false);
  const bootstrap = await import('../client/src/lib/master-invitation-bootstrap');
  expect(bootstrap.getPendingMasterInvitation()).toBeNull(); expect(target.location.hash).toBe('#ies=1'); expect(target.location.search).toBe('?keep=1');
  const result = await load(); expect(result.options.auth.detectSessionInUrl).toBe(false);
});
