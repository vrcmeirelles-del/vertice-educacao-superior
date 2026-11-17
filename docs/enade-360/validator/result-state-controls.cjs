"use strict";
/**
 * ENADE 360 — prototype of result-state contracts.
 * State is NOT an official INEP calculation. SC requires the indicator's
 * verified edition rule; N/A requires documented scope; missing is not zero.
 */
const {policy}=require("./edition-controls.cjs");
const STATES=new Set(["AVAILABLE","SC","NOT_APPLICABLE","MISSING","PENDING","NOT_PUBLISHED"]);
const FORBID_NUMERIC=new Set(["SC","NOT_APPLICABLE","MISSING","PENDING","NOT_PUBLISHED"]);
const NO_EVIDENCE=new Set(["SC","NOT_APPLICABLE","MISSING","PENDING","NOT_PUBLISHED"]);
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function text(v){return typeof v==="string"&&v.trim().length>0}
function checkState(state,{edition,indicator}={}){
 const errors=[];
 if(!state||typeof state!=="object"||Array.isArray(state))return ["STATE_REQUIRED"];
 if(!STATES.has(state.kind))return ["STATE_UNKNOWN"];
 const numericFields=["continuous_value","band","score","computed_value"];
 if(FORBID_NUMERIC.has(state.kind))for(const f of numericFields)if(has(state,f)&&state[f]!==null)errors.push("NON_NUMERIC_STATE_HAS_VALUE:"+f);
 if(state.kind==="AVAILABLE"){
  if(!Number.isFinite(state.continuous_value)&&!Number.isInteger(state.band))errors.push("AVAILABLE_NO_NUMERIC_VALUE");
  if(!text(state.source_version))errors.push("AVAILABLE_SOURCE_VERSION");
 }
 if(state.kind==="SC"){
  if(indicator==="CONCEITO_ENADE"){
   const p=policy(edition,state.methodology_id);
   if(p.status!=="MATCH")errors.push("SC_UNVERIFIED_METHODOLOGY");
   if(!Number.isInteger(state.valid_participants)||state.valid_participants<0)errors.push("SC_COUNT_REQUIRED");
   else if(p.status==="MATCH"&&state.valid_participants>=p.policy.minValid)errors.push("SC_COUNT_INCOMPATIBLE");
  } else errors.push("SC_OTHER_INDICATOR_NOT_VERIFIED");
  if(!text(state.reason))errors.push("SC_REASON_REQUIRED");
 }
 if(state.kind==="NOT_APPLICABLE"){
  if(!text(state.reason)||!text(state.applicability_rule_ref))errors.push("NA_JUSTIFICATION_REQUIRED");
 }
 if(state.kind==="MISSING"){
  if(!text(state.missing_reason)||!text(state.expected_source))errors.push("MISSING_PROVENANCE_REQUIRED");
 }
 if(state.kind==="PENDING"&&(!text(state.pending_dependency)||!text(state.next_verification)))errors.push("PENDING_TRACKING_REQUIRED");
 if(state.kind==="NOT_PUBLISHED"&&(!text(state.publication_source)||!text(state.checked_at)))errors.push("PUBLICATION_CHECK_REQUIRED");
 return errors;
}
function checkReportStates(r){
 const e=[];
 if(!r||typeof r!=="object")return ["REPORT_REQUIRED"];
 if(r.report_type==="R4"&&Array.isArray(r.payload?.indicators)){
  r.payload.indicators.forEach((v,i)=>{
   if(!v||typeof v!=="object")return e.push("INDICATOR_INVALID:"+i);
   if(v.status==="SC"||v.status==="OFFICIAL"||has(v,"value_state")){
     if(!has(v,"value_state"))return e.push("INDICATOR_STATE_REQUIRED:"+i);
     const issues=checkState(v.value_state,{edition:r.edition_year,indicator:v.indicator});
     e.push(...issues.map(x=>"INDICATOR_"+i+"_"+x));
     if(v.status==="SC"&&v.value_state.kind!=="SC")e.push("SC_STATUS_MISMATCH:"+i);
     if(v.status==="OFFICIAL"&&v.value_state.kind!=="AVAILABLE")e.push("OFFICIAL_STATE_MISMATCH:"+i);
   }
  });
 }
 if(r.report_type==="R6"&&Array.isArray(r.payload?.interventions)){
  r.payload.interventions.forEach((v,i)=>{
   if(v?.status==="APPROVED"&&v.basis_state&&NO_EVIDENCE.has(v.basis_state.kind))e.push("INTERVENTION_WITHOUT_RESULTS:"+i);
   if(v?.basis_state){const problems=checkState(v.basis_state,{edition:r.edition_year,indicator:v.basis_indicator});e.push(...problems.map(x=>"INTERVENTION_"+i+"_"+x));}
  });
 }
 return e;
}
module.exports={checkState,checkReportStates,STATES};
