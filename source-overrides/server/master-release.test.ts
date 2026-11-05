import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../client/src/lib/supabase', () => ({ supabase: {} }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each(['true', 'false', ''])('keeps this release unavailable even when environment opt-in is %j', async value => {
  vi.stubEnv('VITE_MASTER_INVITATIONS_ENABLED', value);
  vi.resetModules();
  const release = await import('../client/src/lib/master-invitations');
  expect(import.meta.env.VITE_MASTER_INVITATIONS_ENABLED).toBe(value);
  expect(release.MASTER_INVITATIONS_RELEASE_AVAILABLE).toBe(false);
  expect(release.MASTER_INVITATIONS_ENABLED).toBe(false);
});
