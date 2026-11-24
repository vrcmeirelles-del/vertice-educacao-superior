import {createHash} from 'node:crypto';
import {evaluate} from './engine.mjs';
export const DOCUMENTARY_VERSION='2026.11-documentary.1';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const day=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return null;const n=Date.parse(x+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===x?n/86400000:null;};
const localDay=(asOf,zone)=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(asOf));return day(['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-'));};
const same=(a,b)=>a.institutionId===b.institutionId&&a.courseId===b.courseId;
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9:._-]{1,150}$/.test(x);
// Normalized trusted server records only. No regulatory conclusion or side effect.
export function documentaryRun({scope,config,source,asOf,timeZone='America/Araguaina'}){
 if(!scope||!config||!same(scope,config))throw Error('scope_mismatch');
 if(config.enabled!==true||config.approved!==true)return {status:'disabled',alerts:[],skipped:[]};
 if(!source||!same(scope,source)||source.complete!==true||!Array.isArray(source.requests)||source.requests.length>2500)throw Error('incomplete_or_invalid_source');
 const today=localDay(asOf,timeZone),records=[],issues=[],seen=new Set(),groups=new Map();
 for(const r of source.requests){
  if(!r||!same(scope,r)||!validId(r.id)||!validId(r.revision)||seen.has(r.id))throw Error('invalid_request_scope_or_identity');seen.add(r.id);
  if(!['open','returned','submitted','validated','cancelled'].includes(r.status)){issues.push({id:r.id,reason:'unknown_status'});continue;}
  if(['validated','cancelled','submitted'].includes(r.status))continue;
  const due=day(r.dueDate);
  if(due===null){issues.push({id:r.id,reason:'missing_or_invalid_deadline'});continue;}
  const days=due-today;const band=days<0?'overdue':days<=7?'due':'future';
  for(const ruleId of ['repo.overdue','repo.due'])records.push({...scope,entityId:r.id,ruleId,state:'open',revision:hash([DOCUMENTARY_VERSION,r.revision,r.status,r.dueDate,band]),metrics:{daysToDue:days}});
  const k=r.dueDate;const g=groups.get(k)||{dueDate:k,daysToDue:days,pending:0};g.pending++;groups.set(k,g);
 }
 const result=evaluate({scope,config,asOf,snapshot:{...scope,sourceId:source.id,observedAt:source.observedAt,records}});
 if(result.status!=='evaluated')return {...result,issues:[],deadlineSummary:[]};
 return {...result,issues,deadlineSummary:[...groups.values()].sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),documentaryVersion:DOCUMENTARY_VERSION};
}
// Evidence checklist: explicit links and human validation, never inferred compliance.
export function evidenceChecklist({scope,requirements,evidence}){
 if(!scope||!Array.isArray(requirements)||!Array.isArray(evidence))throw Error('invalid_input');
 const ids=new Set(),eids=new Set();for(const r of requirements){if(!r||!same(scope,r)||!validId(r.id)||ids.has(r.id))throw Error('invalid_requirement');ids.add(r.id);}
 for(const e of evidence){if(!e||!same(scope,e)||!validId(e.id)||eids.has(e.id)||!ids.has(e.requirementId))throw Error('invalid_evidence');eids.add(e.id);}
 return requirements.map(r=>{const links=evidence.filter(e=>e.requirementId===r.id);const reviewed=links.filter(e=>e.status==='validated'&&validId(e.reviewId));return {requirementId:r.id,status:reviewed.length?'human_validated_evidence_present':links.length?'pending_review':'no_linked_evidence',linkedCount:links.length,validatedCount:reviewed.length,compliance:null};});
}
