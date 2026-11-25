// Executor da Automação 360° (modo sombra). Orquestra o que já existe, sem lógica de regra própria:
// configurações vigentes (RPC) -> adaptadores de fonte (RPC) -> motor (shadowRun / evaluate) -> recibo -> record_run.
// Somente servidor, com credencial service_role injetada em `rpc`. Sem IA, sem chamada externa além do próprio banco.
// Modo operacional não é executado aqui: exige autorização própria e nova versão do executor.
import {randomUUID} from 'node:crypto';
import {shadowRun} from './native-integration.mjs';
import {evaluate} from './engine.mjs';
import {prepareShadowReceipt} from './persistence.mjs';

export const EXECUTOR_VERSION = '2026.11-executor.1';
export const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000360';
const PLANNING = ['pei.overdue', 'cpa.pending'];
const MAX_CONFIGS = 500;
const uuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);

function checkConfig(c) {
  if (!c || !Number.isSafeInteger(c.configId) || !uuid(c.institutionId) || !(c.courseId === null || uuid(c.courseId))
    || !Number.isSafeInteger(c.revision) || c.revision < 1 || !Array.isArray(c.ruleIds)
    || !Number.isFinite(c.maxAgeHours) || typeof c.timeZone !== 'string' || !['shadow', 'operational'].includes(c.mode)) {
    throw Error('invalid_config_row');
  }
}

// Executa uma configuração vigente e grava o recibo. Devolve só metadados.
export async function runConfig({ config: c, rpc, asOf, runId = randomUUID() }) {
  checkConfig(c);
  const scope = { institutionId: c.institutionId, courseId: c.courseId };
  if (c.mode !== 'shadow') return { configId: c.configId, ...scope, status: 'skipped_operational' };
  const config = { ...scope, enabled: true, approved: true, revision: c.revision, ruleIds: [...c.ruleIds], maxAgeHours: c.maxAgeHours };
  const actor = { ...scope, id: SYSTEM_ACTOR_ID, mfa: true, permissions: ['read'] };
  const adapters = {
    documentary: async () => rpc('vertice_automation_source_documentary', { p_institution: scope.institutionId, p_course: scope.courseId }),
  };
  const base = await shadowRun({ scope, actor, config, adapters, asOf, timeZone: c.timeZone });
  const alerts = [...base.alerts], sources = [...base.sources];
  let unmapped = base.unmapped.filter((id) => !PLANNING.includes(id));
  const planningIds = config.ruleIds.filter((id) => PLANNING.includes(id));
  if (planningIds.length) {
    try {
      const src = await rpc('vertice_automation_source_planning', { p_institution: scope.institutionId, p_course: scope.courseId });
      if (src?.institutionId !== scope.institutionId || (src.courseId ?? null) !== scope.courseId || src.complete !== true) throw Error('invalid_source');
      const out = evaluate({ scope, config: { ...config, ruleIds: planningIds }, asOf,
        snapshot: { ...scope, sourceId: src.sourceId, observedAt: src.observedAt, records: src.records } });
      sources.push({ family: 'planning', status: out.status });
      if (out.status === 'evaluated') alerts.push(...out.alerts);
    } catch {
      sources.push({ family: 'planning', status: 'source_rejected' });
    }
  }
  const status = unmapped.length || sources.some((s) => s.status !== 'evaluated' || s.issueCount || s.skippedCount) ? 'partial' : 'evaluated';
  const result = { mode: 'shadow', status, alerts, sources, unmapped };
  const receipt = prepareShadowReceipt({ scope, config, result, runId, asOf });
  const ack = await rpc('vertice_automation_record_run', { p_payload: receipt });
  if (ack?.runId !== receipt.runId || ack?.digest !== receipt.digest || !['inserted', 'existing'].includes(ack.status)) throw Error('invalid_ack');
  return {
    configId: c.configId, ...scope, status, runId: receipt.runId, alerts: receipt.alerts.length,
    sources: sources.map((s) => `${s.family}:${s.status}`), unmapped: unmapped.length, ack: ack.status,
  };
}

// Executa todas as configurações vigentes, uma a uma. Falha de uma não interrompe as demais.
export async function runAll({ rpc, asOf = new Date().toISOString() }) {
  const configs = await rpc('vertice_automation_due_configs', {});
  if (!Array.isArray(configs) || configs.length > MAX_CONFIGS) throw Error('invalid_config_list');
  const results = [];
  for (const c of configs) {
    try {
      results.push(await runConfig({ config: c, rpc, asOf }));
    } catch (e) {
      const code = /^[a-z_:0-9.]{1,80}$/.test(e?.message ?? '') ? e.message : 'run_failed';
      results.push({ configId: c?.configId ?? null, institutionId: c?.institutionId ?? null, courseId: c?.courseId ?? null, status: 'failed', error: code });
    }
  }
  return { version: EXECUTOR_VERSION, asOf, configs: configs.length, results };
}
