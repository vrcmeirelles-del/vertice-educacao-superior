// Runs only inside a separately authorized ephemeral GitHub runner. No production URL input.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {bootstrap,sid} from './bootstrap-auth.mjs';
import {run as httpContracts,validate,expectedHead,localUrl} from './http-contract.mjs';
const expectedSqlHashes={
  "supabase/proposals/alumni_course_scope.sql": "b92ff357f9a43a6173d967e3a79b8a52a76b243599d037bd927e574b1194ed33",
  "supabase/proposals/alumni_nominal_safe_stop.sql": "9fda3c8a6da517929195569ca0c880d09d08566153fbcba0857b7392cce07397",
  "supabase/proposals/alumni_nominal_scope.sql": "65b3b65fc7f6d02088c7006ccbb9d9e3d1816142f7a8c54e9f62f297f33e3871",
  "supabase/migrations/20261112130000_alumni_atomic_import.sql": "d79607c665c3f316ed632ce86c76ea771bab4b1efde089a90aafa785df2f3262",
  "supabase/proposals/alumni_write_boundary.sql": "104213fea8c497a8d689bf1b593301a163689ea39ebff3259208c3d1e2eee0d7"
};
export function guardEnvironment(env=process.env){assert.equal(env.GITHUB_ACTIONS,'true','Dedicated GitHub runner only; never retry local denied binds');assert.equal(env.ALLOW_DISPOSABLE_ALUMNI_HTTP,'YES');assert(env.RUNNER_TEMP?.startsWith('/'),'Runner temporary directory required');}
export async function execute(){
 guardEnvironment();
 const root=path.resolve('.');for(const [file,hash]of Object.entries(expectedSqlHashes))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,'Reviewed SQL content required: '+file);
 const settings=JSON.parse(execFileSync('npx',['--yes','supabase@3.1.0','status','--workdir','.alumni-stack','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 const api=localUrl(settings.API_URL);assert.equal(api.hostname,'127.0.0.1');assert.equal(api.pathname,'/');
 const database=new URL(settings.DB_URL);assert.equal(database.hostname,'127.0.0.1');assert.equal(database.protocol,'postgresql:');
 const anon=settings.ANON_KEY,service=settings.SERVICE_ROLE_KEY;assert(anon&&service,'Local JWT keys required, no remote fallback');
 const {default:pg}=await import(pathToFileURL(path.join(root,'scripts/tests/runtime/node_modules/pg/lib/index.js')));
 const db=new pg.Client({connectionString:settings.DB_URL,application_name:'disposable-alumni-auth-test'});
 const directory=path.join(process.env.RUNNER_TEMP,'alumni-auth-test');
 let connected=false;let m;let users;let completed=false;
 const pass=name=>console.log('PASS REAL '+name);
 try{
  await db.connect();connected=true;
  assert((await db.query('show server_version')).rows[0].server_version.startsWith('17.'));
  const empty=(await db.query('select (select count(*) from auth.users)::int users,(select count(*) from vertice_institutions)::int institutions,(select count(*) from vertice_alumni_profiles)::int profiles')).rows[0];assert.deepEqual(empty,{users:0,institutions:0,profiles:0},'Must be a fresh disposable database');
  process.env.ALLOW_DISPOSABLE_AUTH_BOOTSTRAP='YES';
  const result=await bootstrap({authorization:'CREATE_FICTITIOUS_USERS_IN_DISPOSABLE_LOCAL_AUTH',source_head:expectedHead,contains_real_data:false,base_url:api.origin,anon_key:anon,service_role_key:service,database_fixture_reviewed:true,output_dir:directory,sdk_package_json:path.join(root,'.alumni-build/package.json')});
  assert(result.auth_lifecycle_completed&&result.runner_compatible);
  m=JSON.parse(readFileSync(path.join(directory,'manifest.candidate.private.json'),'utf8'));validate(m);users=JSON.parse(readFileSync(path.join(directory,'auth-map.private.json'),'utf8'));
  await db.query("select set_config('qa.disposable_alumni','YES',false)");await db.query(readFileSync(path.join(directory,'fixtures.review-only.sql'),'utf8'));
  pass('Fresh PostgreSQL17, nine local Auth logins with real TOTP enroll/challenge/verify and refresh; AAL1/AAL2 verified');
  await httpContracts(m);
  const request=async(role,endpoint,body,method='POST',auth=false)=>{
   const url=(auth?m.auth_url:m.rest_url)+'/'+endpoint;assert.equal(new URL(url).origin,api.origin);
   const res=await fetch(url,{method,redirect:'error',headers:{Authorization:'Bearer '+m.tokens[role],apikey:m.tokens.anon,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await res.json();}catch{data=null;}return{status:res.status,data};
  };
  const context=role=>request(role,'rpc/alumni_access_context',{p_institution_id:m.ies});
  const denied=r=>{assert([401,403].includes(r.status));assert.equal(r.data?.code,'42501');};
  // Force an error AFTER the importer creates a profile, proving transaction rollback
  // in the disposable database. The temporary fault injector is always removed.
  const rollbackBefore=(await db.query('select count(*)::int n from vertice_alumni_profiles')).rows[0].n;
  await db.query(`create function public.qa_alumni_rollback_probe() returns trigger language plpgsql set search_path='' as $$begin if new.enrollment_id='QA-FORCED-ROLLBACK' then raise exception 'Synthetic rollback probe' using errcode='P0001';end if;return new;end$$;revoke all on function public.qa_alumni_rollback_probe() from public,anon,authenticated;create trigger qa_alumni_rollback_probe before insert on public.vertice_alumni_education for each row execute function public.qa_alumni_rollback_probe();`);
  try{const failed=await request('gestor','rpc/alumni_import_education',{p_institution:m.ies,p_course:m.course,p_enrollment:'QA-FORCED-ROLLBACK',p_record:{full_name:'SYNTHETIC ROLLBACK',academic_status:'formado'}});assert.equal(failed.status,400);assert.equal(failed.data?.code,'P0001');assert.equal((await db.query('select count(*)::int n from vertice_alumni_profiles')).rows[0].n,rollbackBefore);}
  finally{await db.query('drop trigger qa_alumni_rollback_probe on public.vertice_alumni_education;drop function public.qa_alumni_rollback_probe();');}
  pass('RPC transaction rolls back newly created profile on forced education failure');
  // New HTTP requests observe changed database authorization, without replacing JWTs.
  await db.query('delete from vertice_alumni_course_grants where user_id=$1 and course_id=$2',[users.coord_multi,m.other_course]);
  let r=await context('coord_multi');assert.equal(r.status,200);assert.deepEqual(r.data.allowed_course_ids,[m.course]);
  r=await request('coord_multi','vertice_alumni_education?select=id&course_id=eq.'+m.other_course,null,'GET');assert.equal(r.status,200);assert.deepEqual(r.data,[]);pass('Removing one course takes effect in new HTTP requests; shared profile does not widen education');
  await db.query("update vertice_alumni_course_grants set granted_at=now()-interval '2 days',expires_at=now()-interval '1 day' where user_id=$1",[users.coord_multi]);r=await context('coord_multi');assert.equal(r.data.nominal_scope,'none');pass('Expired course grant removes nominal HTTP scope');
  await db.query('update vertice_alumni_role_grants set revoked_at=clock_timestamp() where user_id=$1',[users.coord]);r=await context('coord');assert.equal(r.data.nominal_scope,'none');assert.equal(r.data.can_import,false);pass('Designation revocation closes nominal reads without changing token');
  await db.query('delete from vertice_memberships where user_id=$1',[users.coord_multi]);denied(await context('coord_multi'));pass('Membership removal revokes institutional RPC access');
  const before=(await db.query('select to_jsonb(g) body from vertice_alumni_role_grants g where user_id=$1',[users.coord_conflict])).rows[0].body;
  await db.query('update vertice_alumni_role_grants set revoked_at=clock_timestamp() where user_id=$1',[users.coord_conflict]);
  const after=(await db.query('select to_jsonb(g) body from vertice_alumni_role_grants g where user_id=$1',[users.coord_conflict])).rows[0].body;assert(after.revoked_at);delete before.revoked_at;delete after.revoked_at;assert.deepEqual(after,before);
  r=await context('coord_conflict');assert.equal(r.data.nominal_scope,'none');denied(await request('coord_conflict','rpc/alumni_import_education',{p_institution:m.ies,p_course:m.other_course,p_enrollment:'QA-CONFLICT-AFTER-REVOKE',p_record:{full_name:'SYNTHETIC',academic_status:'formado'}}));pass('One-way revocation of conflicting promotion persists, importer remains denied over HTTP');
  // Invalid signature is tested without forging a valid AAL2 token.
  const parts=m.tokens.reader.split('.');const sig=parts[2];parts[2]=(sig[0]==='A'?'B':'A')+sig.slice(1);
  const invalid=await fetch(m.rest_url+'/rpc/alumni_access_context',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+parts.join('.'),apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({p_institution_id:m.ies})});assert.equal(invalid.status,401);pass('PostgREST rejects invalid JWT signature');
  const refresh=JSON.parse(readFileSync(path.join(directory,'refresh.private.json'),'utf8'));
  r=await request('coord_revoked','logout?scope=global',null,'POST',true);assert([200,204].includes(r.status));
  const afterLogout=await fetch(m.auth_url+'/token?grant_type=refresh_token',{method:'POST',redirect:'error',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refresh.coord_revoked})});assert([400,401].includes(afterLogout.status));pass('Auth logout invalidates refresh; no claim of immediate stateless access-JWT revocation');
  const profileCount=(await db.query('select count(*)::int n from vertice_alumni_profiles')).rows[0].n;
  await db.query(readFileSync('supabase/proposals/alumni_nominal_safe_stop.sql','utf8'));await db.query("notify pgrst, 'reload schema'");
  for(const role of ['gestor','reitor','coord','reader']){
   for(const endpoint of ['vertice_alumni_profiles?select=id,full_name,email','vertice_alumni_education?select=id','vertice_alumni_overview?select=*']){r=await request(role,endpoint,null,'GET');assert([401,403,404].includes(r.status),'Safe-stop must not expose table/view');}
   for(const endpoint of ['rpc/alumni_access_context','rpc/alumni_safe_overview']){r=await request(role,endpoint,{p_institution_id:m.ies});assert([401,403,404].includes(r.status),'Safe-stop must not expose read RPC');}
   r=await request(role,'rpc/alumni_import_education',{p_institution:m.ies,p_course:m.course,p_enrollment:'QA-AFTER-STOP',p_record:{full_name:'SYNTHETIC',academic_status:'formado'}});assert([401,403,404].includes(r.status),'Safe-stop must close importer');
  }
  assert.equal((await db.query('select count(*)::int n from vertice_alumni_profiles')).rows[0].n,profileCount);pass('Operational safe-stop denies HTTP access and preserves all synthetic profiles');
  completed=true;console.log('PASS isolated Auth/PostgREST lifecycle and policy suite. No production endpoint or persistent grant.');
 }finally{
  try{if(connected)await db.end();}finally{rmSync(directory,{recursive:true,force:true});delete process.env.ALLOW_DISPOSABLE_AUTH_BOOTSTRAP;}
  console.log(completed?'Local session files removed; workflow must still confirm stack destruction.':'Isolated test failed; session files removed; workflow must destroy stack.');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)execute().catch(()=>{console.error('Isolated Auth/REST validation failed. No tokens or response payloads logged.');process.exitCode=1;});
