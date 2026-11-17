"use strict";
const assert=require("node:assert/strict");
const {run}=require("./integrated-gate.cjs");
function report(){
 return {report_id:"SYN-R1",report_type:"R1",schema_version:"0.3",generated_at:"2026-11-17T08:00:00Z",edition_year:2023,academic_degree:"bacharelado",area_code:"A1",area_name:"Synthetic",institution_code:"I1",course_code:"C1",
 methodology_id:"M1",methodology_url:"https://www.gov.br/inep/",engine_version:"1",dataset_hash:"a".repeat(64),
 sample_n:2,denominator:3,exclusion_counts:{},missing_counts:{},comparability_class:"C0",caveats:["Synthetic"],generated_by:"test",review_status:"PENDING",
 source_documents:[{url:"https://www.gov.br/inep/",document_title:"Synthetic",retrieval_date:"2026-11-17",sha256:"a".repeat(64),file_version:"v1"}],
 claims:[{claim_id:"C1",text:"Synthetic hypothesis",epistemic_label:"PEDAGOGICAL_HYPOTHESIS",validation_status:"PENDING",evidence_refs:[]}],
 payload:{inscribed:3,present:3,valid:2},
 traceability_version:"0.1",result_traces:[{trace_id:"T1",result_id:"RES1",indicator:"CONCEITO_ENADE",edition_year:2023,academic_degree:"bacharelado",area_code:"A1",institution_code:"I1",course_code:"C1",methodology_id:"M1",methodology_reference:"NT",methodology_version:"v1",engine_version:"1",source_id:"DOC",source_version:"v1",source_url:"https://www.gov.br/inep/",source_sha256:"a".repeat(64),retrieved_at:"2026-11-17T08:00:00Z",state:{kind:"AVAILABLE"},value:0,epistemic_label:"PEDAGOGICAL_HYPOTHESIS",evidence_refs:[],decision:{status:"PENDING"},publication_status:"DRAFT_ONLY"}]};
}
const tests=[
["valid_with_trace",r=>{},true],
["reject_wrong_course",r=>{r.result_traces[0].course_code="C2"},false],
["reject_publish",r=>{r.result_traces[0].publication_status="PUBLISHED"},false],
["reject_duplicate_trace",r=>{r.result_traces.push({...r.result_traces[0]})},false],
["reject_without_traces",r=>{r.result_traces=[]},false],
["legacy_without_trace_allowed",r=>{delete r.traceability_version;delete r.result_traces},true]
];
let passed=0;for(const [name,mutator,expected] of tests){try{const r=report();mutator(r);const v=run(r);assert.equal(v.ok,expected,JSON.stringify(v.errors));passed++;console.log("PASS",name)}catch(e){console.error("FAIL",name,e.message)}}
console.log(JSON.stringify({suite:"trace-integration",tests:tests.length,passed,failed:tests.length-passed,node:process.version}));if(passed!==tests.length)process.exitCode=1;
