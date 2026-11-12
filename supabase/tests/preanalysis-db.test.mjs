// Local PostgreSQL/WASM only: no credentials, remote database or provider calls.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {CANARY_MIGRATION_PATH,buildCanaryMigration,assertCanaryScope} from '../../scripts/build-preanalysis-migration.mjs';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
for(const variant of ['proposal','canary']){
const db = new PGlite();
const root = new URL('../../', import.meta.url);
const sql = p => readFileSync(new URL(p, root), 'utf8');
const migrationSQL=sql(variant==='canary'?CANARY_MIGRATION_PATH:'docs/sql/preanalysis-v2.sql');
if(variant==='canary'){assert.equal(migrationSQL,buildCanaryMigration(sql('docs/sql/preanalysis-v2.sql')));assertCanaryScope(migrationSQL);}
const I='22000000-0000-4000-8000-000000000001', B='22000000-0000-4000-8000-000000000002';
const U='12000000-0000-4000-8000-000000000001', L='12000000-0000-4000-8000-000000000002';
const C='32000000-0000-4000-8000-000000000001', G='42000000-0000-4000-8000-000000000001';
const D='42000000-0000-4000-8000-000000000002', R='52000000-0000-4000-8000-000000000001';
const S='62000000-0000-4000-8000-000000000001', LS='62000000-0000-4000-8000-000000000002', S2='62000000-0000-4000-8000-000000000003';
const EXP=Math.floor(Date.now()/1000)+3600;
let checks=0;
async function exec(q){return db.exec(q);}
async function scalar(q){return (await db.query(q)).rows[0].v;}
async function user(u=U,aal='aal2',claims={}){await exec('reset role; set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,aal,role:'authenticated',session_id:u===L?LS:S,exp:EXP,...claims})]);}
async function service(claims={}){await exec('reset role; set role service_role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'service_role',...claims})]);}
async function denied(q,pattern){await exec('savepoint denial');try{await exec(q);assert.fail(`Unexpected success: ${q}`);}catch(e){if(e.code==='ERR_ASSERTION')throw e;if(pattern)assert.match(e.message,pattern);checks++;}finally{await exec('rollback to savepoint denial; release savepoint denial');}}
const source=(id=G,table='vertice_goals')=>`public.vertice_preanalysis_source('${I}','${table}','${id}')`;
const reserve=(v,hash='a'.repeat(64))=>`public.vertice_preanalysis_reserve('${I}','vertice_goals','${G}','${v}','${hash}','${'b'.repeat(64)}','approved','synthetic')`;
try {
 await exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema auth to authenticated,service_role;grant execute on all functions in schema auth to authenticated,service_role;`);
 await exec(sql('supabase/migrations/202610260001_access_foundation.sql'));
 // Verified pre-existing production schema usage is fixture setup, not a canary privilege change.
 await exec('grant usage on schema vertice_private to service_role');
 const area=sql('supabase/migrations/202610300001_area_real.sql');
 const start=area.indexOf('create or replace function vertice_private.member_role(');
 await exec(area.slice(start,area.indexOf('$$;',start)+3));
 // Synthetic-only prerequisite mirrors the verified private helper. Never create real sessions.
 await exec(`create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
 create function vertice_private.ai_live_session(person uuid,session uuid) returns boolean
 language plpgsql stable security definer set search_path='' as $$ declare valid boolean; begin
 if person is null or session is null or to_regclass('auth.sessions') is null then return false; end if;
 execute 'select exists(select 1 from auth.sessions s where id=$1 and user_id=$2 and ((to_jsonb(s)->>''not_after'') is null or (to_jsonb(s)->>''not_after'')::timestamptz>clock_timestamp()))' into valid using session,person;
 return coalesce(valid,false); end; $$;
 revoke all on function vertice_private.ai_live_session(uuid,uuid) from public,anon,authenticated,service_role;`);
 const helperBefore=await scalar("select jsonb_build_array(pg_get_functiondef(oid),proowner,proacl::text) v from pg_proc where oid='vertice_private.ai_live_session(uuid,uuid)'::regprocedure");
 // Minimal synthetic source schema models the confirmed live columns; not a claim of live replay.
 await exec(`alter table public.vertice_institutions add tier text not null default 'superior';
 create schema storage;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,updated_at timestamptz default now(),last_accessed_at timestamptz);
 create table public.vertice_documents(id uuid primary key,institution_id uuid,course_id uuid,storage_path text,file_name text,file_size bigint,mime_type text,sha256 text,status text,segment text,superseded_by uuid,version_number int,ai_status text);
 create table public.vertice_repository_requests(id uuid primary key,institution_id uuid,course_id uuid,active boolean default true,not_applicable boolean default false,repository_section text);
 create table public.vertice_repository_files(id uuid primary key,institution_id uuid,request_id uuid,storage_path text,file_name text,size_bytes bigint,mime_type text,status text);
 create table public.vertice_goals(id uuid primary key,institution_id uuid,course_id uuid,title text,owner_name text,notes text,direction text,baseline numeric,target numeric,due_date date,frequency text,status text);`);
 await exec(`alter table public.vertice_goals add unit text, add baseline_date date;
 create table public.vertice_goal_measurements(id uuid primary key,institution_id uuid,goal_id uuid,measured_on date,value numeric,source text,note text);
 create table public.vertice_actions(id uuid primary key,institution_id uuid,course_id uuid,goal_id uuid,finding_id uuid,start_date date,due_date date,status text,progress integer,who text,how_much text,evidence text);
 create table public.vertice_diagnosis_items(id uuid primary key,institution_id uuid,course_id uuid,assessed_on date,priority text,status text,score numeric,finding text);
 create table public.vertice_enrollment_snapshots(id uuid primary key,institution_id uuid,course_id uuid,semester text,enrolled integer,capacity integer,available integer,reported_total integer,source_report_at timestamptz,student_status text,class_label text,source_url text);`);
 const existingRelations=(await db.query("select c.oid::text id from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('public','vertice_private','auth','storage') order by c.oid")).rows.map(r=>r.id);
 const existingFunctions=(await db.query("select p.oid::text id from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','vertice_private','auth','storage') order by p.oid")).rows.map(r=>r.id);
 async function relationMetadata(){return (await db.query(`select jsonb_agg(jsonb_build_array(c.oid::text,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,
 (select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t where t.tgrelid=c.oid),
 (select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p where p.polrelid=c.oid),
 (select jsonb_agg(to_jsonb(a) order by a.attnum) from pg_attribute a where a.attrelid=c.oid),
 (select jsonb_agg(to_jsonb(k) order by k.oid) from pg_constraint k where k.conrelid=c.oid)) order by c.oid) v
 from pg_class c where c.oid=any($1::oid[])`,[existingRelations])).rows[0].v;}
 async function functionMetadata(){return (await db.query('select jsonb_agg(jsonb_build_array(oid::text,pg_get_functiondef(oid),proowner::text,proacl::text) order by oid) v from pg_proc where oid=any($1::oid[])',[existingFunctions])).rows[0].v;}
 const relationsBefore=await relationMetadata(),functionsBefore=await functionMetadata();
 const schemaAclsBefore=await scalar("select jsonb_agg(jsonb_build_array(nspname,nspacl::text) order by nspname) v from pg_namespace where nspname in ('public','vertice_private','auth','storage')");
 // Missing deployed prerequisite aborts before any preanalysis table/function is installed.
 await exec('alter function vertice_private.ai_live_session(uuid,uuid) rename to fixture_hidden_live_session');
 await assert.rejects(exec(migrationSQL),/required_private_live_session_dependency_missing_or_incompatible/);checks++;
 await exec('rollback; alter function vertice_private.fixture_hidden_live_session(uuid,uuid) rename to ai_live_session');
 assert.equal(await scalar("select to_regclass('public.vertice_evidence_preanalysis_runs') is null v"),true);checks++;
 await exec(migrationSQL);
 assert.deepEqual(await scalar("select jsonb_build_array(pg_get_functiondef(oid),proowner,proacl::text) v from pg_proc where oid='vertice_private.ai_live_session(uuid,uuid)'::regprocedure"),helperBefore);checks++;
 if(variant==='canary'){
  assert.deepEqual(await relationMetadata(),relationsBefore);checks++;
  assert.deepEqual(await functionMetadata(),functionsBefore);checks++;
  assert.deepEqual(await scalar("select jsonb_agg(jsonb_build_array(nspname,nspacl::text) order by nspname) v from pg_namespace where nspname in ('public','vertice_private','auth','storage')"),schemaAclsBefore);checks++;
  assert.equal(await scalar("select to_regclass('vertice_private.preanalysis_events') is null and to_regprocedure('vertice_private.preanalysis_enqueue()') is null v"),true);checks++;
 }
 await exec(`begin;
 insert into auth.users values('${U}','manager@example.invalid'),('${L}','reader@example.invalid');
 insert into auth.sessions values('${S}','${U}',null),('${LS}','${L}',null),('${S2}','${U}',null);
 insert into public.vertice_institutions(id,name,tier) values('${I}','IES fixture','superior'),('${B}','Escola fixture','escolas');
 insert into public.vertice_memberships(user_id,institution_id,role) values('${U}','${I}','gestor'),('${L}','${I}','leitor'),('${U}','${B}','gestor');
 insert into public.vertice_courses(id,institution_id,name) values('${C}','${I}','Curso');
 insert into public.vertice_goals(id,institution_id,course_id,title,owner_name,notes,direction,baseline,target,due_date,frequency,status) values('${G}','${I}','${C}','Secret Person','Sensitive Name','Contact email','aumentar',1,2,'2027-01-01','anual','ativa');
 insert into public.vertice_documents values('${D}','${I}','${C}','${I}/ppc/file.pdf','file.pdf',12,'application/pdf',null,'pending','superior',null,1,null);
 insert into storage.objects(bucket_id,name,metadata) values('vertice-documents','${I}/ppc/file.pdf','{"size":12,"mimetype":"application/pdf"}');
 insert into public.vertice_repository_requests values('${R}','${I}','${C}',true,false,'novo_instrumento_2026_curso');
 insert into public.vertice_repository_files values('${D}','${I}','${R}','${I}/${R}/${D}.pdf','repo.pdf',12,'application/pdf','enviado');
 insert into storage.objects(bucket_id,name,metadata) values('vertice-novo-instrumento-2026-cursos','${I}/${R}/${D}.pdf','{"size":12}');`);
 await exec(`insert into public.vertice_goal_measurements values('${D}','${I}','${G}','2026-11-01',17,'Secret source URL','Secret personal note');
 insert into public.vertice_diagnosis_items values('${D}','${I}','${C}','2026-11-01','alta','aberto',5,'Secret health finding');
 insert into public.vertice_actions values('${D}','${I}','${C}','${G}','${D}','2026-11-01','2027-01-01','em_andamento',40,'Secret person','Secret finance','Secret evidence');
 insert into public.vertice_enrollment_snapshots values('${D}','${I}','${C}','2026/02',30,50,20,30,'2026-11-01','Secret status','Secret class','Secret URL');`);
 await user();
 // Every optional adapter has a positive fixture and an exact privacy boundary.
 for (const table of ['vertice_goal_measurements','vertice_actions','vertice_diagnosis_items','vertice_enrollment_snapshots']) {
  const adapter=await scalar(`select ${source(D,table)} v`);
  assert.equal(adapter.kind,'structured');assert.equal(adapter.course_id,C);
  assert.equal(adapter.snapshot.quality_inference_allowed,false);
  assert(!JSON.stringify(adapter).includes('Secret'));assert(!('score' in adapter.snapshot));checks++;
 }
 const measurement=await scalar(`select ${source(D,'vertice_goal_measurements')} v`);
 assert.equal(measurement.snapshot.evidence_type,'reported_measurement');assert.equal(measurement.snapshot.denominator,null);checks++;
 const enrollment=await scalar(`select ${source(D,'vertice_enrollment_snapshots')} v`);
 assert.equal(enrollment.snapshot.denominator,50);assert.equal(enrollment.snapshot.source_report_at,'2026-11-01T00:00:00+00:00');checks++;
 await exec(`reset role;update public.vertice_goals set unit='Secret unit email' where id='${G}'`);await user();
 assert.equal((await scalar(`select ${source(D,'vertice_goal_measurements')} v`)).snapshot.unit,null);checks++;
 // Parent modifications invalidate immutable child versions, even if child is untouched.
 assert.notEqual((await scalar(`select ${source(D,'vertice_goal_measurements')} v`)).source_version,measurement.source_version);checks++;
 await exec(`reset role;update public.vertice_goals set institution_id='${B}' where id='${G}'`);await user();
 await denied(`select ${source(D,'vertice_goal_measurements')}`,/invalid_parent/);
 await denied(`select ${source(D,'vertice_actions')}`,/invalid_parent/);
 await exec(`reset role;update public.vertice_goals set institution_id='${I}',course_id=null where id='${G}'`);await user();
 await denied(`select ${source(D,'vertice_actions')}`,/invalid_parent_course/);
 await exec(`reset role;update public.vertice_goals set course_id='${C}' where id='${G}';update public.vertice_diagnosis_items set institution_id='${B}' where id='${D}'`);await user();
 await denied(`select ${source(D,'vertice_actions')}`,/invalid_parent/);
 await exec(`reset role;update public.vertice_diagnosis_items set institution_id='${I}' where id='${D}';update public.vertice_enrollment_snapshots set enrolled=2 where id='${D}'`);await user();
 await denied(`select ${source(D,'vertice_enrollment_snapshots')}`,/small_cohort_suppressed/);
 await exec(`reset role;update public.vertice_enrollment_snapshots set enrolled=30,institution_id='${B}' where id='${D}'`);await user();
 await denied(`select ${source(D,'vertice_enrollment_snapshots')}`,/source_not_found/);
 await exec(`reset role;update public.vertice_enrollment_snapshots set institution_id='${I}' where id='${D}'`);
 if(variant==='proposal'){assert.equal(await scalar('select count(*)::int v from vertice_private.preanalysis_events'),0);checks++;}
 await user();
 const s=await scalar(`select ${source()} v`);assert.equal(s.kind,'structured');assert.equal(s.course_id,C);assert(!JSON.stringify(s).includes('Secret'));assert(!JSON.stringify(s).includes('Sensitive'));checks++;
 assert.equal((await scalar(`select public.vertice_preanalysis_policy('${I}') v`)).enabled,false);
 await denied(`select ${reserve(s.source_version)}`,/provider_disabled/);
 await denied(`select public.vertice_preanalysis_source('${B}','vertice_goals','${G}')`,/forbidden/);
 await denied(`select public.vertice_preanalysis_source('${I}','vertice_memberships','${G}')`,/unsupported_source/);
 const doc=await scalar(`select ${source(D,'vertice_documents')} v`);assert.equal(doc.size_bytes,12);
 await exec(`reset role;update storage.objects set last_accessed_at=now()`);await user();assert.equal((await scalar(`select ${source(D,'vertice_documents')} v`)).source_version,doc.source_version);checks++;
 const repo=await scalar(`select ${source(D,'vertice_repository_files')} v`);assert.equal(repo.storage_bucket,'vertice-novo-instrumento-2026-cursos');checks++;
 await user(L);await denied(`select ${source()}`,/forbidden/);await user(U,'aal1');await denied(`select ${source()}`,/forbidden/);
 // Correct MFA and membership do not rescue malformed, expired, absent or foreign sessions.
 for(const claims of [{session_id:null},{session_id:'not-a-uuid'},{session_id:LS},{session_id:'62000000-0000-4000-8000-000000000099'},{exp:null},{exp:'not-a-number'},{exp:'1.5'},{exp:'9999999999999'},{exp:Math.floor(Date.now()/1000)-1}]){
  await user(U,'aal2',claims);await denied(`select ${source()}`,/forbidden/);
  await denied(`select public.vertice_preanalysis_policy('${I}')`,/forbidden/);
  await denied(`select ${reserve(s.source_version)}`,/forbidden/);
 }
 await exec(`reset role;update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='${S}'`);await user();await denied(`select ${source()}`,/forbidden/);
 await exec(`reset role;delete from auth.sessions where id='${S}'`);await user();await denied(`select ${source()}`,/forbidden/);
 await exec(`reset role;insert into auth.sessions values('${S}','${U}',null)`);await user();
 await denied(`select vertice_private.ai_live_session('${U}','${S}')`,/permission denied/);
 await denied('select * from vertice_private.preanalysis_run_authorizations',/permission denied/);
 await exec('reset role;set role anon');await denied(`select ${source()}`,/permission denied/);
 await exec(`reset role;insert into vertice_private.preanalysis_policy(institution_id,enabled,provider,model,daily_limit) values('${I}',true,'approved','synthetic',1)`);
 if(variant==='proposal')await exec(`update vertice_private.preanalysis_policy set queue_enabled=true where institution_id='${I}'`);await user();
 await exec(`reset role;update public.vertice_goal_measurements set value=18;update public.vertice_actions set progress=41;update public.vertice_diagnosis_items set priority='media';update public.vertice_enrollment_snapshots set enrolled=31;`);
 if(variant==='proposal')for (const table of ['vertice_goal_measurements','vertice_actions','vertice_diagnosis_items','vertice_enrollment_snapshots']) {
  assert.equal(await scalar(`select count(*)::int v from vertice_private.preanalysis_events where source_table='${table}'`),1);checks++;
 }
 await user();
 await denied(`select ${reserve('0'.repeat(64))}`,/stale_source/);
 const first=await scalar(`select ${reserve(s.source_version)} v`);assert.equal(first.created,true);
 await exec('reset role');assert.deepEqual(await scalar(`select jsonb_build_object('session',actor_session_id,'exp',extract(epoch from actor_jwt_expires_at)::bigint) v from vertice_private.preanalysis_run_authorizations where run_id='${first.run_id}'`),{session:S,exp:EXP});checks++;await user();
 const duplicate=await scalar(`select ${reserve(s.source_version)} v`);assert.equal(duplicate.run_id,first.run_id);assert.equal(duplicate.created,false);checks++;
 await denied(`select ${reserve(s.source_version,'c'.repeat(64))}`,/daily_quota/);
 await denied(`update public.vertice_evidence_preanalysis_runs set state='completed'`,/permission denied/);
 await denied(`select vertice_private.preanalysis_source_core('${I}','vertice_goals','${G}')`,/permission denied/);
 const result={summary:'Synthetic',correlation:'potential',links:[{objectKey:'catalog::1',scope:'curso'}],gaps:[],limitations:[],disclaimer:'Requires review'};
 const finalize=`select public.vertice_preanalysis_finalize('${first.run_id}','${U}','${'a'.repeat(64)}','${JSON.stringify(result)}',null)`;
 await denied(finalize,/permission denied/);
 await service();await denied(`select vertice_private.ai_live_session('${U}','${S}')`,/permission denied/);await denied('select * from vertice_private.preanalysis_run_authorizations',/permission denied/);
 await denied(finalize.replace(U,L),/invalid_finalization/);await exec(finalize);await denied(finalize,/invalid_finalization/);
 await user();
 await denied(`select public.vertice_preanalysis_review('${first.run_id}','invented','accepted','reason')`,/unknown_object/);
 await denied(`select public.vertice_preanalysis_review('${first.run_id}',null,'accepted','reason')`,/invalid_review/);
 await denied(`select public.vertice_preanalysis_review('${first.run_id}','catalog::1','accepted','')`,/invalid_review/);
 const d=await scalar(`select public.vertice_preanalysis_review('${first.run_id}','catalog::1','accepted','Manager review') v`);assert.equal(d.actor,U);assert.equal(d.validation_status,'pending');assert.equal(d.course_id,C);checks++;
 const repeated=await scalar(`select public.vertice_preanalysis_review('${first.run_id}','catalog::1','accepted','Manager review') v`);assert.equal(repeated.id,d.id);checks++;
 await user(U,'aal2',{exp:1});assert.equal(await scalar('select count(*)::int v from public.vertice_evidence_preanalysis_runs'),0);assert.equal(await scalar('select count(*)::int v from public.vertice_evidence_preanalysis_decisions'),0);checks++;
 await denied(`select public.vertice_preanalysis_review('${first.run_id}','catalog::1','accepted','Expired session')`,/forbidden/);
 await exec(`reset role;delete from auth.sessions where id='${S}'`);await user();assert.equal(await scalar('select count(*)::int v from public.vertice_evidence_preanalysis_runs'),0);checks++;
 await denied(`select public.vertice_preanalysis_review('${first.run_id}','catalog::1','accepted','Deleted session')`,/forbidden/);
 await exec(`reset role;insert into auth.sessions values('${S}','${U}',null)`);await user();
 await exec(`select public.vertice_preanalysis_review('${first.run_id}',null,'rejected','Insufficient evidence')`);
 await denied('delete from public.vertice_evidence_preanalysis_decisions',/permission denied/);
 await user(L);assert.equal(await scalar('select count(*)::int v from public.vertice_evidence_preanalysis_runs'),0);checks++;
 await exec(`reset role;update public.vertice_goals set target=3 where id='${G}'`);await user();
 await denied(`select public.vertice_preanalysis_review('${first.run_id}','catalog::1','accepted','stale')`,/stale_source/);
 await exec(`reset role;update public.vertice_documents set ai_status='completed' where id='${D}'`);await user();assert.equal((await scalar(`select ${source(D,'vertice_documents')} v`)).source_version,doc.source_version);checks++;
 await exec(`reset role;update public.vertice_documents set status='archived' where id='${D}'`);await user();await denied(`select ${source(D,'vertice_documents')}`,/inactive_source/);
 await exec(`reset role;update public.vertice_repository_requests set institution_id='${B}' where id='${R}'`);await user();await denied(`select ${source(D,'vertice_repository_files')}`,/inactive_request/);
 await exec('reset role');assert.equal(await scalar('select count(*)::int v from public.vertice_evidence_preanalysis_decisions'),2);assert.equal(await scalar('select used v from vertice_private.preanalysis_daily_usage'),1);if(variant==='proposal')assert((await scalar('select count(*)::int v from vertice_private.preanalysis_events'))>0);checks++;
 // A changed/revoked source settles its in-flight run safely, without publishing stale results.
 await exec(`update vertice_private.preanalysis_policy set daily_limit=10 where institution_id='${I}'`);await user();
 const fresh=await scalar(`select ${source()} v`);
 const next=await scalar(`select ${reserve(fresh.source_version,'d'.repeat(64))} v`);
 await exec(`reset role;update public.vertice_goals set target=4 where id='${G}';set role service_role`);
 const stale=await scalar(`select public.vertice_preanalysis_finalize('${next.run_id}','${U}','${'d'.repeat(64)}','${JSON.stringify(result)}',null) v`);assert.equal(stale.state,'failed');assert.equal(stale.error_code,'stale_source');checks++;
 await user();const latest=await scalar(`select ${source()} v`);const revokedRun=await scalar(`select ${reserve(latest.source_version,'e'.repeat(64))} v`);
 await exec(`reset role;update public.vertice_memberships set role='leitor' where user_id='${U}' and institution_id='${I}';set role service_role`);
 const revoked=await scalar(`select public.vertice_preanalysis_finalize('${revokedRun.run_id}','${U}','${'e'.repeat(64)}','${JSON.stringify(result)}',null) v`);assert.equal(revoked.state,'failed');assert.equal(revoked.error_code,'actor_revoked');checks++;
 await exec('reset role');assert.equal(await scalar('select used v from vertice_private.preanalysis_actor_usage'),3);checks++;
 // An otherwise valid service JWT (even for another active session of the same manager)
 // must never replace the exact session/expiry that authorized the run.
 await exec(`update public.vertice_memberships set role='gestor' where user_id='${U}' and institution_id='${I}';update vertice_private.preanalysis_policy set daily_limit=30 where institution_id='${I}'`);
 for(const [index,mode,error] of [[0,'revoked','actor_session_revoked'],[1,'deleted','actor_session_revoked'],[2,'expired','actor_session_expired'],[3,'missing','actor_session_missing'],[4,'table_missing','actor_session_revoked'],[5,'elapsed','actor_session_expired']]){
  await user(U,'aal2',mode==='elapsed'?{exp:Math.floor(Date.now()/1000)+2}:{});const liveSource=await scalar(`select ${source()} v`);const requestHash=String(index+1).repeat(64);
  const run=await scalar(`select ${reserve(liveSource.source_version,requestHash)} v`);
  await exec('reset role');
  if(mode==='revoked')await exec(`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='${S}'`);
  if(mode==='deleted')await exec(`delete from auth.sessions where id='${S}'`);
  if(mode==='expired')await exec(`update vertice_private.preanalysis_run_authorizations set actor_jwt_expires_at=clock_timestamp()-interval '1 second' where run_id='${run.run_id}'`);
  if(mode==='missing')await exec(`delete from vertice_private.preanalysis_run_authorizations where run_id='${run.run_id}'`);
  if(mode==='table_missing')await exec('alter table auth.sessions rename to fixture_unavailable_sessions');
  if(mode==='elapsed')await new Promise(resolve=>setTimeout(resolve,2100));
  await service({sub:U,aal:'aal2',session_id:S2,exp:EXP});
  const settled=await scalar(`select public.vertice_preanalysis_finalize('${run.run_id}','${U}','${requestHash}','${JSON.stringify(result)}',null) v`);
  assert.equal(settled.state,'failed');assert.equal(settled.error_code,error);checks++;
  await denied(`select public.vertice_preanalysis_finalize('${run.run_id}','${U}','${requestHash}','${JSON.stringify(result)}',null)`,/invalid_finalization/);
  await exec('reset role');assert.equal(await scalar(`select result is null and finished_at is not null v from public.vertice_evidence_preanalysis_runs where id='${run.run_id}'`),true);checks++;
  if(mode==='table_missing')await exec('alter table auth.fixture_unavailable_sessions rename to sessions');
  await exec(`insert into auth.sessions values('${S}','${U}',null) on conflict(id) do update set not_after=null`);
 }
 assert.equal(await scalar('select count(*)::int v from public.vertice_evidence_preanalysis_decisions'),2);checks++;
 assert.deepEqual(await scalar("select jsonb_build_array(pg_get_functiondef(oid),proowner,proacl::text) v from pg_proc where oid='vertice_private.ai_live_session(uuid,uuid)'::regprocedure"),helperBefore);checks++;
 await exec('rollback');
 assert.equal(await scalar('select count(*)::int v from public.vertice_evidence_preanalysis_runs'),0);
 console.log(`PASS ${checks} local transactional SQL assertions (${variant}): ACL, MFA, live/expired/revoked/deleted sessions, private saved-session finalization, tier, source/bucket/tenant, PII whitelist, disabled policy, quota/dedupe, immutable review, stale version, ${variant==='canary'?'unchanged existing relation/function/schema metadata and no queue':'queue'} and rollback. Single-session WASM, not multi-session contention or live-schema verification.`);
} finally {await db.close();}
}
