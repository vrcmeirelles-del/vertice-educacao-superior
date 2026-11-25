// Executor da Automação 360° (modos sombra e operacional). Orquestra o que já existe, sem lógica de regra própria:
// configurações vigentes (RPC) -> adaptadores de fonte (RPC) -> motor (shadowRun / evaluate) -> recibo -> record_run.
// Somente servidor, com credencial service_role injetada em `rpc`. Sem IA, sem chamada externa além do próprio banco.
// Modo operacional: mesmo cálculo; o banco só abre alerta para regra com fonte homologada e só dá baixa
// (alerta ainda sem decisão humana) nas regras declaradas avaliadas com fonte completa e limpa.
import {randomUUID} from 'node:crypto';
import {shadowRun} from './native-integration.mjs';
import {evaluate} from './engine.mjs';
import {prepareShadowReceipt} from './persistence.mjs';
import {RULES} from './catalog.mjs';

export const EXECUTOR_VERSION = '2026.11-executor.7';
export const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000360';
const PLANNING = ['pei.overdue', 'cpa.pending', 'goal.unmeasured'];
const byModuleIds = (mods) => RULES.filter((r) => mods.includes(r.module)).map((r) => r.id);
// Regras com adaptador de fonte real. As demais ficam "sem adaptador" (execução parcial), nunca silenciosas.
export const SUPPORTED = Object.freeze(['repo.overdue', 'repo.due', ...PLANNING, 'tcc.due', 'tcc.overdue',
  'internship.due', 'internship.overdue', 'teaching.documents', 'alumni.pending', 'competition.change',
  'curriculum.gap', 'avalia.recovery', 'retention.alert', ...byModuleIds(['Instrumentos de Avaliação'])]);
const MAX_CONFIGS = 500;
// Mesma partição de famílias de native-integration.mjs, para ler cada fonte uma vez antes da execução.
const byModule = (mods) => RULES.filter((r) => mods.includes(r.module)).map((r) => r.id);
const FAMILY_RULES = {
  documentary: ['repo.overdue', 'repo.due'],
  pedagogical: ['sapiens.low', 'curriculum.gap', 'avalia.recovery', 'enade.gap', 'enamed.gap', 'retention.alert'],
  academic: byModule(['Estágio 360°', 'TCC 360°', 'Extensão 360°', 'Atividades de Ensino', 'AC 360°']),
  strategic: byModule(['Captação', 'Inteligência de Mercado', 'Due Diligence', 'Financeiro', 'Conecta 360°']),
  instrumental: byModule(['Instrumentos de Avaliação']),
};
const SOURCE_RPC = { documentary: 'vertice_automation_source_documentary', academic: 'vertice_automation_source_academic',
  strategic: 'vertice_automation_source_strategic', pedagogical: 'vertice_automation_source_pedagogical', planning: 'vertice_automation_source_planning', instrumental: 'vertice_automation_source_instrumental' };
const later = (a, b) => (Date.parse(a) >= Date.parse(b) ? a : b);
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
  const config = { ...scope, enabled: true, approved: true, revision: c.revision, ruleIds: [...c.ruleIds], maxAgeHours: c.maxAgeHours };
  const actor = { ...scope, id: SYSTEM_ACTOR_ID, mfa: true, permissions: ['read'] };
  const args = { p_institution: scope.institutionId, p_course: scope.courseId };
  const unsupported = config.ruleIds.filter((id) => !SUPPORTED.includes(id));
  const shadowIds = config.ruleIds.filter((id) => SUPPORTED.includes(id) && !PLANNING.includes(id));
  const planningIds = config.ruleIds.filter((id) => PLANNING.includes(id));
  // Lê as fontes primeiro e só então fixa o instante da execução: a fonte registra a própria leitura
  // (truncada ao segundo) e o motor recusa observação posterior ao instante avaliado.
  const needed = Object.keys(FAMILY_RULES).filter((f) => shadowIds.some((id) => FAMILY_RULES[f].includes(id))
    && !((f === 'academic' || f === 'pedagogical') && scope.courseId === null));
  if (planningIds.length) needed.push('planning');
  const fetched = {};
  for (const family of needed) {
    try { fetched[family] = { ok: true, value: await rpc(SOURCE_RPC[family], args) }; } catch { fetched[family] = { ok: false }; }
  }
  const runAsOf = asOf ? later(asOf, new Date().toISOString()) : new Date().toISOString();
  const adapters = Object.fromEntries(Object.keys(FAMILY_RULES).filter((f) => fetched[f]).map((f) => [f, async () => {
    if (!fetched[f].ok) throw Error('source_unavailable');
    return fetched[f].value;
  }]));
  const base = shadowIds.length
    ? await shadowRun({ scope, actor, config: { ...config, ruleIds: shadowIds }, adapters, asOf: runAsOf, timeZone: c.timeZone })
    : { alerts: [], sources: [], unmapped: [] };
  const alerts = [...base.alerts], sources = [...base.sources];
  const unmapped = [...unsupported];
  // Regras cuja ausência de alerta é confiável: família avaliada sem registro recusado ou pulado.
  const clean = new Set(base.sources.filter((s) => s.status === 'evaluated' && !s.issueCount && !s.skippedCount).map((s) => s.family));
  const evaluatedRules = shadowIds.filter((id) => !(base.unmapped ?? []).includes(id) && Object.entries(FAMILY_RULES).some(([f, ids]) => clean.has(f) && ids.includes(id)));
  if (planningIds.length) {
    try {
      if (!fetched.planning.ok) throw Error('source_unavailable');
      const src = fetched.planning.value;
      if (src?.institutionId !== scope.institutionId || (src.courseId ?? null) !== scope.courseId || src.complete !== true) throw Error('invalid_source');
      const out = evaluate({ scope, config: { ...config, ruleIds: planningIds }, asOf: runAsOf,
        snapshot: { ...scope, sourceId: src.sourceId, observedAt: src.observedAt, records: src.records } });
      sources.push({ family: 'planning', status: out.status });
      if (out.status === 'evaluated') alerts.push(...out.alerts);
      if (out.status === 'evaluated' && !(out.skipped ?? []).length) evaluatedRules.push(...planningIds);
    } catch {
      sources.push({ family: 'planning', status: 'source_rejected' });
    }
  }
  const status = unmapped.length || sources.some((s) => s.status !== 'evaluated' || s.issueCount || s.skippedCount) ? 'partial' : 'evaluated';
  const result = { mode: 'shadow', status, alerts, sources, unmapped, ...(c.mode === 'operational' ? { evaluatedRules } : {}) };
  const receipt = prepareShadowReceipt({ scope, config, result, runId, asOf: runAsOf });
  const ack = await rpc('vertice_automation_record_run', { p_payload: receipt });
  if (ack?.runId !== receipt.runId || ack?.digest !== receipt.digest || !['inserted', 'existing'].includes(ack.status)) throw Error('invalid_ack');
  return {
    configId: c.configId, ...scope, mode: c.mode, status, runId: receipt.runId, alerts: receipt.alerts.length,
    sources: sources.map((s) => `${s.family}:${s.status}`), unmapped: unmapped.length, ack: ack.status,
    ...(c.mode === 'operational' ? { resolved: ack.resolved ?? 0, sourceCleared: ack.sourceCleared ?? 0 } : {}),
  };
}

// Executa todas as configurações vigentes, uma a uma. Falha de uma não interrompe as demais.
export async function runAll({ rpc, asOf = undefined }) {
  const startedAt = new Date().toISOString();
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
  return { version: EXECUTOR_VERSION, startedAt, configs: configs.length, results };
}
