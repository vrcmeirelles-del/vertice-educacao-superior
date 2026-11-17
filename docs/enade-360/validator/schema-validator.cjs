"use strict";
// ENADE 360 synthetic contract gate v0.2; NOT an INEP calculation engine.
const TYPES={R1:["inscribed","present","valid"],R2:["general_formation","specific_component"],R3:["questionnaire_categories"],R4:["indicators"],R5:["comparisons"],R6:["interventions"],R7:["reconciliations"]};
const REQUIRED=["report_id","report_type","schema_version","generated_at","edition_year","academic_degree","area_code","area_name","methodology_id","methodology_url","engine_version","dataset_hash","sample_n","denominator","exclusion_counts","missing_counts","comparability_class","caveats","generated_by","review_status","source_documents","claims","payload"];
const LABELS=["OFFICIAL_FACT","REPRODUCED_CALCULATION","STATISTICAL_INFERENCE","PEDAGOGICAL_HYPOTHESIS","ACTION_PROPOSAL"];
const {isInstitutionReport}=require("./contract-integrity.cjs");
function validateReport(r){
const e=[];
if(!r||typeof r!=="object"||Array.isArray(r))return {ok:false,errors:["REPORT_OBJECT_REQUIRED"]};
for(const k of REQUIRED)if(r[k]===undefined||(r[k]===null&&!(isInstitutionReport(r)&&["area_code","academic_degree"].includes(k))))e.push("REQUIRED:"+k);
if(!(r.report_type in TYPES))e.push("REPORT_TYPE");
if(!Number.isInteger(r.edition_year)||r.edition_year<2004)e.push("EDITION");
if(r.academic_degree!=="bacharelado"&&!(isInstitutionReport(r)&&r.academic_degree===null))e.push("DEGREE");
if(!Number.isInteger(r.sample_n)||r.sample_n<0||!Number.isInteger(r.denominator)||r.denominator<=0||r.sample_n>r.denominator)e.push("POPULATION");
for(const k of ["exclusion_counts","missing_counts"])if(!r[k]||typeof r[k]!=="object"||Array.isArray(r[k])||Object.values(r[k]).some(v=>!Number.isInteger(v)||v<0))e.push("COUNTS:"+k);
if(!Array.isArray(r.source_documents)||!r.source_documents.length)e.push("SOURCE");else for(const s of r.source_documents){for(const k of ["url","document_title","retrieval_date","file_version"])if(!s[k]||typeof s[k]!=="string")e.push("SOURCE_FIELD:"+k);if(!/^[a-f0-9]{64}$/i.test(s.sha256||""))e.push("SOURCE_HASH");}
if(!Array.isArray(r.caveats))e.push("CAVEATS");
if(!Array.isArray(r.claims))e.push("CLAIMS");else for(const c of r.claims){if(!c.claim_id||!c.text||!LABELS.includes(c.epistemic_label)||!["PENDING","VALIDATED","REJECTED"].includes(c.validation_status))e.push("CLAIM_SHAPE");if(!Array.isArray(c.evidence_refs)||(["OFFICIAL_FACT","REPRODUCED_CALCULATION"].includes(c.epistemic_label)&&!c.evidence_refs.length))e.push("EVIDENCE");if(c.epistemic_label==="REPRODUCED_CALCULATION"&&!c.calculation_formula)e.push("FORMULA");if(c.causal===true&&!c.causal_design_verified)e.push("CAUSAL");}
if(!r.payload||typeof r.payload!=="object"||Array.isArray(r.payload))e.push("PAYLOAD");else if(r.report_type in TYPES)for(const k of TYPES[r.report_type])if(r.payload[k]===undefined||r.payload[k]===null)e.push("PAYLOAD:"+k);
if(r.report_type==="R7"&&Array.isArray(r.payload?.reconciliations))for(const q of r.payload.reconciliations)if(q.status==="MATCH"&&(!Number.isFinite(q.official_value)||!Number.isFinite(q.calculated_value)||q.official_value!==q.calculated_value))e.push("FALSE_MATCH");
if(r.review_status==="APPROVED"&&(!r.reviewed_by||!r.reviewed_at||r.claims?.some(c=>c.validation_status!=="VALIDATED")))e.push("REVIEW");
if(r.report_type==="R6"&&r.review_status==="APPROVED"&&!r.human_intervention_approval)e.push("INTERVENTION");
if(r.public_output&&r.contains_individual_records)e.push("PRIVACY");
if(r.official_publication&&r.edition_year>=2026&&!r.publication_verified)e.push("PUBLICATION");
if(["C2","C4","CX"].includes(r.comparability_class)&&r.claims?.some(c=>c.validation_status==="VALIDATED"&&c.comparison_assertion))e.push("COMPARABILITY");
return {ok:e.length===0,errors:e};
}
module.exports={validateReport,TYPES,REQUIRED,LABELS};
