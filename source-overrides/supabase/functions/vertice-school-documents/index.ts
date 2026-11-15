import {createClient} from 'npm:@supabase/supabase-js@2.45.4';
import {schoolPDF} from './pdf.ts';
const env=(name:string)=>Deno.env.get(name)||'';
const origins=new Set(['https://www.verticesuperior.com.br','https://verticesuperior.com.br','https://vertice-portal.onrender.com','https://vertice-educacao-superior.onrender.com']);
const bucket='vertice-school-documents',table='vertice_school_issued_documents';
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
const keys=()=>{try{return JSON.parse(env('AUTENTIQUE_INSTITUTION_KEYS')||'{}');}catch{return {};}};
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';const send=(body:unknown,status=200)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://www.verticesuperior.com.br','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}});
 if(req.method==='OPTIONS')return send(null,204);if(req.method!=='POST')return send({error:'Método não permitido'},405);
 let admin:any;let jobId:string|null=null;
 try{
  const url=env('SUPABASE_URL');let secret=env('SUPABASE_SERVICE_ROLE_KEY');try{secret=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}').default||secret;}catch{}
  admin=createClient(url,secret,{auth:{persistSession:false}});const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');const auth=await admin.auth.getUser(token);if(auth.error||!auth.data.user)return send({error:'Autenticação obrigatória'},401);
  let anon=env('SUPABASE_ANON_KEY');try{anon=JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||anon;}catch{}
  const user=createClient(url,anon||secret,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
  if(Number(req.headers.get('content-length')||0)>7500000)return send({error:'Arquivo excede o limite'},413);
  const body=await req.json();const institutionId=body.institutionId;
  const scope=await user.rpc('vertice_school_individual',{p_institution_id:institutionId,p_action:'overview',p_payload:{}});if(scope.error)return send({error:scope.error.message},403);
  const credential=keys()[institutionId];const key=String(typeof credential==='string'?credential:credential?.token||'');const sandbox=typeof credential==='string'||credential?.mode!=='production';
  if(body.action==='config')return send({autentique_configured:!!key,mode:sandbox?'sandbox':'production',govbr:'manual'});
  const call=async(action:string,payload:any)=>{const r=await user.rpc('vertice_school_individual',{p_institution_id:institutionId,p_action:action,p_payload:payload});if(r.error)throw new Error(r.error.message);return r.data;};
  if(body.action==='generate'){
   const job=await call('reserve_document',{student_id:body.studentId,template_id:body.templateId});jobId=job.id;
   const bytes=await schoolPDF(job),sha=await hash(bytes),path=`${institutionId}/${job.id}/original.pdf`;
   const upload=await admin.storage.from(bucket).upload(path,bytes,{contentType:'application/pdf',upsert:false});if(upload.error)throw new Error('Não foi possível armazenar o PDF');
   const save=await admin.from(table).update({status:'issued',original_path:path,original_sha256:sha,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','generating').select('id').single();if(save.error)throw new Error('Falha ao concluir a emissão');jobId=null;return send({ok:true,id:job.id,number:job.number});
  }
  const doc=await call('document',{id:body.documentId});if(doc.status!=='issued')return send({error:'Documento ainda não emitido ou revogado'},409);
  const original=async()=>{const r=await admin.storage.from(bucket).download(doc.original_path);if(r.error)throw new Error('PDF original indisponível');const bytes=new Uint8Array(await r.data.arrayBuffer());if(await hash(bytes)!==doc.original_sha256)throw new Error('Integridade do original divergente');return bytes;};
  if(body.action==='download'){
   const path=body.signed?doc.signed_path:doc.original_path;if(!path)return send({error:'Arquivo não disponível'},404);
   const r=await admin.storage.from(bucket).createSignedUrl(path,120);if(r.error)throw new Error('Falha ao abrir arquivo');return send({url:r.data.signedUrl});
  }
  if(body.action==='upload_manual'){
   if(!['unsigned','manual_pending_review'].includes(doc.signature_status))return send({error:'Há outro fluxo de assinatura neste documento'},409);
   if(typeof body.pdfBase64!=='string'||body.pdfBase64.length>7000000)return send({error:'Envie PDF de até 5 MB'},400);
   const bytes=Uint8Array.from(atob(body.pdfBase64),(c:string)=>c.charCodeAt(0));if(bytes.length>5242880||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')return send({error:'Arquivo PDF inválido'},400);
   const sha=await hash(bytes);if(sha===doc.original_sha256)return send({error:'O arquivo é igual ao original sem assinatura. Envie o PDF assinado.'},400);
   const path=`${institutionId}/${doc.id}/recebido-${crypto.randomUUID()}.pdf`;
   const uploaded=await admin.storage.from(bucket).upload(path,bytes,{contentType:'application/pdf',upsert:false});if(uploaded.error)throw new Error('Falha no recebimento do PDF');
   const saved=await admin.from(table).update({provider:'govbr_manual',signature_status:'manual_pending_review',signed_path:path,signed_sha256:sha,signature_note:'Arquivo recebido; autenticidade, signatários e correspondência com o original ainda não conferidos.',updated_at:new Date().toISOString()}).eq('id',doc.id).eq('updated_at',doc.updated_at).select('id').single();if(saved.error){await admin.storage.from(bucket).remove([path]);return send({error:'Documento alterado. Atualize e tente novamente.'},409);}return send({ok:true});
  }
  if(!key)return send({error:'Autentique não configurado para esta instituição. A integração está preparada; falta a credencial.'},409);
  if(body.action==='send_autentique'){
   if(!body.authorized||!Array.isArray(body.signers)||!body.signers.length||body.signers.length>10||body.signers.some((s:any)=>typeof s.email!=='string'||!/^\S+@\S+\.\S+$/.test(s.email)))return send({error:'Confira os signatários e autorize o envio de teste'},400);
   const reserved=await admin.from(table).update({signature_status:'sending',provider:'autentique',signature_note:sandbox?'Envio sandbox autorizado pelo gestor':'Envio de produção autorizado pelo gestor',updated_at:new Date().toISOString()}).eq('id',doc.id).eq('signature_status','unsigned').select('id').single();if(reserved.error)return send({error:'Este documento já possui envio ou assinatura em andamento'},409);
   try{
    const bytes=await original();const form=new FormData();form.append('operations',JSON.stringify({query:'mutation($document:DocumentInput!,$signers:[SignerInput!]!,$file:Upload!){createDocument(sandbox:'+String(sandbox)+',document:$document,signers:$signers,file:$file){id}}',variables:{document:{name:doc.number},signers:body.signers.map((s:any)=>({email:s.email,action:'SIGN'})),file:null}}));form.append('map',JSON.stringify({file:['variables.file']}));form.append('file',new Blob([bytes],{type:'application/pdf'}),doc.number+'.pdf');
    const response=await fetch('https://api.autentique.com.br/v2/graphql',{method:'POST',headers:{Authorization:'Bearer '+key},body:form,signal:AbortSignal.timeout(45000)});const result=await response.json();const id=result.data?.createDocument?.id;
    if(!response.ok||result.errors||!id)throw new Error('Provedor não confirmou a criação');
    const saved=await admin.from(table).update({provider_id:id,signature_status:'sent',provider_snapshot:{sandbox,signers:body.signers.map((s:any)=>({email:s.email})),authorized_by:auth.data.user.id},updated_at:new Date().toISOString()}).eq('id',doc.id).eq('signature_status','sending').select('id').single();if(saved.error)throw new Error('Criação externa sem confirmação local');return send({ok:true,sandbox});
   }catch{await admin.from(table).update({signature_status:'unknown',signature_note:'Envio sem confirmação completa. Conferir no provedor antes de reenviar para evitar duplicidade.',updated_at:new Date().toISOString()}).eq('id',doc.id).eq('signature_status','sending');return send({error:'Não foi possível confirmar o envio. Confira no Autentique antes de qualquer nova tentativa.'},502);}
  }
  if(body.action==='refresh_autentique'){
   if(doc.provider!=='autentique'||!doc.provider_id)return send({error:'Sem solicitação Autentique vinculada'},409);
   const response=await fetch('https://api.autentique.com.br/v2/graphql',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({query:'query{document(id:'+JSON.stringify(doc.provider_id)+'){id files{signed} signatures{signed{created_at} rejected{created_at}}}}'}),signal:AbortSignal.timeout(30000)});const result=await response.json();const found=result.data?.document;
   if(!response.ok||result.errors||found?.id!==doc.provider_id||!Array.isArray(found.signatures))return send({error:'Não foi possível confirmar a situação no provedor'},502);
   const signatures=found.signatures;const status=signatures.some((s:any)=>s.rejected)?'refused':signatures.length&&signatures.every((s:any)=>s.signed)?'signed':signatures.some((s:any)=>s.signed)?'partially_signed':'sent';
   let archived=!!doc.signed_path;let stored:any={};
   if(status==='signed'&&!archived&&found.files?.signed){try{const signedURL=new URL(found.files.signed);if(signedURL.protocol!=='https:'||!['painel.autentique.com.br','api.autentique.com.br'].includes(signedURL.hostname))throw new Error('Unsupported signed file host');const file=await fetch(signedURL,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!file.ok||Number(file.headers.get('content-length')||0)>5242880)throw new Error('Signed file unavailable');const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length>5242880||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('Invalid PDF');const path=`${institutionId}/${doc.id}/autentique-signed.pdf`;const uploaded=await admin.storage.from(bucket).upload(path,bytes,{contentType:'application/pdf',upsert:false});if(uploaded.error)throw uploaded.error;stored={signed_path:path,signed_sha256:await hash(bytes)};archived=true;}catch{/* Provider status is retained; missing archive remains explicit. */}}
   const updated=await admin.from(table).update({...stored,signature_note:status==='signed'&&!archived?'Assinatura confirmada pelo provedor; cópia assinada ainda não arquivada. Conferir no Autentique.':doc.signature_note,signature_status:status,provider_snapshot:{...doc.provider_snapshot,last_checked_at:new Date().toISOString(),signatures},updated_at:new Date().toISOString()}).eq('id',doc.id).eq('provider_id',doc.provider_id).eq('updated_at',doc.updated_at).select('id').single();if(updated.error)return send({error:'Situação alterada durante a consulta. Atualize o painel.'},409);return send({ok:true,status,archived,sandbox:doc.provider_snapshot?.sandbox!==false});
  }
  return send({error:'Operação inválida'},400);
 }catch(e){if(jobId&&admin)await admin.from(table).update({status:'failed',updated_at:new Date().toISOString()}).eq('id',jobId).eq('status','generating');return send({error:e instanceof Error?e.message:'Falha na operação documental'},400);}
});
