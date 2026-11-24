import { createHash } from 'node:crypto';
import { RULES } from './catalog.mjs';
const hash = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const finite = v => typeof v === 'number' && Number.isFinite(v);
const id = v => typeof v === 'string' && /^[a-zA-Z0-9:._-]{1,150}$/.test(v);
const sameScope = (a,b) => a.institutionId === b.institutionId && a.courseId === b.courseId;
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v));
const match = (x,r) => r.op==='lt'?x<r.threshold:r.op==='gt'?x>r.threshold:x>=r.threshold[0]&&x<=r.threshold[1];
const domain = (k,x) => finite(x) && (k==='accuracy'?x>=0&&x<=1:k==='daysToDue'?Number.isSafeInteger(x):Number.isSafeInteger(x)&&x>=0);
// Pure evaluation. No DB, network, credentials, AI, scheduling or delivery.
// Inputs must come from trusted server adapters, not browser payloads.
export function evaluate({scope, config, snapshot, asOf}) {
 if (!scope || !id(scope.institutionId) || !(scope.courseId===null||id(scope.courseId)) || !date(asOf)) throw Error('invalid_scope_or_clock');
 if (!config || !sameScope(scope,config)) throw Error('configuration_scope_mismatch');
 if (config.enabled!==true || config.approved!==true) return {status:'disabled', alerts:[], skipped:[]};
 if (!snapshot || !sameScope(scope,snapshot)) throw Error('snapshot_scope_mismatch');
 if (!id(snapshot.sourceId)||!date(snapshot.observedAt)||Date.parse(snapshot.observedAt)>Date.parse(asOf)) throw Error('invalid_source');
 if (!Array.isArray(snapshot.records)||snapshot.records.length>10000) throw Error('invalid_batch');
 if (!Array.isArray(config.ruleIds)||!finite(config.maxAgeHours)||config.maxAgeHours<=0||config.maxAgeHours>720) throw Error('invalid_config');
 if(config.ruleIds.some(x=>!RULES.some(r=>r.id===x))) throw Error('unknown_rule');
 if(Date.parse(asOf)-Date.parse(snapshot.observedAt)>config.maxAgeHours*3600000) return {status:'stale_source',alerts:[],skipped:[]};
 const alerts=[],skipped=[],seen=new Set();
 for (const rec of snapshot.records) {
  if(!rec||!sameScope(scope,rec)||!id(rec.entityId)||!id(rec.ruleId)||!id(rec.revision)) throw Error('invalid_record_scope_or_identity');
  const key=JSON.stringify([rec.ruleId,rec.entityId]); if(seen.has(key)) throw Error('duplicate_record'); seen.add(key);
  if(!config.ruleIds.includes(rec.ruleId)) continue;
  const r=RULES.find(x=>x.id===rec.ruleId);
  const x=rec.metrics?.[r.metric];
  const reason=rec.state!==r.state?'state_not_eligible':!domain(r.metric,x)?'missing_or_invalid_metric':r.minMetric&&(!domain(r.minMetric,rec.metrics?.[r.minMetric])||rec.metrics[r.minMetric]<r.min)?'insufficient_sample':null;
  if(reason){skipped.push({ruleId:r.id,entityId:rec.entityId,reason});continue;}
  if(!match(x,r))continue;
  alerts.push({idempotencyKey:hash([scope.institutionId,scope.courseId,r.id,r.version,rec.entityId,rec.revision]),institutionId:scope.institutionId,courseId:scope.courseId,ruleId:r.id,ruleVersion:r.version,entityId:rec.entityId,priority:r.priority,status:'pending_review',requiresHumanApproval:true,evidence:{sourceId:snapshot.sourceId,observedAt:snapshot.observedAt,revision:rec.revision,metric:r.metric,value:x,operator:r.op,threshold:r.threshold,...(r.minMetric?{sample:rec.metrics[r.minMetric],minimum:r.min}:{})}});
 }
 return {status:'evaluated',alerts,skipped};
}
