"use strict";
const assert=require("node:assert/strict");
const {inspect}=require("./r2-r6-controls.cjs");
function base(type){return {report_type:type,edition_year:2023,academic_degree:"bacharelado",institution_code:"IES-1",course_code:"COURSE-1",area_code:"AREA-1",methodology_id:"METH-1",payload:{
R2:{general_formation:{methodology_id:"METH-1",unit:"points",n:4},specific_component:{methodology_id:"METH-1",unit:"points",n:4}},
R3:{questionnaire_categories:[{question_id:"Q1",respondents:4,missing:1,denominator:5}]},
R4:{indicators:[{indicator:"IDD",methodology_id:"SYN-IDD",source_version:"synthetic-v1",status:"PENDING"}]},
R5:{comparisons:[{class:"C0",justification:"Same edition and method",claimed_comparable:true}]},
R6:{interventions:[{hypothesis:"Synthetic hypothesis",action:"Review instructional practice",evidence_refs:["SYN-1"],limitations:["No real IES data"],status:"DRAFT"}]}
}[type]};}
const tests=[];
for(const type of ["R2","R3","R4","R5","R6"])tests.push(["valid_"+type,()=>assert.deepEqual(inspect(base(type)),[])]);
function bad(name,type,fn,prefix){tests.push([name,()=>{const x=base(type);fn(x);const e=inspect(x);assert(e.some(y=>y.startsWith(prefix)),"Expected "+prefix+"; got "+e.join(","));}]);}
bad("r2_missing_component_n","R2",r=>delete r.payload.general_formation.n,"R2_COMPONENT_METADATA");
bad("r2_method_mismatch","R2",r=>r.payload.specific_component.methodology_id="OTHER","R2_METHOD_MISMATCH");
bad("r2_missing_specific_component","R2",r=>delete r.payload.specific_component,"MISSING_PAYLOAD");
bad("r3_wrong_population","R3",r=>r.payload.questionnaire_categories[0].missing=4,"R3_INVALID_DENOMINATOR");
bad("r3_negative_missing","R3",r=>r.payload.questionnaire_categories[0].missing=-1,"R3_INVALID_DENOMINATOR");
bad("r3_identifiable","R3",r=>r.payload.questionnaire_categories[0].contains_identifiable_data=true,"R3_PERSONAL_DATA");
bad("r4_sc_as_zero","R4",r=>r.payload.indicators=[{indicator:"IDD",methodology_id:"SYN",source_version:"v1",status:"SC",continuous_value:0,band:0}],"R4_SC_AS_NUMBER");
bad("r4_invalid_indicator","R4",r=>r.payload.indicators[0].indicator="FAKE","R4_METADATA");
bad("r4_enade_wrong_policy","R4",r=>r.payload.indicators=[{indicator:"CONCEITO_ENADE",methodology_id:"WRONG",source_version:"v1",status:"PENDING"}],"R4_UNVERIFIED_METHOD");
bad("r4_igc_course_scope","R4",r=>r.payload.indicators=[{indicator:"IGC",methodology_id:"SYN",source_version:"v1",status:"PENDING"}],"R4_IGC_INSTITUTION_SCOPE");
bad("r5_rupture_claimed_comparable","R5",r=>r.payload.comparisons[0].class="C2","R5_UNSAFE_COMPARISON");
bad("r5_unknown_claimed_comparable","R5",r=>r.payload.comparisons[0].class="CX","R5_UNSAFE_COMPARISON");
bad("r5_cross_area_raw","R5",r=>{r.payload.comparisons[0].class="C3";r.payload.comparisons[0].measure="RAW_SCORE";},"R5_CROSS_AREA_RAW_SCORE");
bad("r5_no_justification","R5",r=>delete r.payload.comparisons[0].justification,"R5_PROVENANCE");
bad("r6_no_evidence","R6",r=>r.payload.interventions[0].evidence_refs=[],"R6_EVIDENCE_GAPS");
bad("r6_no_limitations","R6",r=>r.payload.interventions[0].limitations=[],"R6_EVIDENCE_GAPS");
bad("r6_unapproved","R6",r=>r.payload.interventions[0].status="APPROVED","R6_UNREVIEWED_ACTION");
bad("r2_mixed_course","R2",r=>r.payload.records=[{institution_code:"IES-1",course_code:"DIFFERENT",area_code:"AREA-1",edition_year:2023,academic_degree:"bacharelado"}],"IDENTITY_MISMATCH");
let passed=0;
for(const [name,fn] of tests){try{fn();passed++;console.log("PASS",name);}catch(e){console.error("FAIL",name,e.message);}}
console.log(JSON.stringify({suite:"r2-r6-controls",tests:tests.length,passed,failed:tests.length-passed,node:process.version}));if(passed!==tests.length)process.exitCode=1;
