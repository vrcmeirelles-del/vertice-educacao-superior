// Test-only bootstrap. Never deploy this function to the production project.
// No passwords, OTP secrets or session tokens are logged or returned.
import {createClient} from 'npm:@supabase/supabase-js@2.45.4';
import {totpCode} from './totp.mjs';
const PROJECT='https://rnmkmnrfhvjihsuqziwf.supabase.co';
const FIXTURE='ENAMED360_TEST_20261117';
const profiles=['master','reitoria','direcao','cpa','coordenacao','nde','docente','sem_autorizacao','outra_ies'];
const env=(key:string)=>Deno.env.get(key)||'';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
const secret=(name:string,fallback:string)=>{try{return JSON.parse(env(name)||'{}').default||env(fallback);}catch{return env(fallback);}};
Deno.serve(async req=>{
 if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
 if(env('SUPABASE_URL')!==PROJECT)return respond({error:'isolated_project_required'},403);
 if(Number(req.headers.get('content-length')||0)>1000)return respond({error:'invalid_request'},400);
 const payload=await req.json().catch(()=>null);const capability=payload?.bootstrapToken;
 if(typeof capability!=='string'||!/^[0-9a-f]{64}$/.test(capability))return respond({error:'bootstrap_denied'},403);
 const adminKey=secret('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
 const anonKey=secret('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY');
 if(!adminKey||!anonKey)return respond({error:'auth_runtime_keys_missing'},503);
 const admin=createClient(PROJECT,adminKey,options);let phase='claim',claimed=false;
 const rpc=async(action:string,payload:unknown={})=>{
  const r=await admin.rpc('enamed_test_bootstrap',{p_token:capability,p_action:action,p_payload:payload});
  if(r.error)throw Error('bootstrap_'+action+'_'+(r.error.code||'failed'));return r.data;
 };
 const check=(r:any,label:string)=>{if(r.error)throw Error(label+'_'+(r.error.code||r.error.status||'failed'));return r.data;};
 try{
  const job=await rpc('claim');claimed=true;const fixture=await rpc('seed');
  for(const profile of profiles){
   phase=profile+':create';let record=job.accounts[profile];
   const email='enamed.qa.'+profile+'.20261117@example.com';
   if(!record){
    const password='Qa!'+Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    const listed=check(await admin.auth.admin.listUsers({page:1,perPage:100}),phase+':list');
    const existing=listed.users.find((u:any)=>u.email===email);
    let user;
    if(existing){
     if(existing.app_metadata?.enamed_fixture!==FIXTURE)throw Error('unexpected_existing_account');
     user=check(await admin.auth.admin.updateUserById(existing.id,{password}),phase+':resume').user;
    }else user=check(await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{enamed_fixture:FIXTURE},user_metadata:{full_name:'CONTA SINTÉTICA ENAMED — '+profile}}),phase+':admin').user;
    record=await rpc('register',{profile,userId:user.id,password});
   }
   phase=profile+':password_login';const credential=await rpc('credential',{profile});
   const userClient=createClient(PROJECT,anonKey,options);
   const session=check(await userClient.auth.signInWithPassword({email,password:credential.password}),phase);
   if(session.user.id!==record.userId)throw Error('unexpected_authenticated_user');
   const before=check(await userClient.auth.mfa.getAuthenticatorAssuranceLevel(),phase+':aal');
   if(before.currentLevel!=='aal1')throw Error('password_login_must_be_aal1');
   const read=async(table:string)=>{const r=await userClient.from(table).select('id');return {ids:(r.data||[]).map((x:any)=>x.id).sort(),error:r.error?.code||null};};
   const aal1={institutions:await read('vertice_institutions'),courses:await read('vertice_courses')};
   let factorId=credential.factorId,totpSecret=credential.totpSecret;
   if(!totpSecret){
    phase=profile+':enroll';const factor=check(await userClient.auth.mfa.enroll({factorType:'totp',friendlyName:'ENAMED QA isolated TOTP'}),phase);
    factorId=factor.id;totpSecret=factor.totp.secret;
    await rpc('mfa_secret',{profile,factorId,totpSecret});
   }
   phase=profile+':verify';const code=await totpCode(totpSecret);
   check(await userClient.auth.mfa.challengeAndVerify({factorId,code}),phase);
   const assurance=check(await userClient.auth.mfa.getAuthenticatorAssuranceLevel(),phase+':aal');
   const verifiedUser=check(await userClient.auth.getUser(),phase+':get_user');
   const factors=check(await userClient.auth.mfa.listFactors(),phase+':factors');
   if(assurance.currentLevel!=='aal2'||verifiedUser.user.id!==record.userId||!factors.totp.some((f:any)=>f.id===factorId&&f.status==='verified'))throw Error('real_auth_verification_failed');
   const aal2={institutions:await read('vertice_institutions'),courses:await read('vertice_courses')};
   await rpc('verified',{profile,observations:{source:'real Supabase Auth password/TOTP and Data API',aal1,aal2}});
   // Log out through Auth; never persist or expose the temporary tokens.
   phase=profile+':signout';check(await userClient.auth.signOut({scope:'local'}),phase);
  }
  phase='finish';return respond(await rpc('finish'));
 }catch(error){
  const code=phase+':'+String((error as Error).message).replace(/[^a-zA-Z0-9_:.-]/g,'').slice(0,150);
  if(claimed)await rpc('failed',{error:code}).catch(()=>null);
  return respond({error:'fixture_provision_failed',phase,code},claimed?503:403);
 }
});
