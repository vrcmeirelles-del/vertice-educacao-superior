import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './native-cycle.test.mjs';
import {sanitizeFeedback} from '../../../supabase/functions/vertice-sapiens-bridge/handler.ts';

const metrics=(baseline=5,current=5,overlap=5,sufficient=true,attempts=10,resets=0)=>({
 baseline:{measuredAt:'2026-11-17T10:00:00Z',sampleSize:baseline,avgPKnow:.25,avgEloRating:1000},
 current:{measuredAt:'2026-11-17T11:00:00Z',sampleSize:current,avgPKnow:.65,avgEloRating:1200,attemptsSinceBaseline:attempts},
 delta:{sampleOverlap:overlap,pKnowChange:.4,eloChange:200},
 quality:{sufficient,eligibleStudents:current,counterResets:resets},
});

test('Edge masks small baseline/current independently and suppresses unsupported comparisons',()=>{
 for(const [b,c,o,s,a,r] of [[4,4,4,false,10,0],[4,5,4,false,10,0],[5,4,4,false,10,0],[5,5,4,false,10,0],[5,5,5,false,10,0],[5,5,5,true,0,0],[5,5,5,true,10,1]]){
  const input=metrics(b,c,o,s,a,r),copy=structuredClone(input),result=sanitizeFeedback(input);
  assert.deepEqual(input,copy,'does not mutate remote receipt');
  assert.equal(result.baseline.avgPKnow,b<5?null:.25);
  assert.equal(result.current.avgPKnow,c<5?null:.65);
  assert.equal(result.current.avgEloRating,c<5?null:1200);
  assert.equal(result.delta.pKnowChange,null);assert.equal(result.delta.eloChange,null);
  assert.equal(result.quality.sufficient,false);assert.equal(result.current.sampleSize,c);
 }
 const valid=sanitizeFeedback(metrics());assert.equal(valid.delta.pKnowChange,.4);assert.equal(valid.quality.sufficient,true);
});

test('SQL independently masks raw feedback from an older Edge, preserving counts and valid measurements',async t=>{
 const f=await fixture(t);assert.equal((await f.request('approve')).status,200);
 const iv=await f.row();
 const args={p_institution:iv.institution_id,p_id:iv.id,p_actor:iv.reviewed_by};
 const cases=[[5,5,5,true,10,0],[4,4,4,false,10,0],[4,5,4,false,10,0],[5,4,4,false,10,0],[5,5,4,false,10,0],[5,5,5,false,10,0],[5,5,5,true,0,0],[5,5,5,true,10,1]];
 for(const [b,c,o,s,a,r] of cases){
  const request=await f.rpc({...args,p_action:'feedback_request',p_payload:{}});
  const payload={...request,courseId:iv.course_id,module:iv.module,...metrics(b,c,o,s,a,r)};
  await f.rpc({...args,p_action:'feedback_save',p_payload:payload});
  const row=(await f.db.query('select * from vertice_sapiens_effectiveness where measurement_id=$1',[request.measurementId])).rows[0];
  const valid=s&&b>=5&&c>=5&&o>=5&&a>0&&r===0;
  assert.equal(row.current_avg_p_know===null,c<5);
  assert.equal(row.current_avg_elo===null,c<5);
  assert.equal(row.detail_snapshot.baseline.avgPKnow,b<5?null:.25);
  assert.equal(row.detail_snapshot.baseline.avgEloRating,b<5?null:1000);
  assert.equal(row.p_know_change===null,!valid);assert.equal(row.elo_change===null,!valid);
  assert.equal(row.detail_snapshot.quality.sufficient,valid);
  assert.equal(row.effectiveness,valid?'significant_improvement':'insufficient_data');
  assert.equal(row.current_sample_size,c);assert.equal(row.sample_overlap,o);assert.equal(row.attempts_since_baseline,a);
 }
});

test('consent withdrawal from five to four suppresses persisted estimates through actual HTTP handlers',async t=>{
 const f=await fixture(t);assert.equal((await f.request('approve')).status,200);
 await f.foDb.exec('update student_mastery set bkt_p_know=.65,attempt_count=12');
 assert.equal((await f.request('feedback')).status,200);
 await f.foDb.exec("update fo_vertice_student_links set revoked_at=now() where student_id=(select student_id from fo_vertice_intervention_students limit 1)");
 assert.equal((await f.request('feedback')).status,200);
 const row=(await f.db.query('select * from vertice_sapiens_effectiveness order by created_at desc limit 1')).rows[0];
 assert.equal(row.current_sample_size,4);assert.equal(row.current_avg_p_know,null);assert.equal(row.current_avg_elo,null);
 assert.equal(row.p_know_change,null);assert.equal(row.elo_change,null);assert.equal(row.detail_snapshot.baseline.avgPKnow,null);
 assert.equal(row.effectiveness,'insufficient_data');
});
