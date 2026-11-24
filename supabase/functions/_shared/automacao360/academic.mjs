import {createHash} from 'node:crypto';
import {evaluate} from './engine.mjs';
export const ACADEMIC_VERSION='2026.11-academic.1';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:._-]{1,150}$/.test(x);
const same=(a,b)=>a.institutionId===b.institutionId&&a.courseId===b.courseId;
const count=x=>Number.isSafeInteger(x)&&x>=0;
const day=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return null;const n=Date.parse(x+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===x?n/86400000:null;};
const clock=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const rules={internship:['internship.due','internship.overdue','internship.hours','internship.documents'],tcc:['tcc.overdue','tcc.due','tcc.documents'],extension:['extension.pending','extension.hours','extension.certificates'],teaching:['teaching.pending','teaching.hours','teaching.documents'],ac:['ac.duplicate','ac.hours','ac.documents']};
const allowed=new Set(Object.values(rules).flat());
export function academicRun({scope,config,source,asOf,timeZone}){
 if(!scope||!id(scope.institutionId)||!id(scope.courseId)||!config||!same(scope,config)||!clock(asOf))throw Error('invalid_scope_or_clock');
 if(config.enabled!==true||config.approved!==true)return {status:'disabled',alerts:[],issues:[],skipped:[]};
 if(!Array.isArray(config.ruleIds)||config.ruleIds.some(x=>!allowed.has(x))||!Number.isFinite(config.maxAgeHours)||config.maxAgeHours<=0||config.maxAgeHours>720)throw Error('invalid_academic_config');
 if(!source||!same(scope,source)||source.complete!==true||!id(source.id)||!clock(source.observedAt)||Date.parse(source.observedAt)>Date.parse(asOf)||!Array.isArray(source.entries)||source.entries.length>2000)throw Error('invalid_source');
 if(typeof timeZone!=='string'||!timeZone)throw Error('missing_timezone');
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});const p=fmt.formatToParts(new Date(asOf));const today=day(['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-'));
 const records=[],issues=[],seen=new Set();
 for(const e of source.entries){
  if(!e||!same(scope,e)||!id(e.id)||!id(e.revision)||!Object.hasOwn(rules,e.module))throw Error('invalid_entry');
  const key=JSON.stringify([e.module,e.id]);if(seen.has(key))throw Error('duplicate_entry');seen.add(key);
  const issue=(ruleId,reason)=>issues.push({entityId:e.id,module:e.module,ruleId,reason});
  if(!['open','submitted','validated','cancelled','closed','returned'].includes(e.status)){issue(null,'unknown_status');continue;}
  if(!['open','returned'].includes(e.status))continue;
  if(!clock(e.observedAt)||Date.parse(e.observedAt)>Date.parse(source.observedAt)||Date.parse(asOf)-Date.parse(e.observedAt)>config.maxAgeHours*3600000){issue(null,'stale_or_invalid_entry');continue;}
  for(const ruleId of rules[e.module]){
   if(!config.ruleIds.includes(ruleId))continue;
   let metric,value,band=null;
   if(/\.(due|overdue)$/.test(ruleId)){metric='daysToDue';const d=day(e.dueDate);if(d===null){issue(ruleId,'missing_or_invalid_deadline');continue;}value=d-today;band=value<0?'overdue':value<=7?'due':'future';}
   else if(ruleId.endsWith('.hours')){metric='missingMinutes';if(e.requirementApproved!==true||!id(e.requirementVersion)||e.creditsComplete!==true||!count(e.requiredMinutes)||e.requiredMinutes===0||!count(e.validatedMinutes)){issue(ruleId,'unverified_hours_or_requirement');continue;}value=Math.max(0,e.requiredMinutes-e.validatedMinutes);}
   else if(ruleId==='ac.duplicate'){metric='duplicateCandidates';if(e.duplicateReviewComplete!==true||!id(e.duplicateMethodVersion)||!count(e.duplicateCandidates)){issue(ruleId,'unverified_duplicate_scan');continue;}value=e.duplicateCandidates;}
   else if(['teaching.pending','extension.certificates'].includes(ruleId)){metric='pendingCertificates';if(e.certificateRosterComplete!==true||!count(e.eligibleParticipants)||!count(e.issuedCertificates)||e.issuedCertificates>e.eligibleParticipants){issue(ruleId,'unverified_certificate_roster');continue;}value=e.eligibleParticipants-e.issuedCertificates;}
   else {metric='missingEvidence';if(e.checklistComplete!==true||!id(e.checklistVersion)||!Array.isArray(e.requiredEvidence)||!Array.isArray(e.linkedEvidence)||e.requiredEvidence.length>500||e.linkedEvidence.length>500||[...e.requiredEvidence,...e.linkedEvidence].some(x=>!id(x))||new Set(e.requiredEvidence).size!==e.requiredEvidence.length||new Set(e.linkedEvidence).size!==e.linkedEvidence.length||e.linkedEvidence.some(x=>!e.requiredEvidence.includes(x))){issue(ruleId,'unverified_checklist');continue;}value=e.requiredEvidence.filter(x=>!e.linkedEvidence.includes(x)).length;}
   const revision=hash([ACADEMIC_VERSION,e.module,e.revision,e.status,ruleId,band??value,e.dueDate??null,e.requirementVersion??null,e.checklistVersion??null,e.duplicateMethodVersion??null]);
   records.push({...scope,entityId:e.id,ruleId,state:'open',revision,metrics:{[metric]:value}});
  }
 }
 const out=evaluate({scope,config,asOf,snapshot:{...scope,sourceId:source.id,observedAt:source.observedAt,records}});
 return {...out,issues:out.status==='evaluated'?issues:[],academicVersion:ACADEMIC_VERSION};
}
