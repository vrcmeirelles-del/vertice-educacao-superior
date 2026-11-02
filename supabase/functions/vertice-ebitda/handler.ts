import {normalizeEbitda,calculateEbitda} from './engine.js';
const ORIGINS=new Set(['https://www.verticesuperior.com.br','https://verticesuperior.com.br','https://vertice-educacao-superior-jlri.onrender.com']);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const canonical=(x:any):any=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export function createEbitdaHandler(createClient:any,env:(key:string)=>string|undefined){return async(req:Request)=>{
 const origin=req.headers.get('origin'),headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 if(origin&&ORIGINS.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!ORIGINS.has(origin))return reply(403,{error:'Origem não autorizada.'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Método não permitido.'});
 const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return reply(401,{error:'Entre na área reservada para registrar o cálculo e a DRE.'});
 try{
  const url=env('SUPABASE_URL')!,client=createClient(url,env('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const {data:{user},error:authError}=await client.auth.getUser(auth.slice(7));if(authError||!user||user.is_anonymous)return reply(401,{error:'Sessão inválida. Entre novamente.'});
  if(Number(req.headers.get('content-length')||0)>131072)return reply(413,{error:'Dados do formulário excedem o limite.'});const raw=await req.text();if(raw.length>131072)return reply(413,{error:'Dados do formulário excedem o limite.'});const payload=JSON.parse(raw);
  const institutionId=payload.institutionId;if(!UUID.test(institutionId||''))return reply(400,{error:'Instituição inválida.'});
  const {data:allowed,error:accessError}=await client.rpc('vertice_ebitda_access',{target:institutionId});if(accessError||allowed!==true)return reply(403,{error:'Acesso financeiro reservado ao Gestor da instituição ou Master, com segundo fator.'});
  const secret=env('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}').default;if(!secret)return reply(503,{error:'Área financeira temporariamente indisponível.'});const admin=createClient(url,secret,{auth:{persistSession:false}});
  if(payload.operation==='download'){
   if(!UUID.test(payload.id||''))return reply(400,{error:'Registro inválido.'});const {data:row,error}=await client.from('vertice_ebitda_calculations').select('id,file_name,object_path').eq('institution_id',institutionId).eq('id',payload.id).maybeSingle();if(error||!row)return reply(403,{error:'DRE indisponível para este acesso.'});
   const {data:signed,error:signError}=await admin.storage.from('vertice-dre').createSignedUrl(row.object_path,60,{download:row.file_name});if(signError||!signed?.signedUrl)return reply(503,{error:'Não foi possível preparar o download.'});
   const {error:auditError}=await admin.from('vertice_audit').insert({actor:user.id,table_name:'vertice_ebitda_calculations',action:'download',record_id:row.id});if(auditError)return reply(503,{error:'Não foi possível registrar o download.'});return reply(200,{url:signed.signedUrl,expiresIn:60});
  }
  if(payload.operation!=='save'||!UUID.test(payload.requestId||''))return reply(400,{error:'Operação inválida.'});
  let body;try{body=normalizeEbitda(payload.body||{});}catch(e){return reply(400,{error:(e as Error).message});}const result=calculateEbitda(body);
  const {data:existing,error:lookupError}=await client.from('vertice_ebitda_calculations').select('*').eq('institution_id',institutionId).eq('request_id',payload.requestId).maybeSingle();if(lookupError)return reply(503,{error:'Não foi possível verificar esta solicitação.'});
  if(existing){if(existing.created_by!==user.id||JSON.stringify(canonical(existing.body))!==JSON.stringify(canonical(body)))return reply(409,{error:'Solicitação já utilizada por outro preenchimento. Atualize a página.'});return reply(200,existing);}
  let evidence:any;
  if(payload.upload){const u=payload.upload,parts=String(u.object_path||'').split('/');if(parts.length!==4||parts[0]!==institutionId||parts[1]!==user.id||!UUID.test(parts[2])||!/^[a-z0-9._-]+\.(pdf|xlsx|docx|csv)$/i.test(parts[3])||String(u.file_name||'').length<1||u.file_name.length>200||!Number.isInteger(u.size_bytes)||u.size_bytes<1||u.size_bytes>15728640||!/^[a-f0-9]{64}$/.test(u.sha256||''))return reply(400,{error:'Dados da DRE inválidos.'});evidence={object_path:u.object_path,file_name:u.file_name,size_bytes:u.size_bytes,sha256:u.sha256};}
  else if(UUID.test(payload.sourceId||'')){const {data:source,error}=await client.from('vertice_ebitda_calculations').select('object_path,file_name,size_bytes,sha256').eq('institution_id',institutionId).eq('id',payload.sourceId).maybeSingle();if(error||!source)return reply(403,{error:'DRE anterior indisponível para esta instituição.'});evidence=source;}
  else return reply(400,{error:'Anexe a DRE ou escolha uma versão anterior.'});
  // Download uses the caller's JWT/RLS, not service-role access, and validates the exact bytes.
  const {data:file,error:fileError}=await client.storage.from('vertice-dre').download(evidence.object_path);if(fileError||!file||file.size!==evidence.size_bytes)return reply(400,{error:'A DRE não foi encontrada ou tem tamanho divergente. Reenvie o arquivo.'});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==evidence.sha256)return reply(400,{error:'A DRE difere do arquivo informado. Reenvie e confira os valores.'});
  const {data:saved,error:saveError}=await admin.from('vertice_ebitda_calculations').insert({institution_id:institutionId,request_id:payload.requestId,body,result,...evidence,created_by:user.id}).select('*').single();if(saveError||!saved)return reply(503,{error:'Não foi possível registrar o cálculo. A DRE enviada permanece reservada.'});
  return reply(200,saved);
 }catch{return reply(400,{error:'Não foi possível processar a solicitação. Confira os campos e tente novamente.'});}
};}
