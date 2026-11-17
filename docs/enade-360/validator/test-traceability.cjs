"use strict";
const assert=require("node:assert/strict");
const {validateTrace,validateReportTraces}=require("./traceability-controls.cjs");
function trace(){
 return {trace_id:"T1",result_id:"RES1",indicator:"CONCEITO_ENADE",edition_year:2023,academic_degree:"bacharelado",
 area_code:"A1",institution_code:"I1",course_code:"C1",methodology_id:"M1",methodology_reference:"NT-2023",
 methodology_version:"v2023",engine_version:"synthetic-1",
 source_id:"SOURCE1",source_version:"v1",source_url:"https://www.gov.br/inep/",
 source_sha256:"a".repeat(64),retrieved_at:"2026-11-17T08:00:00Z",
 state:{kind:"AVAILABLE"},value:0,epistemic_label:"PEDAGOGICAL_HYPOTHESIS",
 evidence_refs:[],decision:{status:"PENDING"},publication_status:"DRAFT_ONLY"};
}
function report(){return {indicator:"CONCEITO_ENADE",edition_year:2023,academic_degree:"bacharelado",area_code:"A1",institution_code:"I1",course_code:"C1",methodology_id:"M1",traceability_version:"0.1",review_status:"PENDING",result_traces:[trace()]};}
const tests=[];
function ok(n,fn){tests.push([n,()=>assert.deepEqual(fn(),[])]);}
function bad(n,fn,error){tests.push([n,()=>assert(fn().some(x=>x.includes(error)),n+" expected "+error+" received "+fn())]);}
ok("valid_draft",()=>validateTrace(trace()));
ok("zero_is_valid",()=>validateReportTraces(report()));
bad("no_source_hash",()=>{let t=trace();t.source_sha256="";return validateTrace(t)},"TRACE_SOURCE_HASH");
bad("source_missing",()=>{let t=trace();delete t.source_id;return validateTrace(t)},"TRACE_MISSING:source_id");
bad("no_methodology_reference",()=>{let t=trace();t.methodology_reference="";return validateTrace(t)},"TRACE_TEXT:methodology_reference");
bad("no_edition",()=>{let t=trace();delete t.edition_year;return validateTrace(t)},"TRACE_EDITION");
bad("no_indicator",()=>{let t=trace();t.indicator="";return validateTrace(t)},"TRACE_TEXT:indicator");
bad("no_course",()=>{let t=trace();t.course_code="";return validateTrace(t)},"TRACE_TEXT:course_code");
bad("wrong_degree",()=>{let t=trace();t.academic_degree="licenciatura";return validateTrace(t)},"TRACE_DEGREE");
bad("missing_retrieval",()=>{let t=trace();t.retrieved_at="";return validateTrace(t)},"TRACE_RETRIEVAL_TIME");
bad("unsupported_fact",()=>{let t=trace();t.epistemic_label="OFFICIAL_FACT";return validateTrace(t)},"TRACE_UNSUPPORTED_FACT");
bad("reproduced_without_formula",()=>{let t=trace();t.epistemic_label="REPRODUCED_CALCULATION";t.evidence_refs=["source"];return validateTrace(t)},"TRACE_FORMULA_REQUIRED");
bad("non_numeric_missing",()=>{let t=trace();t.state={kind:"MISSING"};return validateTrace(t)},"TRACE_NONNUMERIC_VALUE");
bad("non_numeric_sc",()=>{let t=trace();t.state={kind:"SC"};return validateTrace(t)},"TRACE_NONNUMERIC_VALUE");
bad("wrong_state",()=>{let t=trace();t.state={kind:"UNKNOWN"};return validateTrace(t)},"TRACE_INVALID_STATE");
bad("publish_blocked",()=>{let t=trace();t.publication_status="PUBLISHED";return validateTrace(t)},"TRACE_PUBLICATION_BLOCKED");
bad("approval_without_signoff",()=>{let t=trace();t.decision.status="APPROVED";return validateTrace(t)},"TRACE_APPROVAL_EVIDENCE");
bad("approve_missing",()=>{let t=trace();t.state={kind:"MISSING"};t.value=null;t.decision={status:"APPROVED",reviewer_id:"R",reviewed_at:"2026-11-17T08:00:00Z",justification:"J",evidence_digest:"E"};return validateTrace(t)},"TRACE_NONAVAILABLE_APPROVAL");
bad("reject_without_reason",()=>{let t=trace();t.decision.status="REJECTED";return validateTrace(t)},"TRACE_REJECTION_REASON");
bad("approved_stale",()=>{let t=trace();t.source_superseded=true;t.decision={status:"APPROVED",reviewer_id:"R",reviewed_at:"2026-11-17T08:00:00Z",justification:"J",evidence_digest:"E"};return validateTrace(t)},"TRACE_STALE_SOURCE_APPROVAL");
bad("scope_mismatch",()=>validateTrace(trace(),{course_code:"OTHER"}),"TRACE_SCOPE_MISMATCH");
bad("no_trace_list",()=>{let r=report();delete r.result_traces;return validateReportTraces(r)},"TRACE_COLLECTION_REQUIRED");
bad("unsupported_version",()=>{let r=report();r.traceability_version="2";return validateReportTraces(r)},"TRACE_VERSION_UNSUPPORTED");
bad("duplicate_trace_id",()=>{let r=report();r.result_traces.push(trace());return validateReportTraces(r)},"TRACE_DUPLICATE_ID");
bad("report_approval_conflict",()=>{let r=report();r.review_status="APPROVED";return validateReportTraces(r)},"TRACE_REPORT_REVIEW_CONFLICT");
ok("legacy_remains_allowed_until_migration",()=>validateReportTraces({report_type:"R1"}));
ok("complete_human_approval",()=>{let t=trace();t.decision={status:"APPROVED",reviewer_id:"R",reviewed_at:"2026-11-17T08:00:00Z",justification:"Test",evidence_digest:"abc"};t.assumptions=["synthetic"];t.limitations=["no INEP records"];return validateTrace(t)});
bad("approved_hypothesis_no_limits",()=>{let t=trace();t.decision={status:"APPROVED",reviewer_id:"R",reviewed_at:"2026-11-17T08:00:00Z",justification:"Test",evidence_digest:"abc"};return validateTrace(t)},"TRACE_HYPOTHESIS_GAPS");
let pass=0;for(const [n,f] of tests){try{f();pass++;console.log("PASS",n)}catch(e){console.error("FAIL",n,e.message)}}
console.log(JSON.stringify({suite:"traceability",tests:tests.length,passed:pass,failed:tests.length-pass,node:process.version}));if(pass!==tests.length)process.exitCode=1;
