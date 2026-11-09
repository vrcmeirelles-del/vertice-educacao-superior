// Conexões de dados da IES: o gestor vincula a fonte (API, banco SQL, agente ou pasta) e a credencial vai para o cofre.
// A credencial nunca volta ao navegador (exceto o token do agente, mostrado uma única vez na criação).
// Autorização: JWT do usuário + RPC vertice_connection_authorize (gestor/master com MFA). Log em vertice_data_connection_runs.
const ORIGINS=new Set(["https://www.verticesuperior.com.br","https://verticesuperior.com.br","https://vertice-portal.onrender.com","https://vertice-educacao-superior.onrender.com","https://vertice-educacao-superior-site.onrender.com"]);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TIPOS=new Set(["api","sql","agente","onedrive"]);
const CATEGORIAS=new Set(["academico_agregado","academico_nominal","pessoal","financeiro"]);
const SEMPRE_FORA=/(cpf|(^|_)rg($|_)|e[-_]?mail|telefone|celular|phone|senha|password|token|secret|endereco|logradouro)/i;
const IDENTIDADE=/(nome|matricula|docente_id|professor_id|id_professor|id_docente)/i;
const ENGINES:Record<string,number>={postgres:5432,mysql:3306,sqlserver:1433};
const E=(code:string,status=400)=>Object.assign(new Error(code),{status});
const svc=()=>{const k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!k)throw E("backend_unavailable",503);return k;};
const URLBASE=()=>Deno.env.get("SUPABASE_URL")!;
const str=(v:unknown,min:number,max:number,code:string)=>{if(typeof v!=="string"||v.trim().length<min||v.length>max)throw E(code);return v.trim();};

function privateIp(ip:string){
 if(/^(10\.|127\.|0\.|169\.254\.|192\.168\.)/.test(ip))return true;
 const m=/^172\.(\d+)\./.exec(ip);if(m&&+m[1]>=16&&+m[1]<=31)return true;
 if(/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip))return true;
 if(/^(::1|fc|fd|fe80)/i.test(ip))return true;
 return false;
}
// Bloqueia destinos internos (SSRF): só host público com nome, nunca IP literal, localhost ou rede interna.
async function hostSeguro(host:string){
 const h=host.toLowerCase();
 if(!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/.test(h)||!h.includes("."))throw E("host_invalido");
 if(/^\d+\.\d+\.\d+\.\d+$/.test(h)||/\.(local|internal|localhost|lan|corp|home)$/.test(h)||h==="localhost")throw E("host_nao_permitido");
 for(const type of ["A","AAAA"] as const){
  try{const ips=await Deno.resolveDns(h,type);for(const ip of ips)if(privateIp(String(ip)))throw E("host_nao_permitido");}
  catch(e){if((e as Error).message==="host_nao_permitido")throw e;}
 }
 return h;
}
function validarConfig(tipo:string,c:any){
 if(!c||typeof c!=="object"||Array.isArray(c))throw E("config_invalida");
 if(tipo==="api"){
  const u=new URL(str(c.base_url,10,300,"config_invalida"));
  if(u.protocol!=="https:"||u.username||u.password)throw E("url_invalida");
  const path=typeof c.test_path==="string"?c.test_path.slice(0,200):"/";
  if(!path.startsWith("/"))throw E("config_invalida");
  const header=typeof c.header_name==="string"&&/^[A-Za-z][A-Za-z0-9-]{1,40}$/.test(c.header_name)?c.header_name:"Authorization";
  const scheme=typeof c.scheme==="string"?c.scheme.slice(0,20):"Bearer";
  const datasets=Array.isArray(c.datasets)?c.datasets.slice(0,20).map((d:any)=>{
   const nome=str(d?.nome,2,60,"config_invalida").toLowerCase().replace(/[^a-z0-9_]+/g,"_");
   const dp=str(d?.path,1,300,"config_invalida");if(!dp.startsWith("/"))throw E("config_invalida");
   const categoria=String(d?.categoria);if(!CATEGORIAS.has(categoria))throw E("config_invalida");
   const array_key=typeof d?.array_key==="string"&&/^[A-Za-z0-9_.-]{1,60}$/.test(d.array_key)?d.array_key:undefined;
   return {nome,path:dp,categoria,array_key};
  }):[];
  return {base_url:u.origin+u.pathname.replace(/\/$/,""),test_path:path,header_name:header,scheme,datasets};
 }
 if(tipo==="sql"){
  const engine=String(c.engine);if(!(engine in ENGINES))throw E("config_invalida");
  const port=Number(c.port)||ENGINES[engine];if(!Number.isInteger(port)||port<1||port>65535)throw E("config_invalida");
  return {engine,host:str(c.host,4,253,"config_invalida"),port,database:str(c.database,1,120,"config_invalida"),user:str(c.user,1,120,"config_invalida")};
 }
 if(tipo==="onedrive")return {link:str(c.link,10,500,"config_invalida")};
 return {};
}
async function testar(tipo:string,config:any,secret:string|null){
 if(tipo==="api"){
  const u=new URL(config.base_url);await hostSeguro(u.hostname);
  const h:Record<string,string>={Accept:"application/json"};
  if(secret)h[config.header_name]=config.header_name.toLowerCase()==="authorization"?config.scheme+" "+secret:secret;
  const r=await fetch(config.base_url+config.test_path,{headers:h,redirect:"manual",signal:AbortSignal.timeout(12000)});
  if(r.status>=300&&r.status<400)throw E("redirecionamento_nao_seguido");
  if(r.status===401||r.status===403)throw E("credencial_recusada_"+r.status);
  if(!r.ok)throw E("api_respondeu_"+r.status);
  return "API respondeu "+r.status;
 }
 if(tipo==="sql"){
  const host=await hostSeguro(config.host);
  const conn=await Deno.connect({hostname:host,port:config.port,transport:"tcp"});conn.close();
  return "Porta "+config.port+" alcançável (login e consulta serão validados na primeira sincronização)";
 }
 if(tipo==="agente")return "Aguardando o agente da IES se apresentar";
 return "Link registrado; a autorização da pasta é feita no passo seguinte";
}
async function sb(path:string,init:RequestInit={}){
 const k=svc();
 return fetch(URLBASE()+path,{...init,headers:{apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/json",...(init.headers??{})},signal:AbortSignal.timeout(15000)});
}
async function registrar(conn:string,inst:string,acao:string,status:string,detalhe:string,user:string|null){
 await sb("/rest/v1/vertice_data_connection_runs",{method:"POST",headers:{Prefer:"return=minimal"},
  body:JSON.stringify({connection_id:conn,institution_id:inst,acao,status,detalhe:detalhe.slice(0,300),acionado_por:user})});
}
function limpar(v:any,cat:string,depth=0):any{
 if(Array.isArray(v))return depth>4?[]:v.map(x=>limpar(x,cat,depth+1));
 if(v&&typeof v==="object"){
  if(depth>4)return null;
  const o:Record<string,unknown>={};
  for(const [k,val] of Object.entries(v)){
   if(SEMPRE_FORA.test(k))continue;
   if(cat!=="academico_nominal"&&IDENTIDADE.test(k))continue;
   o[k]=limpar(val,cat,depth+1);
  }
  return o;
 }
 return v;
}
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
function permitido(conn:any,cat:string){
 const aprov=!!conn.aprovado_em;
 if(cat==="academico_agregado")return true;
 if(cat==="academico_nominal")return conn.escopo==="nominal"&&aprov;
 if(cat==="pessoal")return conn.escopo_financeiro==="pessoal"||(conn.escopo_financeiro==="completo"&&aprov);
 if(cat==="financeiro")return conn.escopo_financeiro==="completo"&&aprov;
 return false;
}
async function sincronizar(conn:any,por:string|null){
 const cfg=conn.config??{};const u=new URL(cfg.base_url);await hostSeguro(u.hostname);
 const secret=await (await sb("/rest/v1/rpc/vertice_connection_read_secret",{method:"POST",body:JSON.stringify({p_conn:conn.id})})).json();
 const h:Record<string,string>={Accept:"application/json"};
 if(typeof secret==="string"&&secret)h[cfg.header_name]=String(cfg.header_name).toLowerCase()==="authorization"?cfg.scheme+" "+secret:secret;
 const resumo:Record<string,unknown>[]=[];let total=0;
 for(const d of (cfg.datasets??[])){
  if(!permitido(conn,d.categoria)){resumo.push({conjunto:d.nome,status:"nao_autorizado"});continue;}
  try{
   const r=await fetch(cfg.base_url+d.path,{headers:h,redirect:"manual",signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw E("api_respondeu_"+r.status);
   const j=await r.json();
   let arr:any=d.array_key?d.array_key.split(".").reduce((a:any,k:string)=>a?.[k],j):j;
   if(!Array.isArray(arr))arr=Object.values(j??{}).find(Array.isArray)??[];
   const rows=arr.slice(0,5000).map((x:any)=>limpar(x,d.categoria));
   let gravadas=0;
   for(let i=0;i<rows.length;i+=500){
    const lote=await Promise.all(rows.slice(i,i+500).map(async(x:any)=>({connection_id:conn.id,institution_id:conn.institution_id,dataset:d.nome,categoria:d.categoria,
     row_hash:hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(x)))),payload:x})));
    const ir=await sb("/rest/v1/vertice_connection_records?on_conflict=connection_id,dataset,row_hash",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(lote)});
    if(!ir.ok)throw E("falha_ao_gravar",500);
    gravadas+=lote.length;
   }
   total+=gravadas;resumo.push({conjunto:d.nome,status:"ok",linhas:gravadas});
  }catch(e){resumo.push({conjunto:d.nome,status:"erro",erro:(e as Error).message});}
 }
 const erros=resumo.filter(r=>r.status==="erro").length;
 await sb("/rest/v1/vertice_data_connections?id=eq."+conn.id,{method:"PATCH",headers:{Prefer:"return=minimal"},
  body:JSON.stringify({ultimo_sync_em:new Date().toISOString(),ultimo_erro:erros?"sincronizacao_parcial":null,updated_at:new Date().toISOString()})});
 await registrar(conn.id,conn.institution_id,"sincronizar",erros?"erro":"ok",JSON.stringify(resumo).slice(0,300),por);
 return {total,conjuntos:resumo};
}
const precisaAprovacao=(c:{escopo:string;escopo_financeiro:string})=>c.escopo==="nominal"||c.escopo_financeiro==="completo";
const tokenAgente=()=>"vag_"+Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,"0")).join("");

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
  const raw=await req.text();if(raw.length>6000)throw E("request_too_large",413);
  const body=raw?JSON.parse(raw):{};
  if(!body||typeof body!=="object"||Array.isArray(body))throw E("invalid_request");
  const apikey=Deno.env.get("SUPABASE_ANON_KEY")??JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"{}").default;
  if(!apikey)throw E("backend_unavailable",503);
  const cronSecret=req.headers.get("x-cron-secret");
  if(cronSecret){
   const k=svc();
   const cr=await fetch(URLBASE()+"/rest/v1/rpc/vertice_espelho_cron_ok",{method:"POST",headers:{apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/json"},body:JSON.stringify({p_secret:cronSecret}),signal:AbortSignal.timeout(10000)});
   if(!cr.ok||(await cr.json())!==true)throw E("access_denied",403);
   const lr=await sb("/rest/v1/vertice_data_connections?tipo=eq.api&status=eq.ativa&select=id,institution_id,config,escopo,escopo_financeiro,aprovado_em");
   const out:unknown[]=[];
   for(const c of (await lr.json())??[]){try{out.push({id:c.id,...await sincronizar(c,null)});}catch(e){out.push({id:c.id,erro:(e as Error).message});}}
   return respond({origem:"agendado",conexoes:out});
  }
  const ur=await fetch(URLBASE()+"/auth/v1/user",{headers:{Authorization:bearer,apikey},signal:AbortSignal.timeout(10000)});
  const user=await ur.json().catch(()=>null);
  if(!ur.ok||!user?.id||user.is_anonymous)throw E("authentication_required",401);
  const action=String(body.action);
  let inst=body.institution_id;
  let conn:any=null;
  if(action!=="criar"){
   const id=body.id;if(typeof id!=="string"||!UUID.test(id))throw E("invalid_request");
   const r=await sb("/rest/v1/vertice_data_connections?id=eq."+id+"&select=id,institution_id,tipo,config,escopo,escopo_financeiro,status,aprovado_em,ultimo_teste_em,ultimo_erro");
   conn=(await r.json())?.[0];if(!conn)throw E("nao_encontrada",404);
   inst=conn.institution_id;
  }
  if(typeof inst!=="string"||!UUID.test(inst))throw E("invalid_request");
  const ar=await fetch(URLBASE()+"/rest/v1/rpc/vertice_connection_authorize",{method:"POST",
   headers:{apikey,Authorization:bearer,"Content-Type":"application/json"},body:JSON.stringify({p_institution:inst}),signal:AbortSignal.timeout(10000)});
  if(!ar.ok||(await ar.json())!==true)throw E("access_denied",403);

  if(action==="aprovar"){
   const mr=await fetch(URLBASE()+"/rest/v1/rpc/vertice_connection_master",{method:"POST",headers:{apikey,Authorization:bearer,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(10000)});
   if(!mr.ok||(await mr.json())!==true)throw E("somente_master",403);
   const status=(conn.tipo==="api"||conn.tipo==="sql")&&conn.ultimo_teste_em&&!conn.ultimo_erro?"ativa":"pendente";
   await sb("/rest/v1/vertice_data_connections?id=eq."+conn.id,{method:"PATCH",headers:{Prefer:"return=minimal"},
    body:JSON.stringify({aprovado_por:user.id,aprovado_em:new Date().toISOString(),status,updated_at:new Date().toISOString()})});
   await registrar(conn.id,inst,"aprovar","ok","Aprovada pelo master (escopo "+conn.escopo+", financeiro "+conn.escopo_financeiro+")",user.id);
   return respond({id:conn.id,status});
  }
  if(action==="criar"){
   const tipo=String(body.tipo);if(!TIPOS.has(tipo))throw E("tipo_invalido");
   if(body.aceite!==true)throw E("aceite_obrigatorio");
   const escopo=body.escopo==="nominal"?"nominal":"agregado";
   const fin=body.escopo_financeiro==="completo"?"completo":body.escopo_financeiro==="pessoal"?"pessoal":"nenhum";
   if(fin!=="nenhum"&&body.aceite_financeiro!==true)throw E("aceite_financeiro_obrigatorio");
   const aprov=precisaAprovacao({escopo,escopo_financeiro:fin});
   const fornecedor=str(body.fornecedor,2,60,"fornecedor_invalido"),rotulo=str(body.rotulo,2,80,"rotulo_invalido");
   const config=validarConfig(tipo,body.config);
   let secret:string|null=null,mostrar:string|null=null;
   if(tipo==="agente"){secret=tokenAgente();mostrar=secret;}
   else if(tipo==="api"||tipo==="sql"){secret=str(body.secret,4,2000,"credencial_obrigatoria");}
   const now=new Date().toISOString();
   const ins=await sb("/rest/v1/vertice_data_connections",{method:"POST",headers:{Prefer:"return=representation"},
    body:JSON.stringify({institution_id:inst,tipo,fornecedor,rotulo,config,escopo,escopo_financeiro:fin,aceite_financeiro_em:fin!=="nenhum"?now:null,status:"pendente",aceite_operador_em:now,aceite_por:user.id,created_by:user.id})});
   const row=(await ins.json())?.[0];if(!ins.ok||!row)throw E("falha_ao_criar",500);
   if(secret){
    const sr=await sb("/rest/v1/rpc/vertice_connection_store_secret",{method:"POST",body:JSON.stringify({p_conn:row.id,p_secret:secret})});
    if(!sr.ok){await sb("/rest/v1/vertice_data_connections?id=eq."+row.id,{method:"DELETE"});throw E("falha_ao_guardar_credencial",500);}
   }
   await registrar(row.id,inst,"criar","ok","Conexão criada ("+tipo+", escopo "+escopo+", financeiro "+fin+")",user.id);
   let resultado="";let status="pendente";let erro:string|null=null;
   try{resultado=await testar(tipo,config,secret);if(tipo==="api"||tipo==="sql")status="ativa";}
   catch(e){erro=(e as Error).message;status="erro";resultado=erro;}
   if(aprov&&status!=="erro")status="aguardando_aprovacao";
   await sb("/rest/v1/vertice_data_connections?id=eq."+row.id,{method:"PATCH",headers:{Prefer:"return=minimal"},
    body:JSON.stringify({status,ultimo_teste_em:new Date().toISOString(),ultimo_erro:erro,updated_at:new Date().toISOString()})});
   await registrar(row.id,inst,"testar",erro?"erro":"ok",resultado,user.id);
   return respond({id:row.id,status,teste:resultado,token_agente:mostrar});
  }

  if(action==="testar"){
   const secret=(conn.tipo==="api"||conn.tipo==="sql")?await (await sb("/rest/v1/rpc/vertice_connection_read_secret",{method:"POST",body:JSON.stringify({p_conn:conn.id})})).json():null;
   let resultado="",erro:string|null=null,status=conn.status;
   try{resultado=await testar(conn.tipo,conn.config,typeof secret==="string"?secret:null);if(conn.tipo==="api"||conn.tipo==="sql")status="ativa";}
   catch(e){erro=(e as Error).message;status="erro";resultado=erro;}
   if(precisaAprovacao(conn)&&!conn.aprovado_em&&status!=="erro")status="aguardando_aprovacao";
   if(conn.status==="pausada")status="pausada";
   await sb("/rest/v1/vertice_data_connections?id=eq."+conn.id,{method:"PATCH",headers:{Prefer:"return=minimal"},
    body:JSON.stringify({status,ultimo_teste_em:new Date().toISOString(),ultimo_erro:erro,updated_at:new Date().toISOString()})});
   await registrar(conn.id,inst,"testar",erro?"erro":"ok",resultado,user.id);
   return respond({id:conn.id,status,teste:resultado});
  }
  if(action==="sincronizar"){
   if(conn.tipo!=="api")throw E("sincronizacao_indisponivel_para_este_tipo");
   if(conn.status!=="ativa")throw E("conexao_nao_ativa");
   const r=await sincronizar(conn,user.id);
   return respond({id:conn.id,...r});
  }
  if(action==="pausar"||action==="retomar"){
   const status=action==="pausar"?"pausada":(precisaAprovacao(conn)&&!conn.aprovado_em?"aguardando_aprovacao":"pendente");
   await sb("/rest/v1/vertice_data_connections?id=eq."+conn.id,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status,updated_at:new Date().toISOString()})});
   await registrar(conn.id,inst,action,"ok","",user.id);
   return respond({id:conn.id,status});
  }
  if(action==="revogar"){
   await sb("/rest/v1/rpc/vertice_connection_drop_secret",{method:"POST",body:JSON.stringify({p_conn:conn.id})});
   await registrar(conn.id,inst,"revogar","ok","Credencial apagada do cofre",user.id);
   return respond({id:conn.id,status:"pausada"});
  }
  throw E("acao_invalida");
 }catch(e){
  const status=(e as {status?:number}).status??500;
  return respond({error:status===500?"internal_error":(e as Error).message},status);
 }
});
