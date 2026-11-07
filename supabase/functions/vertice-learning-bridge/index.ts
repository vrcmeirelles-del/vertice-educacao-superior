import {createClient} from "npm:@supabase/supabase-js@2.45.4";

// Server-only bridge. No CPF is persisted, logged or returned.
const ORIGINS=new Set([
 "https://www.verticesuperior.com.br","https://verticesuperior.com.br",
 "https://vertice-portal.onrender.com","https://vertice-educacao-superior.onrender.com",
 "https://vertice-educacao-superior-site.onrender.com"
]);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ALLOWED_ROLES=new Set(["reitor","gestor","diretor_geral","diretor_pedagogico","procurador"]);
const MODS=new Set(["oab","cfc","enade","delegado","pf","estadual","federal","defensoria","mp"]);
const enc=new TextEncoder();
const fail=(message:string,status=400)=>Object.assign(new Error(message),{status});
const env=(name:string)=>String(Deno.env.get(name)||"");
const send=(body:unknown,status=200,origin="")=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",
  "Access-Control-Allow-Origin":ORIGINS.has(origin)?origin:"https://www.verticesuperior.com.br",
  "Access-Control-Allow-Headers":"authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}
});
const secretKey=()=>{
 const raw=env("SUPABASE_SECRET_KEYS");
 if(raw)try{const obj=JSON.parse(raw);return obj.default||Object.values(obj)[0];}catch{}
 return env("SUPABASE_SERVICE_ROLE_KEY");
};
const publishableKey=()=>{
 const raw=env("SUPABASE_PUBLISHABLE_KEYS");
 if(raw)try{const obj=JSON.parse(raw);return obj.default||Object.values(obj)[0];}catch{}
 return env("SUPABASE_ANON_KEY");
};
function cfg(){
 const url=env("SUPABASE_URL"),serviceKey=secretKey();
 if(!url||!serviceKey)throw fail("Serviço institucional não configurado.",503);
 return{url,serviceKey};
}
function object(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value))throw fail("Dados inválidos.");
 return value as Record<string,unknown>;
}
const str=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);
const institution=v=>{const s=str(v,70).toLowerCase();if(!UUID.test(s))throw fail("Instituição inválida.");return s;};
const course=v=>{const s=str(v,70).toLowerCase();if(!UUID.test(s))throw fail("Curso inválido.");return s;};
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
async function tokenFor(cpf:unknown,institutionId:string){
 const key=env("VERTICE_BRIDGE_IDENTITY_KEY");
 if(key.length<32)throw fail("Chave de identidade da integração não configurada.",503);
 if(!validCpf(cpf))throw fail("Identificador acadêmico inválido.");
 const cryptoKey=await crypto.subtle.importKey("raw",enc.encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const raw=new Uint8Array(await crypto.subtle.sign("HMAC",cryptoKey,enc.encode(
  "fo-vertice:v1:"+institutionId+":"+normalizeCpf(cpf)
 )));
 return Array.from(raw).map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function authenticate(req:Request,inst:string,admin:ReturnType<typeof createClient>){
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer "))throw fail("Autenticação necessária.",401);
 const jwt=auth.slice(7);
 const {data,error}=await admin.auth.getUser(jwt);
 if(error||!data.user)throw fail("Sessão inválida.",401);
 let claims:Record<string,unknown>;
 try{
  const part=jwt.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
  claims=JSON.parse(atob(part.padEnd(Math.ceil(part.length/4)*4,"=")));
 }catch{throw fail("Sessão não reconhecida.",401);}
 if(claims.sub!==data.user.id||claims.aal!=="aal2")throw fail("É exigida autenticação multifator.",403);
 const {data:master,error:masterError}=await admin.from("vertice_admins").select("user_id").eq("user_id",data.user.id).maybeSingle();
 if(masterError)throw fail("Verificação de acesso indisponível.",503);
 if(master)return data.user.id;
 const {data:membership,error:membershipError}=await admin.from("vertice_memberships")
  .select("role").eq("user_id",data.user.id).eq("institution_id",inst).maybeSingle();
 if(membershipError||!membership||!ALLOWED_ROLES.has(membership.role))throw fail("Acesso não autorizado à instituição.",403);
 return data.user.id;
}
async function rpc(admin:ReturnType<typeof createClient>,name:string,args:Record<string,unknown>){
 const {data,error}=await admin.rpc(name,args);
 if(error)throw fail("Falha de validação ou integração acadêmica: "+name,422);
 return data;
}
async function remote(path:string,method="GET",body?:unknown){
 const key=env("VERTICE_BRIDGE_API_KEY");
 if(key.length<32)throw fail("Credencial de comunicação com o Fato & Ordem não configurada.",503);
 const base=env("FATO_ORDEM_BRIDGE_URL")||"https://www.fatoeordem.com.br";
 const url=new URL(path,base);
 if(url.protocol!=="https:"||!["www.fatoeordem.com.br","fatoeordem.com.br","fato-e-ordem-lab.onrender.com"].includes(url.hostname))
  throw fail("Origem da integração não autorizada.",503);
 const response=await fetch(url,{method,headers:{
  "x-vertice-bridge-key":key,
  ...(method!=="GET"?{"x-requested-with":"fato-e-ordem","content-type":"application/json"}:{})
 },body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw fail("Fato & Ordem não confirmou a integração (HTTP "+response.status+").",502);
 const result=await response.json().catch(()=>null);
 if(!result||typeof result!=="object"||!result.result)throw fail("Resposta da integração inválida.",502);
 return result.result;
}
function rows(value:unknown,max=100){
 if(!Array.isArray(value)||!value.length||value.length>max)throw fail("Lote inválido ou acima do limite.");
 return value.map(object);
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS")return send({ok:true},200,origin);
 if(req.method!=="POST")return send({error:"Método não permitido."},405,origin);
 if(origin&&!ORIGINS.has(origin))return send({error:"Origem recusada."},403,origin);
 try{
  if(Number(req.headers.get("content-length")||0)>120000)throw fail("Lote muito grande.",413);
  const body=object(await req.json());
  if(JSON.stringify(body).length>120000)throw fail("Lote muito grande.",413);
  const inst=institution(body.institutionId),operation=str(body.operation,40);
  const {url,serviceKey}=cfg();
  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  const actor=await authenticate(req,inst,admin);
  if(operation==="provision_tenant"){
   if(typeof body.enabled!=="boolean"||body.reviewed!==true)
    throw fail("Confirme a ativação institucional e o escopo do compartilhamento.");
   const {data:ies,error:iesError}=await admin.from("vertice_institutions")
     .select("id,name,status").eq("id",inst).maybeSingle();
   if(iesError||!ies)throw fail("Instituição não cadastrada na Vértice.",404);
   if(body.enabled&&(ies.status!=="ativa"||/(?:teste|fict[ií]ci|demonstrativ)/i.test(ies.name||"")))
    throw fail("O ambiente de demonstração ou instituição inativa não pode compartilhar dados reais.",403);
   const confirmed=await remote("/api/internal/vertice/provision","POST",{
     institutionId:inst,enabled:body.enabled,authorizedBy:actor,institutionName:ies.name
   });
   return send({ok:true,institutionId:inst,enabled:confirmed.enabled,
     notice:confirmed.notice||"Integração institucional atualizada."},200,origin);
  }
  if(operation==="status"){
   const {data,error}=await admin.from("vertice_learning_course_metrics").select(
    "course_id,semester,module,participants,attempts,graded,correct,paired_students,comparison_gap,updated_at"
   ).eq("institution_id",inst).limit(300);
   if(error)throw fail("Painel não disponível.",503);
   const configured=env("VERTICE_BRIDGE_API_KEY").length>=32&&env("VERTICE_BRIDGE_IDENTITY_KEY").length>=32;
   let tenantEnabled:null|boolean=null,tenantStatus:"não configurado"|"ativo"|"inativo"|"indisponível"="não configurado";
   if(configured)try{
     const info=await remote("/api/internal/vertice/tenant?institutionId="+encodeURIComponent(inst));
     tenantEnabled=info.enabled===true;
     tenantStatus=tenantEnabled?"ativo":"inativo";
   }catch{
     tenantStatus="indisponível";
   }
   return send({ok:true,configured,tenantEnabled,tenantStatus,
    metrics:data||[],scope:"institution",courseCount:new Set((data||[]).map(x=>x.course_id)).size},200,origin);
  }
  if(operation==="import_roster"){
   if(body.sourceAttested!==true)throw fail("Confirme que a fonte acadêmica foi conferida.");
   const records=[];
   for(const row of rows(body.rows,100)){
    const c=course(row.courseId),id=await tokenFor(row.cpf,inst);
    const enrollmentRef=str(row.enrollmentRef,120),label=str(row.sourceLabel,200);
    if(!enrollmentRef||label.length<3)throw fail("Matrícula e identificação da fonte são obrigatórias.");
    records.push({studentToken:id,courseId:c,enrollmentRef,sourceLabel:label});
   }
   const result=await rpc(admin,"vertice_bridge_accept_roster",{p_institution:inst,p_rows:records});
   return send({ok:true,accepted:result.accepted,rawCpfStored:false,notice:"Matrículas conferidas; o vínculo com o Fato & Ordem ainda depende de confirmação recíproca."},200,origin);
  }
  if(operation==="import_grades"){
   if(body.sourceAttested!==true)throw fail("Confirme a origem das notas curriculares.");
   const items=[];
   for(const row of rows(body.rows,100)){
    const token=await tokenFor(row.cpf,inst),c=course(row.courseId);
    const semester=str(row.semester,7),subjectCode=str(row.subjectCode,120),
      assessmentCode=str(row.assessmentCode,120),subjectName=str(row.subjectName,250),
      sourceRef=str(row.sourceRef,500),score=Number(row.score),scoreMax=Number(row.scoreMax);
    if(!/^20\d{2}\/[12]$/.test(semester)||!subjectCode||!assessmentCode||subjectName.length<3||
      sourceRef.length<3||!Number.isFinite(score)||!Number.isFinite(scoreMax)||scoreMax<=0||score<0||score>scoreMax)
      throw fail("Nota, escala ou referência curricular inválida.");
    items.push({studentToken:token,courseId:c,semester,subjectCode,assessmentCode,subjectName,
      score,scoreMax,sourceRef,assessedAt:row.assessedAt||null});
   }
   const result=await rpc(admin,"vertice_bridge_ingest_grades",{p_institution:inst,p_rows:items});
   await rpc(admin,"vertice_bridge_refresh_metrics",{p_institution:inst});
   return send({ok:true,accepted:result.accepted,rawCpfStored:false},200,origin);
  }
  if(operation==="import_calendar"){
   if(body.sourceAttested!==true)throw fail("Confirme o calendário letivo da fonte oficial.");
   const windows=rows(body.rows,100).map(row=>({
    courseId:course(row.courseId),semester:str(row.semester,7),
    startsOn:str(row.startsOn,10),endsOn:str(row.endsOn,10),sourceRef:str(row.sourceRef,500)
   }));
   const result=await rpc(admin,"vertice_bridge_accept_windows",{p_institution:inst,p_rows:windows});
   const rec=await rpc(admin,"vertice_bridge_reconcile_semesters",{p_institution:inst});
   await rpc(admin,"vertice_bridge_refresh_metrics",{p_institution:inst});
   return send({ok:true,accepted:result.accepted,reconciled:rec.reconciled},200,origin);
  }
  if(operation==="map_subject"){
   if(body.reviewed!==true)throw fail("Mapeamento curricular exige validação humana.");
   const result=await rpc(admin,"vertice_bridge_map_subject",{
    p_institution:inst,p_course:course(body.courseId),p_subject:str(body.subjectCode,120),
    p_module:str(body.module,30),p_competency:str(body.competency,500),
    p_evidence:str(body.evidenceRef,1000),p_actor:actor
   });
   await rpc(admin,"vertice_bridge_refresh_metrics",{p_institution:inst});
   return send({ok:true,...result},200,origin);
  }
  if(operation==="sync"){
   if(env("VERTICE_BRIDGE_API_KEY").length<32||env("VERTICE_BRIDGE_IDENTITY_KEY").length<32)
    throw fail("Integração ainda sem chaves de servidor.",503);
   const candidates=await remote("/api/internal/vertice/candidates?institutionId="+encodeURIComponent(inst));
   if(!candidates.complete)throw fail("Fila de alunos excede o lote seguro, ampliação necessária.",409);
   let confirmed=0;
   const pending=(candidates.records||[]).filter((x:{verified:boolean})=>!x.verified).slice(0,50);
   if(pending.length){
    const matched=await rpc(admin,"vertice_bridge_candidates",{
     p_institution:inst,p_tokens:pending.map((x:{studentToken:string})=>x.studentToken)
    });
    for(const match of matched||[]){
     const confirmedLink=await remote("/api/internal/vertice/verify","POST",{
      institutionId:inst,studentToken:match.studentToken,courseId:match.courseId
     });
     if(confirmedLink.verified)confirmed++;
    }
    if(confirmed)await rpc(admin,"vertice_bridge_reset_cursor",{p_institution:inst});
   }
   let cursor=await rpc(admin,"vertice_bridge_read_cursor",{p_institution:inst});
   let ingested=0,ignored=0,more=false,pages=0;
   for(let i=0;i<4;i++){
    const query=new URLSearchParams({institutionId:inst,after:cursor.after,afterId:cursor.afterId||"",limit:"400"});
    const page=await remote("/api/internal/vertice/events?"+query.toString());
    const events=page.events||[];pages++;
    if(events.length){
     const result=await rpc(admin,"vertice_bridge_ingest_events",{p_institution:inst,p_events:events});
     ingested+=Number(result.inserted||0);ignored+=Number(result.ignored||0);
     if(!page.nextCursor)throw fail("Cursor de evento ausente.",502);
     await rpc(admin,"vertice_bridge_commit_cursor",{
      p_institution:inst,p_after:page.nextCursor.after,p_after_id:page.nextCursor.afterId
     });
     cursor=page.nextCursor;
    }
    more=Boolean(page.hasMore);
    if(!more)break;
   }
   const metrics=await rpc(admin,"vertice_bridge_refresh_metrics",{p_institution:inst});
   return send({ok:true,confirmedLinks:confirmed,newEvents:ingested,ignoredEvents:ignored,
    publishedGroups:metrics.published_groups,remainingPages:more,
    notice:"Sincronização autenticada sem CPF nem texto de resposta; acertos não são notas oficiais."},200,origin);
  }
  throw fail("Operação desconhecida.",404);
 }catch(error){
  const e=error as {status?:number;message?:string};
  return send({error:e.message||"Falha na integração."},e.status||500,origin);
 }
});
