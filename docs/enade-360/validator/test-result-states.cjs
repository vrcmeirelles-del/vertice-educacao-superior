"use strict";
const assert=require("node:assert/strict");
const {checkState,checkReportStates}=require("./result-state-controls.cjs");
const {POLICIES}=require("./edition-controls.cjs");
const method=POLICIES[2023].id;
function sc(count=1){return {kind:"SC",continuous_value:null,band:null,valid_participants:count,reason:"Fewer than two eligible",methodology_id:method};}
function available(){return {kind:"AVAILABLE",continuous_value:0,source_version:"SYNTHETIC"};}
function r4(state,status="SC"){return {report_type:"R4",edition_year:2023,payload:{indicators:[{indicator:"CONCEITO_ENADE",methodology_id:method,source_version:"SYNTHETIC",status,continuous_value:null,band:null,value_state:state}]}};}
const tests=[];
function ok(name,fn){tests.push([name,()=>assert.deepEqual(fn(),[])]);}
function bad(name,fn,part){tests.push([name,()=>assert(fn().some(x=>x.includes(part)),name+" expected "+part+"; actual "+fn().join(","))]);}
ok("SC_one_valid",()=>checkState(sc(),{edition:2023,indicator:"CONCEITO_ENADE"}));
ok("SC_zero_valid",()=>checkState(sc(0),{edition:2023,indicator:"CONCEITO_ENADE"}));
bad("SC_two_not_allowed",()=>checkState(sc(2),{edition:2023,indicator:"CONCEITO_ENADE"}),"SC_COUNT_INCOMPATIBLE");
bad("SC_zero_not_numeric",()=>checkState({...sc(),continuous_value:0},{edition:2023,indicator:"CONCEITO_ENADE"}),"NON_NUMERIC_STATE_HAS_VALUE");
bad("SC_wrong_edition_method",()=>checkState(sc(),{edition:2022,indicator:"CONCEITO_ENADE"}),"SC_UNVERIFIED_METHODOLOGY");
bad("SC_other_indicator_unverified",()=>checkState(sc(),{edition:2023,indicator:"IDD"}),"SC_OTHER_INDICATOR_NOT_VERIFIED");
bad("SC_missing_count",()=>{const x=sc();delete x.valid_participants;return checkState(x,{edition:2023,indicator:"CONCEITO_ENADE"});},"SC_COUNT_REQUIRED");
bad("SC_missing_reason",()=>checkState({...sc(),reason:""},{edition:2023,indicator:"CONCEITO_ENADE"}),"SC_REASON_REQUIRED");
ok("available_true_zero",()=>checkState(available()));
bad("available_missing_source",()=>checkState({kind:"AVAILABLE",continuous_value:0}),"AVAILABLE_SOURCE_VERSION");
bad("available_missing_value",()=>checkState({kind:"AVAILABLE",source_version:"v"}),"AVAILABLE_NO_NUMERIC_VALUE");
ok("NA_documented",()=>checkState({kind:"NOT_APPLICABLE",reason:"Not in scope",applicability_rule_ref:"SOURCE"}));
bad("NA_unjustified",()=>checkState({kind:"NOT_APPLICABLE",reason:"Not in scope"}),"NA_JUSTIFICATION_REQUIRED");
bad("NA_not_zero",()=>checkState({kind:"NOT_APPLICABLE",reason:"Not in scope",applicability_rule_ref:"SOURCE",score:0}),"NON_NUMERIC_STATE_HAS_VALUE");
ok("missing_documented",()=>checkState({kind:"MISSING",missing_reason:"Not in received extract",expected_source:"INEP ZIP"}));
bad("missing_without_source",()=>checkState({kind:"MISSING",missing_reason:"None"}),"MISSING_PROVENANCE_REQUIRED");
ok("pending_documented",()=>checkState({kind:"PENDING",pending_dependency:"ZIP",next_verification:"After download"}));
bad("pending_without_followup",()=>checkState({kind:"PENDING",pending_dependency:"ZIP"}),"PENDING_TRACKING_REQUIRED");
ok("not_published_checked",()=>checkState({kind:"NOT_PUBLISHED",publication_source:"INEP results page",checked_at:"2026-11-17"}));
bad("not_published_no_check",()=>checkState({kind:"NOT_PUBLISHED",publication_source:"INEP"}),"PUBLICATION_CHECK_REQUIRED");
bad("unknown_state",()=>checkState({kind:"UNAVAILABLE"}),"STATE_UNKNOWN");
ok("R4_SC_valid",()=>checkReportStates(r4(sc())));
bad("R4_missing_state",()=>{const r=r4(sc());delete r.payload.indicators[0].value_state;return checkReportStates(r);},"INDICATOR_STATE_REQUIRED");
bad("R4_OFFICIAL_not_available",()=>checkReportStates(r4(sc(),"OFFICIAL")),"OFFICIAL_STATE_MISMATCH");
bad("R4_SC_conflicting_state",()=>checkReportStates(r4(available(),"SC")),"SC_STATUS_MISMATCH");
ok("R4_OFFICIAL_available_zero",()=>checkReportStates(r4(available(),"OFFICIAL")));
bad("R6_approved_missing_basis",()=>checkReportStates({report_type:"R6",edition_year:2023,payload:{interventions:[{status:"APPROVED",basis_state:{kind:"MISSING",missing_reason:"no data",expected_source:"INEP"}}]}}),"INTERVENTION_WITHOUT_RESULTS");
bad("R6_approved_NA_basis",()=>checkReportStates({report_type:"R6",edition_year:2023,payload:{interventions:[{status:"APPROVED",basis_state:{kind:"NOT_APPLICABLE",reason:"outside scope",applicability_rule_ref:"NT"}}]}}),"INTERVENTION_WITHOUT_RESULTS");
ok("R6_draft_missing_basis",()=>checkReportStates({report_type:"R6",edition_year:2023,payload:{interventions:[{status:"DRAFT",basis_state:{kind:"MISSING",missing_reason:"no data",expected_source:"INEP"}}]}}));
let passed=0;for(const [n,fn] of tests){try{fn();passed++;console.log("PASS",n);}catch(e){console.error("FAIL",n,e.message);}}
console.log(JSON.stringify({suite:"result-states",tests:tests.length,passed,failed:tests.length-passed,node:process.version}));if(passed!==tests.length)process.exitCode=1;
