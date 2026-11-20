import {createClient} from 'npm:@supabase/supabase-js@2.45.4';
import {runAction} from './handler.ts';
import {fail,type Obj} from './core.ts';
// IA suspensa até a plataforma gerar receita (decisão de 19/11/2026). Para religar: secret AI_SUSPENDED=false.
{const __aiFetch=globalThis.fetch;const __aiHosts=/(^|\.)(api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com)$/i;
globalThis.fetch=((input:any,init?:any)=>{let host="";try{host=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url).hostname;}catch{}
if(__aiHosts.test(host)&&String(Deno.env.get("AI_SUSPENDED")??"true").toLowerCase()!=="false")
 return Promise.resolve(new Response(JSON.stringify({error:{type:"ai_suspended",message:"IA suspensa temporariamente."}}),{status:503,headers:{"content-type":"application/json"}}));
return __aiFetch(input,init);}) as typeof fetch;}
const env=(s:string)=>Deno.env.get(s)||'';
const origins=new Set(['https://www.verticesuperior.com.br','https://verticesuperior.com.br','https://vertice-portal.onrender.com','https://vertice-educacao-superior.onrender.com','https://vertice-educacao-superior-site.onrender.com']);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const send=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','vary':'Origin',...(origins.has(origin)?{'access-control-allow-origin':origin}:{}),'access-control-allow-headers':'authorization, content-type, apikey, x-client-info','access-control-allow-methods':'POST, OPTIONS'}});
 if(origin&&!origins.has(origin))return send({error:'origin_denied'},403);
 if(req.method==='OPTIONS')return send({ok:true});if(req.method!=='POST')return send({error:'method_not_allowed'},405);
 try{
  const token=(req.headers.get('authorization')||'').match(/^Bearer (.+)$/)?.[1];if(!token)throw fail('authentication_required',401);
  const text=await req.text();if(text.length>20000)throw fail('request_too_large',413);const body=JSON.parse(text);
  const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);
  if(!uuid(body.institutionId)||!uuid(body.courseId))throw fail('invalid_scope');
  const keys=(()=>{try{return JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}');}catch{return {};}})();
  const secret=keys.default||env('SUPABASE_SERVICE_ROLE_KEY');
  const client=createClient(env('SUPABASE_URL'),secret,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
  const user=await client.auth.getUser(token);if(user.error||!user.data.user)throw fail('invalid_session',401);
  const rpc=async(action:string,payload:Obj={})=>{const {data,error}=await client.rpc('vertice_discursiva',{p_institution_id:body.institutionId,p_course_id:body.courseId,p_action:action,p_payload:payload});if(error)throw fail(error.code==='42501'?'course_access_denied':error.message,error.code==='42501'?403:400);return data;};
  const call=async(provider:'openai'|'anthropic',system:string,input:Obj,image?:{base64:string;mime:string})=>{
   const open=provider==='openai';const key=env(open?'OPENAI_API_KEY':'ANTHROPIC_API_KEY');if(!key)throw fail('provider_unavailable_'+provider,503);
   const model=env(open?'OPENAI_MODEL':'ANTHROPIC_MODEL')||(open?'gpt-4o':'claude-sonnet-4-6');
   const payload=open?{model,messages:[{role:'system',content:system},{role:'user',content:image?[{type:'text',text:JSON.stringify(input)},{type:'image_url',image_url:{url:`data:${image.mime};base64,${image.base64}`}}]:JSON.stringify(input)}],max_tokens:5000,response_format:{type:'json_object'}}:
    {model,system,messages:[{role:'user',content:image?[{type:'image',source:{type:'base64',media_type:image.mime,data:image.base64}},{type:'text',text:JSON.stringify(input)}]:JSON.stringify(input)}],max_tokens:5000};
   const response=await fetch(open?'https://api.openai.com/v1/chat/completions':'https://api.anthropic.com/v1/messages',{method:'POST',headers:open?{'content-type':'application/json',authorization:'Bearer '+key}:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify(payload),signal:AbortSignal.timeout(75000)});
   if(!response.ok)throw fail('provider_failed_'+provider+'_'+response.status,502);const d=await response.json();
   return {content:open?d.choices?.[0]?.message?.content:d.content?.filter((x:Obj)=>x.type==='text').map((x:Obj)=>x.text).join(''),provider,model:d.model||model};
  };
  const admin=createClient(env('SUPABASE_URL'),secret,{auth:{persistSession:false}});
  const bridge=async(path:string,payload:Obj)=>{
   const base=new URL(env('FATO_ORDEM_BRIDGE_URL')||'https://www.fatoeordem.com.br');const key=env('VERTICE_BRIDGE_API_KEY');
   if(base.protocol!=='https:'||!['www.fatoeordem.com.br','fatoeordem.com.br'].includes(base.hostname)||base.port||base.username||base.password||key.length<32)throw fail('fo_bridge_unavailable',503);
   const r=await fetch(new URL('/api/internal/vertice/manuscript/'+path,base),{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-vertice-bridge-key':key,'x-requested-with':'fato-e-ordem'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw fail('fo_bridge_http_'+r.status,r.status===403?403:502);const data=await r.json();if(!data?.result)throw fail('invalid_fo_response',502);return data.result;
  };
  const foContext=async(submissionId?:string)=>{const {data,error}=await client.rpc('vertice_discursiva_fo_context',{p_institution_id:body.institutionId,p_course_id:body.courseId,p_submission_id:submissionId??null});if(error)throw fail(error.message,403);return data;};
  const foStore=async(action:string,payload:Obj)=>{const {data,error}=await admin.rpc('vertice_discursiva_fo_store',{p_institution_id:body.institutionId,p_course_id:body.courseId,p_actor:user.data.user.id,p_action:action,p_payload:payload});if(error)throw fail(error.message);return data;};
  const aiOn=env('AI_SUSPENDED').toLowerCase()==='false';
  // Conjunto de treino: respostas homologadas do curso (mesma autorização e MFA da RPC principal).
  const trainingSet=async()=>{const {data,error}=await client.rpc('vertice_discursiva_training_set',{p_institution_id:body.institutionId,p_course_id:body.courseId});if(error)return [];return Array.isArray(data)?data:[];};
  const result=await runAction(body,{aiOn,trainingSet,secret,call,rpc,bridge,foContext,foStore,authorize:async()=>{await rpc('list');},sources:async query=>(await rpc('sources',{query})).sources,image:async path=>{
   if(!path.startsWith(`${body.institutionId}/${body.courseId}/${user.data.user.id}/`))throw fail('image_scope_denied',403);
   const {data,error}=await client.storage.from('discursiva-responses').download(path);if(error||!data)throw fail('image_not_found');
   if(data.size>6291456||!['image/jpeg','image/png','image/webp'].includes(data.type))throw fail('invalid_image');
   const bytes=new Uint8Array(await data.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return {base64:btoa(binary),mime:data.type};
  }});return send(result);
 }catch(e){const err=e as Error&{status?:number};return send({error:err.status?err.message:'discursiva_unavailable'},err.status||503);}
});
