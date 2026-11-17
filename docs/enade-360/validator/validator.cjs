"use strict";
// Standalone synthetic contract validator; NOT an official INEP calculator.
function validateReport(r){
 const errors=[];
 if(!r || typeof r!=="object"||Array.isArray(r))return {ok:false,errors:["REPORT_OBJECT_REQUIRED"]};
 for(const k of ["report_id","report_type","schema_version","generated_at","edition_year","academic_degree","area_code","area_name","methodology_id","methodology_url","engine_version","dataset_hash","sample_n","exclusion_counts","missing_counts","comparability_class","caveats","generated_by","review_status","source_documents","claims"]){if(r[k]===undefined||r[k]===null)errors.push("REQUIRED:"+k);}
 if(!["R1","R2","R3","R4","R5","R6","R7"].includes(r.report_type))errors.push("INVALID_REPORT_TYPE");
 if(!Number.isInteger(r.edition_year)||r.edition_year<2004)errors.push("INVALID_EDITION");
 if(!Number.isInteger(r.sample_n)||r.sample_n<0)errors.push("INVALID_SAMPLE_N");
 for(const k of ["exclusion_counts","missing_counts"])if(!r[k]||typeof r[k]!=="object"||Array.isArray(r[k]))errors.push("INVALID:"+k);
 if(!Array.isArray(r.caveats))errors.push("CAVEATS_REQUIRED");
 if(!Array.isArray(r.source_documents)||r.source_documents.length===0)errors.push("NO_SOURCE_DOCUMENTS");
 else for(const [i,s] of r.source_documents.entries()){for(const k of ["url","document_title","retrieval_date","sha256","file_version"])if(!s||typeof s[k]!=="string"||!s[k].trim())errors.push(`SOURCE_${i}_REQUIRED:${k}`);if(s&&typeof s.sha256==="string"&&!/^[0-9a-f]{64}$/i.test(s.sha256))errors.push(`SOURCE_${i}_BAD_HASH`);}
 if(!Array.isArray(r.claims))errors.push("CLAIMS_REQUIRED");
 else for(const [i,c] of r.claims.entries()){
   if(!c||!c.claim_id||!c.text||!["OFFICIAL_FACT","REPRODUCED_CALCULATION","STATISTICAL_INFERENCE","PEDAGOGICAL_HYPOTHESIS","ACTION_PROPOSAL"].includes(c.epistemic_label))errors.push(`CLAIM_${i}_INVALID`);
   if(!c||!Array.isArray(c.evidence_refs))errors.push(`CLAIM_${i}_EVIDENCE_FORMAT`);
   else if(["OFFICIAL_FACT","REPRODUCED_CALCULATION"].includes(c.epistemic_label)&&c.evidence_refs.length===0)errors.push(`CLAIM_${i}_NO_EVIDENCE`);
   if(c&&c.epistemic_label==="REPRODUCED_CALCULATION"&&!c.calculation_formula)errors.push(`CLAIM_${i}_NO_FORMULA`);
   if(c&&c.causal===true&&!c.causal_design_verified)errors.push(`CLAIM_${i}_CAUSAL_UNSUPPORTED`);
   if(c&&!["PENDING","VALIDATED","REJECTED"].includes(c.validation_status))errors.push(`CLAIM_${i}_BAD_STATUS`);
 }
 if(r.review_status==="APPROVED"&&(!r.reviewed_by||!r.reviewed_at||r.claims.some(c=>c.validation_status!=="VALIDATED")))errors.push("REVIEW_INCOMPLETE");
 if(r.review_status==="APPROVED"&&r.report_type==="R6"&&!r.human_intervention_approval)errors.push("INTERVENTION_UNAPPROVED");
 if(r.public_output&&r.contains_individual_records)errors.push("PRIVACY_BLOCK");
 if(r.official_publication===true&&r.edition_year>=2026&&!r.publication_verified)errors.push("UNVERIFIED_PUBLICATION");
 if(r.denominator===undefined||r.denominator===null||r.denominator===0)errors.push("DENOMINATOR_REQUIRED");
 return {ok:errors.length===0,errors};
}

function conceptEligibility(validCount,minimum=2){if(!Number.isInteger(validCount)||validCount<0)throw Error("INVALID_COUNT");return validCount<minimum?"SC":"ELIGIBLE_PENDING_OFFICIAL_CALCULATION";}

function filterStudents(students){const reasons={};const accepted=[];for(const s of students){let cause=s.regular!==true?"IRREGULAR":s.present!==true?"NOT_PRESENT":null;if(cause)reasons[cause]=(reasons[cause]||0)+1;else accepted.push(s);}return {accepted,reasons};}

function compare(a,b){if(a.degree!==b.degree)return "C4";if(a.area!==b.area)return "C3";if(a.edition===b.edition&&a.instrument===b.instrument)return "C0";if(!a.methodology||!b.methodology)return "CX";return a.methodology===b.methodology&&a.instrument===b.instrument?"C1":"C2";}

function compareAllowed(a,b,metric){const cls=compare(a,b);return {cls,allowed:!["C4","CX"].includes(cls)&&!(cls==="C3"&&metric==="RAW_SCORE")&&cls!=="C2"};}

function reconcile(official,computed){const diff=+(computed-official).toFixed(8);return {official,computed,difference:diff,status:diff===0?"MATCH":"DIVERGENT"};}

function percentage(n,d){if(!Number.isInteger(n)||!Number.isInteger(d)||d<=0||n<0||n>d)throw Error("INVALID_DENOMINATOR");return {exact:100*n/d,rounded:Math.round(100*n/d)};}

function methodologyAccept(expected,actual){return expected===actual;}

function sourceRevision(previous,current){return previous===current?"UNCHANGED":"RECHECK_REQUIRED";}

function stableSerialize(x){if(Array.isArray(x))return "["+x.map(stableSerialize).join(",")+"]";if(x&&typeof x==="object")return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+stableSerialize(x[k])).join(",")+"}";return JSON.stringify(x);}

module.exports={validateReport,conceptEligibility,filterStudents,compare,compareAllowed,reconcile,percentage,methodologyAccept,sourceRevision,stableSerialize};
