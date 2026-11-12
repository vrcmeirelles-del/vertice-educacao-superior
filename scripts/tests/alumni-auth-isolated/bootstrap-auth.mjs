// PRIVATE PREPARATION ONLY. Import has no network or service side effects.
import assert from 'node:assert/strict';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,chmodSync} from 'node:fs';
import {createRequire} from 'node:module';
import {localUrl,validate,expectedHead} from './http-contract.mjs';
export const personas=['gestor','master','reader','reitor','diretor','coord','coord_multi','coord_revoked','coord_conflict'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const sid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function claims(token){try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url'));}catch{throw Error('Invalid local token format');}}
export function totp(secret,epoch=Date.now(),digits=6){
 assert(/^[A-Z2-7]+=*$/i.test(secret),'Invalid TOTP secret');
 let bits='';for(const c of secret.toUpperCase().replace(/=+$/,''))bits+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5,'0');
 const key=Buffer.from((bits.match(/.{8}/g)||[]).map(b=>parseInt(b,2)));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(epoch/30000)));
 const digest=createHmac('sha1',key).update(counter).digest();const off=digest[19]&15;
 return String((digest.readUInt32BE(off)&0x7fffffff)%10**digits).padStart(digits,'0');
}
export function checkConfig(c){
 assert.equal(c.authorization,'CREATE_FICTITIOUS_USERS_IN_DISPOSABLE_LOCAL_AUTH');
 assert.equal(c.source_head,expectedHead);assert.equal(c.contains_real_data,false);
 const base=localUrl(c.base_url);assert.equal(base.hostname,'127.0.0.1','Numeric loopback only');assert.equal(base.pathname,'/');assert(base.port,'Explicit isolated port required');
 assert(c.anon_key&&c.service_role_key,'Explicit disposable keys required');
 assert.equal(claims(c.anon_key).role,'anon');assert.equal(claims(c.service_role_key).role,'service_role');
 assert.equal(c.database_fixture_reviewed,true,'Database setup must be separately reviewed');
 assert.equal(typeof c.output_dir,'string');assert(c.output_dir.startsWith('/'),'Absolute private output directory required');
 return base.origin;
}
export function localOnlyFetch(origin,fetchImpl=globalThis.fetch){return async(input,init={})=>{
 const value=typeof input==='string'||input instanceof URL?input:input.url;const u=new URL(value);localUrl(u.origin);assert(!u.username&&!u.password&&!u.hash,'No URL credentials or fragments');
 assert.equal(u.origin,origin,'Cross-origin request blocked');assert(u.pathname.startsWith('/auth/v1/'),'Only local Auth paths allowed');
 return fetchImpl(input,{...init,redirect:'error'});
};}
const unwrap=(r,stage)=>{if(r?.error||!r?.data)throw Error('Local Auth step failed: '+stage);return r.data;};
function checkSession(token,user,aal,issuer){const c=claims(token);assert.equal(c.sub,user);assert.equal(c.aal,aal);assert.equal(c.role,'authenticated');assert.equal(c.iss,issuer);assert(c.exp>Date.now()/1000);return token;}
export function fixtureSql(mapping){
 assert.equal(Object.keys(mapping).length,personas.length);for(const p of personas)assert(uuid.test(mapping[p]),'Auth UUID required');
 const u=p=>`'${mapping[p]}'`;const id=n=>`'${sid(n)}'`;const out=['-- PRIVATE, GENERATED FROM AUTH RETURNED UUIDs. REVIEW ONLY; NEVER EXECUTED BY BOOTSTRAP.','begin;',"do $$begin if current_setting('qa.disposable_alumni',true) is distinct from 'YES' then raise exception 'Disposable database opt-in required'; end if; end$$;",'create temporary table qa_auth_map(persona text primary key,user_id uuid unique not null);'];
 out.push('insert into qa_auth_map values '+personas.map(p=>`('${p}',${u(p)})`).join(',')+';');
 out.push("do $$begin if (select count(*) from qa_auth_map q join auth.users a on a.id=q.user_id where a.email like 'qa-%@example.invalid')<>9 then raise exception 'Auth-created fictional identities required'; end if; end$$;");
 out.push(`insert into public.vertice_institutions(id,name) values(${id(1)},'SYNTHETIC IES A'),(${id(2)},'SYNTHETIC IES B');`);
 out.push(`insert into public.vertice_courses(id,institution_id,name) values(${id(11)},${id(1)},'SYNTHETIC A1'),(${id(13)},${id(1)},'SYNTHETIC A2'),(${id(12)},${id(2)},'SYNTHETIC B1');`);
 for(const p of personas.filter(p=>p!=='master'))out.push(`insert into public.vertice_memberships(user_id,institution_id,role) values(${u(p)},${id(1)},'${p==='gestor'?'gestor':p==='reader'||p==='reitor'?'leitor':'equipe'}');`);
 out.push(`insert into public.vertice_admins(user_id) values(${u('master')});`);
 for(const p of ['reitor','diretor','coord','coord_multi','coord_revoked','coord_conflict'])out.push(`insert into public.vertice_alumni_role_grants(institution_id,user_id,access_role,granted_by,expires_at) values(${id(1)},${u(p)},'${p==='reitor'?'reitoria':p==='diretor'?'direcao':'coordenador'}',${u('gestor')},now()+interval '1 day');`);
 for(const p of ['coord','coord_multi','coord_revoked','coord_conflict'])for(const n of p==='coord_multi'?[11,13]:[11])out.push(`insert into public.vertice_alumni_course_grants(institution_id,user_id,course_id,granted_by,expires_at) values(${id(1)},${u(p)},${id(n)},${u('gestor')},now()+interval '1 day');`);
 out.push(`update public.vertice_alumni_role_grants set revoked_at=now() where user_id=${u('coord_revoked')};`);
 out.push(`update public.vertice_memberships set role='gestor' where user_id=${u('coord_conflict')};`);
 for(const [p,e,c,i] of [[31,41,11,1],[32,42,13,1],[33,43,12,2]]){out.push(`insert into public.vertice_alumni_profiles(id,full_name) values(${id(p)},'SYNTHETIC ${p}');`);out.push(`insert into public.vertice_alumni_education(id,profile_id,institution_id,course_id,enrollment_id,academic_status) values(${id(e)},${id(p)},${id(i)},${id(c)},'QA-${e}','formado');`);}
 out.push(`insert into public.vertice_alumni_education(id,profile_id,institution_id,course_id,enrollment_id,academic_status) values(${id(44)},${id(31)},${id(1)},${id(13)},'QA-SHARED-A','formado'),(${id(45)},${id(31)},${id(2)},${id(12)},'QA-SHARED-B','formado');`);
 out.push('commit;');return out.join('\n')+'\n';
}
export async function bootstrap(c,{createClient,fetchImpl=globalThis.fetch}={}){
 const origin=checkConfig(c);const issuer=origin+'/auth/v1';
 // Explicit opt-in is checked before dependency loading or HTTP.
 assert.equal(process.env.ALLOW_DISPOSABLE_AUTH_BOOTSTRAP,'YES','Future authorized environment only');
 if(!createClient){assert(typeof c.sdk_package_json==='string'&&c.sdk_package_json.startsWith('/'),'Explicit local SDK package required');const require=createRequire(c.sdk_package_json);({createClient}=require('@supabase/supabase-js'));}
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:localOnlyFetch(origin,fetchImpl)}};
 const admin=createClient(origin,c.service_role_key,options);const tokens={anon:c.anon_key},mapping={},refresh={},run=randomUUID();
 // A fresh directory avoids reuse/overwrite; no secrets are written to console or returned.
 mkdirSync(c.output_dir,{mode:0o700});chmodSync(c.output_dir,0o700);
 const save=(name,data)=>writeFileSync(c.output_dir+'/'+name,data,{mode:0o600,flag:'wx'});
 try{
  for(const p of personas){
   const email=`qa-${run}-${p}@example.invalid`,password=randomBytes(36).toString('base64url');
   const created=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{synthetic_fixture:true,fixture_run:run}}),'createUser');
   assert(uuid.test(created.user?.id),'Auth-generated UUID required');mapping[p]=created.user.id;
   const client=createClient(origin,c.anon_key,options);
   const login=unwrap(await client.auth.signInWithPassword({email,password}),'signInWithPassword');
   checkSession(login.session?.access_token,mapping[p],'aal1',issuer);
   if(p==='gestor'||p==='master')tokens[p+'_aal1']=login.session.access_token;
   const enrollment=unwrap(await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Disposable QA'}),'mfa.enroll');
   assert.equal(enrollment.type,'totp');assert(enrollment.totp?.secret);
   const challenge=unwrap(await client.auth.mfa.challenge({factorId:enrollment.id}),'mfa.challenge');
   const verified=unwrap(await client.auth.mfa.verify({factorId:enrollment.id,challengeId:challenge.id,code:totp(enrollment.totp.secret)}),'mfa.verify');
   checkSession(verified.access_token,mapping[p],'aal2',issuer);
   const renewed=unwrap(await client.auth.refreshSession({refresh_token:verified.refresh_token}),'refreshSession');
   tokens[p]=checkSession(renewed.session?.access_token,mapping[p],'aal2',issuer);refresh[p]=renewed.session.refresh_token;
   const user=unwrap(await client.auth.getUser(tokens[p]),'getUser');assert.equal(user.user.id,mapping[p]);
  }
  const manifest={purpose:'disposable-alumni-contract-only',source_head:expectedHead,contains_real_data:false,rest_url:origin+'/rest/v1',auth_url:issuer,auth_issuer:issuer,anon_issuer:claims(c.anon_key).iss,tokens,ies:sid(1),other_ies:sid(2),course:sid(11),other_course:sid(13),education:sid(41),profile:sid(31),actor:mapping.coord,multi_courses:[sid(11),sid(13)]};
  save('refresh.private.json',JSON.stringify(refresh));save('auth-map.private.json',JSON.stringify(mapping));save('fixtures.review-only.sql',fixtureSql(mapping));
  save('manifest.candidate.private.json',JSON.stringify(manifest));
  let compatible=true;try{validate(manifest);}catch{compatible=false;}
  save('status.json',JSON.stringify({auth_lifecycle_completed:true,runner_compatible:compatible,sql_executed:false,homologation_complete:false}));
  return {auth_lifecycle_completed:true,runner_compatible:compatible,sql_executed:false,homologation_complete:false};
 }catch{save('failed.json',JSON.stringify({auth_lifecycle_completed:false,homologation_complete:false,cleanup:'Destroy isolated stack and private output directory; partially created fictional users may exist.'}));throw Error('Disposable bootstrap failed; private stack cleanup required. No remote retry.');}
}
