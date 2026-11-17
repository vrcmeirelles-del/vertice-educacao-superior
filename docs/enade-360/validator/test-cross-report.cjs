"use strict";
const assert=require("node:assert/strict");
const {validateCrossReport}=require("./cross-report-controls.cjs");
const {POLICIES}=require("./edition-controls.cjs");
const id=POLICIES[2023].id;
function report(type="R1"){return {report_type:type,edition_year:2023,academic_degree:"bacharelado",institution_code:"100",course_code:"200",area_code:"300",methodology_id:id,review_status:"PENDING",payload:{records:[]}};}
function row(){return {institution_code:"100",course_code:"200",area_code:"300",edition_year:2023,academic_degree:"bacharelado"};}
function rec(){return {...row(),indicator:"CONCEITO_ENADE",methodology_id:id,calculation_methodology_id:id,reference_version:"INEP-SYNTHETIC",official_value:"3.000",calculated_value:"3.000",status:"MATCH"};}
const tests=[];
function test(name,mutator,shouldPass=false,type="R1"){tests.push([name,()=>{const r=report(type);mutator(r);const errors=validateCrossReport(r);assert.equal(errors.length===0,shouldPass,errors.join(","));}]);}
test("valid_r1_identity",x=>x.payload.records.push(row()),true);
test("missing_institution",x=>{delete x.institution_code});
test("missing_course",x=>{delete x.course_code});
test("different_institution",x=>x.payload.records.push({...row(),institution_code:"999"}));
test("different_course",x=>x.payload.records.push({...row(),course_code:"999"}));
test("different_area",x=>x.payload.records.push({...row(),area_code:"999"}));
test("different_edition",x=>x.payload.records.push({...row(),edition_year:2022}));
test("different_degree",x=>x.payload.records.push({...row(),academic_degree:"licenciatura"}));
test("bad_records_container",x=>{x.payload.records="not array"});
test("valid_R7_match",x=>{x.payload={reconciliations:[rec()]};},true,"R7");
test("R7_without_reference",x=>{const y=rec();delete y.reference_version;x.payload={reconciliations:[y]};},false,"R7");
test("R7_mixed_course",x=>x.payload={reconciliations:[{...rec(),course_code:"201"}]},false,"R7");
test("R7_mixed_edition",x=>x.payload={reconciliations:[{...rec(),edition_year:2022}]},false,"R7");
test("R7_wrong_methodology",x=>x.payload={reconciliations:[{...rec(),methodology_id:"WRONG"}]},false,"R7");
test("R7_wrong_calculation_method",x=>x.payload={reconciliations:[{...rec(),calculation_methodology_id:"WRONG"}]},false,"R7");
test("R7_false_match",x=>x.payload={reconciliations:[{...rec(),calculated_value:"3.001"}]},false,"R7");
test("R7_SC_null",x=>x.payload={reconciliations:[{...rec(),status:"SC",official_value:null,calculated_value:null}]},true,"R7");
test("R7_SC_zero_rejected",x=>x.payload={reconciliations:[{...rec(),status:"SC",official_value:0,calculated_value:0}]},false,"R7");
test("R7_rounding_without_rule",x=>x.payload={reconciliations:[{...rec(),status:"ROUNDING_REVIEW",calculated_value:"3.001"}]},false,"R7");
test("R7_rounding_review",x=>x.payload={reconciliations:[{...rec(),status:"ROUNDING_REVIEW",calculated_value:"3.001",rounding:{mode:"DISPLAY",approved:true,digits:2,justification:"Synthetic display"}}]},true,"R7");
test("R7_wrong_degree",x=>x.payload={reconciliations:[{...rec(),academic_degree:"tecnologo"}]},false,"R7");
test("R7_unverified_indicator_match",x=>x.payload={reconciliations:[{...rec(),indicator:"CPC"}]},false,"R7");
test("stale_approved_reference",x=>{x.reference_superseded=true;x.review_status="APPROVED"});
test("valid_pending_stale_reference",x=>{x.reference_superseded=true;},true);
test("global_wrong_methodology",x=>{x.indicator="CONCEITO_ENADE";x.methodology_id="WRONG"});
test("valid_global_policy",x=>{x.indicator="CONCEITO_ENADE";},true);
let passed=0;for(const [name,run] of tests){try{run();passed++;console.log("PASS",name);}catch(e){console.error("FAIL",name,e.message);}}
console.log(JSON.stringify({suite:"cross-report",total:tests.length,passed,failed:tests.length-passed,node:process.version}));if(passed!==tests.length)process.exitCode=1;
