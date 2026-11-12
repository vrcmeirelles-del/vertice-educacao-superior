import test from 'node:test';
import assert from 'node:assert/strict';
import {totp,checkConfig,localOnlyFetch,fixtureSql,personas,sid,bootstrap} from './bootstrap-auth.mjs';
import {validate,expectedHead,cases,assertOverview} from './http-contract.mjs';
test('RFC6238 SHA1 vector, 59 seconds',()=>assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',59000,8),'94287082'));
test('configuration rejects nonlocal endpoints before any client exists',async()=>{for(const base_url of ['https://project.supabase.co','http://localhost:54321','http://127.0.0.1:54321/remote'])await assert.rejects(()=>bootstrap({authorization:'CREATE_FICTITIOUS_USERS_IN_DISPOSABLE_LOCAL_AUTH',source_head:expectedHead,contains_real_data:false,base_url},{createClient:()=>{throw Error('MUST NOT EXECUTE');}}));});
test('transport blocks cross-origin and preserves no-redirect',async()=>{let calls=0;const f=localOnlyFetch('http://127.0.0.1:54321',async(url,init)=>{calls++;assert.equal(init.redirect,'error');return {ok:true};});for(const u of ['https://prod.supabase.co/auth/v1/user','http://127.0.0.1:54322/auth/v1/user','http://127.0.0.1:54321/rest/v1/x','http://x:y@127.0.0.1:54321/auth/v1/user'])await assert.rejects(()=>f(u));assert.equal(calls,0);await f('http://127.0.0.1:54321/auth/v1/token?grant_type=password');assert.equal(calls,1);});
test('SQL map only accepts UUIDs and fictitious identity check',()=>{const m=Object.fromEntries(personas.map((p,i)=>[p,sid(100+i)]));const sql=fixtureSql(m);assert(sql.includes('auth.users'));assert(sql.includes('@example.invalid'));assert(sql.includes('qa.disposable_alumni'));assert(sql.includes("set revoked_at=now()"));assert(sql.includes("set role='gestor'"));assert.throws(()=>fixtureSql({...m,coord:"';DROP TABLE users;--"}));});
// Decoder-only strings, NOT signed tokens, NOT accepted by Auth, NEVER sent over HTTP.
function mockToken(payload){return 'offline.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.not-a-signature';}
function manifest(){const issuer='http://127.0.0.1:54321/auth/v1';return {purpose:'disposable-alumni-contract-only',source_head:expectedHead,contains_real_data:false,auth_url:issuer,auth_issuer:issuer,anon_issuer:'supabase-demo',rest_url:'http://127.0.0.1:54321/rest/v1',ies:sid(1),other_ies:sid(2),course:sid(11),other_course:sid(13),education:sid(41),profile:sid(31),actor:sid(103),multi_courses:[sid(11),sid(13)],tokens:Object.fromEntries([...new Set(cases.map(c=>c[1]))].map(key=>[key,mockToken({iss:key==='anon'?'supabase-demo':issuer,role:key==='anon'?'anon':'authenticated',aal:key.endsWith('_aal1')?'aal1':'aal2',sub:sid(103),exp:Date.now()/1000+60})]))};}
test('manifest decoder guard accepts isolated mapping shape, not token authenticity',()=>assert(validate(manifest())));
test('actor mismatch rejected',()=>{const m=manifest();m.actor=sid(104);assert.throws(()=>validate(m));});
test('foreign user issuer rejected',()=>{const m=manifest();m.tokens.coord=mockToken({iss:'https://prod.supabase.co/auth/v1',role:'authenticated',aal:'aal2',sub:m.actor,exp:Date.now()/1000+60});assert.throws(()=>validate(m));});
test('administrative tested token rejected',()=>{const m=manifest();m.tokens.coord=mockToken({iss:m.auth_issuer,role:'service_role',aal:'aal2',sub:m.actor,exp:Date.now()/1000+60});assert.throws(()=>validate(m));});
import {guardEnvironment} from './run.mjs';
test('orchestrator refuses the restricted local environment and missing opt-in',()=>{assert.throws(()=>guardEnvironment({GITHUB_ACTIONS:'false',ALLOW_DISPOSABLE_ALUMNI_HTTP:'YES',RUNNER_TEMP:'/tmp/qa'}));assert.throws(()=>guardEnvironment({GITHUB_ACTIONS:'true',RUNNER_TEMP:'/tmp/qa'}));assert.throws(()=>guardEnvironment({GITHUB_ACTIONS:'true',ALLOW_DISPOSABLE_ALUMNI_HTTP:'YES'}));assert.doesNotThrow(()=>guardEnvironment({GITHUB_ACTIONS:'true',ALLOW_DISPOSABLE_ALUMNI_HTTP:'YES',RUNNER_TEMP:'/tmp/qa'}));});

// Pure response-shape tests, no SQL/HTTP executed.
test('role indicator schema: exact and protected boundary counts 0 through 6',()=>{
 for(let n=0;n<=6;n++)for(const authorized of [false,true])for(const scope of ['institution','courses']){
  const small=!authorized&&n<5;const body={institution_id:sid(1),indicator_scope:scope,population:'distinct_eligible_profiles',privacy_mode:small?'small_group_range':'exact',total_egressos:small?null:n,total_egressos_min:small?0:null,total_egressos_max:small?4:null,suppression_applied:small};
  assertOverview(body,sid(1),scope,n,authorized);
  assert.throws(()=>assertOverview({...body,total_egressos:999},sid(1),scope,n,authorized));
  assert.throws(()=>assertOverview({...body,unrequested_profile_ids:[]},sid(1),scope,n,authorized));
 }
});
test('indicator contract rejects old bands and incorrect scope/population',()=>{
 const exact={institution_id:sid(1),indicator_scope:'courses',population:'distinct_eligible_profiles',privacy_mode:'exact',total_egressos:1,total_egressos_min:null,total_egressos_max:null,suppression_applied:false};
 for(const body of [{...exact,privacy_mode:'institution_band_5'},{...exact,indicator_scope:'institution'},{...exact,population:'education_rows'}])assert.throws(()=>assertOverview(body,sid(1),'courses',1,true));
});
