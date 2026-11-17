"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {run}=require('./integrated-gate.cjs');
const {iso,reportDigest}=require('./contract-integrity.cjs');
const {POLICIES,select}=require('./edition-controls.cjs');
const {checkState}=require('./result-state-controls.cjs');
const {validateTrace}=require('./traceability-controls.cjs');
function fixture(type='R2'){
 return {report_id:'SYN-ONLY',report_type:type,schema_version:'0.4',generated_at:'2026-11-17T12:00:00Z',edition_year:2023,academic_degree:'bacharelado',area_code:'A1',area_name:'Synthetic',institution_code:'I1',course_code:'C1',methodology_id:'SYN-METHOD',methodology_url:'https://www.gov.br/inep/',engine_version:'test-0.4',dataset_hash:'a'.repeat(64),sample_n:3,denominator:5,exclusion_counts:{},missing_counts:{},comparability_class:'C0',caveats:['Synthetic; no official indicator'],generated_by:'test',review_status:'PENDING',source_documents:[{source_id:'S1',url:'https://www.gov.br/inep/',document_title:'Synthetic',retrieval_date:'2026-11-17',file_version:'v1',sha256:'a'.repeat(64)}],claims:[{claim_id:'CLAIM1',text:'Synthetic hypothesis',epistemic_label:'PEDAGOGICAL_HYPOTHESIS',validation_status:'PENDING',evidence_refs:[]}],payload:{
 R2:{general_formation:{methodology_id:'SYN-METHOD',unit:'points',measure:'COURSE_MEAN',n:3,value:50},specific_component:{methodology_id:'SYN-METHOD',unit:'points',measure:'COURSE_MEAN',n:3,value:75}},
 R3:{questionnaire_categories:[{question_id:'Q1',respondents:3,missing:2,denominator:5}]},
 R4:{indicators:[{indicator:'IDD',methodology_id:'UNVERIFIED-SYNTHETIC',source_version:'v1',status:'PENDING'}]},
 R5:{comparisons:[{class:'C0',justification:'Same synthetic dataset',claimed_comparable:true}]},
 R6:{interventions:[{intervention_id:'ACT1',hypothesis:'Synthetic hypothesis',action:'Review',evidence_refs:['S1'],limitations:['Synthetic only'],status:'DRAFT'}]}
 }[type]};
}
function officialIGC(){
 const r=fixture('R4');r.course_code=null;r.area_code=null;r.academic_degree=null;
 r.payload.indicators=[{indicator:'IGC',methodology_id:r.methodology_id,source_id:'S1',source_version:'v1',status:'OFFICIAL',result_origin:'OFFICIAL_SOURCE',continuous_value:0,band:1,value_state:{kind:'AVAILABLE',continuous_value:0,band:1,source_version:'v1'}}];
 r.traceability_version='0.1';
 r.result_traces=[{trace_id:'T1',result_id:'RES1',indicator:'IGC',edition_year:2023,academic_degree:null,area_code:null,institution_code:'I1',course_code:null,methodology_id:r.methodology_id,methodology_reference:'SYN',methodology_version:'v1',engine_version:r.engine_version,source_id:'S1',source_version:'v1',source_url:'https://www.gov.br/inep/',source_sha256:'a'.repeat(64),retrieved_at:r.generated_at,state:{kind:'AVAILABLE'},value:0,epistemic_label:'OFFICIAL_FACT',evidence_refs:['S1'],decision:{status:'PENDING'},publication_status:'DRAFT_ONLY'}];return r;
}
function approved(){
 const r=fixture('R6');r.review_status='APPROVED';r.reviewed_by='SYN-REVIEWER';r.reviewed_at=r.generated_at;r.review_decision_id='SYN-REPORT-DECISION';r.human_intervention_approval=true;
 Object.assign(r.claims[0],{validation_status:'VALIDATED',assumptions:['Synthetic context'],limitations:['No authenticated session']});
 Object.assign(r.payload.interventions[0],{status:'APPROVED',reviewed_by:r.reviewed_by,reviewed_at:r.reviewed_at,review_decision_id:'SYN-ACTION-DECISION'});return r;
}
if(require.main===module){
const tests=[];
function test(name,fn){tests.push([name,fn]);}
function rejected(name,kind,mutate,error){test(name,()=>{const r=fixture(kind);mutate(r);const out=run(r);assert.equal(out.ok,false);assert(out.errors.some(x=>x.includes(error)),JSON.stringify(out));});}
for(const file of fs.readdirSync(path.join(__dirname,'fixtures/audit-20261117')).filter(x=>x.endsWith('.json'))){
 test('original_audit_'+file,()=>{const r=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/audit-20261117',file)));assert.equal(run(r).ok,false,file+' incorrectly accepted');});
}
for(const kind of ['R2','R3','R4','R5','R6'])test('positive_'+kind,()=>assert.deepEqual(run(fixture(kind)),{ok:true,errors:[]}));
rejected('negative_numeric_value','R2',r=>r.payload.general_formation.value=-1,'R2_VALUE_RANGE');
rejected('oversize_numeric_value','R2',r=>r.payload.general_formation.value=101,'R2_VALUE_RANGE');
test('zero_and_hundred_valid',()=>{const r=fixture();r.payload.general_formation.value=0;r.payload.specific_component.value=100;assert.equal(run(r).ok,true);});
test('standardized_measure_valid',()=>{const r=fixture();Object.assign(r.payload.general_formation,{unit:'standardized_points',measure:'STANDARDIZED_SCORE',value:5});assert.equal(run(r).ok,true);});
rejected('standardized_range','R2',r=>Object.assign(r.payload.general_formation,{unit:'standardized_points',measure:'STANDARDIZED_SCORE',value:5.1}),'R2_VALUE_RANGE');
rejected('mismatched_measure_unit','R2',r=>r.payload.general_formation.measure='STANDARDIZED_SCORE','R2_MEASURE_UNIT');
rejected('new_version_requires_measure','R2',r=>delete r.payload.general_formation.measure,'R2_EXPLICIT_MEASURE_REQUIRED');
rejected('unsafe_integer_count','R2',r=>r.payload.general_formation.n=1e18,'R2_UNSAFE_COMPONENT_COUNT');
test('question_population_explicit_exclusions',()=>{const r=fixture('R3');Object.assign(r.payload.questionnaire_categories[0],{respondents:1,missing:0,excluded:2,not_applicable:2,population_rule_ref:'SYN-RULE'});assert.equal(run(r).ok,true);});
rejected('exclusion_needs_rule','R3',r=>Object.assign(r.payload.questionnaire_categories[0],{respondents:1,excluded:2}),'R3_POPULATION_RULE');
rejected('duplicate_question','R3',r=>r.payload.questionnaire_categories.push({...r.payload.questionnaire_categories[0]}),'R3_DUPLICATE_QUESTION');
test('unbounded_available_rejected',()=>assert(checkState({kind:'AVAILABLE',continuous_value:999,band:99,source_version:'v1'}).includes('AVAILABLE_VALUE_RANGE')));
test('institution_pending_IGC',()=>{const r=fixture('R4');r.course_code=null;r.area_code=null;r.academic_degree=null;r.payload.indicators[0].indicator='IGC';assert.equal(run(r).ok,true,JSON.stringify(run(r)));});
rejected('pending_numeric_value','R4',r=>r.payload.indicators[0].continuous_value=4,'R4_PENDING_NUMERIC_VALUE');
test('C1_receipt_required_even_with_sources',()=>{
 const r=fixture('R5');r.comparability_class='C1';const c=r.payload.comparisons[0];c.class='C1';c.left={edition_year:2021,area_code:'A1',academic_degree:'bacharelado',instrument_id:'SYN-OLD',methodology_id:'SYN-OLD',measure:'COURSE_MEAN',unit:'points',source_ref:'S1'};c.right={...c.left,edition_year:2023,instrument_id:'SYN-NEW',methodology_id:'SYN-NEW'};c.equivalence_refs=['S1'];
 assert(run(r).errors.some(e=>e.includes('R5_C1_EQUIVALENCE_UNVERIFIED')));
 const digest=reportDigest(r);assert.equal(run(r,{verifyComparison:q=>q.report_sha256===digest}).ok,true);
 c.right.area_code='OTHER';assert.equal(run(r,{verifyComparison:()=>true}).ok,false);
});
test('institution_official_default_denied',()=>assert(run(officialIGC()).errors.some(e=>e.includes('R4_OFFICIAL_RESULT_UNVERIFIED'))));
test('official_external_verifier_synthetic_only',()=>{const r=officialIGC(),digest=reportDigest(r);assert.equal(run(r,{verifyOfficialResult:q=>q.report_sha256===digest&&q.source_sha256==='a'.repeat(64)&&q.indicator==='IGC'}).ok,true);});
test('official_body_cannot_supply_verifier',()=>{const r=officialIGC();r.verifyOfficialResult=true;r.payload.indicators[0].verified=true;assert.equal(run(r).ok,false);});
test('official_verifier_exception_denied',()=>assert.equal(run(officialIGC(),{verifyOfficialResult:()=>{throw Error('unavailable')}}).ok,false));
test('official_mutated_after_receipt_denied',()=>{const r=officialIGC(),digest=reportDigest(r);r.payload.indicators[0].continuous_value=1;assert.equal(run(r,{verifyOfficialResult:q=>q.report_sha256===digest}).ok,false);});
test('official_trace_required',()=>{const r=officialIGC();delete r.traceability_version;delete r.result_traces;assert.equal(run(r,{verifyOfficialResult:()=>true}).ok,false);});
test('official_trace_conflict_rejected',()=>{const r=officialIGC();r.result_traces[0].value=4;assert(run(r,{verifyOfficialResult:()=>true}).errors.some(e=>e.includes('R4_OFFICIAL_TRACE_CONFLICT')));});
test('IGC_trace_scope_rejects_course',()=>{const t=officialIGC().result_traces[0];t.course_code='C1';assert(validateTrace(t).includes('TRACE_IGC_INSTITUTION_SCOPE'));});
test('approved_default_denied',()=>assert(run(approved()).errors.includes('REPORT_REVIEW_NOT_AUTHENTICATED')));
test('approved_context_bound_to_payload_synthetic_only',()=>{const r=approved(),digest=reportDigest(r);const ids=new Set(['SYN-REPORT-DECISION','SYN-ACTION-DECISION']);assert.equal(run(r,{verifyDecision:q=>q.report_sha256===digest&&ids.has(q.decision_id)&&q.reviewer_id==='SYN-REVIEWER'}).ok,true,JSON.stringify(run(r)));});
test('approval_boolean_is_not_receipt',()=>{const r=approved();r.authenticated=true;r.decision_verified=true;assert.equal(run(r).ok,false);});
test('approval_digest_rejects_mutation',()=>{const r=approved(),digest=reportDigest(r);r.payload.interventions[0].action='Changed';assert.equal(run(r,{verifyDecision:q=>q.report_sha256===digest}).ok,false);});
test('legacy_cannot_be_approved',()=>{const r=approved();r.schema_version='0.3';assert(run(r,{verifyDecision:()=>true}).errors.includes('APPROVAL_REQUIRES_CONTRACT_0_4'));});
test('invalid_calendar_date',()=>assert.equal(iso('2026-02-30T12:00:00Z'),false));
test('verified_empty_course_SC',()=>assert.equal(select([],2023,POLICIES[2023].id,{source_complete:true,scope:{institution_code:'I1',course_code:'C1',area_code:'A1',edition_year:2023}}).indicatorStatus,'SC'));
test('unverified_empty_course_pending',()=>assert.equal(select([],2023,POLICIES[2023].id).indicatorStatus,'PENDING'));
test('mixed_courses_blocked',()=>{const g={TP_INSCRICAO:1,IN_REGULAR:1,TP_INSCRICAO_ADM:0,TP_PRES:555};assert.equal(select([{...g,course_code:'A'},{...g,course_code:'B'}],2023,POLICIES[2023].id).status,'SCOPE_MISMATCH');});
test('version_unknown_blocked',()=>{const r=fixture();r.schema_version='99';assert.equal(run(r).ok,false);});
let passed=0;for(const [name,fn]of tests){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.message);}}
console.log(JSON.stringify({suite:'audit-integrity',tests:tests.length,passed,failed:tests.length-passed,node:process.version}));if(passed!==tests.length)process.exitCode=1;
}
module.exports={fixture,officialIGC};
