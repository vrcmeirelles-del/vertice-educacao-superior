"use strict";
// Internal Vértice contract integrity. No INEP formula, numerical tolerance or
// authenticated adapter is implemented here. External checks default to denial.
const {createHash}=require("node:crypto");
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const text=x=>typeof x==="string"&&x.trim().length>0;
const count=x=>Number.isSafeInteger(x)&&x>=0;
const classes=new Set(["C0","C1","C2","C3","C4","CX"]);
const indicators=new Set(["CONCEITO_ENADE","IDD","CPC","IGC"]);
function iso(x){
 if(!text(x)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x)||!Number.isFinite(Date.parse(x)))return false;
 const d=x.slice(0,10),p=new Date(d+"T00:00:00Z");return Number.isFinite(p.getTime())&&p.toISOString().slice(0,10)===d;
}
function canonical(x){
 if(x===null||typeof x!=="object")return JSON.stringify(x);
 if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";
 return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";
}
function reportDigest(r){return createHash("sha256").update(canonical(r)).digest("hex");}
function sources(r){return Array.isArray(r.source_documents)?r.source_documents:[];}
function resolved(r,refs){
 return Array.isArray(refs)&&refs.length>0&&refs.every(id=>text(id)&&sources(r).filter(s=>s?.source_id===id&&/^[a-f0-9]{64}$/i.test(s.sha256||"")&&text(s.file_version)).length===1);
}
function trusted(fn,request){try{return typeof fn==="function"&&fn(Object.freeze(request))===true;}catch(_){return false;}}
function isInstitutionReport(r){return r?.report_type==="R4"&&Array.isArray(r.payload?.indicators)&&r.payload.indicators.length>0&&r.payload.indicators.every(v=>v?.indicator==="IGC");}
function integrity(r,context={}){
 if(!r||typeof r!=="object"||Array.isArray(r))return ["INTEGRITY_REPORT_REQUIRED"];
 const errors=[],p=r.payload||{};
 if(has(r,'denominator')&&(!count(r.denominator)||r.denominator===0)||has(r,'sample_n')&&!count(r.sample_n))errors.push("UNSAFE_POPULATION_COUNT");
 if(r.schema_version&&!['0.2','0.3','0.4'].includes(r.schema_version))errors.push("UNSUPPORTED_SCHEMA_VERSION");
 if(r.review_status==="APPROVED"){
  if(r.schema_version!=="0.4")errors.push("APPROVAL_REQUIRES_CONTRACT_0_4");
  if(!iso(r.reviewed_at)||!text(r.reviewed_by)||!text(r.review_decision_id))errors.push("REPORT_REVIEW_METADATA");
  if(!trusted(context.verifyDecision,{report_id:r.report_id,subject_id:r.report_id,decision_id:r.review_decision_id,reviewer_id:r.reviewed_by,reviewed_at:r.reviewed_at,report_sha256:reportDigest(r)}))errors.push("REPORT_REVIEW_NOT_AUTHENTICATED");
 }
 if(r.report_type==="R2")for(const name of ["general_formation","specific_component"]){
  const v=p[name];if(!v||typeof v!=="object"||Array.isArray(v))continue;
  const allowed=new Set(["methodology_id","unit","n","value","measure","missing","not_applicable","population_rule_ref"]);
  if(Object.keys(v).some(k=>!allowed.has(k)))errors.push("R2_UNKNOWN_MEASURE_FIELD:"+name);
  if(!['points','standardized_points'].includes(v.unit))errors.push("R2_UNIT:"+name);
  if(!count(v.n))errors.push("R2_UNSAFE_COMPONENT_COUNT:"+name);
  if(count(v.n)&&count(r.denominator)&&v.n>r.denominator)errors.push("R2_N_EXCEEDS_POPULATION:"+name);
  if(count(v.n)&&count(r.sample_n)&&v.n>r.sample_n&&!text(v.population_rule_ref))errors.push("R2_COMPONENT_POPULATION_RULE:"+name);
  if(has(v,'value')&&v.value!==null&&(!Number.isFinite(v.value)||v.value<0||v.value>(v.unit==='standardized_points'?5:100)))errors.push("R2_VALUE_RANGE:"+name);
  if(v.measure&&(!['RAW_SCORE','COURSE_MEAN','STANDARDIZED_SCORE'].includes(v.measure)||(v.measure==='STANDARDIZED_SCORE')!==(v.unit==='standardized_points')))errors.push("R2_MEASURE_UNIT:"+name);
  if(r.schema_version==='0.4'&&(!has(v,'value')||!text(v.measure)))errors.push("R2_EXPLICIT_MEASURE_REQUIRED:"+name);
 }
 if(r.report_type==="R3"&&Array.isArray(p.questionnaire_categories)){
  const seen=new Set();
  for(const [i,v]of p.questionnaire_categories.entries()){
   if(!v||typeof v!=="object")continue;
   const excluded=v.excluded??0,na=v.not_applicable??0;
   if(![v.respondents,v.missing,v.denominator,excluded,na].every(count)||v.respondents+v.missing+excluded+na!==v.denominator)errors.push("R3_UNACCOUNTED_POPULATION:"+i);
   if((excluded>0||na>0)&&!text(v.population_rule_ref))errors.push("R3_POPULATION_RULE:"+i);
   if(count(r.denominator)&&v.denominator>r.denominator)errors.push("R3_POPULATION_EXCEEDED:"+i);
   if(seen.has(v.question_id))errors.push("R3_DUPLICATE_QUESTION:"+i);seen.add(v.question_id);
  }
 }
 if(r.report_type==="R4"&&Array.isArray(p.indicators))for(const [i,v]of p.indicators.entries()){
  if(!v||typeof v!=="object")continue;
  const s=v.value_state;
  if(v.status==='PENDING'&&['continuous_value','band'].some(k=>has(v,k)&&v[k]!==null))errors.push("R4_PENDING_NUMERIC_VALUE:"+i);
  if(s&&typeof s==='object'){
   for(const k of ['continuous_value','band','source_version','methodology_id'])if(has(v,k)&&has(s,k)&&v[k]!==s[k])errors.push("R4_CONFLICTING_"+k.toUpperCase()+":"+i);
   if(v.status==='PENDING'&&s.kind==='AVAILABLE')errors.push("R4_PENDING_AVAILABLE:"+i);
  }
  if(v.status==='OFFICIAL'){
   if(v.result_origin!=='OFFICIAL_SOURCE')errors.push("R4_OFFICIAL_SOURCE_ORIGIN:"+i);
   const docs=sources(r).filter(d=>d?.source_id===v.source_id);
   const doc=docs[0];
   if(docs.length!==1||!resolved(r,[v.source_id])||doc?.file_version!==v.source_version)errors.push("R4_OFFICIAL_SOURCE_UNRESOLVED:"+i);
   if(r.schema_version==='0.4'){
    const traces=Array.isArray(r.result_traces)?r.result_traces.filter(t=>t?.indicator===v.indicator&&t?.methodology_id===v.methodology_id):[];
    const t=traces[0];
    if(traces.length!==1||t?.value!==v.continuous_value||t?.state?.kind!==s?.kind||t?.source_id!==v.source_id||t?.source_version!==v.source_version||t?.source_sha256!==doc?.sha256||t?.source_url!==doc?.url||t?.epistemic_label!=='OFFICIAL_FACT')errors.push("R4_OFFICIAL_TRACE_CONFLICT:"+i);
   }
   // Only an adapter operating outside the report body can attest that this
   // exact scoped value was read from the frozen official file.
   if(!trusted(context.verifyOfficialResult,{report_id:r.report_id,report_sha256:reportDigest(r),indicator:v.indicator,edition_year:r.edition_year,institution_code:r.institution_code,course_code:r.course_code,area_code:r.area_code,methodology_id:v.methodology_id,source_id:v.source_id,source_version:v.source_version,source_sha256:doc?.sha256,continuous_value:v.continuous_value,band:v.band}))errors.push("R4_OFFICIAL_RESULT_UNVERIFIED:"+i);
  }
 }
 if(r.report_type==="R5"&&Array.isArray(p.comparisons))for(const [i,v]of p.comparisons.entries()){
  if(!v||typeof v!=='object')continue;
  if(!classes.has(v.class))errors.push("R5_UNKNOWN_CLASS:"+i);
  if(classes.has(r.comparability_class)&&v.class!==r.comparability_class)errors.push("R5_CLASS_CONFLICT:"+i);
  if(v.class==='C1'&&v.claimed_comparable===true){
   const keys=['area_code','academic_degree','instrument_id','methodology_id','measure','unit','source_ref'];
   if(!v.left||!v.right||keys.some(k=>!text(v.left?.[k])||!text(v.right?.[k]))||![v.left?.edition_year,v.right?.edition_year].every(Number.isInteger))errors.push("R5_C1_PAIR_REQUIRED:"+i);
   else if(v.left.area_code!==v.right.area_code||v.left.academic_degree!==v.right.academic_degree||v.left.measure!==v.right.measure||v.left.unit!==v.right.unit||v.left.edition_year===v.right.edition_year)errors.push("R5_C1_INCOMPATIBLE_PAIR:"+i);
   if(!resolved(r,v.equivalence_refs)||!resolved(r,[v.left?.source_ref,v.right?.source_ref]))errors.push("R5_C1_EQUIVALENCE_UNRESOLVED:"+i);
   if(!trusted(context.verifyComparison,{report_id:r.report_id,comparison_index:i,report_sha256:reportDigest(r)}))errors.push("R5_C1_EQUIVALENCE_UNVERIFIED:"+i);
  }
 }
 if(r.report_type==="R6"&&Array.isArray(p.interventions))for(const [i,v]of p.interventions.entries()){
  if(!v||typeof v!=='object')continue;
  if(!['DRAFT','APPROVED','REJECTED'].includes(v.status))errors.push("R6_ACTION_STATUS:"+i);
  if(v.status==='APPROVED'){
   if(r.review_status!=='APPROVED')errors.push("R6_REPORT_NOT_APPROVED:"+i);
   if(!iso(v.reviewed_at)||!text(v.reviewed_by)||!text(v.intervention_id)||!text(v.review_decision_id))errors.push("R6_REVIEW_METADATA:"+i);
   if(!resolved(r,v.evidence_refs))errors.push("R6_EVIDENCE_UNRESOLVED:"+i);
   if(!trusted(context.verifyDecision,{report_id:r.report_id,subject_id:v.intervention_id,decision_id:v.review_decision_id,reviewer_id:v.reviewed_by,reviewed_at:v.reviewed_at,report_sha256:reportDigest(r)}))errors.push("R6_REVIEW_NOT_AUTHENTICATED:"+i);
  }
 }
 if(r.schema_version==='0.4'){
  const ids=sources(r).map(s=>s?.source_id);
  if(ids.some(id=>!text(id))||new Set(ids).size!==ids.length)errors.push("SOURCE_IDS_REQUIRED_UNIQUE");
  if(r.claims?.some(c=>c?.evidence_refs?.length&&!resolved(r,c.evidence_refs)))errors.push("CLAIM_EVIDENCE_UNRESOLVED");
  if(r.report_type==='R4'&&Array.isArray(p.indicators)&&new Set(p.indicators.map(v=>v?.indicator)).size!==p.indicators.length)errors.push("R4_DUPLICATE_INDICATOR");
 }
 return errors;
}
module.exports={integrity,isInstitutionReport,iso,reportDigest,resolved};
