"use strict";
const assert=require("node:assert/strict");
const {POLICIES,policy,select,conceptBand,roundDisplay,classifyDifference,classifyClaim}=require("./edition-controls.cjs");
const id22=POLICIES[2022].id,id23=POLICIES[2023].id;
const good={TP_INSCRICAO:1,IN_REGULAR:1,TP_INSCRICAO_ADM:0,TP_PRES:555};
const tests=[
["unknown_edition_blocks",()=>assert.equal(policy(2021,"anything").status,"POLICY_UNVERIFIED")],
["wrong_policy_blocks",()=>assert.equal(policy(2023,id22).status,"METHODOLOGY_MISMATCH")],
["one_valid_SC",()=>assert.equal(select([good],2023,id23).indicatorStatus,"SC")],
["zero_valid_SC",()=>assert.equal(select([],2023,id23).indicatorStatus,"SC")],
["two_valid_eligible_not_concept",()=>{const x=select([good,{...good,TP_INSCRICAO_ADM:2}],2023,id23);assert.equal(x.indicatorStatus,"ELIGIBLE_PENDING_CALCULATION");assert.equal(x.concept,undefined)}],
["missing_field_excluded",()=>assert.equal(select([{...good,TP_PRES:undefined}],2023,id23).reasons.MISSING_REQUIRED_FIELD,1)],
["invalid_student_type",()=>assert.equal(select([{...good,TP_INSCRICAO:0}],2023,id23).reasons.NOT_CONCLUDING,1)],
["irregular_student",()=>assert.equal(select([{...good,IN_REGULAR:0}],2023,id23).reasons.NOT_REGULAR,1)],
["wrong_admin_mode",()=>assert.equal(select([{...good,TP_INSCRICAO_ADM:1}],2023,id23).reasons.INVALID_ADMIN_MODE,1)],
["presence_333",()=>assert.equal(select([{...good,TP_PRES:333}],2023,id23).reasons.INVALID_PRESENCE,1)],
["presence_334",()=>assert.equal(select([{...good,TP_PRES:334}],2023,id23).reasons.INVALID_PRESENCE,1)],
["presence_556",()=>assert.equal(select([{...good,TP_PRES:556}],2023,id23).reasons.INVALID_PRESENCE,1)],
["presence_887",()=>assert.equal(select([{...good,TP_PRES:887}],2023,id23).reasons.INVALID_PRESENCE,1)],
["presence_888",()=>assert.equal(select([{...good,TP_PRES:888}],2023,id23).reasons.INVALID_PRESENCE,1)],
["editions_2022_and_2023",()=>{assert.equal(select([good,good],2022,id22).indicatorStatus,"ELIGIBLE_PENDING_CALCULATION");assert.equal(select([good,good],2023,id23).indicatorStatus,"ELIGIBLE_PENDING_CALCULATION")}],
["unverified_2021_filter_blocks",()=>assert.equal(select([good],2021,"?").status,"POLICY_UNVERIFIED")],
["band_2022_blocks",()=>assert.equal(conceptBand("2",2022,id22).status,"BAND_UNVERIFIED")],
["band_2023_left_threshold",()=>assert.deepEqual(conceptBand("0.944999",2023,id23),{status:"BAND",band:1})],
["band_2023_exact_threshold",()=>assert.deepEqual(conceptBand("0.945",2023,id23),{status:"BAND",band:2})],
["band_2023_final_threshold",()=>assert.deepEqual(conceptBand("3.945",2023,id23),{status:"BAND",band:5})],
["band_2023_maximum",()=>assert.equal(conceptBand("5",2023,id23).band,5)],
["band_out_of_range",()=>assert.equal(conceptBand("5.000001",2023,id23).status,"OUT_OF_RANGE")],
["band_invalid_value",()=>assert.equal(conceptBand("-1",2023,id23).status,"INVALID_SCORE")],
["half_up_edge",()=>assert.equal(roundDisplay("1.005",2),"101")],
["rounding_exact_match",()=>assert.equal(classifyDifference({official:"2.34",computed:"2.34",methodologyExpected:id23,methodologyActual:id23}).category,"EXACT_MATCH")],
["rounding_approved_review_not_accept",()=>assert.equal(classifyDifference({official:"2.344",computed:"2.343",methodologyExpected:id23,methodologyActual:id23,rounding:{mode:"DISPLAY",digits:2,approved:true,justification:"Exibição decimal sintética"}}).action,"REVIEW")],
["rounding_not_authorized_diverges",()=>assert.equal(classifyDifference({official:"2.344",computed:"2.343",methodologyExpected:id23,methodologyActual:id23,rounding:{mode:"DISPLAY",digits:2,approved:false,justification:"Sem aprovação"}}).category,"CALCULATION_DIVERGENCE")],
["tolerance_not_automatic",()=>assert.equal(classifyDifference({official:"2.345",computed:"2.346",methodologyExpected:id23,methodologyActual:id23}).category,"CALCULATION_DIVERGENCE")],
["different_edition_methodology",()=>assert.equal(classifyDifference({official:"3",computed:"3",methodologyExpected:id22,methodologyActual:id23}).category,"METHODOLOGY_DIFFERENCE")],
["missing_methodology_blocks",()=>assert.equal(classifyDifference({official:"2",computed:"2",methodologyExpected:id22}).action,"BLOCK")],
["not_numeric_blocks",()=>assert.equal(classifyDifference({official:"2.0",computed:"NaN",methodologyExpected:id23,methodologyActual:id23}).action,"BLOCK")],
["hypothesis_needs_limitations",()=>assert.equal(classifyClaim({epistemic_label:"PEDAGOGICAL_HYPOTHESIS",assumptions:["a"]}).action,"BLOCK")],
["hypothesis_needs_human",()=>assert.equal(classifyClaim({epistemic_label:"PEDAGOGICAL_HYPOTHESIS",assumptions:["a"],limitations:["b"]}).action,"HUMAN_REVIEW_REQUIRED")],
["calculation_not_hypothesis",()=>assert.equal(classifyClaim({epistemic_label:"REPRODUCED_CALCULATION"}).category,"NOT_PEDAGOGICAL_HYPOTHESIS")]
];
let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log("PASS",name);}catch(e){console.error("FAIL",name,e.message);}}
console.log(JSON.stringify({suite:"edition-controls",tests:tests.length,passed,failed:tests.length-passed,node:process.version}));
if(passed!==tests.length)process.exitCode=1;
