import test from 'node:test';
import assert from 'node:assert/strict';
import { documentaryRun, evidenceChecklist } from '../../../supabase/functions/_shared/automacao360/documentary.mjs';

const scope = { institutionId: 'ies-a', courseId: 'direito' };
const asOf = '2026-11-24T15:00:00Z';
const tz = 'America/Sao_Paulo';
const req = (over = {}) => ({ ...scope, id: 'req-1', revision: 'r1', status: 'open', dueDate: '2026-11-20', ...over });
const run = ({ requests = [req()], config = {}, source = {}, at = asOf, timeZone = tz } = {}) => documentaryRun({
  scope, asOf: at, timeZone,
  config: { ...scope, enabled: true, approved: true, ruleIds: ['repo.overdue', 'repo.due'], maxAgeHours: 24, ...config },
  source: { ...scope, id: 'repo-snapshot', observedAt: at, complete: true, requests, ...source },
});
const rules = r => r.alerts.map(a => a.ruleId).sort();

test('overdue review only', () => {
  const r = run();
  assert.deepEqual(rules(r), ['repo.overdue']);
  assert.equal(r.alerts[0].status, 'pending_review');
  assert.equal(r.alerts[0].requiresHumanApproval, true);
  assert.equal(r.alerts[0].evidence.value, -4);
  assert.equal(r.deadlineSummary.overdue, 1);
});

test('local calendar day not UTC', () => {
  // 01:30 UTC de 25/11 ainda é 24/11 em São Paulo: prazo 24/11 vence hoje, não está vencido.
  const at = '2026-11-25T01:30:00Z';
  const local = run({ at, requests: [req({ dueDate: '2026-11-24' })] });
  assert.deepEqual(rules(local), ['repo.due']);
  assert.equal(local.alerts[0].evidence.value, 0);
  const utc = run({ at, timeZone: 'UTC', requests: [req({ dueDate: '2026-11-24' })] });
  assert.deepEqual(rules(utc), ['repo.overdue']);
});

test('7 day boundary', () => {
  assert.deepEqual(rules(run({ requests: [req({ dueDate: '2026-12-01' })] })), ['repo.due']);
  const r = run({ requests: [req({ dueDate: '2026-12-02' })] });
  assert.equal(r.alerts.length, 0);
  assert.equal(r.deadlineSummary.later, 1);
});

test('no deadline not overdue', () => {
  const r = run({ requests: [req({ dueDate: null })] });
  assert.equal(r.alerts.length, 0);
  assert.deepEqual(r.issues, [{ requestId: 'req-1', issue: 'no_due_date' }]);
  assert.equal(r.deadlineSummary.noDeadline, 1);
  assert.equal(r.deadlineSummary.overdue, 0);
});

test('invalid calendar date', () => {
  assert.throws(() => run({ requests: [req({ dueDate: '2026-02-30' })] }), /invalid_due_date/);
  assert.throws(() => run({ requests: [req({ dueDate: '24/11/2026' })] }), /invalid_due_date/);
  assert.throws(() => run({ timeZone: 'Marte/Base' }), /invalid_time_zone/);
});

for (const status of ['validated', 'cancelled', 'submitted']) {
  test(`excluded ${status}`, () => {
    const r = run({ requests: [req({ status })] });
    assert.equal(r.alerts.length, 0);
    assert.equal(r.deadlineSummary.excluded, 1);
    assert.equal(r.deadlineSummary.pending, 0);
  });
}

test('returned is pending', () => {
  const r = run({ requests: [req({ status: 'returned' })] });
  assert.deepEqual(rules(r), ['repo.overdue']);
  assert.equal(r.deadlineSummary.pending, 1);
});

test('scope isolation', () => {
  assert.throws(() => run({ requests: [req({ courseId: 'medicina' })] }), /scope/);
  assert.throws(() => run({ source: { institutionId: 'ies-b' } }), /scope/);
  assert.throws(() => run({ config: { courseId: null } }), /scope/);
});

test('incomplete source rejected', () => {
  assert.throws(() => run({ source: { complete: false } }), /incomplete_source/);
  assert.throws(() => run({ source: { complete: 'true' } }), /incomplete_source/);
});

test('duplicate rejected', () => {
  assert.throws(() => run({ requests: [req(), req({ revision: 'r2' })] }), /duplicate/);
});

test('stale source', () => {
  const r = run({ source: { observedAt: '2026-11-22T15:00:00Z' } });
  assert.equal(r.status, 'stale_source');
  assert.equal(r.alerts.length, 0);
  assert.equal(r.deadlineSummary, null);
});

test('stable key over days in same band', () => {
  const a = run({ at: '2026-11-24T15:00:00Z' }).alerts[0];
  const b = run({ at: '2026-11-26T15:00:00Z' }).alerts[0];
  assert.equal(a.idempotencyKey, b.idempotencyKey);
});

test('new band creates new key', () => {
  const due = run({ at: '2026-11-24T15:00:00Z', requests: [req({ dueDate: '2026-11-25' })] }).alerts[0];
  const overdue = run({ at: '2026-11-26T15:00:00Z', requests: [req({ dueDate: '2026-11-25' })] }).alerts[0];
  assert.equal(due.ruleId, 'repo.due');
  assert.equal(overdue.ruleId, 'repo.overdue');
  assert.notEqual(due.idempotencyKey, overdue.idempotencyKey);
  // Reabertura (nova revisão do pedido) também gera nova chave na mesma faixa.
  assert.notEqual(run().alerts[0].idempotencyKey, run({ requests: [req({ revision: 'r2' })] }).alerts[0].idempotencyKey);
});

test('disabled', () => {
  const r = run({ config: { enabled: false } });
  assert.equal(r.status, 'disabled');
  assert.equal(r.alerts.length, 0);
  assert.equal(run({ config: { approved: false } }).status, 'disabled');
  assert.throws(() => run({ config: { ruleIds: ['sapiens.low'] } }), /non_documentary_rule/);
});

const checklist = (evidence, requirements = [{ ...scope, id: 'reqm-1' }]) => evidenceChecklist({ scope, requirements, evidence });
const ev = (over = {}) => ({ ...scope, id: 'ev-1', requirementId: 'reqm-1', status: 'uploaded', reviewId: null, ...over });

test('no evidence not noncompliance', () => {
  const r = checklist([]);
  assert.equal(r.items[0].status, 'no_linked_evidence');
  assert.equal(r.items[0].conclusive, false);
  assert.equal(r.nonComplianceAssessed, false);
  assert.ok(!JSON.stringify(r).includes('noncompliant'));
});

test('uploaded not validated', () => {
  const r = checklist([ev()]);
  assert.equal(r.items[0].status, 'pending_review');
  assert.equal(r.items[0].conclusive, false);
});

test('validated requires review id', () => {
  const missing = checklist([ev({ status: 'validated' })]);
  assert.equal(missing.items[0].status, 'pending_review');
  assert.deepEqual(missing.issues, [{ evidenceId: 'ev-1', issue: 'validated_without_review_id' }]);
  const ok = checklist([ev({ status: 'validated', reviewId: 'parecer-9' })]);
  assert.equal(ok.items[0].status, 'validated_evidence');
  assert.equal(ok.items[0].conclusive, true);
});

test('cross course evidence rejected', () => {
  assert.throws(() => checklist([ev({ courseId: 'medicina' })]), /scope/);
  assert.throws(() => checklist([], [{ ...scope, courseId: null, id: 'reqm-1' }]), /scope/);
  assert.throws(() => checklist([ev({ requirementId: 'outro' })]), /unknown_requirement/);
});
