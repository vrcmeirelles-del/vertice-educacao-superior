// Espelho de documentos do repositório (Storage) -> OneDrive.
// UNITOP: tudo do curso 027 vai para "Mesa digital" (01 Instrumento / 02 Apoio / 03 Diversos e certidões).
// UNICALDAS: só documentos validados, em 10 Cursos/<código - CURSO>/Documentos Validados/<Dimensão>/Indicador <n>.
// Processa um lote por chamada; o cliente chama de novo enquanto "restantes" > 0. Controle em vertice_onedrive_documentos.
const ORIGINS=new Set(["https://www.verticesuperior.com.br","https://verticesuperior.com.br","https://vertice-portal.onrender.com","https://vertice-educacao-superior.onrender.com","https://vertice-educacao-superior-site.onrender.com"]);
const UNITOP="1f5fd5b4-93c6-4626-834d-136884915587",UNICALDAS="4224e2fc-6a96-4761-820f-6f8e809ca1c1";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const driveId="b!GyLR53JNYkSt-KuvMN5YemviyAq9ZChCvFFxeRXLYNGIMY3xMuDhTK_J5zKaFMbV";
const G="https://graph.microsoft.com/v1.0/drives/"+driveId+"/";
const CLIENTES="Documentos Virgilio/Empresas/Vertice/CLIENTES";
const MESA:Record<string,string>={
 instrumento:"01QH47HHVAIWYHDQLVWFH3GU4B52642DFN",
 apoio:"01QH47HHT3R7ZDKYHSUFAYRPIS5A6HQB2V",
 diversos:"01QH47HHWGMMEBJY37JVE37T5GWUA25TO6",
};
const UNITOP_CURSOS=new Set(["027"]);
const DIM:Record<string,string>={"1":"Dimensão 1 - Organização didático-pedagógica","2":"Dimensão 2 - Corpo docente e tutorial","3":"Dimensão 3 - Infraestrutura"};
const MAX_FILE=40*1024*1024,TIME_BUDGET_MS=100000;
const enc=new TextEncoder();
const b64=(v:Uint8Array)=>btoa(String.fromCharCode(...v)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
const E=(code:string,status=400)=>Object.assign(new Error(code),{status});
const svc=()=>{const k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!k)throw E("backend_unavailable",503);return k;};
const clean=(s:string)=>s.replace(/[\\/:*?"<>|#%~&{}]/g,"-").replace(/\s+/g," ").replace(/^[. ]+|[. ]+$/g,"").slice(0,110)||"documento";

async function graphToken(){
 const keyRaw=Deno.env.get("VERTICE_ONEDRIVE_PRIVATE_KEY_B64");
 if(!keyRaw)throw E("onedrive_credentials_unavailable",503);
 const app="d13efb83-3ddf-4e6e-9589-f0fb7584b201",tenant="720c1cd3-7c2e-4496-8378-958c07a05218";
 const endpoint="https://login.microsoftonline.com/"+tenant+"/oauth2/v2.0/token";
 const der=Uint8Array.from(atob(atob(keyRaw).replace(/-----[^-]+-----|\s/g,"")),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey("pkcs8",der,{name:"RSA-PSS",hash:"SHA-256"},false,["sign"]);
 const now=Math.floor(Date.now()/1000);
 const unsigned=[{alg:"PS256","x5t#S256":"AfcNWRTSnisqXg6d2WidZtZg0vTzJR2ukkUoJta2CCk"},{aud:endpoint,iss:app,sub:app,jti:crypto.randomUUID(),nbf:now-5,exp:now+300}]
  .map(o=>b64(enc.encode(JSON.stringify(o)))).join(".");
 const sig=b64(new Uint8Array(await crypto.subtle.sign({name:"RSA-PSS",saltLength:32},key,enc.encode(unsigned))));
 const r=await fetch(endpoint,{method:"POST",body:new URLSearchParams({client_id:app,scope:"https://graph.microsoft.com/.default",grant_type:"client_credentials",
  client_assertion_type:"urn:ietf:params:oauth:client-assertion-type:jwt-bearer",client_assertion:unsigned+"."+sig}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw E("onedrive_auth_failed",503);
 const j=await r.json();if(typeof j.access_token!=="string")throw E("onedrive_auth_failed",503);
 return j.access_token as string;
}
async function pages(path:string,bearer:string,apikey:string){
 const out:any[]=[];
 for(let from=0;from<30000;from+=1000){
  const r=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/"+path,{headers:{apikey,Authorization:bearer,Range:from+"-"+(from+999),"Range-Unit":"items"},signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw E("leitura_negada_ou_indisponivel",r.status===401||r.status===403?403:502);
  const p=await r.json();if(!Array.isArray(p))throw E("resposta_invalida",502);
  out.push(...p);if(p.length<1000)break;
 }
 return out;
}
const folderCache=new Map<string,string>();
async function itemByPath(token:string,parentId:string|null,name:string){
 const url=G+(parentId?"items/"+parentId+":/":"root:/")+encodeURIComponent(name);
 const r=await fetch(parentId?url:G+"root:/"+name.split("/").map(encodeURIComponent).join("/"),{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(15000)});
 if(r.status===404)return null;
 if(!r.ok)throw E("onedrive_leitura_falhou_"+r.status,502);
 const j=await r.json();return j.folder?j.id as string:null;
}
async function ensureChild(token:string,parentId:string,name:string){
 const key=parentId+"/"+name;
 const hit=folderCache.get(key);if(hit)return hit;
 let id=await itemByPath(token,parentId,name);
 if(!id){
  const r=await fetch(G+"items/"+parentId+"/children",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({name,folder:{},"@microsoft.graph.conflictBehavior":"fail"}),signal:AbortSignal.timeout(15000)});
  if(r.status===409)id=await itemByPath(token,parentId,name);
  else if(r.ok)id=(await r.json()).id;
  if(!id)throw E("onedrive_pasta_falhou",502);
 }
 folderCache.set(key,id);return id;
}
async function destFolder(token:string,inst:string,f:any):Promise<{parent:string;label:string}|null>{
 const ind=String((f.instrument_indicators?.[0]??f.indicator??"")).trim();
 if(inst===UNITOP){
  if(!UNITOP_CURSOS.has(String(f.course_code)))return null;
  const cat=f.document_category in MESA?f.document_category:"diversos";
  let parent=MESA[cat],label=cat;
  if(cat==="instrumento"){
   const sub=/^\d+\.\d+$/.test(ind)?"Indicador "+ind:"Sem indicador";
   parent=await ensureChild(token,parent,sub);label="01 Instrumento/"+sub;
  }else label=cat==="apoio"?"02 Apoio":"03 Diversos e certidões";
  return {parent,label};
 }
 if(inst===UNICALDAS){
  if(f.status!=="validado")return null;
  const m=/^(\d+)\.\d+$/.exec(ind);if(!m||!DIM[m[1]])return null;
  const course=clean(String(f.course_code)+" - "+String(f.course_name));
  const base=await itemByPath(token,null,CLIENTES+"/UNICALDAS/10 Cursos/"+course+"/Documentos Validados");
  if(!base)return null;
  const dim=await ensureChild(token,base,DIM[m[1]]);
  const parent=await ensureChild(token,dim,"Indicador "+ind);
  return {parent,label:course+"/Documentos Validados/"+DIM[m[1]]+"/Indicador "+ind};
 }
 return null;
}
async function upload(token:string,parent:string,name:string,bytes:ArrayBuffer,mime:string){
 const r=await fetch(G+"items/"+parent+":/"+encodeURIComponent(name)+":/content",{method:"PUT",
  headers:{Authorization:"Bearer "+token,"Content-Type":mime||"application/octet-stream"},body:bytes,signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw E("onedrive_gravacao_falhou_"+r.status,502);
 return (await r.json()).id as string;
}
async function logRow(row:Record<string,unknown>){
 const k=svc();
 await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/vertice_onedrive_documentos?on_conflict=file_id",{method:"POST",
  headers:{apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
  body:JSON.stringify({...row,updated_at:new Date().toISOString()}),signal:AbortSignal.timeout(10000)});
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")??"";
 const headers:Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
 if(ORIGINS.has(origin))headers["Access-Control-Allow-Origin"]=origin;
 const respond=(d:unknown,s=200)=>Response.json(d,{status:s,headers});
 if(origin&&!ORIGINS.has(origin))return respond({error:"origin_denied"},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
 const t0=Date.now();
 try{
  const bearer=req.headers.get("authorization")??"";
  if(!/^Bearer [\w.-]{16,8190}$/.test(bearer))throw E("authentication_required",401);
  const raw=await req.text();if(raw.length>2048)throw E("request_too_large",413);
  const body=raw?JSON.parse(raw):{};
  if(!body||typeof body!=="object"||Array.isArray(body))throw E("invalid_request");
  const apikey=Deno.env.get("SUPABASE_ANON_KEY")??JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"{}").default;
  if(!apikey)throw E("backend_unavailable",503);
  const ur=await fetch(Deno.env.get("SUPABASE_URL")+"/auth/v1/user",{headers:{Authorization:bearer,apikey},signal:AbortSignal.timeout(10000)});
  const user=await ur.json().catch(()=>null);
  if(!ur.ok||!user?.id||user.is_anonymous)throw E("authentication_required",401);
  const inst=body.institution_id;
  if(typeof inst!=="string"||!UUID.test(inst)||(inst!==UNITOP&&inst!==UNICALDAS))throw E("invalid_request");
  const ar=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/rpc/vertice_source_drive_authorize",{method:"POST",
   headers:{apikey,Authorization:bearer,"Content-Type":"application/json"},body:JSON.stringify({p_institution:inst}),signal:AbortSignal.timeout(10000)});
  if(!ar.ok||(await ar.json())!==true)throw E("access_denied",403);
  const limit=Math.min(Math.max(Number(body.limit)||20,1),40),retry=body.retry===true;

  const files=await pages("vertice_repository_files?institution_id=eq."+inst+"&select=id,file_name,status,document_category,instrument_indicators,storage_path,size_bytes,mime_type,request_id&order=created_at.asc",bearer,apikey);
  const reqs=new Map((await pages("vertice_repository_requests?institution_id=eq."+inst+"&select=id,course_id,indicator,document_code",bearer,apikey)).map(r=>[r.id,r]));
  const courses=new Map((await pages("vertice_courses?institution_id=eq."+inst+"&select=id,code,name",bearer,apikey)).map(c=>[c.id,c]));
  const k=svc();
  const logs=new Map<string,any>();
  for(const r of await pages("vertice_onedrive_documentos?institution_id=eq."+inst+"&select=file_id,status",("Bearer "+k),k))logs.set(r.file_id,r);
  const todo:any[]=[];let semLog=0;
  for(const f of files){
   const l=logs.get(f.id);
   if(!l){semLog++;todo.push(f);}
   else if(retry&&l.status==="erro")todo.push(f);
  }
  const res={ok:0,erro:0,sem_destino:0,muito_grande:0};
  let processados=0;const token=todo.length?await graphToken():"";
  for(const f of todo){
   if(processados>=limit||Date.now()-t0>TIME_BUDGET_MS)break;
   processados++;
   const rq=reqs.get(f.request_id),c=rq?courses.get(rq.course_id):null;
   const row:any={file_id:f.id,institution_id:inst,size_bytes:f.size_bytes};
   try{
    if(!String(f.storage_path).startsWith(inst+"/"))throw E("caminho_invalido");
    if((f.size_bytes??0)>MAX_FILE){await logRow({...row,status:"muito_grande"});res.muito_grande++;continue;}
    const d=await destFolder(token,inst,{...f,indicator:rq?.indicator,course_code:c?.code,course_name:c?.name});
    if(!d){await logRow({...row,status:"sem_destino"});res.sem_destino++;continue;}
    const src=await fetch(Deno.env.get("SUPABASE_URL")+"/storage/v1/object/authenticated/vertice-repositorios/"+String(f.storage_path).split("/").map(encodeURIComponent).join("/"),
     {headers:{Authorization:"Bearer "+k,apikey:k},signal:AbortSignal.timeout(60000)});
    if(!src.ok)throw E("storage_"+src.status);
    const bytes=await src.arrayBuffer();
    const ext=(String(f.file_name).match(/\.[A-Za-z0-9]{1,6}$/)?.[0])??"";
    const stem=clean(String(f.file_name).replace(/\.[A-Za-z0-9]{1,6}$/,""));
    const item=await upload(token,d.parent,stem+"__"+f.id+ext,bytes,f.mime_type);
    await logRow({...row,status:"ok",destino:d.label,onedrive_item_id:item,size_bytes:bytes.byteLength});res.ok++;
   }catch(e){
    await logRow({...row,status:"erro",erro:String((e as Error).message).slice(0,200)});res.erro++;
   }
  }
  const restantes=Math.max(semLog-processados,0);
  return respond({instituicao:inst===UNITOP?"UNITOP":"UNICALDAS",total_arquivos:files.length,processados,...res,restantes});
 }catch(e){
  const status=(e as {status?:number}).status??500;
  return respond({error:status===500?"internal_error":(e as Error).message},status);
 }
});
