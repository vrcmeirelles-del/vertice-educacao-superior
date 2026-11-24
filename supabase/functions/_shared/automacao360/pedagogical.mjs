import {createHash} from 'node:crypto';
import {evaluate} from './engine.mjs';
export const PEDAGOGICAL_VERSION='2026.11-pedagogical.1';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:._-]{1,150}$/.test(x);
const same=(a,b)=>a.institutionId===b.institutionId&&a.courseId===b.courseId;
const count=x=>Number.isSafeInteger(x)&&x>=0;
const clock=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const matrices={'curriculum.gap':'curriculum','enade.gap':'enade','enamed.gap':'enamed'};
const allowed=new Set(['sapiens.low','avalia.recovery','retention.alert',...Object.keys(matrices)]);
// Trusted server adapters must attest completeness, source authorization and review status.
// No individual risk score, no grade, no mastery update, no external calls.
export function pedagogicalRun({scope,config,source,asOf}){
 if(!scope||!id(scope.institutionId)||!id(scope.courseId)||!config||!same(scope,config)||!clock(asOf))throw Error('invalid_scope_or_clock');
 if(config.enabled!==true||config.approved!==true)return {status:'disabled',alerts:[],skipped:[],issues:[]};
 if(!Array.isArray(config.ruleIds)||config.ruleIds.some(x=>!allowed.has(x)))throw Error('invalid_pedagogical_rules');
 if(!source||!same(scope,source)||source.complete!==true||!Array.isArray(source.groups)||source.groups.length>2500||!id(source.id)||!clock(source.observedAt)||Date.parse(source.observedAt)>Date.parse(asOf))throw Error('invalid_source');
 const records=[],issues=[],seen=new Set();
 for(const g of source.groups){
  if(!g||!same(scope,g)||!id(g.id)||!id(g.revision)||!allowed.has(g.ruleId))throw Error('invalid_group');
  const k=JSON.stringify([g.ruleId,g.id]);if(seen.has(k))throw Error('duplicate_group');seen.add(k);
  if(!config.ruleIds.includes(g.ruleId))continue;
  const skip=reason=>issues.push({ruleId:g.ruleId,entityId:g.id,reason});
  if(g.status!=='validated'||g.provisional!==false||!id(g.reviewId)){skip('not_human_validated');continue;}
  if(!clock(g.observedAt)||Date.parse(g.observedAt)>Date.parse(source.observedAt)||!Number.isFinite(config.maxAgeHours)||Date.parse(asOf)-Date.parse(g.observedAt)>config.maxAgeHours*3600000){skip('stale_or_invalid_group');continue;}
  let metrics;
  if(g.ruleId==='sapiens.low'){
   if(!id(g.competencyKey)||!id(g.windowId)||!count(g.correct)||!count(g.graded)||g.correct>g.graded||!count(g.studentCount)||g.studentCount>g.graded||g.studentCount<5||g.graded<30){skip('insufficient_or_invalid_sample');continue;}
   metrics={accuracy:g.correct/g.graded,graded:g.graded};
  }else if(Object.hasOwn(matrices,g.ruleId)){
   if(g.matrixKind!==matrices[g.ruleId]||!id(g.matrixVersion)||g.mappingComplete!==true||!Array.isArray(g.required)||!Array.isArray(g.covered)||g.required.length===0||g.required.length>5000||g.covered.length>5000||[...g.required,...g.covered].some(x=>!id(x))||new Set(g.required).size!==g.required.length||new Set(g.covered).size!==g.covered.length||g.covered.some(x=>!g.required.includes(x))){skip('invalid_or_incomplete_matrix');continue;}
   metrics={uncoveredCompetencies:g.required.filter(x=>!g.covered.includes(x)).length};
  }else{
   const field=g.ruleId==='avalia.recovery'?'pendingRecovery':'confirmedAlerts';
   if(g.existingEngineVerified!==true||!id(g.engineVersion)||!count(g[field])){skip('unverified_upstream');continue;}
   metrics={[field]:g[field]};
  }
  records.push({...scope,entityId:g.id,ruleId:g.ruleId,state:'validated',revision:hash([PEDAGOGICAL_VERSION,g.revision,g.reviewId,g.matrixVersion??null,g.engineVersion??null,g.windowId??null,g.competencyKey??null,metrics]),metrics});
 }
 const out=evaluate({scope,config,asOf,snapshot:{...scope,sourceId:source.id,observedAt:source.observedAt,records}});
 return {...out,issues:out.status==='evaluated'?issues:[],pedagogicalVersion:PEDAGOGICAL_VERSION};
}
