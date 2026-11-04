import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { consumeMasterFragment, parseMasterFragment } from '../client/src/lib/master-invitation-token';

const sdk = vi.hoisted(() => ({ createClient: vi.fn(() => ({})) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.createClient }));
const invitation = '11111111-1111-4111-8111-111111111111';
const rawToken = 'a'.repeat(43);
const masterHash = `#master_invitation=${invitation}&master_token=${rawToken}`;
beforeEach(() => { vi.resetModules(); sdk.createClient.mockClear(); });
afterEach(() => { vi.unstubAllGlobals(); });

function browser(hash: string) {
  const location = { pathname: '/master', search: '', hash };
  const replaceState = vi.fn((_state: unknown, _title: string, url: string) => {
    location.hash = new URL(url, 'https://example.invalid').hash;
  });
  vi.stubGlobal('window', { location, history: { replaceState }, localStorage: {}, addEventListener: vi.fn() });
  return { location, replaceState };
}

describe('Master bootstrap composition with Auth and navigation', () => {
  it('captures only its own credential and removes it before SDK creation', async () => {
    const page = browser(masterHash);
    sdk.createClient.mockImplementationOnce(() => { expect(page.location.hash).toBe(''); return {}; });
    await import('../client/src/lib/supabase');
    const bootstrap = await import('../client/src/lib/master-invitation-bootstrap');
    expect(bootstrap.getPendingMasterInvitation()).toEqual({ invitation, rawToken });
    expect(page.replaceState).toHaveBeenCalledOnce();
    expect(sdk.createClient).toHaveBeenCalledOnce();
  });

  it.each(['recovery', 'invite'])('preserves independent Auth %s callbacks', async type => {
    const hash = `#access_token=synthetic-only&refresh_token=synthetic-refresh&type=${type}`;
    const page = browser(hash);
    const auth = await import('../client/src/lib/supabase');
    expect(auth.passwordCallback).toBe(true);
    expect(auth.callbackToken).toBe('synthetic-only');
    expect(page.location.hash).toBe(hash);
    expect(page.replaceState).not.toHaveBeenCalled();
    expect((await import('../client/src/lib/master-invitation-bootstrap')).getPendingMasterInvitation()).toBeNull();
  });

  it.each(['#masters=1', '#ies=1', '#instituicao=fixture&aba=biblioteca', '#repositorios=1', '#code=synthetic-code', '#token_hash=synthetic-hash&type=recovery'])('leaves independent navigation/callback untouched: %s', hash => {
    const page = browser(hash);
    expect(consumeMasterFragment(page.location, { replaceState: page.replaceState })).toBeNull();
    expect(page.replaceState).not.toHaveBeenCalled();
  });

  it.each(['ies_invitation', 'ies_token', 'ies_future', 'academic_invitation', 'academic_token', 'academic_future', 'access_token', 'refresh_token', 'code', 'token_hash'])('fails closed for a mixed Master credential: %s', key => {
    const page = browser(`${masterHash}&${key}=synthetic`);
    expect(parseMasterFragment(page.location.hash)).toBeNull();
    expect(consumeMasterFragment(page.location, { replaceState: page.replaceState })).toBeNull();
    expect(page.location.hash).toBe('');
  });

  it.each(['code', 'token_hash', 'access_token', 'refresh_token', 'master_invitation', 'master_token', 'ies_token', 'academic_token'])('rejects mixed query credentials and preserves ordinary query: %s', key => {
    const replaceState = vi.fn();
    const search = `?return=dashboard&${key}=synthetic-secret`;
    expect(parseMasterFragment(masterHash, search)).toBeNull();
    expect(consumeMasterFragment({ hash: masterHash, pathname: '/master', search }, { replaceState })).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/master?return=dashboard');
  });

  it('never captures a Master credential from query and scrubs it without handing Auth a partial callback', () => {
    const replaceState = vi.fn();
    expect(consumeMasterFragment({ hash: '#access_token=synthetic&type=recovery', pathname: '/master', search: `?view=summary&master_invitation=${invitation}&master_token=${rawToken}` }, { replaceState })).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/master?view=summary');
  });

  it('preserves independent Auth query callbacks and benign query beside a valid Master fragment', () => {
    const replaceState = vi.fn();
    for (const key of ['code', 'token_hash']) {
      expect(consumeMasterFragment({ hash: '#type=recovery', pathname: '/entrar', search: `?${key}=synthetic` }, { replaceState })).toBeNull();
      expect(replaceState).not.toHaveBeenCalled();
    }
    expect(consumeMasterFragment({ hash: masterHash, pathname: '/master', search: '?view=a%20b' }, { replaceState })).toEqual({ invitation, rawToken });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/master?view=a%20b');
  });
});
