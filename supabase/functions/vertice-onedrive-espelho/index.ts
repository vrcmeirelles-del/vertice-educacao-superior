// Espelho Portal Vértice -> OneDrive (CLIENTES/<IES>/Portal Vértice/<bloco>/<aba>/<tabela>.csv).
// Lista fixa de tabelas (sem dados nominais de alunos, sem finanças). Colunas de e-mail/telefone/CPF são removidas.
// Usuário: lê com o JWT dele (RLS vale). Agendado: Bearer = service role. Log em vertice_onedrive_espelho.
const ORIGINS=new Set(["https://www.verticesuperior.com.br","https://verticesuperior.com.br","https://vertice-portal.onrender.com","https://vertice-educacao-superior.onrender.com","https://vertice-educacao-superior-site.onrender.com"]);
const UNITOP="1f5fd5b4-93c6-4626-834d-136884915587",UNICALDAS="4224e2fc-6a96-4761-820f-6f8e809ca1c1";
const IES:Record<string,string>={[UNITOP]:"UNITOP",[UNICALDAS]:"UNICALDAS"};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const driveId="b!GyLR53JNYkSt-KuvMN5YemviyAq9ZChCvFFxeRXLYNGIMY3xMuDhTK_J5zKaFMbV";
const BASE="Documentos Virgilio/Empresas/Vertice/CLIENTES";
const G="01 Gestão e Planejamento",R="02 Regulação e Avaliação",D="03 Dados Acadêmicos",F="05 Fontes e Base de Dados";
const MAP:[string,string][]=[
 ["vertice_goals",G+"/Metas e indicadores"],["vertice_goal_measurements",G+"/Metas e indicadores"],
 ["vertice_actions",G+"/Plano de ação 5W2H"],["vertice_action_governance",G+"/Plano de ação 5W2H"],
 ["vertice_diagnosis_items",G+"/Diagnóstico"],
 ["vertice_emec_snapshots",R+"/e-MEC · Regulação"],
 ["vertice_repository_requests",R+"/Reconhecimento de Curso"],["vertice_repository_files",R+"/Reconhecimento de Curso"],
 ["vertice_avaliacao_simulada",R+"/Recredenciamento · Instrumento 2017"],
 ["vertice_instrumento_checklist",R+"/Novo Instrumento"],["vertice_instrumento_evidencias",R+"/Novo Instrumento"],
 ["vertice_instrumento_ciclo",R+"/Novo Instrumento"],["vertice_instrumento_cpa",R+"/Novo Instrumento"],
 ["vertice_instrumento_correspondencias",R+"/Novo Instrumento"],
 ["vertice_enade360_records",R+"/ENADE 360°"],
 ["vertice_courses",D+"/Cadastro e cursos"],
 ["vertice_enrollment_snapshots",D+"/Matrículas"],
 ["vertice_course_semester_stats",D+"/e-ORBIT · Espelho"],["vertice_turma_stats",D+"/e-ORBIT · Espelho"],["vertice_risco_agregado",D+"/e-ORBIT · Espelho"],
 ["vertice_reprovacoes_detalhe",D+"/BI · Reprovações de Todos os Cursos"],["vertice_offering_outcomes",D+"/BI · Reprovações de Todos os Cursos"],
 ["vertice_eorbit_direito_raio_x",D+"/Raio-X Direito"],
 ["vertice_learning_course_metrics",D+"/Aprendizagem Conectada"],
 ["vertice_base_records",F+"/Base da organização"],["vertice_base_modules",F+"/Base da organização"],
];
const BLOCKED_COL=/(e[-_]?mail|cpf|telefone|phone|senha|password|token|secret)/i;
const MAX_ROWS=20000,MAX_BYTES=8*1024*1024;
const enc=new TextEncoder();
const b64=(v:Uint8Array)=>btoa(String.fromCharCode(...v)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
const E=(code:string,status=400)=>Object.assign(new Error(code),{status});
const hex=(buf:ArrayBuffer)=>Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");

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
function toCsv(rows:Record<string,unknown>[]){
 const cols=Object.keys(rows[0]).filter(c=>!BLOCKED_COL.test(c));
 const cell=(v:unknown)=>{
  if(v===null||v===undefined)return "";
  const s=typeof v==="object"?JSON.stringify(v):String(v);
  return /[",\r\n;]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
 };
 const lines=[cols.join(",")];
 for(const r of rows)lines.push(cols.map(c=>cell(r[c])).join(","));
 return enc.encode("﻿"+lines.join("\r\n")+"\r\n");
}
async function fetchRows(table:string,inst:string,bearer:string,apikey:string){
 const out:Record<string,unknown>[]=[];
 for(let from=0;from<MAX_ROWS;from+=1000){
  const r=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/"+table+"?institution_id=eq."+inst+"&select=*",
   {headers:{apikey,Authorization:bearer,Range:from+"-"+(from+999),"Range-Unit":"items"},signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw E("leitura_negada_ou_indisponivel",r.status===401||r.status===403?403:502);
  const page=await r.json();
  if(!Array.isArray(page))throw E("resposta_invalida",502);
  out.push(...page);
  if(page.length<1000)break;
 }
 return out;
}
const svc=()=>{const k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!k)throw E("backend_unavailable",503);return k;};
async function lastHash(inst:string,table:string){
 const k=svc();
 const r=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/vertice_onedrive_espelho?institution_id=eq."+inst+"&tabela=eq."+table+"&status=in.(ok,sem_mudanca)&select=sha256&order=created_at.desc&limit=1",
  {headers:{apikey:k,Authorization:"Bearer "+k},signal:AbortSignal.timeout(10000)});
 if(!r.ok)return null;
 const j=await r.json();return j?.[0]?.sha256??null;
}
async function putFile(token:string,ies:string,dest:string,file:string,bytes:Uint8Array){
 const path=[...BASE.split("/"),ies,"Portal Vértice",...dest.split("/"),file].map(encodeURIComponent).join("/");
 const r=await fetch("https://graph.microsoft.com/v1.0/drives/"+driveId+"/root:/"+path+":/content",
  {method:"PUT",headers:{Authorization:"Bearer "+token,"Content-Type":"text/csv; charset=utf-8"},body:bytes,signal:AbortSignal.timeout(40000)});
 if(!r.ok)throw E("onedrive_gravacao_falhou_"+r.status,502);
}
async function syncOne(inst:string,table:string,dest:string,ctx:{token:string;bearer:string;apikey:string;force:boolean}){
 const ies=IES[inst],file=table+".csv";
 const res:Record<string,unknown>={tabela:table,destino:"Portal Vértice/"+dest+"/"+file};
 let status="ok",erro:string|null=null,linhas=0,bytes=0,sha:string|null=null;
 try{
  const rows=await fetchRows(table,inst,ctx.bearer,ctx.apikey);
  linhas=rows.length;
  if(!linhas)status="vazio";
  else{
   const data=toCsv(rows);bytes=data.byteLength;
   if(bytes>MAX_BYTES)status="muito_grande";
   else{
    sha=hex(await crypto.subtle.digest("SHA-256",data));
    if(!ctx.force&&sha===await lastHash(inst,table))status="sem_mudanca";
    else await putFile(ctx.token,ies,dest,file,data);
   }
  }
 }catch(e){status="erro";erro=(e as Error).message?.slice(0,200)??"erro";}
 return {res:{...res,linhas,bytes,status,erro},log:{institution_id:inst,tabela:table,destino:"Portal Vértice/"+dest,linhas,bytes,sha256:sha,status,erro}};
}
async function pool<T,R>(items:T[],n:number,fn:(x:T)=>Promise<R>){
 const out:R[]=[];let i=0;
 await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const j=i++;out[j]=await fn(items[j]);}}));
 return out;
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")??"";
 const headers:Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
 if(ORIGINS.has(origin))headers["Access-Control-Allow-Origin"]=origin;
 const respond=(d:unknown,s=200)=>Response.json(d,{status:s,headers});
 if(origin&&!ORIGINS.has(origin))return respond({error:"origin_denied"},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
 try{
  const bearer=req.headers.get("authorization")??"";
  if(!/^Bearer [\w.-]{16,8190}$/.test(bearer))throw E("authentication_required",401);
  const raw=await req.text();
  if(raw.length>2048)throw E("request_too_large",413);
  const body=raw?JSON.parse(raw):{};
  if(!body||typeof body!=="object"||Array.isArray(body))throw E("invalid_request");
  const apikey=Deno.env.get("SUPABASE_ANON_KEY")??JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"{}").default;
  if(!apikey)throw E("backend_unavailable",503);
  const force=body.force===true;
  let targets:string[],origem:string,userId:string|null=null;
  const cronSecret=req.headers.get("x-cron-secret");
  let cron=false;
  if(cronSecret){
   const k=svc();
   const cr=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/rpc/vertice_espelho_cron_ok",{method:"POST",
    headers:{apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/json"},body:JSON.stringify({p_secret:cronSecret}),signal:AbortSignal.timeout(10000)});
   cron=cr.ok&&(await cr.json())===true;
   if(!cron)throw E("access_denied",403);
  }
  let readBearer=bearer;
  if(cron){
   origem="agendado";targets=Object.keys(IES);readBearer="Bearer "+svc();
  }else{
   const ur=await fetch(Deno.env.get("SUPABASE_URL")+"/auth/v1/user",{headers:{Authorization:bearer,apikey},signal:AbortSignal.timeout(10000)});
   const user=await ur.json().catch(()=>null);
   if(!ur.ok||!user?.id||user.is_anonymous)throw E("authentication_required",401);
   const inst=body.institution_id;
   if(typeof inst!=="string"||!UUID.test(inst)||!IES[inst])throw E("invalid_request");
   const ar=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/rpc/vertice_source_drive_authorize",{method:"POST",
    headers:{apikey,Authorization:bearer,"Content-Type":"application/json"},body:JSON.stringify({p_institution:inst}),signal:AbortSignal.timeout(10000)});
   if(!ar.ok||(await ar.json())!==true)throw E("access_denied",403);
   origem="manual";userId=user.id;targets=[inst];
  }
  const token=await graphToken();
  const summary:Record<string,unknown>[]=[],logs:Record<string,unknown>[]=[];
  for(const inst of targets){
   const ctx={token,bearer:readBearer,apikey:cron?svc():apikey,force};
   const results=await pool(MAP,4,([t,d])=>syncOne(inst,t,d,ctx));
   for(const r of results){logs.push({...r.log,origem,acionado_por:userId});}
   const count=(s:string)=>results.filter(r=>r.res.status===s).length;
   summary.push({instituicao:IES[inst],ok:count("ok"),sem_mudanca:count("sem_mudanca"),vazio:count("vazio"),muito_grande:count("muito_grande"),erro:count("erro"),
    erros:results.filter(r=>r.res.status==="erro").map(r=>({tabela:r.res.tabela,erro:r.res.erro}))});
  }
  const k=svc();
  const lr=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/vertice_onedrive_espelho",{method:"POST",
   headers:{apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(logs),signal:AbortSignal.timeout(15000)});
  return respond({origem,resumo:summary,log_gravado:lr.ok});
 }catch(e){
  const status=(e as {status?:number}).status??500;
  return respond({error:status===500?"internal_error":(e as Error).message},status);
 }
});
