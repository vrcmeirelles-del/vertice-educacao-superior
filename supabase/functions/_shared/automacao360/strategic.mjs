import {evaluate} from './engine.mjs';
import {createHash} from 'node:crypto';
export const STRATEGIC_VERSION='2026.11-strategic.1';
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:._-]{1,150}$/.test(x);
const same=(a,b)=>a.institutionId===b.institutionId&&a.courseId===b.courseId;
const count=x=>Number.isSafeInteger(x)&&x>=0;
const clock=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const ratio=(n,d)=>Number(BigInt(n)*10000n/BigInt(d));
const modules={capture:['capture.stale','capture.conversion','capture.sla'],competition:['competition.change'],market:['market.new','market.transaction'],due:['due.pending','due.blocker'],finance:['finance.overdue','finance.arrears','finance.cashgap'],alumni:['alumni.pending','alumni.response']};
const allowed=new Set(Object.values(modules).flat());
const specs={
 'capture.stale':['unattendedLeads','open'], 'capture.sla':['slaBreaches','open'], 'competition.change':['confirmedChanges','validated'], 'market.new':['unreviewedPublications','open'], 'market.transaction':['confirmedTransactions','validated'], 'due.pending':['missingEvidence','open'], 'due.blocker':['confirmedBlockers','open'], 'finance.overdue':['overdueInvoices','open'], 'alumni.pending':['pendingSurveys','open']
};
// Aggregates only. Trusted server adapter must establish deduplication, review and source provenance.
// No collection, publication, contacts, predictions or changes to financial/academic records.
export function strategicRun({scope,config,source,asOf}){
 if(!scope||!id(scope.institutionId)||!(scope.courseId===null||id(scope.courseId))||!config||!same(scope,config)||!clock(asOf))throw Error('invalid_scope_or_clock');
 if(config.enabled!==true||config.approved!==true)return {status:'disabled',alerts:[],issues:[],skipped:[]};
 if(!Array.isArray(config.ruleIds)||config.ruleIds.some(x=>!allowed.has(x))||!Number.isFinite(config.maxAgeHours)||config.maxAgeHours<=0||config.maxAgeHours>720)throw Error('invalid_strategic_config');
 if(!source||!same(scope,source)||source.complete!==true||!id(source.id)||!clock(source.observedAt)||Date.parse(source.observedAt)>Date.parse(asOf)||!Array.isArray(source.entries)||source.entries.length>2000)throw Error('invalid_source');
 if(Date.parse(asOf)-Date.parse(source.observedAt)>config.maxAgeHours*3600000)return {status:'stale_source',alerts:[],issues:[],skipped:[]};
 const records=[],issues=[],seen=new Set();
 for(const e of source.entries){
  if(!e||!same(scope,e)||!id(e.id)||!id(e.revision)||!Object.hasOwn(modules,e.module))throw Error('invalid_entry');
  const key=JSON.stringify([e.module,e.id]);if(seen.has(key))throw Error('duplicate_entry');seen.add(key);
  const issue=(ruleId,reason)=>issues.push({entityId:e.id,ruleId,reason});
  if(!clock(e.observedAt)||Date.parse(e.observedAt)>Date.parse(source.observedAt)||Date.parse(asOf)-Date.parse(e.observedAt)>config.maxAgeHours*3600000||!clock(e.windowStart)||!clock(e.windowEnd)||Date.parse(e.windowStart)>=Date.parse(e.windowEnd)||Date.parse(e.windowEnd)>Date.parse(e.observedAt)||!id(e.definitionVersion)||e.complete!==true){issue(null,'invalid_or_stale_evidence');continue;}
  if(e.status==='closed'||e.status==='cancelled')continue;
  for(const ruleId of modules[e.module]){
   if(!config.ruleIds.includes(ruleId))continue;
   const m=e.metrics||{};let metrics,state;
   if(Object.hasOwn(specs,ruleId)){
    const [k,s]=specs[ruleId];state=s;
    if(!count(m[k])){issue(ruleId,'invalid_count');continue;}
    if(['competition.change','market.transaction','due.blocker'].includes(ruleId)&&(!id(e.reviewId)||e.verified!==true)){issue(ruleId,'review_required');continue;}
    if(['capture.stale','capture.sla'].includes(ruleId)&&!id(e.policyVersion)){issue(ruleId,'policy_required');continue;}
    metrics={[k]:m[k]};
   }else{
    state='validated';
    if(e.verified!==true||!id(e.reviewId)){issue(ruleId,'review_required');continue;}
    if(ruleId==='finance.cashgap'){
     if(e.currency!=='BRL'||!count(m.availableCents)||!count(m.committedOutflowCents)||e.status!=='validated'){issue(ruleId,'invalid_cash_inputs');continue;}
     metrics={cashGapCents:Math.max(0,m.committedOutflowCents-m.availableCents)};
    }else{
     const [n,d,k]=ruleId==='capture.conversion'?['enrolledLeads','eligibleLeads','conversionBps']:ruleId==='finance.arrears'?['overdueCents','dueCents','arrearsBps']:['respondedInvites','eligibleInvites','responseBps'];
     if(!count(m[n])||!count(m[d])||m[d]===0||m[n]>m[d]||(ruleId==='finance.arrears'&&e.currency!=='BRL')||(ruleId==='capture.conversion'&&e.cohortMature!==true)){issue(ruleId,'invalid_or_incomplete_denominator');continue;}
     metrics={[k]:ratio(m[n],m[d]),[d]:m[d]};
    }
   }
   if(e.status!==state){issue(ruleId,'state_not_eligible');continue;}
   const revision=createHash('sha256').update(JSON.stringify([e.revision,e.definitionVersion,e.windowStart,e.windowEnd,e.policyVersion??null,e.reviewId??null])).digest('hex');
   records.push({...scope,entityId:e.id,revision,ruleId,state,metrics});
  }
 }
 return {...evaluate({scope,config,snapshot:{...scope,sourceId:source.id,observedAt:source.observedAt,records},asOf}),issues};
}
