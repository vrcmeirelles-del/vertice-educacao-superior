import { RULES } from './catalog.mjs';
import { configure, approveConfig, queue } from './governance.mjs';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const same=(a,b)=>a?.institutionId===b?.institutionId&&a?.courseId===b?.courseId;
// Server-side only: actor and grants must be resolved from the authenticated native session.
function authorize(scope,actor,permission){
 if(!uuid(scope?.institutionId)||!(scope.courseId===null||uuid(scope.courseId))||!uuid(actor?.id)||actor.mfa!==true||!Array.isArray(actor.grants)||!actor.grants.some(g=>same(g,scope)&&Array.isArray(g.permissions)&&g.permissions.includes(permission)))throw Error('access_denied');
 return {...scope,id:actor.id,mfa:true,permissions:[permission==='automation.configure'?'configure':permission==='automation.approve'?'approve_config':'read']};
}
export async function loadInstitutionDashboard({scope,actor,asOf,readProjection}){
 authorize(scope,actor,'automation.read');
 if(typeof asOf!=='string'||!Number.isFinite(Date.parse(asOf))||typeof readProjection!=='function')throw Error('invalid_request');
 const base={...scope,readOnly:true,status:'unavailable',rules:[],pending:null,asOf};
 let p;try{p=await readProjection({...scope});}catch{return base;}
 if(!same(scope,p)||typeof p.observedAt!=='string'||!Number.isFinite(Date.parse(p.observedAt))||Date.parse(p.observedAt)>Date.parse(asOf)||!Array.isArray(p.rules)||!Array.isArray(p.alerts))return {...base,status:'invalid_source'};
 if(Date.parse(asOf)-Date.parse(p.observedAt)>86400000)return {...base,status:'stale'};
 const seen=new Set(),rules=[];
 for(const row of p.rules){const r=RULES.find(r=>r.id===row?.id&&r.version===row.version);if(!r||seen.has(r.id)||!same(scope,row)||!['active','inactive','shadow','blocked'].includes(row.state))return {...base,status:'invalid_source'};seen.add(r.id);rules.push({id:r.id,module:r.module,version:r.version,priority:r.priority,cadence:r.cadence,state:row.state});}
 let pending;try{pending=queue({scope,actor:authorize(scope,actor,'automation.read'),alerts:p.alerts}).map(a=>({key:a.idempotencyKey,ruleId:a.ruleId,priority:a.priority,status:a.status}));}catch{return {...base,status:'invalid_source'};}
 // Partial observations never imply inactive rules or a complete alert queue.
 return {...base,status:p.complete===true?'observed':'partial',observedAt:p.observedAt,rules,pending:p.complete===true?pending:null};
}
// Pure proposal builders. Neither saves nor activates a configuration.
export function proposeInstitutionConfig({scope,actor,previous,ruleIds,enabled,maxAgeHours,asOf}){
 return configure({scope,actor:authorize(scope,actor,'automation.configure'),previous,ruleIds,enabled,maxAgeHours,asOf});
}
export function reviewInstitutionConfig({scope,actor,config,asOf}){
 return approveConfig({scope,actor:authorize(scope,actor,'automation.approve'),config,asOf});
}
