import {createHash} from 'node:crypto';
import {RULES} from './catalog.mjs';
export const GOVERNANCE_VERSION='2026.11-governance.1';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:._-]{1,150}$/.test(x);
const stamp=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const scoped=(a,b)=>a&&b&&a.institutionId===b.institutionId&&a.courseId===b.courseId;
const check=(scope,actor,permission)=>{if(!id(scope?.institutionId)||!(scope.courseId===null||id(scope.courseId))||!scoped(scope,actor)||!id(actor.id)||actor.mfa!==true||!Array.isArray(actor.permissions)||!actor.permissions.includes(permission))throw Error('access_denied');};
const validKey=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const states=['pending_review','approved','rejected','in_progress','completed','verified'];
// All arguments are trusted server-side projections. No database or external effects.
export function configure({scope,actor,previous,ruleIds,enabled,maxAgeHours,asOf}){
 check(scope,actor,'configure');
 if(!stamp(asOf)||typeof enabled!=='boolean'||!Array.isArray(ruleIds)||new Set(ruleIds).size!==ruleIds.length||ruleIds.some(x=>!RULES.some(r=>r.id===x))||!Number.isFinite(maxAgeHours)||maxAgeHours<=0||maxAgeHours>720)throw Error('invalid_configuration');
 if(previous&&(!scoped(scope,previous)||!Number.isSafeInteger(previous.revision)||previous.revision<1))throw Error('invalid_previous');
 return {...scope,ruleIds:[...ruleIds].sort(),enabled,approved:false,maxAgeHours,revision:(previous?.revision??0)+1,configuredBy:actor.id,configuredAt:asOf};
}
export function approveConfig({scope,actor,config,asOf}){
 check(scope,actor,'approve_config');
 if(!scoped(scope,config)||config.approved!==false||!stamp(asOf)||!stamp(config.configuredAt)||Date.parse(asOf)<Date.parse(config.configuredAt)||actor.id===config.configuredBy)throw Error('invalid_approval');
 return {...config,approved:true,approvedBy:actor.id,approvedAt:asOf};
}
export function queue({scope,actor,alerts}){
 check(scope,actor,'read'); if(!Array.isArray(alerts)||alerts.length>10000)throw Error('invalid_batch');
 const seen=new Set(); for(const a of alerts){if(!scoped(scope,a)||!validKey(a.idempotencyKey)||!states.includes(a.status)||!RULES.some(r=>r.id===a.ruleId&&r.version===a.ruleVersion&&r.priority===a.priority)||seen.has(a.idempotencyKey))throw Error('invalid_alert');seen.add(a.idempotencyKey);}
 return alerts.filter(a=>a.status==='pending_review').sort((a,b)=>a.priority.localeCompare(b.priority)||a.idempotencyKey.localeCompare(b.idempotencyKey));
}
const transitions={approve:['pending_review','approved','review'],reject:['pending_review','rejected','review'],start:['approved','in_progress','execute'],complete:['in_progress','completed','execute'],verify:['completed','verified','verify']};
export function transition({scope,actor,alert,action,expectedRevision,asOf,reason,ownerId,dueAt,evidenceRef}){
 const t=Object.hasOwn(transitions,action)?transitions[action]:null;if(!t)throw Error('invalid_action');check(scope,actor,t[2]);
 if(!scoped(scope,alert)||!validKey(alert.idempotencyKey)||alert.status!==t[0]||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision!==(alert.revision??0)||!stamp(asOf)||typeof reason!=='string'||reason.trim().length<5||reason.length>2000)throw Error('invalid_transition');
 if(alert.updatedAt&&(!stamp(alert.updatedAt)||Date.parse(asOf)<Date.parse(alert.updatedAt)))throw Error('invalid_clock');
 if(action==='approve'&&(!id(ownerId)||!stamp(dueAt)||Date.parse(dueAt)<=Date.parse(asOf)))throw Error('invalid_plan');
 if(['complete','verify'].includes(action)&&!id(evidenceRef))throw Error('evidence_required');
 if(action==='verify'&&actor.id===alert.completedBy)throw Error('independent_verification_required');
 const next={...alert,status:t[1],revision:expectedRevision+1,updatedAt:asOf,...(action==='approve'?{ownerId,dueAt}:{}),...(action==='complete'?{completedBy:actor.id,completionEvidence:evidenceRef}:{}),...(action==='verify'?{verificationEvidence:evidenceRef}:{} )};
 const event={...scope,alertKey:alert.idempotencyKey,revision:next.revision,from:t[0],to:t[1],actorId:actor.id,at:asOf,reason:reason.trim(),evidenceRef:evidenceRef??null};
 return {alert:next,event:{...event,eventId:digest(event)}};
}
export function planningProposal({scope,actor,alert,goalId}){
 check(scope,actor,'propose_plan');if(!scoped(scope,alert)||alert.status!=='approved'||!validKey(alert.idempotencyKey)||!id(goalId)||!id(alert.ownerId)||!stamp(alert.dueAt))throw Error('invalid_plan');
 return {...scope,goalId,ownerId:alert.ownerId,dueAt:alert.dueAt,sourceAlertKey:alert.idempotencyKey,idempotencyKey:digest([scope.institutionId,scope.courseId,alert.idempotencyKey,goalId]),status:'draft',requiresHumanApproval:true};
}
export function effectiveness({scope,actor,baseline,followup,direction}){
 check(scope,actor,'read');const valid=x=>scoped(scope,x)&&x.validated===true&&id(x.reviewId)&&id(x.metric)&&id(x.definitionVersion)&&id(x.populationKey)&&id(x.unit)&&stamp(x.at)&&Number.isFinite(x.value)&&Number.isSafeInteger(x.sample)&&x.sample>=30;
 if(!valid(baseline)||!valid(followup)||!['higher','lower'].includes(direction)||['metric','definitionVersion','populationKey','unit'].some(k=>baseline[k]!==followup[k])||Date.parse(followup.at)<=Date.parse(baseline.at))return {status:'insufficient_comparable_evidence'};
 const delta=followup.value-baseline.value;if(!Number.isFinite(delta))return {status:'insufficient_comparable_evidence'};
 return {status:'observed_change',delta,direction:delta===0?'stable':(direction==='higher'?delta>0:delta<0)?'improved':'worsened',causalAttribution:false};
}
