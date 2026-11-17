"use strict";
// Pure in-memory prototype only: no database, no API, no production authorization.
const crypto=require("node:crypto");
const ROLES=new Set(["MASTER","REITORIA","COORDENACAO","NDE","CPA"]);
function canonical(x){if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";if(x&&typeof x==="object")return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";return JSON.stringify(x);}
const hash=x=>crypto.createHash("sha256").update(canonical(x)).digest("hex");
function append(history,evt){
 if(!Array.isArray(history)||!evt||!evt.stream_id||!evt.tenant_id||!evt.institution_id||!evt.result_id||!evt.event_type||!evt.idempotency_key)throw Error("BAD_EVENT");
 if(history.length){
  const h=history[history.length-1];
  if(h.stream_id!==evt.stream_id||h.tenant_id!==evt.tenant_id||h.institution_id!==evt.institution_id)throw Error("CROSS_SCOPE_APPEND");
  if(history.some(x=>x.idempotency_key===evt.idempotency_key))throw Error("DUPLICATE_IDEMPOTENCY_KEY");
 }
 if(evt.publication_status&&evt.publication_status!=="DRAFT_ONLY")throw Error("PUBLICATION_BLOCKED");
 const previous_hash=history.length?history[history.length-1].event_hash:null;
 const sequence=history.length+1;
 const record={...evt,sequence,previous_hash,publication_status:"DRAFT_ONLY"};
 const event_hash=hash(record);
 return [...history,Object.freeze({...record,event_hash})];
}
function verify(history){
 if(!Array.isArray(history))return false;
 for(let i=0;i<history.length;i++){
  const {event_hash,...record}=history[i];
  if(record.sequence!==i+1||record.previous_hash!==(i?history[i-1].event_hash:null)||hash(record)!==event_hash)return false;
  if(i&&record.stream_id!==history[0].stream_id)return false;
 }
 return true;
}
function canRead(subject,resource){
 if(!subject||!resource||!subject.user_id||!ROLES.has(subject.role)||!subject.active||subject.mfa_level!=="aal2")return false;
 if(!Array.isArray(subject.grants))return false;
 return subject.grants.some(g=>{
  if(!g.active||g.tenant_id!==resource.tenant_id||g.institution_id!==resource.institution_id)return false;
  if(subject.role==="MASTER"||subject.role==="REITORIA")return g.role===subject.role;
  if(subject.role==="CPA")return g.role==="CPA"&&resource.visibility==="AGGREGATED"&&!resource.contains_personal_data;
  return g.role===subject.role&&g.course_id===resource.course_id&&!resource.contains_personal_data;
 });
}
function readEvidence(subject,resource,events,{limit=20,after=0}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(after)||after<0)return {status:400,error:"BAD_PAGINATION"};
 if(!canRead(subject,resource))return {status:404,error:"NOT_FOUND"};
 if(!verify(events))return {status:409,error:"CHAIN_INVALID"};
 const items=events.filter(e=>e.sequence>after&&e.tenant_id===resource.tenant_id&&e.institution_id===resource.institution_id&&(resource.course_id===null||e.course_id===resource.course_id)).slice(0,limit).map(e=>({event_id:e.event_id,sequence:e.sequence,event_type:e.event_type,event_hash:e.event_hash,previous_hash:e.previous_hash,publication_status:"DRAFT_ONLY"}));
 return {status:200,traceability_version:"0.1",items,next_cursor:items.length?items[items.length-1].sequence:null,publication_status:"DRAFT_ONLY"};
}
module.exports={canonical,hash,append,verify,canRead,readEvidence};
