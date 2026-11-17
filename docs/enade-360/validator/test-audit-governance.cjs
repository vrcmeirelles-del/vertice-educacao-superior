"use strict";
const assert=require("node:assert/strict");
const {append,verify,canRead,readEvidence}=require("./audit-event-prototype.cjs");
const entry={event_id:"E1",stream_id:"S1",tenant_id:"T1",institution_id:"I1",course_id:"C1",result_id:"R1",event_type:"SOURCE_CAPTURED",idempotency_key:"K1"};
const resource={tenant_id:"T1",institution_id:"I1",course_id:"C1",visibility:"COURSE",contains_personal_data:false};
function subject(role,course="C1",institution="I1",tenant="T1"){return {user_id:"U",role,active:true,grants:[{active:true,role,tenant_id:tenant,institution_id:institution,course_id:course}]};}
const tests=[];
function test(name,fn){tests.push([name,fn]);}
test("append_first",()=>assert.equal(append([],entry)[0].sequence,1));
test("verify_chain",()=>assert(verify(append(append([],entry),{...entry,event_id:"E2",idempotency_key:"K2"}))));
test("detect_tampering",()=>{const h=append([],entry);assert(!verify([{...h[0],result_id:"altered"}]));});
test("detect_reorder",()=>{const h=append(append([],entry),{...entry,event_id:"E2",idempotency_key:"K2"});assert(!verify(h.slice().reverse()));});
test("detect_missing_event",()=>{const h=append(append([],entry),{...entry,event_id:"E2",idempotency_key:"K2"});assert(!verify(h.slice(1)));});
test("duplicate_key_rejected",()=>assert.throws(()=>append(append([],entry),{...entry,event_id:"E2"}),/DUPLICATE/));
test("cross_tenant_append_rejected",()=>assert.throws(()=>append(append([],entry),{...entry,event_id:"E2",idempotency_key:"K2",tenant_id:"T2"}),/CROSS_SCOPE/));
test("publication_blocked",()=>assert.throws(()=>append([],{...entry,publication_status:"PUBLISHED"}),/PUBLICATION_BLOCKED/));
test("master_scoped",()=>assert(canRead(subject("MASTER"),resource)));
test("master_other_tenant_denied",()=>assert(!canRead(subject("MASTER","C1","I1","T2"),resource)));
test("reitoria_institution",()=>assert(canRead(subject("REITORIA","OTHER"),resource)));
test("reitoria_other_ies_denied",()=>assert(!canRead(subject("REITORIA","C1","I2"),resource)));
test("coordination_course",()=>assert(canRead(subject("COORDENACAO"),resource)));
test("coordination_cross_course_denied",()=>assert(!canRead(subject("COORDENACAO","C2"),resource)));
test("nde_course",()=>assert(canRead(subject("NDE"),resource)));
test("nde_cross_course_denied",()=>assert(!canRead(subject("NDE","C2"),resource)));
test("cpa_denied_course",()=>assert(!canRead(subject("CPA"),resource)));
test("cpa_aggregated_allowed",()=>assert(canRead(subject("CPA"),{...resource,visibility:"AGGREGATED"})));
test("cpa_personal_denied",()=>assert(!canRead(subject("CPA"),{...resource,visibility:"AGGREGATED",contains_personal_data:true})));
test("anonymous_denied",()=>assert(!canRead(null,resource)));
test("inactive_denied",()=>assert(!canRead({...subject("MASTER"),active:false},resource)));
test("role_mismatch_denied",()=>assert(!canRead({...subject("MASTER"),role:"NDE"},resource)));
test("read_authorized",()=>assert.equal(readEvidence(subject("COORDENACAO"),resource,append([],entry)).status,200));
test("read_denied_neutral",()=>assert.equal(readEvidence(subject("COORDENACAO","C2"),resource,append([],entry)).status,404));
test("read_chain_corruption",()=>{const h=append([],entry);assert.equal(readEvidence(subject("MASTER"),resource,[{...h[0],event_hash:"wrong"}]).status,409);});
test("read_bad_pagination",()=>assert.equal(readEvidence(subject("MASTER"),resource,append([],entry),{limit:101}).status,400));
test("read_no_publication",()=>assert.equal(readEvidence(subject("MASTER"),resource,append([],entry)).publication_status,"DRAFT_ONLY"));
test("immutable_input",()=>{const h=append([],entry);assert.equal(h[0].event_hash.length,64);assert.equal(entry.sequence,undefined);});
let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log("PASS",name)}catch(e){console.error("FAIL",name,e.message)}}
console.log(JSON.stringify({suite:"audit-governance",tests:tests.length,passed,failed:tests.length-passed,node:process.version}));if(passed!==tests.length)process.exitCode=1;
