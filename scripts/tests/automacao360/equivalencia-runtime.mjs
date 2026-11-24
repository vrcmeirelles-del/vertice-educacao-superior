// Calcula chaves determinísticas dos módulos da Automação 360° e imprime JSON.
// Executado em Node e em Deno (runtime das Edge Functions) para provar equivalência de SHA-256.
// Node:  node scripts/tests/automacao360/equivalencia-runtime.mjs
// Deno:  deno run --allow-read scripts/tests/automacao360/equivalencia-runtime.mjs
import { evaluate } from '../../../supabase/functions/_shared/automacao360/engine.mjs';
import { documentaryRun } from '../../../supabase/functions/_shared/automacao360/documentary.mjs';
import { academicRun } from '../../../supabase/functions/_shared/automacao360/academic.mjs';
import { strategicRun } from '../../../supabase/functions/_shared/automacao360/strategic.mjs';
import { prepareShadowReceipt } from '../../../supabase/functions/_shared/automacao360/persistence.mjs';
import { transition } from '../../../supabase/functions/_shared/automacao360/governance.mjs';
import { RULES } from '../../../supabase/functions/_shared/automacao360/catalog.mjs';

const I = '00000000-0000-4000-8000-000000000101', C = '00000000-0000-4000-8000-000000000201';
const scope = { institutionId: I, courseId: C }, asOf = '2026-11-24T12:00:00.000Z';
const cfg = (ruleIds) => ({ ...scope, enabled: true, approved: true, ruleIds, maxAgeHours: 24 });

const engine = evaluate({ scope, asOf, config: cfg(['repo.overdue', 'sapiens.low']), snapshot: { ...scope, sourceId: 'eq', observedAt: asOf, records: [
  { ...scope, entityId: 'doc-1', ruleId: 'repo.overdue', revision: 'v1', state: 'open', metrics: { daysToDue: -2 } },
  { ...scope, entityId: 'grp-1', ruleId: 'sapiens.low', revision: 'v1', state: 'validated', metrics: { accuracy: 0.31, graded: 40 } }] } });

const documentary = documentaryRun({ scope, asOf, timeZone: 'America/Sao_Paulo', config: cfg(['repo.overdue', 'repo.due']), source: { ...scope, id: 'repo', observedAt: asOf, complete: true, requests: [
  { ...scope, id: 'r1', revision: 'a', status: 'open', dueDate: '2026-11-20' }, { ...scope, id: 'r2', revision: 'b', status: 'returned', dueDate: '2026-11-27' }] } });

const academic = academicRun({ scope, asOf, timeZone: 'America/Sao_Paulo', config: cfg(['internship.hours', 'tcc.overdue']), source: { ...scope, id: 'acad', observedAt: asOf, complete: true, entries: [
  { ...scope, id: 'e1', revision: 'r1', module: 'internship', status: 'open', observedAt: asOf, requirementApproved: true, requirementVersion: 'ppc1', creditsComplete: true, requiredMinutes: 600, validatedMinutes: 120 },
  { ...scope, id: 'e2', revision: 'r1', module: 'tcc', status: 'open', observedAt: asOf, dueDate: '2026-11-01' }] } });

const strategic = strategicRun({ scope, asOf, config: cfg(['capture.conversion']), source: { ...scope, id: 'str', observedAt: asOf, complete: true, entries: [
  { ...scope, id: 's1', revision: 'r1', module: 'capture', status: 'validated', observedAt: asOf, windowStart: '2026-10-01T00:00:00Z', windowEnd: '2026-11-01T00:00:00Z',
    definitionVersion: 'v1', complete: true, verified: true, reviewId: 'rv1', cohortMature: true, metrics: { eligibleLeads: 50, enrolledLeads: 3 } }] } });

const receipt = prepareShadowReceipt({ scope, runId: '00000000-0000-4000-8000-0000000000e1', asOf,
  config: { ...cfg(['repo.overdue', 'repo.due']), revision: 3 }, result: { mode: 'shadow', status: 'evaluated', sources: [{}], unmapped: [], alerts: documentary.alerts } });

const actor = { ...scope, id: 'gestor', mfa: true, permissions: ['review'] };
const alert = { ...scope, idempotencyKey: documentary.alerts[0].idempotencyKey, ruleId: 'repo.overdue', ruleVersion: RULES[0].version, priority: 'P0', status: 'pending_review' };
const ev = transition({ scope, actor, alert, action: 'approve', expectedRevision: 0, asOf, reason: 'Revisão documentada', ownerId: 'responsavel', dueAt: '2026-12-01T00:00:00.000Z' }).event;

const keys = (r) => r.alerts.map((a) => a.idempotencyKey);
console.log(JSON.stringify({ engine: keys(engine), documentary: keys(documentary), academic: keys(academic), strategic: keys(strategic), receipt: receipt.digest, event: ev.eventId }));
