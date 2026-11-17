"use strict";
// R2-R6 policy-driven prototype. Synthetic guard only; no official computation.
const {policy}=require("./edition-controls.cjs");
const REQUIRED={
 R2:["general_formation","specific_component"],
 R3:["questionnaire_categories"],
 R4:["indicators"],
 R5:["comparisons"],
 R6:["interventions"]
};
const officialIndicators=new Set(["CONCEITO_ENADE","IDD","CPC","IGC"]);
function validId(x){return typeof x==="string"&&x.trim().length>0;}
function positiveInt(x){return Number.isInteger(x)&&x>=0;}
function inspect(r){
 const issues=[];if(!r||!REQUIRED[r.report_type])return ["UNSUPPORTED_REPORT"];
 for(const f of REQUIRED[r.report_type])if(r.payload?.[f]===undefined||r.payload[f]===null)issues.push("MISSING_PAYLOAD:"+f);
 const p=r.payload||{};
 const ident=(obj,i)=>{
  if(!obj||typeof obj!=="object"){issues.push("INVALID_ENTRY:"+i);return;}
  for(const f of ["institution_code","course_code","area_code","edition_year","academic_degree"]){
   if(obj[f]===undefined||obj[f]===null||String(obj[f])!==String(r[f]))issues.push("IDENTITY_MISMATCH:"+i+":"+f);
  }
 };
 if(r.report_type==="R2"){
  for(const k of ["general_formation","specific_component"]){
   const v=p[k];
   if(!v||typeof v!=="object"||Array.isArray(v)||!validId(v.methodology_id)||!validId(v.unit)||!positiveInt(v.n))issues.push("R2_COMPONENT_METADATA:"+k);
   else if(v.methodology_id!==r.methodology_id)issues.push("R2_METHOD_MISMATCH:"+k);
  }
 }
 if(r.report_type==="R3"){
  if(!Array.isArray(p.questionnaire_categories))issues.push("R3_CATEGORIES_TYPE");
  else p.questionnaire_categories.forEach((v,i)=>{
   if(!v||!validId(v.question_id)||!positiveInt(v.respondents)||!positiveInt(v.missing)||!positiveInt(v.denominator)||v.denominator===0||v.respondents+v.missing>v.denominator)issues.push("R3_INVALID_DENOMINATOR:"+i);
   if(v&&v.contains_identifiable_data===true)issues.push("R3_PERSONAL_DATA:"+i);
  });
 }
 if(r.report_type==="R4"){
  if(!Array.isArray(p.indicators))issues.push("R4_INDICATORS_TYPE");
  else p.indicators.forEach((v,i)=>{
   if(!v||!officialIndicators.has(v.indicator)||!validId(v.methodology_id)||!validId(v.source_version))return issues.push("R4_METADATA:"+i);
   if(v.indicator==="IGC"&&validId(r.course_code))issues.push("R4_IGC_INSTITUTION_SCOPE:"+i);
   if(v.indicator==="CONCEITO_ENADE"&&policy(r.edition_year,v.methodology_id).status!=="MATCH")issues.push("R4_UNVERIFIED_METHOD:"+i);
   if(v.status==="SC"&&(v.continuous_value!==null||v.band!==null))issues.push("R4_SC_AS_NUMBER:"+i);
   if(v.status!=="SC"&&v.status!=="PENDING"&&v.status!=="OFFICIAL")issues.push("R4_STATUS:"+i);
   if(v.status==="OFFICIAL"&&(!validId(v.source_version)||v.continuous_value===undefined))issues.push("R4_OFFICIAL_PROVENANCE:"+i);
  });
 }
 if(r.report_type==="R5"){
  if(!Array.isArray(p.comparisons))issues.push("R5_TYPE");
  else p.comparisons.forEach((v,i)=>{
   if(!v||!validId(v.class)||!validId(v.justification))return issues.push("R5_PROVENANCE:"+i);
   if(["C2","C4","CX"].includes(v.class)&&v.claimed_comparable===true)issues.push("R5_UNSAFE_COMPARISON:"+i);
   if(v.class==="C3"&&v.measure==="RAW_SCORE"&&v.claimed_comparable===true)issues.push("R5_CROSS_AREA_RAW_SCORE:"+i);
  });
 }
 if(r.report_type==="R6"){
  if(!Array.isArray(p.interventions))issues.push("R6_INTERVENTIONS_TYPE");
  else p.interventions.forEach((v,i)=>{
   if(!v||!validId(v.hypothesis)||!validId(v.action)||!Array.isArray(v.evidence_refs)||!v.evidence_refs.length||!Array.isArray(v.limitations)||!v.limitations.length)issues.push("R6_EVIDENCE_GAPS:"+i);
   if(v?.status==="APPROVED"&&(!validId(v.reviewed_by)||!validId(v.reviewed_at)))issues.push("R6_UNREVIEWED_ACTION:"+i);
  });
 }
 if(r.payload?.records!==undefined&&Array.isArray(r.payload.records))r.payload.records.forEach(ident);
 return issues;
}
module.exports={inspect};
