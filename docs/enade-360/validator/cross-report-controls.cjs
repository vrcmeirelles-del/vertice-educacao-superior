"use strict";
// ENADE 360 cross-report guards; no official indicator calculation.
// Optional identity for R1-R6; R7 rows always demand complete keys.
const {policy,classifyDifference}=require("./edition-controls.cjs");
const identityFields=["institution_code","course_code","area_code","edition_year","academic_degree"];
function nonempty(v){return typeof v==="string"&&v.trim().length>0;}
function normalize(v){return v===undefined||v===null?"":String(v);}
function reportIdentity(r){
 const e=[];
 const hasIdentity=nonempty(r?.course_code)||nonempty(r?.institution_code);
 if(hasIdentity){
   for(const k of ["institution_code","course_code","area_code"])if(!nonempty(r[k]))e.push("IDENTITY_MISSING:"+k);
   if(r.academic_degree!=="bacharelado")e.push("IDENTITY_DEGREE");
 }
 return e;
}
function validateCourseRecords(r){
 const errors=[...reportIdentity(r)];
 const records=r?.payload?.records;
 if(records===undefined)return errors;
 if(!Array.isArray(records))return [...errors,"COURSE_RECORDS_INVALID"];
 if(!nonempty(r.course_code)||!nonempty(r.institution_code))errors.push("COURSE_SCOPE_REQUIRED");
 for(const [i,row] of records.entries()){
   if(!row||typeof row!=="object"){errors.push("RECORD_INVALID:"+i);continue;}
   for(const k of identityFields){
     if(normalize(row[k])!==normalize(r[k]))errors.push("CROSS_COURSE_OR_EDITION:"+i+":"+k);
   }
 }
 return errors;
}
function validateReconciliation(r){
 const errors=[];
 if(r?.report_type!=="R7")return errors;
 const rows=r?.payload?.reconciliations;
 if(!Array.isArray(rows))return ["RECONCILIATIONS_REQUIRED"];
 for(const [i,row] of rows.entries()){
   if(!row||typeof row!=="object"){errors.push("ROW_INVALID:"+i);continue;}
   for(const k of ["institution_code","course_code","area_code","indicator","methodology_id","reference_version"]){
     if(!nonempty(row[k]))errors.push("R7_MISSING:"+i+":"+k);
   }
   if(!Number.isInteger(row.edition_year)||row.edition_year!==r.edition_year)errors.push("R7_EDITION:"+i);
   if(row.academic_degree!=="bacharelado")errors.push("R7_DEGREE:"+i);
   for(const k of ["institution_code","course_code","area_code"])if(nonempty(r[k])&&normalize(row[k])!==normalize(r[k]))errors.push("R7_IDENTITY_MISMATCH:"+i+":"+k);
   if(row.indicator==="CONCEITO_ENADE"){
     const p=policy(row.edition_year,row.methodology_id);
     if(p.status!=="MATCH")errors.push("R7_METHOD_POLICY:"+i+":"+p.status);
   }else if(row.status==="MATCH")errors.push("R7_INDICATOR_UNVERIFIED:"+i);
   if(row.status==="SC"){
     if(row.official_value!==null||row.calculated_value!==null)errors.push("R7_SC_NOT_NULL:"+i);
     continue;
   }
   if(row.status==="MATCH"){
     const diff=classifyDifference({official:row.official_value,computed:row.calculated_value,methodologyExpected:row.methodology_id,methodologyActual:row.calculation_methodology_id});
     if(diff.category!=="EXACT_MATCH")errors.push("R7_FALSE_MATCH:"+i+":"+diff.category);
   }else if(row.status==="ROUNDING_REVIEW"){
     const diff=classifyDifference({official:row.official_value,computed:row.calculated_value,methodologyExpected:row.methodology_id,methodologyActual:row.calculation_methodology_id,rounding:row.rounding});
     if(diff.category!=="DISPLAY_ROUNDING_DIFFERENCE")errors.push("R7_UNJUSTIFIED_ROUNDING:"+i);
   }else if(row.status==="DIVERGENT"){
     if(row.official_value===undefined||row.calculated_value===undefined)errors.push("R7_MISSING_VALUES:"+i);
   }else errors.push("R7_UNKNOWN_STATUS:"+i);
 }
 return errors;
}
function validateVersion(r){
 const errors=[];
 if(r?.edition_year&&r?.indicator==="CONCEITO_ENADE"){
   const p=policy(r.edition_year,r.methodology_id);
   if(p.status!=="MATCH")errors.push("REPORT_METHOD_POLICY:"+p.status);
 }
 if(r?.reference_superseded===true&&r.review_status==="APPROVED")errors.push("STALE_REFERENCE_APPROVAL");
 return errors;
}
function validateCrossReport(r){return [...validateCourseRecords(r),...validateReconciliation(r),...validateVersion(r)];}
module.exports={validateCourseRecords,validateReconciliation,validateVersion,validateCrossReport};
