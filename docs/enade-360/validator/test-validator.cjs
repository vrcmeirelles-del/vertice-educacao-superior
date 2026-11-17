"use strict";
// node test-validator.cjs — synthetic tests only
const {validateReport,conceptEligibility,filterStudents,compare,compareAllowed,reconcile,percentage,methodologyAccept,sourceRevision,stableSerialize}=require("./validator.cjs");
function assert(x,msg){if(!x)throw Error(msg);}
function fixture(){return {report_id:"TEST-R7",report_type:"R7",schema_version:"0.1",generated_at:"2026-11-16T00:00:00Z",edition_year:2022,academic_degree:"bacharelado",area_code:"TEST",area_name:"Sintética",methodology_id:"TEST-METH-2022",methodology_url:"https://www.gov.br/inep/",engine_version:"0.1",dataset_hash:"synthetic",sample_n:2,denominator:2,exclusion_counts:{},missing_counts:{},comparability_class:"C0",caveats:["Dados sintéticos"],generated_by:"synthetic-test",review_status:"PENDING",source_documents:[{url:"https://www.gov.br/inep/",document_title:"Teste sintético",retrieval_date:"2026-11-16",sha256:"a".repeat(64),file_version:"synthetic"}],claims:[{claim_id:"c1",text:"Hipótese sintética",epistemic_label:"PEDAGOGICAL_HYPOTHESIS",evidence_refs:[],validation_status:"PENDING"}]};}
const scenarios=[
["M01",()=>{const r=fixture();r.claims[0].epistemic_label="OFFICIAL_FACT";assert(!validateReport(r).ok,"source-free official claim accepted")}],
["M02",()=>assert(conceptEligibility(1)==="SC","one eligible person must be SC")],
["M03",()=>assert(conceptEligibility(2)==="ELIGIBLE_PENDING_OFFICIAL_CALCULATION","eligible is not homologated")],
["M04",()=>{const x=filterStudents([{regular:true,present:true},{regular:false,present:true}]);assert(x.accepted.length===1&&x.reasons.IRREGULAR===1,"filter count wrong")}],
["M05",()=>assert(!compareAllowed({degree:"bacharelado",area:"A"},{degree:"bacharelado",area:"B"},"RAW_SCORE").allowed,"cross-area raw score accepted")],
["M06",()=>assert(compare({degree:"bacharelado",area:"A",edition:2022,methodology:"v1",instrument:"v1"},{degree:"bacharelado",area:"A",edition:2023,methodology:"v2",instrument:"v2"})==="C2","rupture not flagged")],
["M07",()=>assert(compare({degree:"bacharelado",area:"A"},{degree:"licenciatura",area:"A"})==="C4","degrees merged")],
["M08",()=>{let r=fixture();r.edition_year=2026;r.official_publication=true;assert(validateReport(r).errors.includes("UNVERIFIED_PUBLICATION"),"unverified release accepted")}],
["M09",()=>{let x=reconcile(3,4);assert(x.status==="DIVERGENT"&&x.official===3&&x.computed===4,"values not preserved")}],
["M10",()=>{let x=percentage(39135,44156);assert(x.rounded===89&&x.rounded-87===2,"percentage reconciliation wrong")}],
["M11",()=>assert(methodologyAccept("2023-new","2022-old")===false,"wrong method accepted")],
["M12",()=>{let r=fixture();r.claims[0].causal=true;assert(!validateReport(r).ok,"unsupported causal claim accepted")}],
["M13",()=>{let r=fixture();delete r.denominator;delete r.missing_counts;assert(!validateReport(r).ok,"incomplete metadata accepted")}],
["M14",()=>{let a=fixture();let b={...a,claims:[...a.claims]};assert(stableSerialize(a)===stableSerialize(b),"non deterministic serialization")}],
["M15",()=>assert(conceptEligibility(1)==="SC"&&conceptEligibility(1)!==0,"SC converted to zero")],
["M16",()=>assert(sourceRevision("hash1","hash2")==="RECHECK_REQUIRED","source revision ignored")],
["M17",()=>{let r=fixture();r.report_type="R6";r.review_status="APPROVED";r.reviewed_by="X";r.reviewed_at="2026-11-16";r.claims[0].validation_status="VALIDATED";assert(validateReport(r).errors.includes("INTERVENTION_UNAPPROVED"),"unapproved intervention published")}],
["M18",()=>{let r=fixture();r.public_output=true;r.contains_individual_records=true;assert(validateReport(r).errors.includes("PRIVACY_BLOCK"),"individual records exposed")}],
["V01",()=>assert(validateReport(fixture()).ok,"baseline valid fixture rejected")],
["V02",()=>{let r=fixture();r.source_documents[0].sha256="wrong";assert(validateReport(r).errors.some(x=>x.includes("BAD_HASH")),"bad hash accepted")}]
];
let failed=0;
for(const [id,fn] of scenarios){try{fn();console.log(`PASS ${id}`);}catch(e){failed++;console.error(`FAIL ${id}: ${e.message}`);}}
console.log(`${scenarios.length-failed}/${scenarios.length} passing`);
if(failed)process.exitCode=1;
