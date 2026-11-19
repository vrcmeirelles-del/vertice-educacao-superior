/**
 * Vértice Avalia 360° — serviço privado de imagens.
 * Contrato inicial para homologação, NÃO implantado em produção.
 *
 * Segurança: JWT válido + AAL2 e autorização por curso/disciplinas em RPC,
 * ticket gerado pelo servidor, hash SHA-256 dos bytes baixados do Storage,
 * confirmação exclusivamente pelo service_role. Sem acesso público ao bucket.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.45.4';

const env=(key:string)=>Deno.env.get(key)||'';
const bucket='avalia360-private';
const origins=new Set([
 'https://verticesuperior.com.br','https://www.verticesuperior.com.br',
 'https://vertice-portal.onrender.com','https://vertice-educacao-superior.onrender.com'
]);
type Body={
 action:'prepare'|'confirm';institutionId:string;courseId:string;
 disciplineId:string;questionId:string;sha256:string;mime:string;sizeBytes:number;
 imageId?:string;path?:string;
};
const uuid=(s:unknown):s is string=>typeof s==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const sha=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const validMime=(s:string)=>['image/png','image/jpeg','image/webp'].includes(s);
function sniff(bytes:Uint8Array):string|null{
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&
   String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
function cors(origin:string){
 return {
  'content-type':'application/json','cache-control':'no-store','vary':'Origin',
  'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
  'access-control-allow-methods':'POST,OPTIONS',
  ...(origins.has(origin)?{'access-control-allow-origin':origin}:{})
 };
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const respond=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers:cors(origin)});
 if(origin&&!origins.has(origin))return respond({error:'origin_denied'},403);
 if(req.method==='OPTIONS')return respond({ok:true});
 if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
 const bearer=(req.headers.get('authorization')||'').match(/^Bearer (.+)$/)?.[1];
 if(!bearer)return respond({error:'authentication_required'},401);
 const url=env('SUPABASE_URL');
 const secret=env('SUPABASE_SERVICE_ROLE_KEY');
 const publishable=env('SUPABASE_ANON_KEY');
 if(!url||!secret||!publishable)return respond({error:'configuration_unavailable'},503);
 try{
  const raw=await req.text();
  if(raw.length>4000)return respond({error:'request_too_large'},413);
  const body=JSON.parse(raw) as Body;
  if(!body||!['prepare','confirm'].includes(body.action)||
    !uuid(body.institutionId)||!uuid(body.courseId)||!uuid(body.questionId)||
    typeof body.disciplineId!=='string'||body.disciplineId.length<1||
    body.disciplineId.length>120||!sha(body.sha256)||
    !validMime(body.mime)||!Number.isInteger(body.sizeBytes)||
    body.sizeBytes<1||body.sizeBytes>10485760)
     return respond({error:'invalid_parameters'},400);
  const actorClient=createClient(url,publishable,{global:{headers:{Authorization:'Bearer '+bearer}},
    auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:identityError}=await actorClient.auth.getUser(bearer);
  if(identityError||!identity.user)return respond({error:'invalid_session'},401);
  // RPC MUST verify AAL2 using auth.jwt() and course/subject authorization.
  const action=body.action==='prepare'?'prepare':'inspect';
  if(action==='inspect'&&(!uuid(body.imageId)||!body.path))
    return respond({error:'invalid_media_receipt'},400);
  const {data:authorized,error:authorizationError}=await actorClient.rpc('vertice_avalia_media',{
    p_institution:body.institutionId,p_course:body.courseId,
    p_discipline:body.disciplineId,p_question:body.questionId,
    p_action:action,p_payload:action==='prepare'?{
      sha256:body.sha256,mime:body.mime,sizeBytes:body.sizeBytes
    }:{imageId:body.imageId,path:body.path}
  });
  if(authorizationError||!authorized)
    return respond({error:'course_or_media_access_denied'},403);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  if(action==='prepare'){
   if(!uuid(authorized.imageId)||typeof authorized.path!=='string')
      return respond({error:'invalid_ticket_record'},500);
   const prefix=body.institutionId+'/'+body.courseId+'/'+identity.user.id+'/'+body.questionId+'/';
   if(!authorized.path.startsWith(prefix))return respond({error:'invalid_ticket_scope'},500);
   const {data:ticket,error:ticketError}=await admin.storage.from(bucket)
      .createSignedUploadUrl(authorized.path,{upsert:false});
   if(ticketError||!ticket?.token)return respond({error:'storage_ticket_unavailable'},503);
   return respond({path:authorized.path,imageId:authorized.imageId,token:ticket.token});
  }
  const expectedPrefix=body.institutionId+'/'+body.courseId+'/'+identity.user.id+'/'+body.questionId+'/';
  if(authorized.path!==body.path||!authorized.path.startsWith(expectedPrefix)||
    authorized.sha256!==body.sha256||authorized.mime!==body.mime||
    authorized.sizeBytes!==body.sizeBytes||!uuid(authorized.imageId))
    return respond({error:'media_metadata_mismatch'},403);
  if(authorized.state==='confirmed')return respond({error:'already_confirmed'},409);
  if(authorized.state!=='pending')return respond({error:'media_not_pending'},409);
  const {data:blob,error:downloadError}=await admin.storage.from(bucket).download(authorized.path);
  if(downloadError||!blob)return respond({error:'storage_object_missing'},404);
  if(blob.size>10485760||blob.size!==authorized.sizeBytes)
    return respond({error:'actual_size_mismatch'},422);
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const actualMime=sniff(bytes);
  if(actualMime!==authorized.mime)return respond({error:'actual_mime_mismatch'},422);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const actualSha=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(actualSha!==authorized.sha256)return respond({error:'actual_sha256_mismatch'},422);
  const {data:receipt,error:finalizeError}=await admin.rpc('vertice_avalia_media_finalize',{
    p_image:authorized.imageId,p_actual_sha:actualSha,p_actual_size:bytes.byteLength,p_actual_mime:actualMime
  });
  if(finalizeError||!receipt)return respond({error:'media_finalization_failed'},409);
  return respond(receipt);
 }catch{
  return respond({error:'media_service_unavailable'},503);
 }
});
