import {managementOverview} from './management.ts';
import {extractDocumentPreview,type ExtractionAdapters} from './extraction.ts';
import {runDocumentReview,validateSnippets,inspectSensitiveText,ReviewError,type VerifiedSnippet,type ReviewCompletion} from './core.ts';
export type Scope={actorId:string;institutionId:string;courseId:string};
export type Policy={enabled:boolean;model:string|null;max_output_tokens:number;max_files:number};
export type Reservation={reservation_id:string;model:string;max_output_tokens:number};
export type Backend={
 management:(scope:Scope)=>Promise<{id:string;file_id:string;file_name:string;page:null;text:string;sha256:string;sensitive_findings:string[]}[]>;
 authenticate:(authorization:string)=>Promise<string>;
 context:(scope:Scope,files:string[])=>Promise<Policy>;
 extraction:(scope:Scope)=>ExtractionAdapters;
 criteria:(scope:Scope,files:string[])=>Promise<{id:string;title:string;source_url:string}[]>;
 reserve:(scope:Scope,files:string[],hash:string)=>Promise<Reservation>;
 claim:(id:string,actor:string,hash:string)=>Promise<void>;
 finalize:(id:string,actor:string,state:'succeeded'|'failed',hash:string|null,usage:{input_tokens:number|null;output_tokens:number|null},code:string|null)=>Promise<void>;
};
export class BoundaryError extends Error{constructor(readonly code:string,readonly status:number){super(code)}}
export type HandlerOptions={backend:(authorization:string)=>Backend;configured:()=>boolean;apiKey:()=>string;review?:typeof runDocumentReview};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGINS=new Set(['https://www.verticesuperior.com.br','https://verticesuperior.com.br','https://vertice-educacao-superior-jlri.onrender.com']);
export async function hashValue(value:unknown){const bytes=new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
async function readBody(req:Request){if(Number(req.headers.get('content-length')??0)>65536)throw new BoundaryError('request_too_large',413);if(!req.body)throw new BoundaryError('invalid_request',400);const reader=req.body.getReader();const parts:Uint8Array[]=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw new BoundaryError('request_too_large',413);parts.push(value)}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock()}const bytes=new Uint8Array(size);let n=0;for(const part of parts){bytes.set(part,n);n+=part.length}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new BoundaryError('invalid_request',400)}}
function auditError(code:string):string{return ({provider_unavailable:'provider_error',timeout:'timeout',invalid_output:'invalid_output',refused:'safety_block',sensitive_input:'safety_block',evidence_changed:'evidence_changed'} as Record<string,string>)[code]??'internal_error';}
export function createReviewHandler(options:HandlerOptions){return async(req:Request):Promise<Response>=>{
 const origin=req.headers.get('origin');const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin&&ORIGINS.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
 const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!ORIGINS.has(origin))return response({error:'origin_denied'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return response({error:'method_not_allowed'},405);
 let reservation:Reservation|undefined,scope:Scope|undefined,backend:Backend|undefined;
 try{
  const authorization=req.headers.get('authorization')??'';if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization)||authorization.length>8192)throw new BoundaryError('authentication_required',401);
  backend=options.backend(authorization);const actorId=await backend.authenticate(authorization);
  const body=await readBody(req);if(!body||typeof body!=='object'||Array.isArray(body)||!['status','preview','analyze'].includes(body.action)||!UUID.test(body.institution_id??'')||!UUID.test(body.course_id??''))throw new BoundaryError('invalid_request',400);
  const allowed=new Set(['action','institution_id','course_id','file_ids','preview_digest','selections','privacy_confirmed']);if(Object.keys(body).some(k=>!allowed.has(k)))throw new BoundaryError('invalid_request',400);
  const files=body.file_ids??[];if(!Array.isArray(files)||files.length>3||files.some(f=>typeof f!=='string'||!UUID.test(f))||new Set(files).size!==files.length)throw new BoundaryError('invalid_request',400);
  scope={actorId,institutionId:body.institution_id,courseId:body.course_id};const policy=await backend.context(scope,files);
  if(body.action==='status')return response({configured:options.configured(),...policy,limits:{files:3,bytes_per_file:5*1024*1024,snippets:12,snippet_chars:4000,total_chars:24000},provider:'OpenAI',supported_formats:['txt','csv'],overview:managementOverview(await backend.management(scope))});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);let preview;
  try{preview=files.length?await extractDocumentPreview(scope,files,backend.extraction(scope),controller.signal):{files:[]}}finally{clearTimeout(timeout)}
  const chunks=[...await backend.management(scope),...preview.files.flatMap(f=>f.chunks.map(c=>({id:c.id,file_id:c.fileId,file_name:f.fileName??'',page:c.page,text:c.text,sha256:c.sha256,sensitive_findings:inspectSensitiveText(c.text)})))];
  const digest=await hashValue({scope,files:preview.files.map(f=>({id:f.fileId,status:f.status,sha256:f.sha256??null})),chunks:chunks.map(c=>({id:c.id,text:c.text}))});
  if(body.action==='preview')return response({preview_digest:digest,chunks,overview:managementOverview(chunks),unsupported:preview.files.filter(f=>f.status!=='ready').map(f=>({file_id:f.fileId,status:f.status,message:f.message})),reviewRequired:true,providerTransmission:false});
  if(body.privacy_confirmed!==true||typeof body.preview_digest!=='string'||body.preview_digest!==digest)throw new BoundaryError('preview_changed_or_unconfirmed',409);
  if(!policy.enabled||!options.configured()||!policy.model)throw new BoundaryError('analysis_not_configured',503);
  const snippets:VerifiedSnippet[]=validateSnippets(body.selections);for(const snippet of snippets){const source=chunks.find(c=>c.id===snippet.id);if(!source||!source.text.includes(snippet.text))throw new BoundaryError('unverified_excerpt',400)}
  const criteria=files.length?await backend.criteria(scope,files):[];
  const requestHash=await hashValue({version:'integrated-5',scope,digest,snippets,criteria});
  reservation=await backend.reserve(scope,files,requestHash);await backend.claim(reservation.reservation_id,actorId,requestHash);
  const completion:ReviewCompletion=await (options.review??runDocumentReview)({snippets,model:reservation.model,criteria,coverage:{available:chunks.length,selected:snippets.length,overview:snippets.some(s=>s.id==='gestao_panorama')}},{apiKey:options.apiKey(),maxOutputTokens:reservation.max_output_tokens,timeoutMs:20000});
  await backend.finalize(reservation.reservation_id,actorId,'succeeded',await hashValue(completion.result),completion.usage,null);
  return response({analysis_id:reservation.reservation_id,...completion});
 }catch(error){
  const code=error instanceof BoundaryError||error instanceof ReviewError?error.code:'analysis_unavailable';
  if(reservation&&scope&&backend)await backend.finalize(reservation.reservation_id,scope.actorId,'failed',null,{input_tokens:null,output_tokens:null},auditError(code)).catch(()=>undefined);
  return response({error:code},error instanceof BoundaryError?error.status:error instanceof ReviewError?error.code==='sensitive_input'||error.code==='invalid_input'?400:502:503);
 }
};}

