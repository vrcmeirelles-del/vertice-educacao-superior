import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';import {createServer} from 'node:http';
import {PGlite} from '@electric-sql/pglite';
import {createSapiensHandler} from '../../../supabase/functions/vertice-sapiens-bridge/handler.ts';
const fo=process.env.FATO_ORDEM_REPO;if(!fo)throw Error('Set FATO_ORDEM_REPO to a checkout of the paired F&O branch');
const {fixture:foFixture,id,token,secret}=await import(pathToFileURL(resolve(fo,'test/helpers/sapiens-fixture.mjs')));
const {handleVerticeBridgeApi}=await import(pathToFileURL(resolve(fo,'src/vertice-learning-bridge.mjs')));
const jwt=(n=1,aal='aal2')=>'synthetic.'+Buffer.from(JSON.stringify({sub:id(n),aal})).toString('base64url')+'.synthetic';
export async function fixture(t){
 const f=await foFixture();t.after(()=>f.db.close());
 const db=new PGlite();await db.waitReady;t.after(()=>db.close());
 await db.exec(await readFile(new URL('./fixture.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../../source-overrides/migrations/20261115000000_sapiens_core_tables.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../../supabase/migrations/20261115013757_sapiens_native_bridge.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../../supabase/migrations/20261117111205_sapiens_feedback_privacy.sql',import.meta.url),'utf8'));
 await db.query('insert into vertice_institutions values($1,$2),($3,$4)',[id(11),'Synthetic A',id(12),'Synthetic B']);
 await db.query('insert into vertice_courses values($1,$2,$3),($4,$2,$5),($6,$7,$8)',[id(21),id(11),'Law',id(22),'Other',id(23),id(12),'Other IES']);
 await db.query('insert into vertice_admins values($1)',[id(1)]);
 await db.query('insert into vertice_memberships values($1,$2,$3)',[id(2),id(11),'gestor']);
 for(let n=1;n<=5;n++)await db.query('insert into vertice_private.learning_students values($1,$2,$3,true)',[id(11),id(21),token(n)]);
 await db.query(`insert into vertice_sapiens_diagnoses(id,institution_id,course_id,module,semester,sample_size,severity,summary,llm_model,data_snapshot_at) values($1,$2,$3,'oab','2026/2',5,'warning','SYNTHETIC diagnosis','synthetic',now())`,[id(41),id(11),id(21)]);
 for(const n of [31,32])await db.query(`insert into vertice_sapiens_interventions(id,institution_id,diagnosis_id,course_id,module,competency,intervention_type,title,description,suggested_kc_ids,llm_model) values($1,$2,$3,$4,'oab','Civil','remedial_practice','SYNTHETIC intervention','SYNTHETIC intervention description',ARRAY['civil.case'],'synthetic')`,[id(n),id(11),id(41),id(21)]);
 const server=createServer(async(req,res)=>{try{
  await handleVerticeBridgeApi({request:req,response:res,url:new URL(req.url,'http://local'),service:f.bridge,requireRole:()=>{throw Error('unexpected')},
   verifyMutationRequest:r=>{assert.equal(r.headers['x-requested-with'],'fato-e-ordem');},readJsonBody:async r=>{let s='';for await(const c of r)s+=c;return JSON.parse(s);},sendJson:(r,status,body)=>{r.writeHead(status,{'content-type':'application/json'});r.end(JSON.stringify(body));}});
 }catch(e){res.writeHead(e.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const state={mode:'ok',calls:0,rpcFail:''};
 const rpc=async a=>{if(state.rpcFail===a.p_action){state.rpcFail='';throw Error('synthetic DB failure');}await db.exec('set role service_role');try{return (await db.query('select public.vertice_sapiens_bridge($1,$2,$3,$4,$5) result',[a.p_action,a.p_institution,a.p_id,a.p_actor,a.p_payload])).rows[0].result;}finally{await db.exec('reset role');}};
 const deps={getUser:async value=>{if(![jwt(1),jwt(1,'aal1'),jwt(2)].includes(value))return null;return{id:JSON.parse(Buffer.from(value.split('.')[1],'base64url')).sub};},
  isMaster:async user=>(await db.query('select 1 from vertice_admins where user_id=$1',[user])).rows.length===1,rpc,
  baseUrl:'https://www.fatoeordem.com.br',bridgeKey:secret,
  fetch:async(url,options)=>{state.calls++;if(state.mode==='before')throw Error('synthetic timeout before send');if(state.mode==='503')return Response.json({error:'synthetic'}, {status:503});
   const result=await fetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}`,options);
   if(state.mode==='after')throw Error('synthetic lost acknowledgement');
   if(state.mode==='bad_ack')return Response.json({result:{accepted:true}});
   return result;
  }};
 const handler=createSapiensHandler(deps);
 const request=(action,opts={})=>handler(new Request('https://edge.synthetic.test',{method:'POST',headers:{authorization:'Bearer '+(opts.jwt||jwt()),origin:opts.origin||'https://www.verticesuperior.com.br','content-type':'application/json'},body:JSON.stringify({action,institutionId:opts.inst||id(11),interventionId:opts.intervention||id(31),...opts.extra})}));
 const row=async()=> (await db.query('select * from vertice_sapiens_interventions where id=$1',[id(31)])).rows[0];
 return{...f,db,foDb:f.db,request,state,rpc,row,deps};
}
test('complete native cycle across HTTP and two PostgreSQL engines; stores longitudinal aggregates and audit',async t=>{
 const f=await fixture(t);let r=await f.request('approve');assert.equal(r.status,200);assert.equal((await f.row()).status,'sent');assert.equal((await f.row()).fo_registered_students,5);
 assert.equal((await f.foDb.query('select count(*)::int n from fo_vertice_intervention_students')).rows[0].n,5);
 await f.foDb.query('update student_mastery set bkt_p_know=.65,elo_rating=1200,attempt_count=12');
 r=await f.request('feedback');assert.equal(r.status,200);
 let e=(await f.db.query('select * from vertice_sapiens_effectiveness')).rows[0];assert.equal(Number(e.p_know_change),.4);assert.equal(e.attempts_since_baseline,10);assert.equal(e.effectiveness,'significant_improvement');
 await f.foDb.query('update student_mastery set bkt_p_know=.7,attempt_count=15');await f.request('feedback');
 assert.equal((await f.db.query('select count(*)::int n from vertice_sapiens_effectiveness')).rows[0].n,2);
 const audit=(await f.db.query('select action,actor_id,details from vertice_sapiens_audit_trail')).rows;assert.deepEqual(audit.map(a=>a.action),['approved','sent','updated','updated']);assert.ok(audit.every(a=>a.actor_id===id(1)));
 const serialized=JSON.stringify((await f.db.query('select * from vertice_sapiens_effectiveness')).rows);assert.equal(serialized.includes(token(1)),false);
});
test('rejection never dispatches; Master and MFA checks reject before mutations; forged request scope rejected',async t=>{
 const f=await fixture(t);
 for(const opts of [{jwt:'invalid'},{jwt:jwt(2)},{jwt:jwt(1,'aal1')},{origin:'https://evil.example'},{extra:{approvedBy:id(1)}},{inst:id(12)}]){assert.ok((await f.request('approve',opts)).status>=400);}
 assert.equal(f.state.calls,0);assert.equal((await f.row()).status,'proposed');
 assert.equal((await f.request('reject')).status,200);assert.equal((await f.row()).status,'rejected');assert.equal(f.state.calls,0);
 assert.ok((await f.request('retry')).status>=400);assert.ok((await f.request('approve')).status>=400);
 // DB rejects a service caller falsely claiming a non-Master actor as well.
 await assert.rejects(f.rpc({p_action:'approve',p_institution:id(11),p_id:id(32),p_actor:id(2),p_payload:{}}),/Master required/);
});
test('lost acknowledgement retries immutable payload without duplicate registration or baseline reset',async t=>{
 const f=await fixture(t);f.state.mode='after';assert.equal((await f.request('approve')).status,502);assert.equal((await f.row()).status,'approved');assert.equal((await f.row()).delivery_status,'failed');
 assert.equal((await f.foDb.query('select count(*)::int n from fo_vertice_interventions')).rows[0].n,1);
 f.state.mode='ok';assert.equal((await f.request('retry')).status,200);assert.equal((await f.row()).status,'sent');assert.equal((await f.foDb.query('select count(*)::int n from fo_vertice_interventions')).rows[0].n,1);
 const calls=f.state.calls;await f.request('approve');assert.equal(f.state.calls,calls);assert.equal((await f.db.query("select count(*)::int n from vertice_sapiens_audit_trail where action='approved'")).rows[0].n,1);
});
test('communication errors, invalid acknowledgement and failed local commit never become sent; expired lease recovers',async t=>{
 const f=await fixture(t);for(const mode of ['before','503','bad_ack']){f.state.mode=mode;assert.equal((await f.request('approve')).status,502);assert.equal((await f.row()).status,'approved');}
 f.state.mode='ok';f.state.rpcFail='sent';assert.equal((await f.request('retry')).status,502);assert.equal((await f.row()).status,'approved');assert.equal((await f.request('retry')).status,200);
 const a={p_institution:id(11),p_id:id(32),p_actor:id(1),p_payload:{}};await f.rpc({...a,p_action:'approve'});const first=await f.rpc({...a,p_action:'claim'});await assert.rejects(f.rpc({...a,p_action:'claim'}),/in progress/);
 await f.db.query("update vertice_private.sapiens_delivery set lease_until=now()-interval '1 second' where intervention_id=$1",[id(32)]);const second=await f.rpc({...a,p_action:'claim'});assert.notEqual(first.leaseId,second.leaseId);
 await assert.rejects(f.rpc({...a,p_action:'failed',p_payload:{leaseId:first.leaseId}}),/Stale/);
});
test('no eligible students, course mismatch, F&O eligibility loss and disabled tenant fail closed',async t=>{
 const f=await fixture(t);await f.db.exec('update vertice_private.learning_students set active=false');assert.ok((await f.request('approve')).status>=400);assert.equal(f.state.calls,0);assert.equal((await f.row()).status,'proposed');
 await f.db.exec('update vertice_private.learning_students set active=true');await f.db.query('update vertice_sapiens_interventions set course_id=$1 where id=$2',[id(23),id(31)]);assert.ok((await f.request('approve')).status>=400);assert.equal(f.state.calls,0);
 await f.db.query('update vertice_sapiens_interventions set course_id=$1 where id=$2',[id(21),id(31)]);
 await f.foDb.exec('update fo_vertice_student_links set revoked_at=now()');assert.equal((await f.request('approve')).status,502);assert.equal((await f.row()).status,'approved');assert.equal((await f.foDb.query('select count(*)::int n from fo_vertice_interventions')).rows[0].n,0);
 await f.foDb.exec('update fo_vertice_tenants set enabled=false');assert.equal((await f.request('retry')).status,502);
});
test('feedback retry after local failure reuses remote measurement; revoked cohort produces insufficient_data',async t=>{
 const f=await fixture(t);await f.request('approve');await f.foDb.exec('update student_mastery set bkt_p_know=.65,attempt_count=12');
 f.state.rpcFail='feedback_save';assert.equal((await f.request('feedback')).status,503);assert.equal((await f.db.query('select count(*)::int n from vertice_sapiens_effectiveness')).rows[0].n,0);
 assert.equal((await f.request('feedback')).status,200);assert.equal((await f.foDb.query('select count(*)::int n from fo_vertice_intervention_feedback')).rows[0].n,1);
 await f.foDb.exec('update fo_vertice_student_links set revoked_at=now()');await f.request('feedback');const e=(await f.db.query('select * from vertice_sapiens_effectiveness order by measured_at desc')).rows[0];assert.equal(e.effectiveness,'insufficient_data');assert.equal(e.current_sample_size,0);assert.equal(e.p_know_change,null);
});
test('database ACL/RLS: browser cannot decide, read outbox or forge audit; reads require institution and AAL2',async t=>{
 const f=await fixture(t);await f.request('approve');
 await f.db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal','aal1',false)",[id(1)]);await f.db.exec('set role authenticated');
 assert.equal((await f.db.query('select count(*)::int n from vertice_sapiens_interventions')).rows[0].n,0);
 await assert.rejects(f.db.exec("update vertice_sapiens_interventions set status='approved'"),/permission denied/);
 await assert.rejects(f.db.query('select public.vertice_sapiens_bridge($1,$2,$3,$4,$5)',['approve',id(11),id(31),id(1),{}]),/permission denied/);
 await assert.rejects(f.db.exec('select * from vertice_private.sapiens_delivery'),/permission denied/);
 await assert.rejects(f.db.exec("insert into vertice_sapiens_audit_trail(institution_id) values(null)"),/permission denied/);
 await f.db.exec('reset role');await f.db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal','aal2',false)",[id(2)]);await f.db.exec('set role authenticated');assert.equal((await f.db.query('select count(*)::int n from vertice_sapiens_interventions')).rows[0].n,2);
 await f.db.exec('reset role');await f.db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(99)]);await f.db.exec('set role authenticated');assert.equal((await f.db.query('select count(*)::int n from vertice_sapiens_interventions')).rows[0].n,0);await f.db.exec('reset role');
});
