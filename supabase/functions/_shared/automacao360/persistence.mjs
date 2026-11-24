import {RULES} from './catalog.mjs';
import {createHash} from 'node:crypto';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function prepareShadowReceipt({scope,config,result,runId,asOf}){
 if(!uuid(scope?.institutionId)||!(scope.courseId===null||uuid(scope.courseId))||!uuid(runId)||!Number.isFinite(Date.parse(asOf)))throw Error('invalid_scope');
 if(config?.institutionId!==scope.institutionId||config.courseId!==scope.courseId||config.approved!==true||config.enabled!==true||!Number.isSafeInteger(config.revision)||config.revision<1)throw Error('invalid_config');
 if(result?.mode!=='shadow'||!['evaluated','partial'].includes(result.status)||!Array.isArray(result.alerts)||!Array.isArray(result.sources)||!Array.isArray(result.unmapped)||result.alerts.length>10000)throw Error('invalid_result');
 const seen=new Set();
 const alerts=result.alerts.map(a=>{
  if(a.institutionId!==scope.institutionId||a.courseId!==scope.courseId||a.status!=='pending_review'||a.requiresHumanApproval!==true||!config.ruleIds.includes(a.ruleId)||!RULES.some(r=>r.id===a.ruleId&&r.version===a.ruleVersion&&r.priority===a.priority)||!/^[a-f0-9]{64}$/.test(a.idempotencyKey)||seen.has(a.idempotencyKey))throw Error('invalid_alert');
  seen.add(a.idempotencyKey);return {key:a.idempotencyKey,rule:a.ruleId,version:a.ruleVersion,priority:a.priority};
 }).sort((a,b)=>a.key.localeCompare(b.key));
 // Only allowlisted metadata is retained. No raw response, student identifier or free text.
 const payload={runId,institutionId:scope.institutionId,courseId:scope.courseId,configRevision:config.revision,asOf,status:result.status,alerts,sourceCount:result.sources.length,unmappedCount:result.unmapped.length};
 return {...payload,digest:hash(payload)};
}
// The transport must be server-only and use a dedicated, authorized worker connection.
// This function does not call a production endpoint or schedule work.
export async function persistShadowReceipt(receipt,writer){
 if(typeof writer!=='function')throw Error('writer_unavailable');
 const {digest,...payload}=receipt??{};
 if(digest!==hash(payload))throw Error('receipt_corrupt');
 const ack=await writer(receipt);
 if(ack?.runId!==receipt.runId||ack?.digest!==digest||!['inserted','existing'].includes(ack.status))throw Error('invalid_ack');
 return ack;
}
