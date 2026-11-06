import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
const { rpc, rpcResult, setHeader, getSession } = vi.hoisted(() => ({ rpc: vi.fn(), rpcResult: vi.fn(), setHeader: vi.fn(), getSession: vi.fn() }));
vi.mock('../client/src/lib/supabase', () => ({ supabase: { rpc, auth: { getSession } } }));
import { canonicalMasterEmail, consumeMasterFragment, parseMasterFragment, generateMasterSecret, masterInvitationLink } from '../client/src/lib/master-invitation-token';
import { MASTER_INVITATIONS_ENABLED, listMasters, listMasterInvitations, issueMasterInvitation, previewMasterInvitation, acceptMasterInvitation, revokeMasterInvitation, createMasterRequestGuard } from '../client/src/lib/master-invitations';
import MasterInvitations from '../client/src/components/area/MasterInvitations';

const id = '11111111-1111-4111-8111-111111111111', user = '22222222-2222-4222-8222-222222222222';
const context = { userId: user, isCurrent: () => true };
const token = 'a'.repeat(43), credential = { invitation: id, rawToken: token };
const email = 'synthetic@example.invalid', createdAt = '2026-11-03T10:00:00.123456Z', expiresAt = '2030-01-01T00:00:00Z';
const response = { id, email, expires_at: expiresAt };
beforeEach(() => {
  rpc.mockReset(); rpcResult.mockReset(); setHeader.mockReset(); getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { user: { id: user }, access_token: 'synthetic-fixture-only' } }, error: null });
  rpc.mockImplementation((...args) => { const promise = Promise.resolve().then(() => rpcResult(...args)); return Object.assign(promise, { setHeader: (key: string, value: string) => { setHeader(key, value); return promise; } }); });
  // Deterministic, isolated test material, never issued to a real service.
  vi.stubGlobal('crypto', { subtle: webcrypto.subtle, getRandomValues: (array: Uint8Array) => { array.fill(7); return array; } });
});
describe('Master invitations fail closed', () => {
  it('is disabled by default', () => { expect(MASTER_INVITATIONS_ENABLED).toBe(false); });
  it('normalizes email without provider-specific alias rewriting', () => {
    expect(canonicalMasterEmail(' Person+tag@Example.invalid ')).toBe('person+tag@example.invalid');
    for (const value of ['a..b@example.invalid', '.a@example.invalid', 'a.@example.invalid', 'a@-bad.invalid', 'a@example', 'a b@example.invalid', 'a'.repeat(65)+'@example.invalid', null]) expect(canonicalMasterEmail(value)).toBeNull();
  });
  it('uses a 32-byte token and SHA256 and includes it only in a fragment', async () => {
    const result = await generateMasterSecret(); expect(result.rawToken).toHaveLength(43); expect(result.digest).toMatch(/^[0-9a-f]{64}$/);
    const link = new URL(masterInvitationLink({ invitation: id, rawToken: result.rawToken }));
    expect(link.origin).toBe('https://www.verticesuperior.com.br'); expect(link.search).toBe('');
    expect(parseMasterFragment(link.hash)).toEqual({ invitation: id, rawToken: result.rawToken });
  });
  it('has no insecure random fallback', async () => { await expect(generateMasterSecret({} as Crypto)).rejects.toThrow(); });
  it('removes malformed, duplicate and mixed credentials from history', () => {
    for (const hash of ['#master_token=bad', `#master_invitation=${id}&master_token=${token}&master_token=${token}`, `#master_invitation=${id}&master_token=${token}&academic_token=${token}`, `#master_invitation=${id}&master_token=${token}&access_token=synthetic`]) {
      const history = { replaceState: vi.fn() };
      expect(consumeMasterFragment({ hash, pathname: '/master', search: '' }, history)).toBeNull();
      expect(history.replaceState).toHaveBeenCalledWith(null, '', '/master');
    }
  });
  it('leaves independent Auth, academic and ordinary navigation fragments untouched', () => {
    for (const hash of ['#access_token=synthetic&type=recovery', '#academic_token=synthetic', '#ies_token=synthetic', '#ies=1', '#masters=1']) {
      const history = { replaceState: vi.fn() };
      expect(consumeMasterFragment({ hash, pathname: '/master', search: '' }, history)).toBeNull();
      expect(history.replaceState).not.toHaveBeenCalled();
    }
  });
  it('rejects mixed IES and Master credentials before bootstrap', () => {
    for (const extra of [`ies_invitation=${id}`, `ies_token=${token}`, `ies_invitation=${id}&ies_token=${token}`]) {
      const history = { replaceState: vi.fn() };
      const hash = `#master_invitation=${id}&master_token=${token}&${extra}`;
      expect(parseMasterFragment(hash)).toBeNull();
      expect(consumeMasterFragment({ hash, pathname: '/master', search: '' }, history)).toBeNull();
      expect(history.replaceState).toHaveBeenCalledWith(null, '', '/master');
    }
  });
  it('makes no RPC or credential generation when disabled', async () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues');
    await expect(listMasters(false)).rejects.toThrow(); await expect(listMasterInvitations(false)).rejects.toThrow();
    await expect(issueMasterInvitation(false, email, context)).rejects.toThrow(); await expect(previewMasterInvitation(false, credential, context)).rejects.toThrow();
    await expect(acceptMasterInvitation(false, credential, context)).rejects.toThrow(); await expect(revokeMasterInvitation(false, id, context)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled(); expect(getRandomValues).not.toHaveBeenCalled();
  });
  it('sends only digest during issuance and requires the matching recipient response', async () => {
    rpcResult.mockResolvedValue({ data: response, error: null });
    const issued = await issueMasterInvitation(true, ' Synthetic@Example.invalid ', context);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0]; expect(name).toBe('vertice_issue_master_invitation'); expect(args.target_email).toBe(email);
    expect(setHeader).toHaveBeenCalledWith('Authorization', 'Bearer synthetic-fixture-only');
    expect(args.token_digest).toMatch(/^[0-9a-f]{64}$/); expect(JSON.stringify(args)).not.toContain(new URL(issued.link).hash.split('master_token=')[1]);
    rpcResult.mockResolvedValue({ data: { ...response, email: 'other@example.invalid' }, error: null });
    await expect(issueMasterInvitation(true, email, context)).rejects.toThrow();
  });
  it('never uses a newly switched account for an action from the old account', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id }, access_token: 'different-synthetic-account' } }, error: null });
    await expect(issueMasterInvitation(true, email, context)).rejects.toThrow();
    await expect(revokeMasterInvitation(true, id, context)).rejects.toThrow();
    await expect(acceptMasterInvitation(true, credential, context)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('cancels before dispatch when account changes while hashing the token', async () => {
    let release!: (value: ArrayBuffer) => void, started!: () => void;
    const digestStarted = new Promise<void>(resolve => { started = resolve; });
    const digest = new Promise<ArrayBuffer>(resolve => { release = resolve; });
    vi.stubGlobal('crypto', { getRandomValues: (array: Uint8Array) => array.fill(7), subtle: { digest: () => { started(); return digest; } } });
    let current = true;
    const request = issueMasterInvitation(true, email, { userId: user, isCurrent: () => current });
    await digestStarted; current = false; release(new Uint8Array(32).buffer);
    await expect(request).rejects.toThrow(); expect(rpc).not.toHaveBeenCalled();
  });
  it('pins the original session token even if shared auth changes before dispatch', async () => {
    let release!: (value: ArrayBuffer) => void, started!: () => void;
    const digestStarted = new Promise<void>(resolve => { started = resolve; });
    const digest = new Promise<ArrayBuffer>(resolve => { release = resolve; });
    vi.stubGlobal('crypto', { getRandomValues: (array: Uint8Array) => array.fill(7), subtle: { digest: () => { started(); return digest; } } });
    rpcResult.mockResolvedValue({ data: response, error: null });
    const request = issueMasterInvitation(true, email, context);
    await digestStarted;
    getSession.mockResolvedValue({ data: { session: { user: { id }, access_token: 'different-synthetic-account' } }, error: null });
    release(new Uint8Array(32).buffer); await request;
    expect(setHeader).toHaveBeenCalledWith('Authorization', 'Bearer synthetic-fixture-only');
    expect(setHeader).not.toHaveBeenCalledWith('Authorization', 'Bearer different-synthetic-account');
  });
  it('does not emit on invalid emails or retry uncertain responses', async () => {
    await expect(issueMasterInvitation(true, 'bad', context)).rejects.toThrow(); expect(rpc).not.toHaveBeenCalled();
    rpcResult.mockRejectedValue(new Error('network')); await expect(issueMasterInvitation(true, email, context)).rejects.toThrow(); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('rejects error/null/malformed response without returning link or internal error', async () => {
    for (const reply of [{ data: null, error: { message: 'sensitive details' } }, { data: {}, error: null }, { data: { ...response, expires_at: null }, error: null }]) {
      rpcResult.mockResolvedValue(reply); await expect(issueMasterInvitation(true, email, context)).rejects.toThrow('Operação de Master');
    }
  });
  it('requires the expected ID and user on explicit acceptance', async () => {
    rpcResult.mockResolvedValue({ data: response, error: null });
    expect(await previewMasterInvitation(true, credential, context)).toEqual({ id, email, expiresAt });
    rpcResult.mockResolvedValue({ data: { id, user_id: id, accepted: true }, error: null });
    await expect(acceptMasterInvitation(true, credential, context)).rejects.toThrow();
    rpcResult.mockResolvedValue({ data: { id, user_id: user, accepted: true }, error: null });
    await expect(acceptMasterInvitation(true, credential, context)).resolves.toBeUndefined();
  });
  it('rejects hash-as-token locally and requires explicit server revocation result', async () => {
    await expect(previewMasterInvitation(true, { invitation: id, rawToken: 'a'.repeat(64) }, context)).rejects.toThrow(); expect(rpc).not.toHaveBeenCalled();
    rpcResult.mockResolvedValue({ data: { id, revoked: false }, error: null }); await expect(revokeMasterInvitation(true, id, context)).rejects.toThrow();
    rpcResult.mockResolvedValue({ data: { id, revoked: true }, error: null }); await expect(revokeMasterInvitation(true, id, context)).resolves.toBeUndefined();
  });
  it('projects minimal directory and invitation metadata, dropping accidental secrets', async () => {
    rpcResult.mockResolvedValue({ data: [{ user_id: user, email, created_at: createdAt, token_hash: 'secret' }], error: null });
    expect(await listMasters(true)).toEqual({ rows: [{ userId: user, email, createdAt }], next: null });
    rpcResult.mockResolvedValue({ data: [{ id, target_email: email, created_at: createdAt, expires_at: expiresAt, revoked_at: null, accepted_at: null, token_hash: 'secret', raw_token: token }], error: null });
    const result = await listMasterInvitations(true); expect(result.rows[0].email).toBe(email); expect(JSON.stringify(result)).not.toContain('secret'); expect(JSON.stringify(result)).not.toContain(token);
  });
  it('distinguishes unavailable lists from confirmed empty lists', async () => {
    rpcResult.mockResolvedValue({ data: [], error: null }); expect((await listMasters(true)).rows).toEqual([]);
    for (const reply of [{ data: null, error: null }, { data: [], error: { code: '42501' } }]) { rpcResult.mockResolvedValue(reply); await expect(listMasters(true)).rejects.toThrow(); await expect(listMasterInvitations(true)).rejects.toThrow(); }
  });
  it('retains precise keyset cursors and rejects duplicates or malformed cursors', async () => {
    const rows = Array.from({ length: 50 }, (_, n) => ({ user_id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, email, created_at: createdAt }));
    rpcResult.mockResolvedValue({ data: rows, error: null });
    const result = await listMasters(true); expect(result.next).toEqual({ createdAt, id: rows[49].user_id });
    rpcResult.mockResolvedValue({ data: [], error: null }); await listMasters(true, result.next);
    expect(rpc.mock.calls.at(-1)?.[1]).toEqual({ page_size: 50, before_created_at: createdAt, before_user_id: rows[49].user_id });
    await expect(listMasters(true, { createdAt: 'bad', id })).rejects.toThrow();
    rpcResult.mockResolvedValue({ data: [rows[0], rows[0]], error: null }); await expect(listMasters(true)).rejects.toThrow();
  });
  it('locks synchronously and invalidates results after dismissal/account change', () => {
    const guard = createMasterRequestGuard(); const first = guard.begin()!;
    expect(guard.begin()).toBeNull(); guard.invalidate(); expect(guard.current(first)).toBe(false);
    const next = guard.begin()!; guard.finish(first); expect(guard.begin()).toBeNull(); guard.finish(next); expect(guard.begin()).not.toBeNull();
  });
  it('renders disabled setup and denies non-Master without data, links or real sends', () => {
    const disabled = renderToStaticMarkup(createElement(MasterInvitations, { userId: user, isMaster: true }));
    expect(disabled).toContain('Funcionalidade em preparação'); expect(disabled).toContain('<fieldset disabled'); expect(disabled).toContain('acesso global');
    const denied = renderToStaticMarkup(createElement(MasterInvitations, { userId: user, isMaster: false, backendReady: true }));
    expect(denied).not.toContain('<form'); expect(denied).not.toContain(email); expect(rpc).not.toHaveBeenCalled();
  });
  it('bootstraps before Auth and retains logout/account-change invalidation', () => {
    for (const file of ['client/src/main.tsx', 'client/src/lib/supabase.ts']) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source.indexOf('ies/preAuthGuard')).toBeLessThan(source.indexOf('master-invitation-bootstrap'));
      expect(source.indexOf('master-invitation-bootstrap')).toBeLessThan(source.indexOf(file.endsWith('supabase.ts') ? 'createClient' : 'createRoot'));
    }
    const host = fs.readFileSync('client/src/components/area/MasterAccess.tsx', 'utf8');
    expect(host).toContain("event === 'SIGNED_OUT'"); expect(host).toContain('lastUser.current !== session.user.id'); expect(host).toContain('generation.current++'); expect(host).toContain('queueMicrotask');
  });
});
