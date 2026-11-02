import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const mime:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',txt:'text/plain'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const token=req.headers.get('authorization')||'';
 const client=createClient(url,anon,{global:{headers:{Authorization:token}},auth:{persistSession:false}});
 const storage=createClient(url,secret,{auth:{persistSession:false}}).storage.from('vertice-aquisicoes-cofre');
 const call=async(op:string,m:string,p:unknown)=>{const {data,error}=await client.rpc('dd_portal',{op,m,p});if(error)throw new Error(error.message);return data;};
 let uploaded:string|null=null;
 try{
  const {data:{user},error}=await client.auth.getUser();if(error||!user)return json({error:'Entre para continuar.'},401);
  if(req.headers.get('content-type')?.includes('multipart/form-data')){
   if(Number(req.headers.get('content-length')||0)>16000000)return json({error:'Limite de 15 MB.'},413);
   const form=await req.formData(),file=form.get('file'),m=String(form.get('matter_id')||''),front=String(form.get('front')||''),classification=String(form.get('classification')||'restricted');
   if(!(file instanceof File)||!file.size||file.size>15728640)throw new Error('Envie um arquivo de até 15 MB.');
   const ext=file.name.split('.').pop()!.toLowerCase();if(!mime[ext])throw new Error('Formato não permitido.');
   await call('upload_authorize',m,{front,classification});
   const bytes=await file.arrayBuffer(),sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
   const bundle=await call('load',m,{}),existing=bundle.documents.find((d:{sha256:string})=>d.sha256===sha256);
   if(existing)return json({id:existing.id,reused:true});
   uploaded=`${m}/${crypto.randomUUID()}.${ext}`;
   const {error:uploadError}=await storage.upload(uploaded,bytes,{contentType:mime[ext],upsert:false});if(uploadError)throw uploadError;
   const result=await call('register_document',m,{path:uploaded,name:file.name.slice(0,255),mime:mime[ext],size:file.size,sha256,classification,front});
   uploaded=null;return json(result);
  }
  const p=await req.json();if(p.op!=='download')throw new Error('Operação inválida.');
  const d=await call('download_authorize',p.matter_id,{id:p.document_id});
  const {data,error:signedError}=await storage.createSignedUrl(d.path,300,{download:d.name});if(signedError)throw signedError;
  return json({url:data.signedUrl,expires_in:300});
 }catch(e){if(uploaded)await storage.remove([uploaded]);return json({error:e instanceof Error?e.message:'Não foi possível processar o arquivo.'},400);}
});
