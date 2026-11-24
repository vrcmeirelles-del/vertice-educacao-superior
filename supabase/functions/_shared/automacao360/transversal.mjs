import {createHash} from 'node:crypto';
import {RULES} from './catalog.mjs';
import {planningProposal,effectiveness} from './governance.mjs';
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:._-]{1,150}$/.test(x);
const key=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const same=(a,b)=>a&&b&&a.institutionId===b.institutionId&&a.courseId===b.courseId;
const stamp=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const pedagogical=new Set(['sapiens.low','curriculum.gap','avalia.recovery','enade.gap','enamed.gap','retention.alert']);
export const TRANSVERSAL_VERSION='2026.11-transversal.1';
function auth(scope,actor,permission){
 if(!id(scope?.institutionId)||!(scope.courseId===null||id(scope.courseId))||!id(actor?.id)||actor.mfa!==true||!Array.isArray(actor.grants)||!actor.grants.some(g=>same(g,scope)&&Array.isArray(g.permissions)&&g.permissions.includes(permission)))throw Error('access_denied');
 return {...scope,id:actor.id,mfa:true,permissions:['propose_plan','read']};
}
// Pure server-side builder: inputs must be loaded from authoritative storage, never trusted from HTTP body.
export function prepareIntervention({scope,actor,alert,goal,owner,asOf}){
 const a=auth(scope,actor,'automation.propose_intervention');
 if(!same(scope,alert)||alert.status!=='approved'||alert.executionMode!=='operational'||alert.humanApprovalVerified!==true||!key(alert.idempotencyKey)||!id(alert.approvedBy)||!stamp(alert.approvedAt)||!stamp(asOf)||Date.parse(alert.approvedAt)>Date.parse(asOf)||!Number.isSafeInteger(alert.revision)||alert.revision<1||!RULES.some(r=>r.id===alert.ruleId&&r.version===alert.ruleVersion&&r.priority===alert.priority))throw Error('invalid_approved_alert');
 if(!same(scope,goal)||goal.status!=='active'||!id(goal.id)||!same(scope,owner)||owner.active!==true||owner.id!==alert.ownerId||!stamp(alert.dueAt)||Date.parse(alert.dueAt)<=Date.parse(asOf))throw Error('invalid_goal_or_owner');
 const p=planningProposal({scope,actor:a,alert,goalId:goal.id});
 return {...p,version:TRANSVERSAL_VERSION,sourceAlertRevision:alert.revision,ruleId:alert.ruleId,priority:alert.priority,proposedBy:actor.id,proposedAt:asOf,destinations:['planning','5w2h',...(pedagogical.has(alert.ruleId)&&scope.courseId!==null?['sapiens']:[])],status:'draft',requiresHumanApproval:true,what:`Revisar ocorrência ${alert.ruleId}`,why:'Evidência registrada no alerta de origem; confirmar contexto e causa.',who:owner.id,when:alert.dueAt,where:scope.courseId??scope.institutionId,how:null,howMuch:null};
}
export function reviewIntervention({scope,actor,draft,alert,goal,owner,asOf,decision}){
 auth(scope,actor,'automation.review_intervention');
 if(!same(scope,draft)||draft.status!=='draft'||draft.version!==TRANSVERSAL_VERSION||actor.id===draft.proposedBy||!stamp(asOf)||!stamp(draft.proposedAt)||Date.parse(asOf)<Date.parse(draft.proposedAt)||!['approve','reject'].includes(decision))throw Error('invalid_review');
 const rebuilt=prepareIntervention({scope,actor:{id:draft.proposedBy,mfa:true,grants:[{...scope,permissions:['automation.propose_intervention']}]},alert,goal,owner,asOf:draft.proposedAt});
 if(hash(rebuilt)!==hash(draft)||Date.parse(draft.dueAt)<=Date.parse(asOf))throw Error('stale_or_modified_draft');
 return {...draft,status:decision==='approve'?'approved_for_handoff':'rejected',reviewedBy:actor.id,reviewedAt:asOf,requiresHumanApproval:true};
}
// No dispatch: a future transactional adapter must verify current approvals and acknowledge destination IDs.
export function handoffIntent({scope,actor,reviewed,destination,asOf}){
 auth(scope,actor,'automation.prepare_handoff');
 if(!same(scope,reviewed)||reviewed.status!=='approved_for_handoff'||reviewed.version!==TRANSVERSAL_VERSION||!key(reviewed.idempotencyKey)||!id(reviewed.reviewedBy)||reviewed.reviewedBy===reviewed.proposedBy||!stamp(asOf)||!stamp(reviewed.reviewedAt)||Date.parse(asOf)<Date.parse(reviewed.reviewedAt)||!stamp(reviewed.dueAt)||Date.parse(asOf)>=Date.parse(reviewed.dueAt)||!['planning','5w2h','sapiens'].includes(destination)||!reviewed.destinations?.includes(destination))throw Error('invalid_handoff');
 return {...scope,destination,proposalKey:reviewed.idempotencyKey,idempotencyKey:hash([reviewed.idempotencyKey,destination]),status:'awaiting_native_transaction',dispatched:false};
}
export function compareIntervention({scope,actor,baseline,followup,direction}){
 const a=auth(scope,actor,'automation.read_effectiveness');return effectiveness({scope,actor:a,baseline,followup,direction});
}
export function biSummary({scope,actor,projection,asOf}){
 auth(scope,actor,'automation.read_bi');
 const unavailable={...scope,status:'unverified',counts:null};
 if(!same(scope,projection)||projection.complete!==true||!stamp(asOf)||!stamp(projection.observedAt)||Date.parse(projection.observedAt)>Date.parse(asOf)||Date.parse(asOf)-Date.parse(projection.observedAt)>86400000||!Array.isArray(projection.rows)||projection.rows.length>10000)return unavailable;
 const counts={draft:0,approved_for_handoff:0,rejected:0},seen=new Set();
 for(const r of projection.rows){if(!same(scope,r)||!key(r.idempotencyKey)||seen.has(r.idempotencyKey)||!Object.hasOwn(counts,r.status)||r.executionMode!=='operational')return unavailable;seen.add(r.idempotencyKey);counts[r.status]++;}
 return {...scope,status:'observed',counts,observedAt:projection.observedAt};
}
