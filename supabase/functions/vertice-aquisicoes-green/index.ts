import postgres from 'npm:postgres@3.4.7';
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createHash} from 'node:crypto';
import {createWorkflow} from './workflow.ts';
import {buildAudit} from './audit.ts';
import {formCatalog} from './forms-catalog.ts';
import {formsLoad,saveOperationForm} from './forms-service.ts';
import {brandWord} from './document-branding.ts';
import {documentNotice} from './branding-data.ts';
import {prompt} from './prompt.ts';
import {unzipSync} from 'npm:fflate@0.8.2';
import {DOMParser} from 'npm:@xmldom/xmldom@0.8.11';
// O motor original entrega JSON como texto, conforme pg/PGlite. Preserva essa
// convenção para não serializar uma segunda vez e transformar arrays em strings.
const jsonText=(v:any)=>typeof v==='string'?v:JSON.stringify(v);
const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:2,idle_timeout:20,connect_timeout:15,types:{json:{to:114,from:[114],serialize:jsonText,parse:JSON.parse},jsonb:{to:3802,from:[3802],serialize:jsonText,parse:JSON.parse}}});
const origin=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const admin=createClient(origin,secret,{auth:{persistSession:false}}),bucket=admin.storage.from('vertice-aquisicoes-cofre');
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const send=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const fail=(message:string,status=400)=>{throw Object.assign(new Error(message),{status});};
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
// PGlite entrega o tamanho limitado dos anexos como número; postgres.js entrega
// bigint como texto. Mantém a representação usada nos hashes do motor original.
const safe=(r:any)=>{if(!r||typeof r!=='object')return r;const v={...r};delete v.institution_id;if('storage_key' in v){delete v.front;v.size_bytes=Number(v.size_bytes);}if('target_name' in v){delete v.revision;delete v.created_by;delete v.instrument_id;}return v;};
const txAPI=(s:any)=>({query:async(q:string,p:any[]=[])=>({rows:Array.from(await s.unsafe(q,p)).map(safe)}),exec:async(q:string)=>s.unsafe(q)});
const bytesOf=async(path:string)=>{const {data,error}=await bucket.download(path);if(error||!data)fail('Arquivo ausente no cofre.');return new Uint8Array(await data.arrayBuffer());};
const mime:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',txt:'text/plain'};
const tables=new Set(['dd_matters','dd_requirements','dd_requirement_state','dd_findings','dd_documents','dd_document_links','dd_matter_members']);
function decodeDoc(bytes:Uint8Array,id:string){try{
 const entry=unzipSync(bytes,{filter:f=>f.name==='word/document.xml'&&f.originalSize<=8388608})['word/document.xml'];if(!entry)throw new Error('XML ausente ou excede 8 MB.');
 const xml=new TextDecoder().decode(entry);if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Declaração XML externa não permitida.');
 const doc=new DOMParser({errorHandler:{warning:()=>{},error:()=>{throw new Error('XML inválido.');},fatalError:()=>{throw new Error('XML inválido.');}}}).parseFromString(xml,'text/xml');
 const children=(n:any,name:string)=>Array.from(n.childNodes||[]).filter((c:any)=>c.nodeName===name) as any[];
 const text=(n:any)=>Array.from(n.getElementsByTagName('w:t')).map((x:any)=>x.textContent||'').join(' ').trim();
 return {id,ok:true,tables:Array.from(doc.getElementsByTagName('w:tbl')).map((t:any,i)=>({table:i+1,rows:children(t,'w:tr').map((r,j)=>({row:j+1,cells:children(r,'w:tc').map(c=>text(c).slice(0,12000))}))})),paragraphs:children(doc.getElementsByTagName('w:body')[0],'w:p').slice(0,300).map(p=>text(p).slice(0,4000))};
 }catch(e){return{id,ok:false,error:String(e.message).slice(0,200)};}}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const u=new URL(req.url),path=u.pathname.replace(/^.*?\/vertice-aquisicoes-green/,'')||'/';
 try{
  if(path==='/health'){await sql`select 1`;return send({status:'ok',model:'green-original',workflow:'2.1',forms_version:'4.0'});}
  const authorization=req.headers.get('authorization')||'';
  const client=createClient(origin,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:{user},error}=await client.auth.getUser();if(error||!user)return send({message:'Entre pelo painel master.'},401);
  const token=authorization.replace(/^Bearer /,''),claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  if(claims.aal!=='aal2')return send({message:'Valide o segundo fator no portal.'},403);
  const payload=async()=>{if(Number(req.headers.get('content-length')||0)>12*1024*1024)fail('Solicitação excede o limite.',413);return req.json();};
  if(path.startsWith('/templates/')){
   const {data:p,error:profileError}=await client.rpc('dd_portal',{op:'profile'});if(profileError)throw profileError;
   if(!p.master){const {data:ms}=await client.rpc('dd_portal',{op:'list'});if(!ms?.length)fail('Sem autorização para a biblioteca.',403);}
   let name=path==='/templates/catalogo'?'catalogo.json':path==='/templates/biblioteca.zip'?'biblioteca-modelos-v3.zip':null;
   if(!name){const id=path.match(/^\/templates\/(M\d{2})\.docx$/)?.[1];if(!id)fail('Modelo não encontrado.',404);const {data}=await admin.storage.from('vertice-aquisicoes-modelos').download('catalogo.json');if(!data)fail('Catálogo indisponível.');const c=JSON.parse(await data.text());name=c.models.find((x:any)=>x.id===id)?.filename;if(!name)fail('Modelo não encontrado.',404);}
   const {data,error}=await admin.storage.from('vertice-aquisicoes-modelos').download(name);if(error||!data)throw error;
   if(name.endsWith('.json')){const c=JSON.parse(await data.text());return send({...c,document_notice:documentNotice,models:c.models.map(({sha256,size,...m}:any)=>({...m,source_sha256:sha256,source_size:size,download_presentation:'Cópia de preenchimento com identidade Vértice e aviso de confidencialidade/LGPD; o hash da fonte se refere ao modelo original.'}))});}
   const bytes=new Uint8Array(await data.arrayBuffer()),branded=name.endsWith('.zip')?bytes:brandWord(bytes);
   return new Response(branded,{headers:{...cors,'Cache-Control':'no-store','Content-Type':name.endsWith('.zip')?'application/zip':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`}});
  }
  if(path==='/auth/v1/logout')return send({}); // O host encerra a sessão única.
  if(path.startsWith('/auth/'))fail('Use o login do portal.',400);
  return await sql.begin(async s=>{
   await s.unsafe("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true)",[JSON.stringify(claims),user.id]);
   const db={transaction:async(fn:any)=>fn(txAPI(s))};
   const asUser=async(_user:any,fn:any)=>{await s.unsafe('set local role authenticated');const result=await fn(txAPI(s));await s.unsafe('reset role');return result;};
   const [rev]=await s`select body from public.dd_requirement_revisions order by created_at desc limit 1`;if(!rev)fail('Instrumento em implantação.',503);
   const verifyRemote=async(data:any)=>{for(const d of data.documents.filter((d:any)=>data.links.some((l:any)=>l.document_id===d.id))){if(!d.storage_key.startsWith(data.matter.id+'/'))fail('Arquivo fora do mandato.',403);if(hash(await bytesOf(d.storage_key))!==d.sha256)fail('Integridade divergente: '+d.file_name);}};
   const workflow=await createWorkflow({local:{db,persist:async()=>{}},asUser,directory:'',revision:rev.body,verifyRemote,loadFormData:formsLoad,loadRegulatory:async(tx:any,m:string)=>(await tx.query(`select e.id,e.revision,e.created_at,e.body from public.vertice_emec_snapshots e join public.dd_matters m on (m.institution_id=e.institution_id or exists(select 1 from public.vertice_base_matter_links l where l.matter_id=m.id and l.institution_id=e.institution_id)) where m.id=$1 order by e.created_at desc,e.revision desc limit 1`,[m])).rows[0]||null});
   if(path==='/forms/catalog')return send(formCatalog);
   if(path.startsWith('/forms/')){
    const parts=path.split('/').filter(Boolean),m=parts[1];if(!/^[0-9a-f-]{36}$/.test(m))fail('Mandato inválido.');
    await s`select pg_advisory_xact_lock(hashtext(${m}))`;
    const allowed=await asUser(user,async tx=>(await tx.query('select id from dd_matters where id=$1',[m])).rows[0]);if(!allowed)fail('Mandato indisponível.',403);
    if(req.method==='GET'&&parts.length===2)return send(await asUser(user,tx=>formsLoad(tx,m)));
    if(req.method==='POST'&&['shared','answer'].includes(parts[2]))return send(await saveOperationForm({s,asUser,user,m,p:await payload(),catalog:formCatalog,kind:parts[2]==='shared'?'shared':'answer'}));
    fail('Operação de formulário não encontrada.',404);
   }
   if(path==='/workflow/instrument')return send(workflow.revision);
   const parts=path.split('/').filter(Boolean);
   if(parts[0]==='workflow'){
    const m=parts[1];if(!/^[0-9a-f-]{36}$/.test(m))fail('Mandato inválido.');
    await s`select pg_advisory_xact_lock(hashtext(${m}))`;
    if(req.method==='GET'&&parts.length===2){const w=await workflow.load(user,m);return send({...w,revision:{version:w.revision.version,sha256:w.revision.sha256,purpose:w.revision.purpose,sources:w.revision.sources,reviewed_on:w.revision.reviewed_on},opinions:w.opinions.map(({snapshot,report_text,...x}:any)=>x)});}
    if(req.method==='GET'&&parts[2]==='history')return send(await workflow.history(user,m));
    if(req.method==='GET'&&parts[2]==='briefing')return send(await workflow.briefing(user,m));
    if(req.method==='GET'&&parts[2]==='report')return send(await workflow.report(user,m,parts[3]));
    if(req.method==='POST'&&parts.length===3){const p=await payload();if(parts[2]==='approve'){
      const {data,error}=await createClient(origin,anon,{auth:{persistSession:false}}).auth.signInWithPassword({email:user.email!,password:p.password});if(error||data.user?.id!==user.id)fail('Reconfirme sua senha do portal.',401);delete p.password;
    }const w=await workflow.act(user,m,parts[2],p);return send({...w,revision:{version:w.revision.version,sha256:w.revision.sha256,purpose:w.revision.purpose,sources:w.revision.sources,reviewed_on:w.revision.reviewed_on},opinions:w.opinions.map(({snapshot,report_text,...x}:any)=>x)});}
   }
   if(path==='/agent/run'&&req.method==='POST'){
    const p=await payload(),w=await workflow.load(user,p.matter_id),decoded=[];
    for(const d of w.documents.filter((d:any)=>/\.docx$/i.test(d.file_name))){const raw=await bytesOf(d.storage_key);if(hash(raw)!==d.sha256)fail('Integridade divergente: '+d.file_name);decoded.push(decodeDoc(raw,d.id));}
    const responses=w.states.map((state:any)=>{const f=w.form_answers?.find((f:any)=>f.state_id===state.id);if(!f)return state;const code=w.requirements.find((r:any)=>r.id===state.requirement_id)?.code,schema=formCatalog.requirements[code];return {...state,answer:[state.answer||'',...schema.fields.filter((s:any)=>f.body.fields[s.key]).map((s:any)=>s.label+': '+f.body.fields[s.key]),...f.body.rows.map((r:any)=>r.join(' | '))].join('\n')};});
    const report=buildAudit(w.requirements,w.documents,decoded,{responses,links:w.links});return send({...report,matter_id:p.matter_id,limits:report.limits.map((v:string)=>v==='Sem modelo de IA e sem chamadas externas.'?'Sem modelo de IA nem envio de documentos a provedores de IA. Leitura no ambiente reservado da Vértice.':v)});
   }
   if(path==='/agent/prompt')return send({mode:'document_check',prompt});
   if(path.startsWith('/rest/v1/rpc/')&&req.method==='POST'){
    const name=parts.at(-1),p=await payload();
    if(p.m){if(!/^[0-9a-f-]{36}$/.test(p.m))fail('Mandato inválido.');await s`select pg_advisory_xact_lock(hashtext(${p.m}))`;}
    if(name==='dd_profile')return send(await asUser(user,async tx=>{const r=(await tx.query("select public.dd_portal('profile') profile")).rows[0].profile;return {admin:r.master,user_id:r.user_id,institutions:r.institutions};}));
    if(name==='dd_create_matter')return send((await asUser(user,tx=>tx.query('select public.dd_green_create($1) result',[JSON.stringify(p.payload)]))).rows[0].result);
    if(name==='dd_save_response'){await asUser(user,tx=>tx.query('select public.dd_green_response($1,$2,$3,$4)',[p.m,p.r,p.a,JSON.stringify(p.attachments)]));return send(null);}
    if(name==='dd_save_state'){if(['compliant','not_applicable'].includes(p.s))fail('Conclua este item na análise das evidências.',409);const state=(await asUser(user,tx=>tx.query('select id,answer from public.dd_requirement_state where matter_id=$1 and requirement_id=$2',[p.m,p.r]))).rows[0];if(!state)fail('Requisito indisponível.',403);await asUser(user,tx=>tx.query("select public.dd_portal('save_state',$1,$2)",[p.m,JSON.stringify({id:state.id,status:p.s,note:p.n,answer:state.answer||''})]));return send(null);}
    if(name==='dd_add_member'){await asUser(user,tx=>tx.query("select public.dd_portal('member',$1,$2)",[p.m,JSON.stringify({email:p.email_address,role:p.member_role,expires_at:p.expiry,front_scope:[]})]));return send(null);}
    if(name==='dd_add_finding'){const r=await asUser(user,tx=>tx.query("select public.dd_portal('finding',$1,$2)",[p.m,JSON.stringify({...p.payload,value_brl:p.payload.value})]));return send(r.rows[0]);}
    if(name==='dd_register_document'){
     const raw=await bytesOf(p.payload.path);if(hash(raw)!==p.payload.sha256||raw.length!==Number(p.payload.size))fail('Integridade divergente.');
     const result=(await asUser(user,tx=>tx.query("select public.dd_portal('register_document',$1,$2) result",[p.m,JSON.stringify({...p.payload,front:p.payload.front||'SOC'})]))).rows[0].result;return send(result.id);
    }
    if(name==='dd_log_download'){const d=(await asUser(user,tx=>tx.query('select matter_id from public.dd_documents where id=$1',[p.d]))).rows[0];if(!d)fail('Arquivo indisponível.',403);const r=(await asUser(user,tx=>tx.query("select public.dd_portal('download_authorize',$1,$2) result",[d.matter_id,JSON.stringify({id:p.d})]))).rows[0].result;return send(r.path);}
    fail('Operação não disponível.',404);
   }
   if(path.startsWith('/rest/v1/')&&req.method==='GET'){
    const table=parts.at(-1)!;if(!tables.has(table))fail('Consulta não permitida.',404);
    const m=u.searchParams.get('matter_id');if(m&&!/^eq\.[0-9a-f-]{36}$/.test(m))fail('Mandato inválido.');
    let query=`select * from public.${table}`,params:any[]=[];if(m){query+=' where matter_id=$1';params=[m.slice(3)];}const order=u.searchParams.get('order');if(order){if(!['code','created_at.desc'].includes(order))fail('Ordenação inválida.');query+=' order by '+(order==='code'?'code':'created_at desc');}
    return send((await asUser(user,tx=>tx.query(query,params))).rows);
   }
   if(path.startsWith('/storage/v1/object/')&&req.method==='POST'){
    const signing=path.startsWith('/storage/v1/object/sign/'),prefix=signing?'/storage/v1/object/sign/dd-acervo/':'/storage/v1/object/dd-acervo/';
    if(!path.startsWith(prefix))fail('Caminho inválido.');const object=decodeURIComponent(path.slice(prefix.length)),m=object.split('/')[0];if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-zA-Z0-9._-]+$/.test(object))fail('Caminho inválido.');
    if(signing){const d=(await asUser(user,tx=>tx.query('select id from public.dd_documents where matter_id=$1 and storage_key=$2',[m,object]))).rows[0];if(!d)fail('Sem acesso ao arquivo.',403);await asUser(user,tx=>tx.query("select public.dd_portal('download_authorize',$1,$2)",[m,JSON.stringify({id:d.id})]));const {data,error}=await bucket.createSignedUrl(object,300,{download:true});if(error)throw error;return send({signedURL:data.signedUrl,absolute:true});}
    const front=u.searchParams.get('front')||'SOC';await asUser(user,tx=>tx.query("select public.dd_portal('upload_authorize',$1,$2)",[m,JSON.stringify({front,classification:u.searchParams.get('classification')||'restricted'})]));
    const ext=object.split('.').at(-1)!.toLowerCase();if(!mime[ext])fail('Formato não permitido.');const raw=new Uint8Array(await req.arrayBuffer());if(!raw.length||raw.length>15728640)fail('Limite de 15 MB.');
    const {error}=await bucket.upload(object,raw,{contentType:mime[ext],upsert:false});if(error)throw error;return send({Key:'dd-acervo/'+object});
   }
   fail('Operação não encontrada.',404);
  });
 }catch(e){console.error('green request',e.code||e.status||'',e.message);return send({message:e.message||'Não foi possível concluir.'},e.status||(e.code==='42501'?403:400));}
});
