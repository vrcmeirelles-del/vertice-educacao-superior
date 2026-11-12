import {PreanalysisError,type SourceRef,type Source,type Policy} from './preanalysis-core.ts';
import type {Backend,Reservation} from './preanalysis-handler.ts';
export function makePreanalysisBackend(authorization:string,env:(name:string)=>string|undefined,fetcher:typeof fetch=fetch):Backend {
 const base=env('SUPABASE_URL')??'';if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base))throw new PreanalysisError('backend_not_configured',503);
 function key(service=false):string{const kind=service?'SECRET':'PUBLISHABLE';const bundle=env(`SUPABASE_${kind}_KEYS`);if(bundle){try{const k=JSON.parse(bundle).default;if(typeof k==='string'&&k)return k}catch{}}
 const k=env(service?'SUPABASE_SERVICE_ROLE_KEY':'SUPABASE_ANON_KEY');if(!k)throw new PreanalysisError('backend_not_configured',503);return k}
 function headers(service=false):Record<string,string>{const apiKey=key(service);return {apikey:apiKey,'Content-Type':'application/json',...(!service?{Authorization:authorization}:apiKey.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${apiKey}`})}}
 async function request(path:string,body?:unknown,service=false):Promise<any>{
 const res=await fetcher(base+path,{method:body===undefined?'GET':'POST',headers:headers(service),...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!res.ok){if(res.status===401)throw new PreanalysisError('authentication_required',401);let code='';try{code=(await res.json()).code??''}catch{}throw new PreanalysisError(code==='42501'||res.status===403?'source_unavailable':code==='40001'?'source_changed':code==='53300'?'quota_exceeded':code==='55000'?'analysis_not_activated':'backend_unavailable',code==='42501'||res.status===403?403:code==='40001'?409:code==='53300'?429:503)}
 return res.status===204?null:res.json();}
 const rpc=(name:string,body:unknown,service=false)=>request(`/rest/v1/rpc/${name}`,body,service);
 const args=(r:SourceRef)=>({p_institution:r.institutionId,p_source_table:r.sourceTable,p_source_id:r.sourceId});
 return {
 async authenticate(){const u=await request('/auth/v1/user');if(!u?.id||u.is_anonymous===true)throw new PreanalysisError('authentication_required',401);return u.id},
 async source(ref){const d=await rpc('vertice_preanalysis_source',args(ref));if(!d)throw new PreanalysisError('source_unavailable',403);return {institutionId:d.institution_id,sourceTable:d.source_table,sourceId:d.source_id,courseId:d.course_id??null,version:d.source_version,kind:d.kind,fileName:d.file_name,mimeType:d.mime_type,sizeBytes:d.size_bytes,sha256:d.sha256,storageBucket:d.storage_bucket,storagePath:d.storage_path,fields:d.snapshot} as Source},
 async policy(inst){const p=await rpc('vertice_preanalysis_policy',{p_institution:inst});return {enabled:p.enabled===true,provider:p.provider,model:p.model,maxOutputTokens:p.max_output_tokens??3200} as Policy},
 async read(source){
  // Source is exclusively server-resolved. Still reject unexpected buckets/paths.
  const buckets=source.sourceTable==='vertice_documents'?['vertice-documents']:['vertice-repositorios','vertice-recredenciamento-2017','vertice-novo-instrumento-2026-institucional','vertice-novo-instrumento-2026-cursos'];
  const expected=source.storageBucket;
  if(!expected||!buckets.includes(expected)||typeof source.storagePath!=='string'||!source.storagePath.startsWith(source.institutionId+'/')||source.storagePath.split('/').some(p=>!p||p==='.'||p==='..'||/[\\%\x00-\x1f]/.test(p)))throw new PreanalysisError('storage_scope_denied',403);
  const path=source.storagePath.split('/').map(encodeURIComponent).join('/');
  const res=await fetcher(`${base}/storage/v1/object/authenticated/${expected}/${path}`,{headers:headers(),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok||!res.body)throw new PreanalysisError('storage_unavailable',403);
  if(Number(res.headers.get('content-length')??0)>5*1024*1024)throw new PreanalysisError('file_size_limit',413);
  const reader=res.body.getReader();const parts:Uint8Array[]=[];let size=0;
  try{for(;;){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>5*1024*1024||size!==0&&size>Number(source.sizeBytes))throw new PreanalysisError('file_size_limit',413);parts.push(x.value)}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock()}
  if(size!==source.sizeBytes)throw new PreanalysisError('source_integrity_mismatch',409);const bytes=new Uint8Array(size);let n=0;for(const p of parts){bytes.set(p,n);n+=p.length}return bytes;
 },
 async reserve(s,requestHash,catalogHash,p){return await rpc('vertice_preanalysis_reserve',{...args(s),p_source_version:s.version,p_request_hash:requestHash,p_catalog_hash:catalogHash,p_provider:p.provider,p_model:p.model}) as Reservation},
 async finalize(id,actor,requestHash,result,error){const settled=await rpc('vertice_preanalysis_finalize',{p_run_id:id,p_expected_actor:actor,p_request_hash:requestHash,p_result:result,p_error_code:error},true);if(result&&settled?.state!=='completed')throw new PreanalysisError(settled?.error_code==='actor_revoked'?'source_unavailable':'source_changed',409)},
 async history(ref){const runs=await request(`/rest/v1/vertice_evidence_preanalysis_runs?institution_id=eq.${ref.institutionId}&source_table=eq.${ref.sourceTable}&source_id=eq.${ref.sourceId}&select=id,state,result,error_code,source_version,created_at,provider,model&order=created_at.desc&limit=10`);if(!runs.length)return [];const decisions=await request(`/rest/v1/vertice_evidence_preanalysis_decisions?institution_id=eq.${ref.institutionId}&run_id=in.(${runs.map((r:any)=>r.id).join(',')})&select=run_id,object_key,decision,reason,created_at,validation_status,audit_sequence&order=audit_sequence.desc&limit=500`);return runs.map((r:any)=>({...r,decisions:decisions.filter((d:any)=>d.run_id===r.id)}))},
 async review(runId,objectKey,decision,reason){return rpc('vertice_preanalysis_review',{p_run_id:runId,p_object_key:objectKey,p_decision:decision,p_reason:reason})},
 };
}
