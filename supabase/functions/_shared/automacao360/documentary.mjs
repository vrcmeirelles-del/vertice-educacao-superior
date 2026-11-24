// Bloco 02: adaptação documental da Automação 360°.
// Implementação própria a partir do contrato em docs/automacao360/INTEGRACAO.md.
// Pura: sem banco, rede, IA, agendamento ou envio. Executar só no servidor, com dados
// obtidos por leitura autorizada. `complete:true` e `reviewId` são atestados pelo servidor;
// estas funções apenas conferem forma, escopo e estado normalizado.
import { evaluate } from './engine.mjs';

export const DOCUMENTARY_VERSION = '2026.11-documentary.1';
export const DOCUMENTARY_RULES = Object.freeze(['repo.overdue', 'repo.due']);
export const REQUEST_STATUSES = Object.freeze(['open', 'returned', 'submitted', 'validated', 'cancelled']);
// Pendente para o responsável: aberto ou devolvido para correção.
const PENDING = new Set(['open', 'returned']);
export const EVIDENCE_STATUSES = Object.freeze(['uploaded', 'under_review', 'validated', 'rejected']);

const id = v => typeof v === 'string' && /^[a-zA-Z0-9:._-]{1,150}$/.test(v);
const sameScope = (a, b) => a.institutionId === b.institutionId && a.courseId === b.courseId;
const validScope = s => s && id(s.institutionId) && (s.courseId === null || id(s.courseId));
const isoInstant = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v));

// YYYY-MM-DD de calendário real (rejeita 2026-02-30). Retorna dias desde a época ou null.
function calendarDay(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return t / 86400000;
}

// Dia de calendário local de um instante UTC no fuso configurado da IES.
function localDay(asOf, timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(asOf));
  } catch { throw Error('invalid_time_zone'); }
  const get = t => parts.find(p => p.type === t)?.value;
  return calendarDay(`${get('year')}-${get('month')}-${get('day')}`);
}

// Faixa de prazo. A revisão enviada ao motor combina a revisão do pedido com a faixa:
// a chave de idempotência fica estável enquanto o pedido permanece na mesma faixa e muda
// quando ele entra em outra (ex.: de "vence em 7 dias" para "vencido").
const band = days => days === null ? 'none' : days < 0 ? 'overdue' : days <= 7 ? 'due' : 'later';

export function documentaryRun({ scope, config, source, asOf, timeZone } = {}) {
  if (!validScope(scope) || !isoInstant(asOf)) throw Error('invalid_scope_or_clock');
  if (typeof timeZone !== 'string' || !timeZone) throw Error('invalid_time_zone');
  if (!config || !sameScope(scope, config)) throw Error('configuration_scope_mismatch');
  if (config.enabled !== true || config.approved !== true) return { status: 'disabled', alerts: [], skipped: [], issues: [], deadlineSummary: null };
  if (!Array.isArray(config.ruleIds) || config.ruleIds.some(r => !DOCUMENTARY_RULES.includes(r))) throw Error('non_documentary_rule');
  if (!source || !sameScope(scope, source)) throw Error('snapshot_scope_mismatch');
  if (!id(source.id) || !isoInstant(source.observedAt)) throw Error('invalid_source');
  if (source.complete !== true) throw Error('incomplete_source');
  if (!Array.isArray(source.requests)) throw Error('invalid_batch');
  if (source.requests.length * Math.max(config.ruleIds.length, 1) > 10000) throw Error('batch_limit_exceeded');

  const today = localDay(asOf, timeZone);
  const seen = new Set(), records = [], issues = [];
  const deadlineSummary = { pending: 0, overdue: 0, dueWithin7Days: 0, later: 0, noDeadline: 0, excluded: 0 };

  for (const req of source.requests) {
    if (!req || !sameScope(scope, req) || !id(req.id) || !id(req.revision)) throw Error('invalid_record_scope_or_identity');
    if (seen.has(req.id)) throw Error('duplicate_record');
    seen.add(req.id);
    if (!REQUEST_STATUSES.includes(req.status)) throw Error('invalid_status');
    const due = req.dueDate === null ? null : calendarDay(req.dueDate);
    if (req.dueDate !== null && due === null) throw Error('invalid_due_date');

    if (!PENDING.has(req.status)) { deadlineSummary.excluded++; continue; }
    deadlineSummary.pending++;
    const days = due === null ? null : due - today;
    const b = band(days);
    if (b === 'none') { deadlineSummary.noDeadline++; issues.push({ requestId: req.id, issue: 'no_due_date' }); }
    else if (b === 'overdue') deadlineSummary.overdue++;
    else if (b === 'due') deadlineSummary.dueWithin7Days++;
    else deadlineSummary.later++;

    const revision = `${req.revision}.${b}`;
    if (!id(revision)) throw Error('invalid_record_scope_or_identity');
    for (const ruleId of config.ruleIds) {
      records.push({ institutionId: scope.institutionId, courseId: scope.courseId, entityId: req.id, revision, ruleId, state: 'open', metrics: { daysToDue: days } });
    }
  }

  const result = evaluate({
    scope, asOf, config,
    snapshot: { institutionId: scope.institutionId, courseId: scope.courseId, sourceId: source.id, observedAt: source.observedAt, records },
  });
  // Sem prazo não é atraso: o motor abstém por métrica ausente; o motivo já consta em issues.
  return { ...result, issues, deadlineSummary: result.status === 'evaluated' ? deadlineSummary : null, adapterVersion: DOCUMENTARY_VERSION };
}

// Situação de cada requisito regulatório quanto às evidências vinculadas.
// Nunca conclui não conformidade: ausência de vínculo é falta de informação.
export function evidenceChecklist({ scope, requirements, evidence } = {}) {
  if (!validScope(scope)) throw Error('invalid_scope');
  if (!Array.isArray(requirements) || !Array.isArray(evidence)) throw Error('invalid_batch');
  if (requirements.length > 10000 || evidence.length > 10000) throw Error('batch_limit_exceeded');
  const reqs = new Map();
  for (const r of requirements) {
    if (!r || !sameScope(scope, r) || !id(r.id)) throw Error('requirement_scope_or_identity');
    if (reqs.has(r.id)) throw Error('duplicate_requirement');
    reqs.set(r.id, []);
  }
  const issues = [], seen = new Set();
  for (const e of evidence) {
    if (!e || !sameScope(scope, e) || !id(e.id) || !id(e.requirementId)) throw Error('evidence_scope_or_identity');
    if (seen.has(e.id)) throw Error('duplicate_evidence');
    seen.add(e.id);
    if (!reqs.has(e.requirementId)) throw Error('unknown_requirement');
    if (!EVIDENCE_STATUSES.includes(e.status)) throw Error('invalid_status');
    let status = e.status;
    // "validated" só vale com identificador de parecer; sem ele, volta para análise.
    if (status === 'validated' && !id(e.reviewId)) { status = 'under_review'; issues.push({ evidenceId: e.id, issue: 'validated_without_review_id' }); }
    reqs.get(e.requirementId).push({ id: e.id, status });
  }
  const items = [...reqs].map(([requirementId, list]) => {
    const status = !list.length ? 'no_linked_evidence'
      : list.some(x => x.status === 'validated') ? 'validated_evidence'
      : list.some(x => x.status === 'uploaded' || x.status === 'under_review') ? 'pending_review'
      : 'rejected_only';
    return { requirementId, status, conclusive: status === 'validated_evidence', evidenceIds: list.map(x => x.id).sort() };
  });
  const summary = Object.fromEntries(['validated_evidence', 'pending_review', 'rejected_only', 'no_linked_evidence'].map(k => [k, items.filter(i => i.status === k).length]));
  return { items, summary, issues, nonComplianceAssessed: false, adapterVersion: DOCUMENTARY_VERSION };
}
