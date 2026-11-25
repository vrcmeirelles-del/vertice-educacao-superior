import {createClient} from "npm:@supabase/supabase-js@2.45.4";

/**
 * vertice-roster-sync — Automatic roster synchronization
 *
 * Called by pg_cron or Supabase scheduled invocation every hour.
 * Finds connectors due for sync, fetches roster from IES API, calls batch-link.
 *
 * Can also be called manually with {connectorId} to sync a specific connector.
 */

const env=(name:string)=>String(Deno.env.get(name)||"");
const secretKey=()=>{
 const raw=env("SUPABASE_SECRET_KEYS");
 if(raw)try{const obj=JSON.parse(raw);return obj.default||Object.values(obj)[0];}catch{}
 return env("SUPABASE_SERVICE_ROLE_KEY");
};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// SSRF guard: recusa endpoints que apontam para loopback/rede interna/metadados de nuvem.
// Mitiga configuração de conector maliciosa; não cobre DNS rebinding (TOCTOU) de nomes externos.
function isBlockedHost(hostname:string){
 const h=hostname.toLowerCase().replace(/^\[|\]$/g,"");
 if(h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h.endsWith(".internal"))return true;
 if(h==="::1"||h.startsWith("fd")||h.startsWith("fe80")||h.startsWith("::ffff:"))return true;
 const m=h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
 if(m){
  const a=Number(m[1]),b=Number(m[2]);
  if(a===127||a===10||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||a>=224)return true;
 }
 return false;
}

type Connector={
 id:string;institution_id:string;connector_type:string;
 api_base_url:string;api_auth_type:string;api_auth_value:string;
 api_roster_endpoint:string;api_roster_method:string;api_response_mapping:Record<string,string>;
 sync_filter_status:string[];sync_auto_link:boolean;
};

function normalizeCpf(input:unknown){return String(input??"").replace(/\D/g,"");}
function validCpf(input:unknown){
 const cpf=normalizeCpf(input);
 if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return false;
 const check=(size:number)=>{
  let sum=0;for(let i=0;i<size;i++)sum+=Number(cpf[i])*(size+1-i);
  const r=(sum*10)%11;return r===10?0:r;
 };
 return check(9)===Number(cpf[9])&&check(10)===Number(cpf[10]);
}

function getNestedValue(obj:unknown,path:string):unknown{
 const parts=path.split(".");
 let current:unknown=obj;
 for(const p of parts){
  if(!current||typeof current!=="object")return undefined;
  current=(current as Record<string,unknown>)[p];
 }
 return current;
}

async function fetchRoster(connector:Connector):Promise<{cpf:string;name:string;curso:string;turma:string;status:string}[]>{
 const url=new URL(connector.api_roster_endpoint,connector.api_base_url);
 if(url.protocol!=="https:"&&url.protocol!=="http:")throw new Error("Endpoint da IES com esquema inválido");
 if(isBlockedHost(url.hostname))throw new Error("Endpoint da IES aponta para host interno não permitido");
 const headers:Record<string,string>={"Accept":"application/json"};

 if(connector.api_auth_type==="bearer")headers["Authorization"]="Bearer "+connector.api_auth_value;
 else if(connector.api_auth_type==="basic")headers["Authorization"]="Basic "+btoa(connector.api_auth_value);
 else if(connector.api_auth_type==="api_key_header"){
  const [key,...val]=connector.api_auth_value.split(":");
  headers[key]=val.join(":");
 }

 // redirect:"error" impede exfiltração da credencial do conector via 3xx para host arbitrário.
 const response=await fetch(url,{method:connector.api_roster_method,headers,redirect:"error",signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error("API da IES retornou HTTP "+response.status);
 const body=await response.json();

 const mapping=connector.api_response_mapping;
 const studentsPath=mapping.students||"data";
 const list=getNestedValue(body,studentsPath);
 if(!Array.isArray(list))throw new Error("Resposta da API não contém lista em '"+studentsPath+"'");

 return list.map((row:Record<string,unknown>)=>({
  cpf:normalizeCpf(getNestedValue(row,mapping.cpf||"cpf")),
  name:String(getNestedValue(row,mapping.name||"nome")??""),
  curso:String(getNestedValue(row,mapping.course||"curso")??""),
  turma:String(getNestedValue(row,mapping.turma||"turma")??""),
  status:String(getNestedValue(row,mapping.status||"situacao")??"ativo").toLowerCase(),
 })).filter(r=>validCpf(r.cpf));
}

async function syncConnector(admin:ReturnType<typeof createClient>,connector:Connector){
 // Create log entry
 const {data:log}=await admin.from("vertice_sync_log").insert({
  connector_id:connector.id,institution_id:connector.institution_id,status:"running"
 }).select("id").single();
 const logId=log?.id;

 try{
  // Update connector status
  await admin.from("vertice_api_connectors").update({last_sync_status:"running",updated_at:new Date().toISOString()}).eq("id",connector.id);

  // Fetch roster from IES API
  const roster=await fetchRoster(connector);

  // Filter by allowed statuses
  const allowedStatuses=new Set(connector.sync_filter_status.map(s=>s.toLowerCase()));
  const filtered=roster.filter(r=>allowedStatuses.has(r.status));

  let matched=0,linked=0,skipped=0;

  if(filtered.length&&connector.sync_auto_link){
   // Get course mapping — use first course from institution
   const {data:courses}=await admin.from("vertice_courses")
    .select("id").eq("institution_id",connector.institution_id).limit(1);
   const courseId=courses?.[0]?.id;
   if(!courseId)throw new Error("Nenhum curso cadastrado para esta IES");

   // Call learning bridge batch_link
   const bridgeKey=env("VERTICE_BRIDGE_API_KEY");
   const identityKey=env("VERTICE_BRIDGE_IDENTITY_KEY");
   const bridgeUrl=env("FATO_ORDEM_BRIDGE_URL")||"https://www.fatoeordem.com.br";
   if(bridgeKey.length<32||identityKey.length<32)throw new Error("Chaves da bridge não configuradas");

   // Process in batches of 500
   for(let i=0;i<filtered.length;i+=500){
    const batch=filtered.slice(i,i+500);
    const response=await fetch(new URL("/api/internal/vertice/batch-link",bridgeUrl),{
     method:"POST",
     headers:{"x-vertice-bridge-key":bridgeKey,"x-requested-with":"fato-e-ordem","content-type":"application/json"},
     body:JSON.stringify({institutionId:connector.institution_id,courseId,students:batch.map(s=>({cpf:s.cpf}))}),
     signal:AbortSignal.timeout(60000)
    });
    if(!response.ok)throw new Error("Bridge HTTP "+response.status);
    const result=await response.json();
    const r=result.result||result;
    matched+=(r.matched||0);linked+=(r.linked||0);skipped+=(r.skipped||0);
   }
  }else{
   skipped=filtered.length;
  }

  // Update connector
  await admin.from("vertice_api_connectors").update({
   last_sync_at:new Date().toISOString(),last_sync_status:"success",
   last_sync_message:`${linked} vinculados de ${filtered.length} alunos ativos`,
   last_sync_matched:matched,last_sync_linked:linked,last_sync_total:filtered.length,
   updated_at:new Date().toISOString()
  }).eq("id",connector.id);

  // Update log
  if(logId)await admin.from("vertice_sync_log").update({
   completed_at:new Date().toISOString(),status:"success",
   total_fetched:roster.length,matched,linked,skipped,new_students:linked
  }).eq("id",logId);

  return{connectorId:connector.id,institution:connector.institution_id,total:filtered.length,matched,linked,skipped,status:"success"};
 }catch(error){
  const msg=(error as Error).message||"Erro desconhecido";
  await admin.from("vertice_api_connectors").update({
   last_sync_status:"error",last_sync_message:msg,updated_at:new Date().toISOString()
  }).eq("id",connector.id);
  if(logId)await admin.from("vertice_sync_log").update({
   completed_at:new Date().toISOString(),status:"error",error_message:msg
  }).eq("id",logId);
  return{connectorId:connector.id,institution:connector.institution_id,status:"error",error:msg};
 }
}

Deno.serve(async req=>{
 const reply=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
 if(req.method==="OPTIONS")return new Response(null,{status:204});
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405);

 const url=env("SUPABASE_URL"),serviceKey=secretKey(),anonKey=env("SUPABASE_ANON_KEY");
 if(!url||!serviceKey||!anonKey)return reply({error:"Não configurado"},503);
 const admin=createClient(url,serviceKey,{auth:{persistSession:false}});

 try{
  let body:Record<string,unknown>={};
  try{body=await req.json();}catch{}

  // Autorização obrigatória. Sem isto, qualquer portador da anon key pública (que satisfaz o
  // verify_jwt do gateway) poderia disparar a sincronização privilegiada (service role + saída
  // com credenciais do conector + escrita no bridge). Dois caminhos legítimos:
  //  (1) execução agendada: header x-cron-secret validado por vertice_espelho_cron_ok;
  //  (2) execução manual: usuário autenticado (MFA/aal2) que gerencia a instituição do conector.
  let connectors:Connector[]=[];
  const cronSecret=req.headers.get("x-cron-secret");

  if(cronSecret){
   const cr=await fetch(url+"/rest/v1/rpc/vertice_espelho_cron_ok",{method:"POST",
    headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"},
    body:JSON.stringify({p_secret:cronSecret}),signal:AbortSignal.timeout(10000)});
   if(!cr.ok||(await cr.json())!==true)return reply({error:"access_denied"},403);
   const {data}=await admin.from("vertice_api_connectors")
    .select("*").eq("sync_enabled",true).neq("connector_type","manual_only")
    .or(`last_sync_at.is.null,last_sync_at.lt.${new Date(Date.now()-3600000).toISOString()}`);
   connectors=((data||[]) as Connector[]).filter(c=>c.api_base_url);
  }else{
   const bearer=req.headers.get("authorization")||"";
   if(!/^Bearer [\w.-]{16,}$/.test(bearer))return reply({error:"authentication_required"},401);
   const ur=await fetch(url+"/auth/v1/user",{headers:{Authorization:bearer,apikey:anonKey},signal:AbortSignal.timeout(10000)});
   const user=await ur.json().catch(()=>null);
   if(!ur.ok||!user?.id||user.is_anonymous)return reply({error:"authentication_required"},401);
   const connectorId=typeof body.connectorId==="string"?body.connectorId:"";
   if(!UUID.test(connectorId))return reply({error:"invalid_request"},400);
   const {data:conn}=await admin.from("vertice_api_connectors")
    .select("*").eq("id",connectorId).eq("sync_enabled",true).maybeSingle();
   if(!conn)return reply({error:"connector_not_found"},404);
   // Autorização por instituição (master/gestor/reitor/diretor/procurador + aal2), com o JWT do usuário.
   const ar=await fetch(url+"/rest/v1/rpc/vertice_evidence_can_manage",{method:"POST",
    headers:{apikey:anonKey,Authorization:bearer,"Content-Type":"application/json"},
    body:JSON.stringify({p_institution_id:(conn as Connector).institution_id}),signal:AbortSignal.timeout(10000)});
   if(!ar.ok||(await ar.json())!==true)return reply({error:"access_denied"},403);
   connectors=[conn as Connector];
  }

  const results=[];
  for(const connector of connectors){
   results.push(await syncConnector(admin,connector));
  }
  return reply({ok:true,synced:results.length,results});
 }catch(error){
  return reply({error:(error as Error).message},500);
 }
});
