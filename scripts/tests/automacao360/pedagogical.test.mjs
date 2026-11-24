import test from 'node:test';import assert from 'node:assert/strict';import {pedagogicalRun} from '../../../supabase/functions/_shared/automacao360/pedagogical.mjs';
const scope={institutionId:'ies1',courseId:'law'},asOf='2026-11-24T12:00:00Z';
const base={...scope,id:'group1',revision:'r1',status:'validated',provisional:false,reviewId:'review1',observedAt:asOf,ruleId:'sapiens.low',competencyKey:'civil',windowId:'w1',correct:10,graded:30,studentCount:10};
const run=(g=base,options={})=>pedagogicalRun({scope,asOf,config:{...scope,enabled:true,approved:true,ruleIds:[g.ruleId],maxAgeHours:24,...options.config},source:{...scope,id:'source1',observedAt:asOf,complete:true,groups:[g],...options.source}});
test('low accuracy generates pending proposal only',()=>{const r=run();assert.equal(r.alerts.length,1);assert.equal(r.alerts[0].status,'pending_review');assert.equal(r.alerts[0].requiresHumanApproval,true);});
test('boundary 50% does not alert',()=>assert.equal(run({...base,correct:15}).alerts.length,0));
for(const [name,change] of Object.entries({provisional:{provisional:true},missingFlag:{provisional:undefined},unreviewed:{reviewId:null},unvalidated:{status:'pending'},smallSample:{graded:29},smallCohort:{studentCount:4},invalidCounts:{correct:31},missingCounts:{graded:null},stale:{observedAt:'2026-11-20T12:00:00Z'},future:{observedAt:'2026-11-25T12:00:00Z'},missingCompetency:{competencyKey:null}}))test(name,()=>{const r=run({...base,...change});assert.equal(r.alerts.length,0);assert.equal(r.issues.length,1);});
test('cross institution rejected',()=>assert.throws(()=>run({...base,institutionId:'ies2'}),/invalid_group/));
test('cross course rejected',()=>assert.throws(()=>run({...base,courseId:'med'}),/invalid_group/));
test('partial source rejected',()=>assert.throws(()=>run(base,{source:{complete:false}}),/invalid_source/));
test('duplicate groups rejected',()=>assert.throws(()=>run(base,{source:{groups:[base,base]}}),/duplicate_group/));
test('disabled configuration',()=>assert.equal(run(base,{config:{enabled:false}}).status,'disabled'));
test('idempotency stable',()=>assert.equal(run().alerts[0].idempotencyKey,run().alerts[0].idempotencyKey));
test('revision change produces distinct key',()=>assert.notEqual(run().alerts[0].idempotencyKey,run({...base,revision:'r2'}).alerts[0].idempotencyKey));
for(const kind of ['curriculum','enade','enamed']){const g={...base,ruleId:kind+'.gap',matrixKind:kind,matrixVersion:'v1',mappingComplete:true,required:['a','b'],covered:['a']};test(kind+' coverage gap',()=>assert.equal(run(g).alerts[0].evidence.value,1));test(kind+' missing mapping',()=>assert.equal(run({...g,mappingComplete:false}).alerts.length,0));test(kind+' complete coverage',()=>assert.equal(run({...g,covered:['a','b']}).alerts.length,0));}
test('unknown matrix item rejected',()=>assert.equal(run({...base,ruleId:'enade.gap',matrixKind:'enade',matrixVersion:'v1',mappingComplete:true,required:['a'],covered:['x']}).alerts.length,0));
for(const [ruleId,field] of [['avalia.recovery','pendingRecovery'],['retention.alert','confirmedAlerts']]){const g={...base,ruleId,engineVersion:'v1',existingEngineVerified:true,[field]:2};test(ruleId+' consumes existing evidence',()=>assert.equal(run(g).alerts.length,1));test(ruleId+' unverified upstream blocked',()=>assert.equal(run({...g,existingEngineVerified:false}).alerts.length,0));}
