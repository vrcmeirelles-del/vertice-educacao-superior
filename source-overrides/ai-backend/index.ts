import {createReviewHandler,BoundaryError,type Backend,type Scope,type Policy,type Reservation} from './handler.ts';
import type {ImmutableFile,ExtractionScope} from './extraction.ts';
import indicators from './criteria.json' with {type:'json'};
import {managementChunks} from './management.ts';
declare const Deno:{env:{get:(name:string)=>string|undefined};serve:(handler:(request:Request)=>Promise<Response>)=>void};
const URL=Deno.env.get('SUPABASE_URL')??'';
function platformKey(kind:'PUBLISHABLE'|'SECRET'):string{
 const raw=Deno.env.get(`SUPABASE_${kind}_KEYS`);if(raw){try{const value=JSON.parse(raw).default;if(typeof value==='string'&&value)return value}catch{}}
 const value=Deno.env.get(kind==='PUBLISHABLE'?'SUPABASE_ANON_KEY':'SUPABASE_SERVICE_ROLE_KEY');if(!value)throw new BoundaryError('backend_not_configured',503);return value;
}
function makeBackend(authorization:string):Backend{
 const callerKey=platformKey('PUBLISHABLE');
 const headers=(service=false):Record<string,string>=>{const key=service?platformKey('SECRET'):callerKey;return {'apikey':key,'Content-Type':'application/json',...(!service?{'Authorization':authorization}:key.startsWith('sb_secret_')?{}:{'Authorization':`Bearer ${key}`})}};
 async function json(path:string,init:RequestInit={},service=false):Promise<any>{
  const response=await fetch(URL+path,{...init,headers:{...headers(service),...init.headers},signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok){let code='';try{code=(await response.json()).code??''}catch{}throw new BoundaryError(code==='42501'||response.status===403?'access_denied':code==='53300'?'quota_exceeded':code==='40001'?'evidence_changed':code==='23505'?'already_requested':'backend_unavailable',code==='42501'||response.status===403?403:code==='53300'?429:code==='40001'||code==='23505'?409:503)}
  return response.status===204?null:await response.json();
 }
 const rpc=(name:string,body:Record<string,unknown>,service=false)=>json(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(body)},service);
 async function fileDescriptor(scope:ExtractionScope,fileId:string):Promise<ImmutableFile|null>{
  if(!scope.courseId)return null;
  const rows=await json(`/rest/v1/vertice_repository_files?id=eq.${fileId}&institution_id=eq.${scope.institutionId}&select=id,institution_id,request_id,storage_path,file_name,size_bytes,mime_type&limit=1`);
  const f=Array.isArray(rows)&&rows.length===1?rows[0]:null;if(!f)return null;
  const requests=await json(`/rest/v1/vertice_repository_requests?id=eq.${f.request_id}&institution_id=eq.${scope.institutionId}&course_id=eq.${scope.courseId}&select=id&limit=1`);
  if(!Array.isArray(requests)||requests.length!==1)return null;
  return {fileId:f.id,institutionId:f.institution_id,courseId:scope.courseId,requestId:f.request_id,versionId:f.id,storagePath:f.storage_path,fileName:f.file_name,sizeBytes:Number(f.size_bytes),mimeType:f.mime_type};
 }
 return {
  async management(scope){return managementChunks(await rpc('vertice_ai_management_snapshot',{inst:scope.institutionId,course:scope.courseId}),indicators)},
  async authenticate(){const response=await fetch(URL+'/auth/v1/user',{headers:headers(),signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw new BoundaryError('authentication_required',401);const user=await response.json();if(!user?.id||user.is_anonymous===true)throw new BoundaryError('authentication_required',401);return user.id},
  async context(scope,files){return await rpc('vertice_ai_context',{inst:scope.institutionId,course:scope.courseId,file_ids:files}) as Policy},
  extraction:scope=>({authorizeImmutableFile:fileDescriptor,async readImmutableStorage(file,signal){
   const path=file.storagePath.split('/').map(encodeURIComponent).join('/');
   const response=await fetch(`${URL}/storage/v1/object/authenticated/vertice-repositorios/${path}`,{headers:headers(),signal,redirect:'error'});
   if(!response.ok||!response.body)throw new BoundaryError('document_unavailable',403);
   if(Number(response.headers.get('content-length')??0)>5*1024*1024)throw new BoundaryError('document_too_large',413);
   const body=response.body;return (async function*(){const reader=body.getReader();try{for(;;){const v=await reader.read();if(v.done)break;yield v.value}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock()}})();
  }}),
  async criteria(scope,files){const ids=files.join(',');const rows=await json(`/rest/v1/vertice_repository_files?id=in.(${ids})&institution_id=eq.${scope.institutionId}&select=request_id&limit=3`);const requestIds=[...new Set((rows as any[]).map(f=>f.request_id))].join(',');const requests=await json(`/rest/v1/vertice_repository_requests?id=in.(${requestIds})&institution_id=eq.${scope.institutionId}&course_id=eq.${scope.courseId}&select=indicator&limit=3`);const codes=[...new Set((requests as any[]).flatMap(r=>String(r.indicator??'').match(/\b[123]\.\d{1,2}\b/g)??[]))];return codes.filter(c=>c in indicators).map(id=>({id,title:(indicators as Record<string,string>)[id],source_url:'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/avaliacao-in-loco/instrumentos-de-avaliacao/2017'}))},
  async reserve(scope,files,hash){return await rpc('vertice_ai_reserve',{inst:scope.institutionId,course:scope.courseId,file_ids:files,request_hash:hash}) as Reservation},
  async claim(id,actor,hash){await rpc('vertice_ai_claim',{reservation:id,expected_actor:actor,expected_hash:hash},true)},
  async finalize(id,actor,state,hash,usage,code){await rpc('vertice_ai_finalize',{reservation:id,expected_actor:actor,final_state:state,response_hash:hash,input_tokens:usage.input_tokens,output_tokens:usage.output_tokens,error_code:code},true)},
 };
}
Deno.serve(createReviewHandler({backend:makeBackend,configured:()=>Boolean(Deno.env.get('OPENAI_API_KEY')?.trim()),apiKey:()=>Deno.env.get('OPENAI_API_KEY')??''}));

