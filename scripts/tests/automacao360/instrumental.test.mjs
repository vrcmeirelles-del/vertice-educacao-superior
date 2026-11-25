// Família "instrumental" (instrumentos de avaliação): validação da fonte e avaliação pelo motor real.
import test from 'node:test';
import assert from 'node:assert/strict';
import {instrumentalRun, SPECS} from '../../../supabase/functions/_shared/automacao360/instrumental.mjs';
import {shadowRun, UNMAPPED} from '../../../supabase/functions/_shared/automacao360/native-integration.mjs';
import {RULES} from '../../../supabase/functions/_shared/automacao360/catalog.mjs';

const course = {institutionId: '11111111-1111-4111-8111-111111111111', courseId: '22222222-2222-4222-8222-222222222222'};
const ies = {...course, courseId: null};
const asOf = '2026-11-25T12:00:00Z', observedAt = '2026-11-25T11:00:00Z';
const ALL = Object.values(SPECS).map(([r]) => r);
const cfg = (scope, ruleIds = ALL) => ({...scope, enabled: true, approved: true, revision: 1, ruleIds, maxAgeHours: 24});
const entry = (scope, module, value, extra = {}) => ({...scope, module, id: module + ':x', revision: 'r1', observedAt, complete: true, status: SPECS[module][2],
  definitionVersion: 'v1', catalogCode: 'reconhecimento_curso', catalogVersion: '2017', metrics: {[SPECS[module][1]]: value}, ...extra});
const src = (scope, entries) => ({...scope, id: 'instrumental-v1', observedAt, complete: true, entries});

test('as seis regras de instrumento estão no catálogo, com adaptador e sem IA', () => {
  const ids = RULES.filter((r) => r.module === 'Instrumentos de Avaliação').map((r) => r.id).sort();
  assert.deepEqual(ids, [...ALL].sort());
  assert.ok(ids.every((x) => !UNMAPPED.includes(x)));
});

test('contagem acima de zero vira alerta pendente de revisão humana; zero não', () => {
  const entries = [entry(course, 'evidence', 12), entry(course, 'stalled', 0), entry(course, 'uncovered', 3), entry(course, 'unbacked', 2),
    entry(course, 'unassigned', 0), {...course, module: 'milestone', id: 'milestone:x', revision: 'n', applicable: false}];
  const r = instrumentalRun({scope: course, config: cfg(course), source: src(course, entries), asOf});
  assert.equal(r.status, 'evaluated');
  assert.deepEqual(r.alerts.map((a) => a.ruleId).sort(), ['instrument.evidence', 'instrument.unbacked', 'instrument.uncovered']);
  assert.ok(r.alerts.every((a) => a.status === 'pending_review' && a.requiresHumanApproval === true));
  assert.deepEqual(r.issues, []);
});

test('sem catálogo no banco a regra se abstém: pendência, nunca zero', () => {
  const missing = {...course, module: 'evidence', id: 'evidence:x', revision: 'sem-catalogo', complete: false, reason: 'catalog_missing'};
  const r = instrumentalRun({scope: course, config: cfg(course, ['instrument.evidence']), source: src(course, [missing]), asOf});
  assert.deepEqual(r.alerts, []);
  assert.deepEqual(r.issues, [{entityId: 'evidence:x', ruleId: 'instrument.evidence', reason: 'catalog_missing'}]);
  const noCatalogCode = entry(course, 'evidence', 5, {catalogCode: undefined});
  assert.equal(instrumentalRun({scope: course, config: cfg(course, ['instrument.evidence']), source: src(course, [noCatalogCode]), asOf}).issues[0].reason, 'catalog_required');
});

test('contagem inválida, estado errado e evidência futura viram pendência', () => {
  for (const [e, reason] of [[entry(course, 'stalled', -1), 'invalid_count'], [entry(course, 'stalled', 1.5), 'invalid_count'],
    [entry(course, 'unbacked', 2, {status: 'open'}), 'state_not_eligible'], [entry(course, 'stalled', 1, {observedAt: '2026-11-25T11:30:00Z'}), 'invalid_or_stale_evidence']]) {
    const r = instrumentalRun({scope: course, config: cfg(course), source: src(course, [e]), asOf});
    assert.deepEqual(r.alerts, []);
    assert.equal(r.issues[0].reason, reason);
  }
});

test('escopo, duplicidade, regra alheia e fonte velha são recusados', () => {
  assert.throws(() => instrumentalRun({scope: course, config: cfg(course), source: src(course, [entry(ies, 'stalled', 1)]), asOf}), /invalid_entry/);
  assert.throws(() => instrumentalRun({scope: course, config: cfg(course), source: src(course, [entry(course, 'stalled', 1), entry(course, 'stalled', 2)]), asOf}), /duplicate_entry/);
  assert.throws(() => instrumentalRun({scope: course, config: cfg(course, ['repo.due']), source: src(course, []), asOf}), /invalid_instrumental_config/);
  assert.throws(() => instrumentalRun({scope: course, config: cfg(course), source: src(ies, []), asOf}), /invalid_source/);
  const old = {...src(course, [entry(course, 'stalled', 4)]), observedAt: '2026-11-23T11:00:00Z'};
  assert.equal(instrumentalRun({scope: course, config: cfg(course), source: old, asOf}).status, 'stale_source');
});

test('revisão estável: mesma fonte gera a mesma chave; mudança de dado gera chave nova', () => {
  const run = (rev) => instrumentalRun({scope: ies, config: cfg(ies, ['instrument.milestone']), source: src(ies, [entry(ies, 'milestone', 2, {revision: rev})]), asOf}).alerts[0].idempotencyKey;
  assert.equal(run('a'), run('a'));
  assert.notEqual(run('a'), run('b'));
});

test('integra ao modo sombra no escopo da IES, sem exigir curso', async () => {
  const actor = {...ies, id: '33333333-3333-4333-8333-333333333333', mfa: true, permissions: ['read']};
  const out = await shadowRun({scope: ies, actor, config: cfg(ies, ['instrument.milestone', 'instrument.unassigned']), asOf, timeZone: 'America/Araguaina',
    adapters: {instrumental: async () => src(ies, [entry(ies, 'milestone', 1), entry(ies, 'unassigned', 4)])}});
  assert.equal(out.mode, 'shadow');
  assert.deepEqual(out.sources, [{family: 'instrumental', status: 'evaluated', issueCount: 0, skippedCount: 0}]);
  assert.deepEqual(out.alerts.map((a) => a.ruleId).sort(), ['instrument.milestone', 'instrument.unassigned']);
});
