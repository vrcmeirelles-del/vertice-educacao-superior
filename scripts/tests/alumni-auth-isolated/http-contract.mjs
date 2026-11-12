// REVIEW CANDIDATE ONLY. Original runner remains unchanged.
// PRIVATE PREPARATION. No endpoint is contacted without explicit disposable-run opt-in.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const expectedHead='4e1884a7db86671e364136cf57b7662e04d32b1f';
export const cases=[
 ['anonymous aggregate RPC denied','anon','rpc/alumni_safe_overview','POST','denied'],
 ['AAL1 management aggregate denied','gestor_aal1','rpc/alumni_safe_overview','POST','denied'],
 ['master AAL1 denied','master_aal1','rpc/alumni_access_context','POST','denied'],
 ['master AAL2 institutional context','master','rpc/alumni_access_context','POST','institution_import'],
 ['reitoria actual institutional education','reitor','vertice_alumni_education?select=id,institution_id,course_id,profile:vertice_alumni_profiles!profile_id(id,full_name,email)','GET','institution_rows'],
 ['reader context aggregate only','reader','rpc/alumni_access_context','POST','none'],
 ['reader raw profiles empty','reader','vertice_alumni_profiles?select=id,full_name,email','GET','empty'],
 ['reader education empty','reader','vertice_alumni_education?select=id,profile_id,course_id','GET','empty'],
 ['reader old owner overview empty','reader','vertice_alumni_overview?select=*','GET','empty'],
 ['reader safe overview protected shape','reader','rpc/alumni_safe_overview','POST','aggregate'],
 ['foreign institution RPC denied','reader','rpc/alumni_access_context','POST','foreign_denied'],
 ['reitoria institutional read without import','reitor','rpc/alumni_access_context','POST','institution_read'],
 ['direction institutional read without import','diretor','rpc/alumni_access_context','POST','institution_read'],
 ['coordinator embedded profile only own course','coord','vertice_alumni_education?select=id,course_id,profile:vertice_alumni_profiles!profile_id(id,full_name,email)','GET','course_rows'],
 ['coordinator foreign course filter empty','coord','vertice_alumni_education?select=id,course_id','GET','other_course_empty'],
 ['multicourse coordinator context union','coord_multi','rpc/alumni_access_context','POST','multicourse'],
 ['revoked coordinator context empty','coord_revoked','rpc/alumni_access_context','POST','none'],
 ['conflicting promotion context denied','coord_conflict','rpc/alumni_access_context','POST','none'],
 ['conflicting promotion importer denied','coord_conflict','rpc/alumni_import_education','POST','import_denied'],
 ['reitoria importer denied','reitor','rpc/alumni_import_education','POST','import_denied'],
 ['coordinator importer denied','coord','rpc/alumni_import_education','POST','import_denied'],
 ['reader direct relink denied','reader','vertice_alumni_education','PATCH','write_denied'],
 ['coordinator selfgrant denied','coord','vertice_alumni_course_grants','POST','write_denied'],
 ['management global history denied','gestor','vertice_alumni_contact_history?select=*','GET','denied'],
 ['management CPF hash denied','gestor','vertice_alumni_profiles?select=cpf_hash','GET','denied'],
 ['legacy importer denied','gestor','rpc/alumni_find_or_create_profile','POST','legacy_denied'],
 ['manager atomic import idempotent','gestor','rpc/alumni_import_education','POST','import_retry'],
];
export function localUrl(value){const u=new URL(value);assert.equal(u.protocol,'http:','Disposable localhost HTTP only');assert(['127.0.0.1','localhost','[::1]'].includes(u.hostname),'Remote hosts forbidden');assert(!u.username&&!u.password&&!u.search&&!u.hash,'No credentials/query/hash in base URL');return u;}
export function validate(m){assert.equal(m.purpose,'disposable-alumni-contract-only');assert.equal(m.source_head,expectedHead);assert.equal(m.contains_real_data,false);localUrl(m.rest_url);localUrl(m.auth_url);localUrl(m.auth_issuer);const origin=localUrl(m.auth_url).origin;assert.equal(localUrl(m.rest_url).origin,origin);assert.equal(localUrl(m.auth_issuer).origin,origin);assert.equal(localUrl(m.auth_url).hostname,'127.0.0.1');assert.equal(localUrl(m.auth_url).pathname,'/auth/v1');assert.equal(localUrl(m.auth_issuer).pathname,'/auth/v1');assert.equal(localUrl(m.rest_url).pathname,'/rest/v1');assert.equal(new Set(cases.map(c=>c[1])).size,Object.keys(m.tokens).length,'Exact role token fixture required');for(const key of new Set(cases.map(c=>c[1]))){const token=m.tokens[key];assert.equal(typeof token,'string');const part=token.split('.');assert.equal(part.length,3);const c=JSON.parse(Buffer.from(part[1],'base64url'));if(key==='anon'){assert.equal(c.role,'anon');assert.equal(c.iss,m.anon_issuer);assert(['supabase','supabase-demo',m.auth_issuer].includes(m.anon_issuer),'Unexpected local anonymous issuer');}else{assert.equal(c.iss,m.auth_issuer,'Only tokens from configured disposable Auth issuer');assert.equal(c.role,'authenticated');assert.equal(c.aal,key.endsWith('_aal1')?'aal1':'aal2');}assert(c.exp>Date.now()/1000,'Expired fixture token');assert(!['service_role','supabase_admin'].includes(c.role),'Never use administrative token for tested calls');}
 for(const id of [m.ies,m.other_ies,m.course,m.other_course,m.education,m.profile,...m.multi_courses])assert(/^00000000-0000-4000-8000-[0-9]{12}$/.test(id),'Synthetic fixture UUIDs only');assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(m.actor),'Valid Auth UUID required');assert.equal(m.actor,JSON.parse(Buffer.from(m.tokens.coord.split('.')[1],'base64url')).sub,'actor must be coordinator session subject');assert(m.multi_courses.includes(m.course)&&m.multi_courses.length>1);return m;}
export async function run(m){validate(m);assert.equal(process.env.ALLOW_DISPOSABLE_ALUMNI_HTTP,'YES','Requires explicit opt-in in separately authorized environment');
 const request=async(role,path,method,body,auth=false)=>{const base=auth?m.auth_url:m.rest_url;const url=new URL(base.replace(/\/$/,'')+'/'+path);localUrl(url.origin);const res=await fetch(url,{method,redirect:'error',headers:{Authorization:'Bearer '+m.tokens[role],apikey:m.tokens.anon,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await res.json();}catch{data=null;}return {status:res.status,data};};
 // Confirms Auth accepts these disposable sessions, not merely SQL set_config.
 for(const role of Object.keys(m.tokens).filter(r=>r!=='anon')){const r=await request(role,'user','GET',null,true);assert.equal(r.status,200,'Disposable Auth session must validate: '+role);assert(r.data?.id);}
 for(const [name,role,original,method,expect] of cases){let path=original,body=method==='POST'?{p_institution_id:m.ies}:null;
  if(expect==='foreign_denied')body.p_institution_id=m.other_ies;
  if(expect==='other_course_empty')path+='&course_id=eq.'+m.other_course;
  if(expect==='course_rows')path+='&institution_id=eq.'+m.ies;
  if(expect.startsWith('import_'))body={p_institution:m.ies,p_course:m.other_course,p_enrollment:'QA-HTTP-ISOLATED',p_record:{full_name:'SYNTHETIC HTTP',academic_status:'formado'}};
  if(expect==='legacy_denied')body={p_cpf_hash:null,p_full_name:'SYNTHETIC HTTP',p_email:null,p_phone:null,p_source:'import'};
  if(expect==='write_denied')body=method==='PATCH'?{profile_id:m.profile}:{institution_id:m.ies,user_id:m.actor,course_id:m.other_course,granted_by:m.actor,expires_at:'2099-01-01T00:00:00Z'};
  if(method==='PATCH')path+='?id=eq.'+m.education;
  const r=await request(role,path,method,body);
  if(expect.includes('denied')){assert([401,403].includes(r.status),name+' must be authorization failure, not missing RPC/schema');assert.equal(r.data?.code,'42501',name+' must hit access boundary');}
  else {assert.equal(r.status,200,name);const d=r.data;
   if(['empty','other_course_empty'].includes(expect))assert.deepEqual(d,[]);
   if(expect==='none')assert.deepEqual(d,{can_view_nominal:false,can_import:false,nominal_scope:'none',allowed_course_ids:[]});
   if(expect==='institution_import')assert.deepEqual(d,{can_view_nominal:true,can_import:true,nominal_scope:'institution',allowed_course_ids:[]});
   if(expect==='institution_rows'){assert(d.length>0);assert(d.every(x=>x.institution_id===m.ies&&x.profile?.id));assert(m.multi_courses.every(c=>d.some(x=>x.course_id===c)));}
   if(expect==='institution_read')assert.deepEqual(d,{can_view_nominal:true,can_import:false,nominal_scope:'institution',allowed_course_ids:[]});
   if(expect==='multicourse'){assert.equal(d.nominal_scope,'courses');assert.equal(d.can_import,false);assert.deepEqual([...d.allowed_course_ids].sort(),[...m.multi_courses].sort());}
   if(expect==='course_rows'){assert(d.length>0,'Fixture must contain own-course row');assert(d.every(x=>x.course_id===m.course&&x.profile?.id),'Embedded RLS/profile relation must resolve safely');}
   if(expect==='aggregate'){assert.deepEqual(Object.keys(d).sort(),['institution_id','privacy_mode','suppression_applied','total_egressos_min','total_egressos_max'].sort());assert.equal(d.institution_id,m.ies);assert.equal(d.privacy_mode,'institution_band_5');}
   if(expect==='import_retry'){assert(d.profile_id&&d.education_id);const again=await request(role,path,method,body);assert.equal(again.status,200);assert.equal(again.data.profile_id,d.profile_id);assert.equal(again.data.education_id,d.education_id);}
  }
  console.log('PASS '+name); // Never print tokens, response bodies or personal details.
 }
 console.log(`${cases.length} HTTP contract cases passed; Auth session validation only, login/MFA enrollment lifecycle separately required.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.includes('--plan'))console.log(cases.map(c=>c[0]).join('\n'));else {const path=process.argv[2];assert(path,'Use --plan or explicit disposable manifest path');await run(JSON.parse(readFileSync(path,'utf8')));}}
