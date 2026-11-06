/** UNI_GIZ structure-only evidence confirmation (never restores BAK or publishes BI). */
const ALLOWED=new Set([
 "https://www.verticesuperior.com.br","https://verticesuperior.com.br",
 "https://vertice-portal.onrender.com","https://vertice-educacao-superior.onrender.com",
 "https://vertice-educacao-superior-site.onrender.com"
]);
const UNICALDAS="4224e2fc-6a96-4761-820f-6f8e809ca1c1";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SOURCE_SQL_SHA="1e4da89de373d8e642e7130a97bdb9b524e0d71734fd4e02864e9e6bb39b9318";
const CATALOG_SHA="af1c81ab7dcdce0f8a164e6778386715c9065673cbd99755529d156491622b1f";
type Obj=Record<string,unknown>;
const fail=(message:string,status=400)=>Object.assign(new Error(message),{status});
const safeJson=async(res:Response)=>res.json().catch(()=>null);
const sha=async(buf:ArrayBuffer)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",buf))]
 .map(x=>x.toString(16).padStart(2,"0")).join("");
Deno.serve(async req=>{
 const origin=req.headers.get("origin")??"";
 const headers:Record<string,string>={
  "Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods":"POST,OPTIONS"
 };
 if(ALLOWED.has(origin))headers["Access-Control-Allow-Origin"]=origin;
 const respond=(data:unknown,status=200)=>Response.json(data,{status,headers});
 if(origin&&!ALLOWED.has(origin))return respond({error:"origin_denied"},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
 try{
  const bearer=req.headers.get("authorization")??"";
  if(!/^Bearer [\w.-]{16,8190}$/.test(bearer))throw fail("authentication_required",401);
  if(Number(req.headers.get("content-length")??0)>2048)throw fail("request_too_large",413);
  const body=(await req.json()) as unknown;
  if(!body||typeof body!=="object"||Array.isArray(body)||JSON.stringify(body).length>2048)
   throw fail("invalid_request");
  const args=body as Obj,reportId=args.report_id,institutionId=args.institution_id;
  if(typeof reportId!=="string"||!UUID.test(reportId)||institutionId!==UNICALDAS)
   throw fail("invalid_request");
  const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anon=Deno.env.get("SUPABASE_ANON_KEY")??JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"{}").default;
  if(!url||!service||!anon)throw fail("backend_unavailable",503);
  const authResponse=await fetch(url+"/auth/v1/user",{headers:{apikey:anon,Authorization:bearer},signal:AbortSignal.timeout(10000)});
  const user=await safeJson(authResponse);
  if(!authResponse.ok||!user?.id||user.is_anonymous)throw fail("authentication_required",401);
  const access=await fetch(url+"/rest/v1/rpc/vertice_source_drive_authorize",{
   method:"POST",headers:{apikey:anon,Authorization:bearer,"Content-Type":"application/json"},
   body:JSON.stringify({p_institution:institutionId}),signal:AbortSignal.timeout(10000)
  });
  if(!access.ok||await safeJson(access)!==true)throw fail("institution_access_denied",403);
  const adminHeaders={apikey:service,Authorization:"Bearer "+service};
  const reports=await fetch(url+"/rest/v1/vertice_backup_structure_checks?id=eq."+reportId+
   "&institution_id=eq."+institutionId+"&select=*",{headers:adminHeaders,signal:AbortSignal.timeout(12000)});
  if(!reports.ok)throw fail("report_unavailable",502);
  const list=await safeJson(reports);
  if(!Array.isArray(list)||list.length!==1)throw fail("report_not_found",404);
  const report=list[0];
  if(report.created_by!==user.id)throw fail("report_owner_required",403);
  if(report.stage==="evidencias_recebidas")return respond({confirmed:true,already_confirmed:true,review_state:"pendente_analise_tecnica"});
  if(report.stage!=="aguardando_arquivos"||report.origin_database!=="UNI_GIZ_HOMOLOGACAO"||report.origin_readonly!==true)
   throw fail("report_not_confirmable",409);
  if(report.catalog_sha256!==CATALOG_SHA||report.query_sha256!==SOURCE_SQL_SHA||
    Number(report.expected_tables)!==642||Number(report.found_tables)+Number(report.missing_tables)!==642)
    throw fail("report_metadata_mismatch",409);
  const backups=await fetch(url+"/rest/v1/vertice_academic_backups?id=eq."+report.backup_id+
    "&institution_id=eq."+institutionId+"&stage=eq.recebido&select=id",{
    headers:adminHeaders,signal:AbortSignal.timeout(12000)
  });
  if(!backups.ok||(await safeJson(backups))?.length!==1)throw fail("source_backup_not_confirmed",409);
  const prefix=institutionId+"/"+reportId+"/";
  async function getObject(name:string,max:number,expectedSize:number,expectedHash:string){
   const objectUrl=url+"/storage/v1/object/authenticated/vertice-validacoes-ies/"+
      (prefix+name).split("/").map(encodeURIComponent).join("/");
   const response=await fetch(objectUrl,{headers:adminHeaders,signal:AbortSignal.timeout(18000)});
   if(!response.ok)throw fail("evidence_file_missing",409);
   const length=Number(response.headers.get("content-length")??0);
   if(length>max)throw fail("evidence_exceeds_limit",413);
   const buffer=await response.arrayBuffer();
   if(buffer.byteLength!==expectedSize||buffer.byteLength>max)throw fail("evidence_size_mismatch",409);
   if(await sha(buffer)!==expectedHash)throw fail("evidence_sha_mismatch",409);
   return buffer;
  }
  const manifestBuffer=await getObject("00_manifesto_conciliacao.json",131072,
    Number(report.manifest_bytes),String(report.manifest_sha256));
  const tableBuffer=await getObject("02_642_tabelas.csv",4194304,
    Number(report.tables_csv_bytes),String(report.tables_csv_sha256));
  const manifest=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(manifestBuffer)) as Obj;
  if(manifest.instituicao!=="FACULDADE DE CALDAS NOVAS"||manifest.banco!=="UNI_GIZ_HOMOLOGACAO"||
     manifest.estado!=="READ_ONLY"||manifest.arquivo_sql_sha256!==SOURCE_SQL_SHA||
     manifest.tabelas_esperadas!==642||manifest.tabelas_localizadas!==report.found_tables||
     manifest.tabelas_ausentes!==report.missing_tables||
     manifest.tabelas_adicionais!==report.extra_tables)throw fail("manifest_content_mismatch",409);
  const descriptor=Array.isArray(manifest.arquivos)?
    manifest.arquivos.find(x=>x&&typeof x==="object"&&x.arquivo==="02_642_tabelas.csv"):null;
  if(!descriptor||descriptor.sha256!==report.tables_csv_sha256)throw fail("manifest_table_checksum_mismatch",409);
  const tableText=new TextDecoder("utf-8",{fatal:true}).decode(tableBuffer).replace(/^\uFEFF/,"");
  const tableLines=tableText.split(/\r?\n/).filter(x=>x.trim().length);
  if(tableLines.length!==643||!tableLines[0].toLowerCase().includes("situacao")||
    !tableLines[0].toLowerCase().includes("tabela"))throw fail("unexpected_structure_rows",409);
  // Content is technical evidence only; no row-level academic or personal fields are exposed.
  const update=await fetch(url+"/rest/v1/vertice_backup_structure_checks?id=eq."+reportId+
    "&institution_id=eq."+institutionId,{
    method:"PATCH",headers:{...adminHeaders,"Content-Type":"application/json",Prefer:"return=representation"},
    body:JSON.stringify({stage:"evidencias_recebidas"}),signal:AbortSignal.timeout(12000)
  });
  const updated=await safeJson(update);
  if(!update.ok||!Array.isArray(updated)||updated.length!==1)
   throw fail("server_confirmation_failed",502);
  return respond({confirmed:true,review_state:"pendente_analise_tecnica",
    found:Number(report.found_tables),missing:Number(report.missing_tables),
    message:"Evidências técnicas recebidas e verificadas por hash. Auditoria e BI ainda pendentes."});
 }catch(e){
  const er=e as Error&{status?:number};
  const safeCodes=new Set(["origin_denied","method_not_allowed","authentication_required","request_too_large",
   "invalid_request","backend_unavailable","institution_access_denied","report_unavailable",
   "report_not_found","report_owner_required","report_not_confirmable","report_metadata_mismatch",
   "source_backup_not_confirmed","evidence_file_missing","evidence_exceeds_limit","evidence_size_mismatch",
   "evidence_sha_mismatch","manifest_content_mismatch","manifest_table_checksum_mismatch",
   "unexpected_structure_rows","server_confirmation_failed"]);
  return respond({error:safeCodes.has(er.message)?er.message:"validation_error"},er.status??503);
 }
});
