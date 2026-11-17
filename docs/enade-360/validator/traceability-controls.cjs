"use strict";
/* ENADE 360 — versioned traceability envelope. Synthetic protocol; no official calculation.
 * One result -> one immutable source-version/method/indicator/edition chain.
 * No automatic publication, inference of authenticity, or approval.
 */
const HEX=/^[a-f0-9]{64}$/i;
const STATES=new Set(["AVAILABLE","SC","NOT_APPLICABLE","MISSING","PENDING","NOT_PUBLISHED"]);
const LABELS=new Set(["OFFICIAL_FACT","REPRODUCED_CALCULATION","STATISTICAL_INFERENCE","PEDAGOGICAL_HYPOTHESIS","ACTION_PROPOSAL"]);
const isText=x=>typeof x==="string"&&x.trim().length>0;
const has=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const isIso=x=>isText(x)&&!Number.isNaN(Date.parse(x))&&/^\d{4}-\d{2}-\d{2}T/.test(x);
function validateTrace(t,scope={}){
 const e=[];
 if(!t||typeof t!=="object"||Array.isArray(t))return ["TRACE_REQUIRED"];
 for(const k of ["trace_id","result_id","indicator","area_code","institution_code","course_code","methodology_id","methodology_reference","methodology_version","engine_version","source_id","source_version","source_url","source_sha256","retrieved_at","state","epistemic_label","evidence_refs","decision","publication_status"]){
  if(!has(t,k)||(t[k]===null&&!(t.indicator==="IGC"&&["course_code","area_code"].includes(k))))e.push("TRACE_MISSING:"+k);
 }
 for(const k of ["trace_id","result_id","indicator","methodology_id","methodology_reference","methodology_version","engine_version","source_id","source_version","source_url","institution_code","course_code","area_code"])
  if(!isText(t[k])&&!(t.indicator==="IGC"&&["course_code","area_code"].includes(k)&&t[k]===null))e.push("TRACE_TEXT:"+k);
 if(t.indicator==="IGC"&&(t.course_code!==null||t.area_code!==null))e.push("TRACE_IGC_INSTITUTION_SCOPE");
 if(!Number.isInteger(t.edition_year)||t.edition_year<2004)e.push("TRACE_EDITION");
 if(t.academic_degree!=="bacharelado"&&!(t.indicator==="IGC"&&t.academic_degree===null))e.push("TRACE_DEGREE");
 if(!HEX.test(t.source_sha256||""))e.push("TRACE_SOURCE_HASH");
 if(!isIso(t.retrieved_at))e.push("TRACE_RETRIEVAL_TIME");
 if(!STATES.has(t.state?.kind))e.push("TRACE_INVALID_STATE");
 if(!LABELS.has(t.epistemic_label))e.push("TRACE_BAD_LABEL");
 if(!Array.isArray(t.evidence_refs))e.push("TRACE_EVIDENCE_REFS");
 else if(["OFFICIAL_FACT","REPRODUCED_CALCULATION"].includes(t.epistemic_label)&&t.evidence_refs.length===0)e.push("TRACE_UNSUPPORTED_FACT");
 if(t.epistemic_label==="REPRODUCED_CALCULATION"&&!isText(t.calculation_formula))e.push("TRACE_FORMULA_REQUIRED");
 if(t.state?.kind==="AVAILABLE"&&!Number.isFinite(t.value))e.push("TRACE_AVAILABLE_VALUE_MISSING");
 if(t.state?.kind!=="AVAILABLE"&&t.value!==null&&t.value!==undefined)e.push("TRACE_NONNUMERIC_VALUE");
 for(const k of ["indicator","institution_code","course_code","area_code","edition_year","academic_degree","methodology_id"])
  if(has(scope,k)&&scope[k]!==undefined&&String(scope[k])!==String(t[k]))e.push("TRACE_SCOPE_MISMATCH:"+k);
 const d=t.decision;
 if(!d||typeof d!=="object")e.push("TRACE_DECISION_REQUIRED");
 else{
  if(!["PENDING","APPROVED","REJECTED"].includes(d.status))e.push("TRACE_DECISION_STATUS");
  if(d.status==="APPROVED"){
   if(!isText(d.reviewer_id)||!isIso(d.reviewed_at)||!isText(d.justification)||!isText(d.evidence_digest))e.push("TRACE_APPROVAL_EVIDENCE");
   if(t.state?.kind!=="AVAILABLE")e.push("TRACE_NONAVAILABLE_APPROVAL");
  }
  if(d.status==="REJECTED"&&!isText(d.justification))e.push("TRACE_REJECTION_REASON");
 }
 if(t.publication_status!=="DRAFT_ONLY")e.push("TRACE_PUBLICATION_BLOCKED");
 if(t.source_superseded===true&&d?.status==="APPROVED")e.push("TRACE_STALE_SOURCE_APPROVAL");
 if(t.decision?.status==="APPROVED"&&t.epistemic_label==="PEDAGOGICAL_HYPOTHESIS"&&(!Array.isArray(t.assumptions)||!t.assumptions.length||!Array.isArray(t.limitations)||!t.limitations.length))e.push("TRACE_HYPOTHESIS_GAPS");
 return [...new Set(e)];
}
function validateReportTraces(r){
 if(!r||typeof r!=="object")return ["TRACE_REPORT_INVALID"];
 // Opt-in envelope until R0-R7 migration; no claim that legacy reports are traced.
 if(r.traceability_version===undefined)return r.schema_version==="0.4"&&r.report_type==="R4"&&r.payload?.indicators?.some(v=>v?.status==="OFFICIAL")?["TRACE_OFFICIAL_REQUIRED"]:[];
 if(r.traceability_version!=="0.1")return ["TRACE_VERSION_UNSUPPORTED"];
 if(!Array.isArray(r.result_traces)||r.result_traces.length===0)return ["TRACE_COLLECTION_REQUIRED"];
 const e=[],seen=new Set();
 for(const [i,t] of r.result_traces.entries()){
  const problems=validateTrace(t,r);
  e.push(...problems.map(p=>"TRACE_"+i+"_"+p));
  if(t&&seen.has(t.trace_id))e.push("TRACE_DUPLICATE_ID:"+i);
  if(t)seen.add(t.trace_id);
 }
 if(r.review_status==="APPROVED"&&r.result_traces.some(t=>t?.decision?.status!=="APPROVED"))e.push("TRACE_REPORT_REVIEW_CONFLICT");
 return e;
}
module.exports={validateTrace,validateReportTraces};
