// Isolated PostgreSQL only. Full repository foundation/area/alumni migrations,
process.on("uncaughtException",e=>{console.error(e.message);process.exit(1);});
// actual RLS/helpers. Auth JWT plumbing is emulated, no live Supabase credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
let db, pgClient;
if(process.env.PG_TEST_SOCKET){
 assert(process.env.PG_TEST_SOCKET.startsWith('/'), 'Unix socket required; no network hostname');
 assert(/^alumni_qa_[a-z0-9_]+$/.test(process.env.PG_TEST_DB||''), 'Disposable QA database required');
 const {default:pg}=await import(pathToFileURL(process.env.PG_MODULE));pg.types.setTypeParser(20,Number);
 pgClient=new pg.Client({host:process.env.PG_TEST_SOCKET,port:Number(process.env.PG_TEST_PORT||5432),database:process.env.PG_TEST_DB,user:process.env.PG_TEST_USER});
 await pgClient.connect();
 assert.equal((await pgClient.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n,0,'QA database must be empty');
 db={query:(...args)=>pgClient.query(...args),exec:sql=>pgClient.query(sql),close:()=>pgClient.end()};
}else{const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE));db=new PGlite();}
await db.exec(`do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;end$$;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema auth to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;`);
for(const file of ['202610260001_access_foundation.sql','202610300001_area_real.sql','20261111000000_alumni_360_phase1.sql','20261112130000_alumni_atomic_import.sql']){
 if(file==='20261111000000_alumni_360_phase1.sql')await db.exec(readFileSync('supabase/migrations/20261029220000_unitop_area.sql','utf8').split('\n')[1]); // DDL modality only; never imports historical IES data.
 await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
}
// Exercise a deliberately permissive starting fixture, including column grants.
await db.exec(`grant all on vertice_alumni_profiles,vertice_alumni_education,vertice_alumni_overview to anon,authenticated;
grant update(profile_id) on vertice_alumni_education to authenticated;`);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ies=id(1),other=id(2),course=id(11),courseB=id(12),manager=id(21),reader=id(22),master=id(23),managerB=id(24),pA=id(31),pB=id(32),eA=id(41),eB=id(42);
await db.exec(`insert into auth.users(id) values('${manager}'),('${reader}'),('${master}'),('${managerB}');
insert into vertice_institutions(id,name) values('${ies}','TEST A'),('${other}','TEST B');
insert into vertice_courses(id,institution_id,name) values('${course}','${ies}','TEST course A'),('${courseB}','${other}','TEST course B');
insert into vertice_memberships(user_id,institution_id,role) values('${manager}','${ies}','gestor'),('${reader}','${ies}','leitor'),('${managerB}','${other}','gestor');
insert into vertice_admins(user_id) values('${master}');
insert into vertice_alumni_profiles(id,full_name) values('${pA}','SYNTHETIC A'),('${pB}','SYNTHETIC B');
insert into vertice_alumni_education(id,profile_id,institution_id,course_id,enrollment_id,academic_status) values('${eA}','${pA}','${ies}','${course}','A','formado'),('${eB}','${pB}','${other}','${courseB}','B','formado');`);
async function session(user,aal='aal2',role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user||'',JSON.stringify({aal})]);await db.exec(`set role ${role}`);}
async function rows(table){return(await db.query('select * from '+table)).rows;}
const rpc=async(target=ies,c=course,key='NEW')=>(await db.query('select alumni_import_education($1,$2,$3,$4) result',[target,c,key,{full_name:'SYNTHETIC IMPORT',academic_status:'formado'}])).rows[0].result;
let tests=0;const pass=t=>{tests++;console.log('PASS '+t);};
// Demonstrate pre-existing defect only with synthetic IDs before security proposal.
await session(reader);
await db.exec(`update vertice_alumni_education set profile_id='${pB}' where id='${eA}'`);
assert.equal((await rows('vertice_alumni_profiles')).some(p=>p.id===pB),true);pass('synthetic preflight reproduces direct relink exposure under original policies');
await db.exec('reset role');await db.exec(`update vertice_alumni_education set profile_id='${pA}' where id='${eA}'`);
await session(null,'aal1','anon');assert.equal((await rows('vertice_alumni_overview')).length,2);pass('synthetic preflight reproduces owner-view access before proposal');
await db.exec('reset role');await db.exec(readFileSync('supabase/proposals/alumni_write_boundary.sql','utf8'));await db.exec(readFileSync('supabase/proposals/alumni_write_boundary.sql','utf8'));
for(const [label,user,aal,role] of [['anon',null,'aal1','anon'],['reader',reader,'aal2','authenticated'],['manager AAL1',manager,'aal1','authenticated'],['manager AAL2',manager,'aal2','authenticated'],['master AAL1',master,'aal1','authenticated'],['master AAL2',master,'aal2','authenticated']]){
 await session(user,aal,role);
 for(const sql of [`update vertice_alumni_education set profile_id='${pB}' where id='${eA}'`,`insert into vertice_alumni_education(profile_id,institution_id,course_id,enrollment_id) values('${pB}','${ies}','${course}','FORGED')`,`delete from vertice_alumni_education where id='${eA}'`,`update vertice_alumni_profiles set full_name='FORGED' where id='${pA}'`,`truncate vertice_alumni_profiles cascade`])await assert.rejects(()=>db.exec(sql),/permission denied/);
 pass(`${label}: direct DML, relink and truncate denied`);
 if(role==='anon'){await assert.rejects(()=>rows('vertice_alumni_overview'),/permission denied/);await assert.rejects(()=>rpc(),/permission denied/);}
 else if(aal==='aal1'){assert.equal((await rows('vertice_alumni_profiles')).length,0);assert.equal((await rows('vertice_alumni_overview')).length,0);await assert.rejects(()=>rpc(),/permissão/);}
 else if(user===reader){assert.equal((await rows('vertice_alumni_profiles')).length,1);assert.equal((await rows('vertice_alumni_overview')).length,1);await assert.rejects(()=>rpc(),/permissão/);}
 else {const result=await rpc();assert(result.education_id);const again=await rpc();assert.equal(result.profile_id,again.profile_id);}
}
await session(manager);assert.equal((await rows('vertice_alumni_profiles')).some(p=>p.id===pB),false);await assert.rejects(()=>rpc(other,courseB),/permissão/);await assert.rejects(()=>rpc(ies,courseB),/Curso/);pass('manager legitimate reads/import preserved, cross-tenant import/course denied');
if(pgClient){
 const {default:pg}=await import(pathToFileURL(process.env.PG_MODULE));pg.types.setTypeParser(20,Number);
 const second=new pg.Client({host:process.env.PG_TEST_SOCKET,port:Number(process.env.PG_TEST_PORT||5432),database:process.env.PG_TEST_DB,user:process.env.PG_TEST_USER});await second.connect();
 try{
  await session(manager);await db.exec('begin');const first=await rpc(ies,course,'CONCURRENT');
  await second.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[manager,JSON.stringify({aal:'aal2'})]);await second.query('set role authenticated');
  let finished=false;const waiting=second.query('select alumni_import_education($1,$2,$3,$4) result',[ies,course,'CONCURRENT',{full_name:'SYNTHETIC IMPORT',academic_status:'formado'}]).then(r=>{finished=true;return r.rows[0].result;});
  await new Promise(r=>setTimeout(r,150));assert.equal(finished,false,'second session should wait on transaction lock');
  await db.exec('commit');const next=await waiting;assert.equal(first.profile_id,next.profile_id);assert.equal(first.education_id,next.education_id);pass('real two-session import waits then preserves exactly one identity');
 }finally{await db.exec('rollback');await second.end();}
}else{console.log('SKIP real two-session concurrency: embedded single-session engine');}
await db.exec('reset role');const before=(await rows('vertice_alumni_profiles')).length;await db.exec(readFileSync('supabase/rollback/20261112130000_alumni_atomic_import.sql','utf8'));
await session(manager);await assert.rejects(()=>rpc(),/permission denied/);await assert.rejects(()=>db.exec(`update vertice_alumni_education set profile_id='${pB}' where id='${eA}'`),/permission denied/);assert((await rows('vertice_alumni_overview')).length>0);await db.exec('reset role');assert.equal((await rows('vertice_alumni_profiles')).length,before);pass('rollback disables import, preserves authorized reading/data and does not reopen direct writes');
console.log(`${tests} access scenarios passed; actual repository policies/helpers, emulated JWT transport.`);await db.close();
