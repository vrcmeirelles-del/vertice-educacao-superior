"use strict";
const assert=require("node:assert/strict");
const {validateReport,TYPES}=require("./schema-validator.cjs");
function fixture(type="R1"){
const payload={R1:{inscribed:5,present:4,valid:3},R2:{general_formation:{},specific_component:{}},R3:{questionnaire_categories:[]},R4:{indicators:[]},R5:{comparisons:[]},R6:{interventions:[]},R7:{reconciliations:[]}};
return {report_id:"SYNTHETIC-1",report_type:type,schema_version:"0.2",generated_at:"2026-11-16T00:00:00Z",edition_year:2022,academic_degree:"bacharelado",area_code:"TEST",area_name:"Teste sintético",methodology_id:"synthetic",methodology_url:"https://www.gov.br/inep/",engine_version:"0.2",dataset_hash:"0".repeat(64),sample_n:3,denominator:5,exclusion_counts:{},missing_counts:{},comparability_class:"C0",caveats:[],generated_by:"test",review_status:"PENDING",source_documents:[{url:"https://www.gov.br/inep/",document_title:"Sintético",retrieval_date:"2026-11-16",file_version:"test",sha256:"a".repeat(64)}],claims:[{claim_id:"C1",text:"Hipótese sintética",epistemic_label:"PEDAGOGICAL_HYPOTHESIS",validation_status:"PENDING",evidence_refs:[]}],payload:payload[type]};
}
const tests=[];
for(const type of Object.keys(TYPES))tests.push(["valid_"+type,()=>assert.equal(validateReport(fixture(type)).ok,true)]);
for(const key of ["source_documents","sample_n","denominator","missing_counts","methodology_id","payload","claims"])tests.push(["missing_"+key,()=>{const r=fixture();delete r[key];assert.equal(validateReport(r).ok,false)}]);
tests.push(["hash_rejected",()=>{const r=fixture();r.source_documents[0].sha256="INVALID";assert.equal(validateReport(r).ok,false)}]);
tests.push(["fake_official_claim",()=>{const r=fixture();r.claims[0].epistemic_label="OFFICIAL_FACT";assert.equal(validateReport(r).ok,false)}]);
tests.push(["calculation_without_formula",()=>{const r=fixture();r.claims[0].epistemic_label="REPRODUCED_CALCULATION";r.claims[0].evidence_refs=["doc"];assert.equal(validateReport(r).ok,false)}]);
tests.push(["invalid_population",()=>{const r=fixture();r.sample_n=10;assert.equal(validateReport(r).ok,false)}]);
tests.push(["missing_type_payload",()=>{const r=fixture("R7");delete r.payload.reconciliations;assert.equal(validateReport(r).ok,false)}]);
tests.push(["false_match",()=>{const r=fixture("R7");r.payload.reconciliations=[{status:"MATCH",official_value:3,calculated_value:4}];assert.equal(validateReport(r).ok,false)}]);
tests.push(["causality",()=>{const r=fixture();r.claims[0].causal=true;assert.equal(validateReport(r).ok,false)}]);
tests.push(["incomplete_review",()=>{const r=fixture();r.review_status="APPROVED";assert.equal(validateReport(r).ok,false)}]);
tests.push(["unapproved_intervention",()=>{const r=fixture("R6");r.review_status="APPROVED";r.reviewed_by="Reviewer";r.reviewed_at="2026-11-16";r.claims[0].validation_status="VALIDATED";assert.equal(validateReport(r).ok,false)}]);
tests.push(["personal_data",()=>{const r=fixture();r.public_output=true;r.contains_individual_records=true;assert.equal(validateReport(r).ok,false)}]);
tests.push(["methodological_incompatibility",()=>{const r=fixture("R5");r.comparability_class="C4";r.claims[0].validation_status="VALIDATED";r.claims[0].comparison_assertion=true;assert.equal(validateReport(r).ok,false)}]);
tests.push(["unverified_publication",()=>{const r=fixture();r.edition_year=2026;r.official_publication=true;assert.equal(validateReport(r).ok,false)}]);
let failures=0;for(const [name,run] of tests){try{run();console.log("PASS",name)}catch(e){failures++;console.log("FAIL",name,e.message)}}console.log(JSON.stringify({tests:tests.length,passed:tests.length-failures,failed:failures,node:process.version}));if(failures)process.exitCode=1;
