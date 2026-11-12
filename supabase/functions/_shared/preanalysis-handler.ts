import {SOURCE_ADAPTERS} from './preanalysis-sources.ts';
import {PIPELINE_VERSION,PreanalysisError,hash,sourceRef,verifySelection,sensitiveFlags,applicableCatalog,validateResult,type SourceRef,type Source,type Chunk,type Catalog,type Policy,type Result} from './preanalysis-core.ts';
import {extractEvidence} from './preanalysis-extraction.ts';
import {callProvider} from './preanalysis-provider.ts';
export type Reservation={run_id:string;state:string;result?:Result;created:boolean};
export interface Backend {
 authenticate():Promise<string>;
 source(ref:SourceRef):Promise<Source>;
 policy(institutionId:string):Promise<Policy>;
 read(source:Source):Promise<Uint8Array>;
 reserve(source:Source,requestHash:string,catalogHash:string,policy:Policy):Promise<Reservation>;
 finalize(id:string,actor:string,requestHash:string,result:Result|null,error:string|null):Promise<void>;
 history(ref:SourceRef):Promise<unknown>;
 review(runId:string,objectKey:string|null,decision:'accepted'|'rejected',reason:string):Promise<unknown>;
}
const ORIGINS=new Set(['https://www.verticesuperior.com.br','https://verticesuperior.com.br','https://vertice-educacao-superior.onrender.com','https://vertice-portal.onrender.com','https://vertice-educacao-superior-site.onrender.com','https://vertice-educacao-superior-jlri.onrender.com']);
async function readBody(req:Request):Promise<Record<string,unknown>>{
 if(!req.body||Number(req.headers.get('content-length')??0)>50000)throw new PreanalysisError('invalid_request',413);
 const reader=req.body.getReader();const parts:Uint8Array[]=[];let size=0;try{for(;;){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>50000)throw new PreanalysisError('request_too_large',413);parts.push(x.value)}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock()}
 const bytes=new Uint8Array(size);let n=0;for(const p of parts){bytes.set(p,n);n+=p.length}let b;try{b=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new PreanalysisError('invalid_request')}
 if(!b||typeof b!=='object'||Array.isArray(b))throw new PreanalysisError('invalid_request');return b;
}
function sameSource(a:Source,b:SourceRef){return a.institutionId===b.institutionId&&a.sourceTable===b.sourceTable&&a.sourceId===b.sourceId&&typeof a.version==='string'&&a.version.length>0&&['file','structured'].includes(a.kind)}
export function createPreanalysisHandler(options:{backend:(authorization:string)=>Backend;catalog:Catalog[];apiKey:(provider:string)=>string;provider?:typeof callProvider;enabled:()=>boolean;sourceRefPermitted?:(ref:SourceRef)=>boolean;processingScope?:(source:Source)=>{expectedContentHash?:string}|null}){
 return async(req:Request):Promise<Response>=>{
 const origin=req.headers.get('origin');const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin&&ORIGINS.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'});
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!ORIGINS.has(origin))return respond({error:'origin_denied'},403);if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
 let backend:Backend|undefined,actor='',reservation:Reservation|undefined,requestHash='';
 try{
  const auth=req.headers.get('authorization')??'';if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth)||auth.length>8192)throw new PreanalysisError('authentication_required',401);
  backend=options.backend(auth);actor=await backend.authenticate();const body=await readBody(req);
  const action=body.action??'preview';if(!['preview','analyze','history','review'].includes(String(action)))throw new PreanalysisError('invalid_action');
  const allowed=action==='review'?['action','run_id','object_key','decision','reason']:['action','institution_id','source_table','source_id','file_id','preview_digest','selections','privacy_confirmed','coverage_acknowledged'];
  if(Object.keys(body).some(k=>!allowed.includes(k)))throw new PreanalysisError('invalid_request');
  if(action==='review'){
   if(typeof body.run_id!=='string'||!['accepted','rejected'].includes(String(body.decision))||(body.object_key!==null&&typeof body.object_key!=='string')||typeof body.reason!=='string'||body.reason.length>1000)throw new PreanalysisError('invalid_review');
   return respond({review:await backend.review(body.run_id,body.object_key as string|null,body.decision as 'accepted'|'rejected',body.reason)});
  }
  const ref=sourceRef(body);
  if(action!=='history'){if(!options.enabled())throw new PreanalysisError('analysis_not_activated',503);if(!options.sourceRefPermitted?.(ref))throw new PreanalysisError('source_not_in_release',403);}
  const source=await backend.source(ref);if(!sameSource(source,ref))throw new PreanalysisError('source_unavailable',403);
  if(action==='history')return respond({runs:await backend.history(ref),source_version:source.version});
  const policy=await backend.policy(source.institutionId);
  // Kill switch and exact release scope also protect preview extraction, not just provider calls.
  if(!options.enabled()||!policy.enabled)throw new PreanalysisError('analysis_not_activated',503);
  const processingPermit=options.processingScope?.(source);if(!processingPermit)throw new PreanalysisError('source_not_in_release',403);
  let chunks:Chunk[]=[],status='ready',limitations:string[]=[],contentHash='',extractionVersion='structured-allowlist-v2',documentCoverage:string|null=null,pageCoverage:{page:number;status:string;characters:number}[]=[];
  if(source.kind==='file'){
   if(!Number.isSafeInteger(source.sizeBytes)||Number(source.sizeBytes)<0||Number(source.sizeBytes)>5*1024*1024)throw new PreanalysisError('file_size_limit',413);
   const bytes=await backend.read(source);
   if(processingPermit.expectedContentHash){const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer)),b=>b.toString(16).padStart(2,'0')).join('');if(actual!==processingPermit.expectedContentHash)throw new PreanalysisError('release_content_mismatch',409);}
   const extraction=await extractEvidence(bytes,{fileName:source.fileName??'',mimeType:source.mimeType??'',sizeBytes:source.sizeBytes!});
   chunks=extraction.chunks;status=extraction.status;limitations=extraction.limitations;contentHash=extraction.sha256;extractionVersion=extraction.extractionVersion;documentCoverage=extraction.documentCoverage??null;pageCoverage=extraction.pageCoverage??[];
   if(source.sha256&&source.sha256.toLowerCase()!==contentHash)throw new PreanalysisError('source_integrity_mismatch',409);
  }else {
   // Only server allowlisted fields; no arbitrary client JSON, SQL or URLs.
   const adapter=SOURCE_ADAPTERS.find(a=>a.table===source.sourceTable&&a.kind==='structured');
   if(!source.fields||!adapter)throw new PreanalysisError('adapter_pending',409);
   const text=JSON.stringify(source.fields,null,2);if(text.length>20000)throw new PreanalysisError('structured_source_limit',413);
   contentHash=await hash(source.fields);chunks=[{id:'structured_1',text,page:null,section:adapter.label}];
   limitations=[adapter.fieldPolicy,'Dados declarados ou reportados, com contexto limitado; não comprovam qualidade, execução ou conceito regulatório.'];
  }
  // Re-authorize immediately after read, detecting source replacement/revocation.
  const latest=await backend.source(ref);if(!sameSource(latest,ref)||latest.version!==source.version)throw new PreanalysisError('source_changed',409);
  const catalog=applicableCatalog(options.catalog,source);const catalogHash=await hash(catalog);
  const digest=await hash({actor,ref,sourceVersion:source.version,contentHash,status,extractionVersion,documentCoverage,pageCoverage,chunks,catalogHash,policy,pipeline:PIPELINE_VERSION});
  const coverage={catalogs:catalog.map(c=>({key:c.key,label:c.label,version:c.version,scope:c.scope,regulatoryStatus:c.regulatoryStatus,objects:c.objects.length})),unavailableCourseCatalogs:source.courseId===null,notes:['Catálogos especializados de curso requerem perfil validado e não são inferidos pelo título do documento.']};
  if(action==='preview')return respond({preview_digest:digest,source_version:source.version,content_hash:contentHash,extraction_status:status,document_coverage:documentCoverage,page_coverage:pageCoverage,chunks:chunks.map(c=>({...c,sensitive_flags:sensitiveFlags(c.text)})),limitations,coverage,provider:policy.provider,model:policy.model,enabled:policy.enabled&&options.enabled(),providerTransmission:false,reviewRequired:true});
  if(status!=='ready'&&status!=='ready_with_gaps')throw new PreanalysisError('extraction_requires_manual_review',409);
  if(body.privacy_confirmed!==true||typeof body.preview_digest!=='string'||body.preview_digest!==digest)throw new PreanalysisError('preview_changed_or_unconfirmed',409);
  if(status==='ready_with_gaps'&&body.coverage_acknowledged!==true)throw new PreanalysisError('partial_coverage_unconfirmed',409);
  const selected=verifySelection(body.selections,chunks);
  if(!options.enabled()||!policy.enabled||!policy.provider||!policy.model||!options.apiKey(policy.provider))throw new PreanalysisError('analysis_not_activated',503);
  if(!catalog.length)throw new PreanalysisError('catalog_unavailable',409);
  requestHash=await hash({actor,ref,version:source.version,contentHash,extractionVersion,documentCoverage,pageCoverage,coverageAcknowledged:body.coverage_acknowledged===true,catalogHash,selected,policy,pipeline:PIPELINE_VERSION});
  reservation=await backend.reserve(source,requestHash,catalogHash,policy);
  if(!reservation.created)return respond({run_id:reservation.run_id,state:reservation.state,result:reservation.result??null,reused:true});
  const raw=await (options.provider??callProvider)(policy,selected,catalog,options.apiKey(policy.provider));
  const result:Result={...validateResult(raw,catalog,selected),provenance:{pipelineVersion:PIPELINE_VERSION,extractionVersion,sourceVersion:source.version,contentHash,catalogHash,selectedChunkHashes:await Promise.all(selected.map(async c=>({id:c.id,sha256:await hash(c.text)}))),scope:'selected_excerpts',documentCoverage,pageCoverage,coverageAcknowledged:body.coverage_acknowledged===true}};
  if(status==='ready_with_gaps')result.limitations.push(`Leitura textual parcial. Páginas ${pageCoverage.filter(p=>p.status!=='text'&&p.status!=='confirmed_blank').map(p=>p.page).join(', ')} não tiveram conteúdo textual verificado e permanecem para revisão visual ou OCR. Os trechos selecionados não representam leitura integral.`);
  const after=await backend.source(ref);if(!sameSource(after,ref)||after.version!==source.version)throw new PreanalysisError('source_changed',409);
  await backend.finalize(reservation.run_id,actor,requestHash,result,null);
  return respond({run_id:reservation.run_id,state:'completed',result,reused:false});
 }catch(error){
  const code=error instanceof PreanalysisError?error.code:'preanalysis_unavailable';
  if(reservation?.created&&backend)await backend.finalize(reservation.run_id,actor,requestHash,null,code).catch(()=>undefined);
  return respond({error:code},error instanceof PreanalysisError?error.status:503);
 }
 };
}
