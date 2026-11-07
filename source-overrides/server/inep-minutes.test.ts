import { describe, expect, it, vi } from 'vitest';
import { createMinutesStore, emptyMinutes, minutesSchema, type MinutesRow } from '../client/src/lib/inep-minutes';
const row = (): MinutesRow => ({ id: crypto.randomUUID(), institution_id: crypto.randomUUID(), course_id: crypto.randomUUID(), source_library_id: crypto.randomUUID(), title: 'Ata', body: emptyMinutes(), version: 0, mutation_id: '', created_by: 'actor', updated_by: 'actor', updated_at: '', created_at: '' });
describe('minute drafts validation', () => {
  it('allows incomplete drafts but rejects unknown approval/signature fields', () => {
    expect(minutesSchema.safeParse(emptyMinutes()).success).toBe(true);
    expect(minutesSchema.safeParse({ ...emptyMinutes(), signed: true }).success).toBe(false);
  });
  it('requires evidence for completion, reason/new date for rescheduling and stable unique action IDs', () => {
    const a = { id: crypto.randomUUID(), description: 'Revisar PPC', owner: 'Coordenação', due: '', status: 'concluida', evidence: '', origin: '', reason: '' };
    expect(minutesSchema.safeParse({ ...emptyMinutes(), actions: [a] }).success).toBe(false);
    a.evidence = 'Relatório 03';
    expect(minutesSchema.safeParse({ ...emptyMinutes(), actions: [a] }).success).toBe(true);
    expect(minutesSchema.safeParse({ ...emptyMinutes(), actions: [a, a] }).success).toBe(false);
    a.status = 'reprogramada';
    expect(minutesSchema.safeParse({ ...emptyMinutes(), actions: [a] }).success).toBe(false);
    a.reason = 'Aguardando reunião'; a.due = '2026-12-01';
    expect(minutesSchema.safeParse({ ...emptyMinutes(), actions: [a] }).success).toBe(true);
  });
  it('rejects invalid dates, excess text and more than 100 actions', () => {
    expect(minutesSchema.safeParse({ ...emptyMinutes(), date: '2026-02-30' }).success).toBe(false);
    expect(minutesSchema.safeParse({ ...emptyMinutes(), time: '25:00' }).success).toBe(false);
    expect(minutesSchema.safeParse({ ...emptyMinutes(), agenda: 'x'.repeat(8001) }).success).toBe(false);
    expect(minutesSchema.safeParse({ ...emptyMinutes(), actions: Array.from({ length: 101 }, () => ({ id: crypto.randomUUID(), description: 'Revisar', owner: '', due: '', status: 'pendente', evidence: '', origin: '', reason: '' })) }).success).toBe(false);
  });
});
describe('navigation-safe draft persistence', () => {
  it('suppresses double submits and keeps completion after unsubscribe/navigation', async () => {
    const s = createMinutesStore(); const r = row(); s.open('actor:ies:doc', r);
    let resolve!: (r: MinutesRow) => void;
    const persist = vi.fn(() => new Promise<MinutesRow>(r => { resolve = r; }));
    const unsubscribe = s.subscribe(() => {});
    const p = s.save('actor:ies:doc', persist);
    unsubscribe(); await s.save('actor:ies:doc', persist);
    expect(persist).toHaveBeenCalledTimes(1);
    resolve({ ...r, version: 1 }); await p;
    expect(s.get('actor:ies:doc')?.row.version).toBe(1);
    expect(s.dirty(s.get('actor:ies:doc'))).toBe(false);
  });
  it('retries ambiguous results with identical immutable payload and idempotency key', async () => {
    const s = createMinutesStore(); const r = row(); s.open('a:i:d', r);
    const persist = vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockImplementation(async (r, mutation) => ({ ...r, mutation_id: mutation, version: 1 }));
    await s.save('a:i:d', persist);
    expect(s.get('a:i:d')?.uncertain).toBe(true);
    s.edit('a:i:d', { ...r, title: 'must not replace in-flight payload' });
    await s.save('a:i:d', persist);
    expect(persist.mock.calls[1]).toEqual(persist.mock.calls[0]);
    expect(s.get('a:i:d')?.row.title).toBe('Ata');
  });
  it('preserves text and blocks overwrite after concurrent version conflict', async () => {
    const s = createMinutesStore(); const r = row(); s.open('a:i:d', r);
    await s.save('a:i:d', async () => { throw { code: '40001' }; });
    const retry = vi.fn(); await s.save('a:i:d', retry);
    expect(retry).not.toHaveBeenCalled();
    expect(s.get('a:i:d')?.row).toEqual(r);
    expect(s.get('a:i:d')?.conflict).toBe(true);
  });
  it('isolates actor/institution caches and never restores plaintext after logout', async () => {
    const s = createMinutesStore(); const r = row(); s.open('a:i:d', r);
    expect(s.entries('a:other:')).toEqual([]); expect(s.entries('b:i:')).toEqual([]);
    let resolve!: (r: MinutesRow) => void;
    const p = s.save('a:i:d', () => new Promise<MinutesRow>(r => { resolve = r; }));
    s.clear(); resolve({ ...r, version: 1 }); await p;
    expect(s.entries('')).toEqual([]);
  });
});
