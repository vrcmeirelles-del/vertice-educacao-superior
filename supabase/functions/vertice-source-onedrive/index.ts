// OneDrive import restricted to institution-specific migration folders previously configured.
type Json=Record<string,unknown>;
const ORIGINS=new Set(["https://www.verticesuperior.com.br","https://verticesuperior.com.br","https://vertice-portal.onrender.com","https://vertice-educacao-superior.onrender.com","https://vertice-educacao-superior-site.onrender.com"]);
const UNITOP="1f5fd5b4-93c6-4626-834d-136884915587",UNICALDAS="4224e2fc-6a96-4761-820f-6f8e809ca1c1";
const folders:Record<string,string>={[UNITOP]:"UNITOP",[UNICALDAS]:"UNICALDAS"};
const extMime:Record<string,string>={
 pdf:"application/pdf",csv:"text/csv",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 json:"application/json",txt:"text/plain",xml:"application/xml"
};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const enc=new TextEncoder();
const b64=(v:Uint8Array)=>btoa(String.fromCharCode(...v)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
const E=(code:string,status=400)=>Object.assign(new Error(code),{status});
const readBody=async(req:Request)=>{
 if(Number(req.headers.get("content-length")??0)>2048)throw E("request_too_large",413);
 const body=await req.json();
 if(!body||typeof body!=="object"||Array.isArray(body)||JSON.stringify(body).length>2048)throw E("invalid_request");
 return body;
};
async function graphToken(){
 const keyRaw=Deno.env.get("VERTICE_ONEDRIVE_PRIVATE_KEY_B64");
 if(!keyRaw)throw E("onedrive_credentials_unavailable",503);
 const app="d13efb83-3ddf-4e6e-9589-f0fb7584b201";
 const tenant="720c1cd3-7c2e-4496-8378-958c07a05218";
 const endpoint="https://login.microsoftonline.com/"+tenant+"/oauth2/v2.0/token";
 const der=Uint8Array.from(atob(atob(keyRaw).replace(/-----[^-]+-----|\s/g,"")),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey("pkcs8",der,{name:"RSA-PSS",hash:"SHA-256"},false,["sign"]);
 const now=Math.floor(Date.now()/1000);
 const header={alg:"PS256","x5t#S256":"AfcNWRTSnisqXg6d2WidZtZg0vTzJR2ukkUoJta2CCk"};
 const claims={aud:endpoint,iss:app,sub:app,jti:crypto.randomUUID(),nbf:now-5,exp:now+300};
 const unsigned=[header,claims].map(obj=>b64(enc.encode(JSON.stringify(obj)))).join(".");
 const signature=b64(new Uint8Array(await crypto.subtle.sign({name:"RSA-PSS",saltLength:32},key,enc.encode(unsigned))));
 const response=await fetch(endpoint,{method:"POST",body:new URLSearchParams({
  client_id:app,scope:"https://graph.microsoft.com/.default",grant_type:"client_credentials",
  client_assertion_type:"urn:ietf:params:oauth:client-assertion-type:jwt-bearer",client_assertion:unsigned+"."+signature
 }),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw E("onedrive_auth_failed",503);
 const result=await response.json();if(typeof result.access_token!=="string")throw E("onedrive_auth_failed",503);
 return result.access_token as string;
}
const driveId="b!GyLR53JNYkSt-KuvMN5YemviyAq9ZChCvFFxeRXLYNGIMY3xMuDhTK_J5zKaFMbV";
async function graph(path:string,token:string){
 const response=await fetch("https://graph.microsoft.com/v1.0/"+path,{
  headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(12000),redirect:"follow"
 });
 if(!response.ok)throw E("onedrive_folder_or_file_unavailable",response.status===403?403:502);
 return response.json();
}
async function folderInfo(institution:string,token:string){
 const path="Documentos Virgilio/Empresas/Vertice/CLIENTES/"+folders[institution]+"/Migração";
 const uri="drives/"+driveId+"/root:/"+path.split("/").map(encodeURIComponent).join("/")+"?%24select=id,name,folder,webUrl";
 const folder=await graph(uri,token);
 if(!folder.folder||typeof folder.id!=="string")throw E("onedrive_migration_folder_missing",404);
 return folder as {id:string;name:string;folder:unknown};
}
async function api(path:string,token:string,key:string,method="POST",body?:unknown){
 const response=await fetch(Deno.env.get("SUPABASE_URL")!+path,{
  method,headers:{apikey:key,Authorization:token,"Content-Type":"application/json",Prefer:"return=representation"},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw E("database_or_access_denied",response.status===401||response.status===403?403:502);
 return response.json();
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")??"";
 const headers:Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
 if(ORIGINS.has(origin))headers["Access-Control-Allow-Origin"]=origin;
 const respond=(data:unknown,status=200)=>Response.json(data,{status,headers});
 if(origin&&!ORIGINS.has(origin))return respond({error:"origin_denied"},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
 try{
  const bearer=req.headers.get("authorization")??"";
  if(!/^Bearer [\w.-]{16,8190}$/.test(bearer))throw E("authentication_required",401);
  const key=Deno.env.get("SUPABASE_ANON_KEY")??JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"{}").default;
  if(!key)throw E("backend_unavailable",503);
  const userResponse=await fetch(Deno.env.get("SUPABASE_URL")!+"/auth/v1/user",{headers:{Authorization:bearer,apikey:key},signal:AbortSignal.timeout(10000)});
  const user=await userResponse.json().catch(()=>null);
  if(!userResponse.ok||!user?.id||user.is_anonymous)throw E("authentication_required",401);
  const body=await readBody(req);
  const inst=body.institution_id,action=body.action;
  if(typeof inst!=="string"||!UUID.test(inst)||!folders[inst]||!["list","import"].includes(action))throw E("invalid_request");
  const allowed=await api("/rest/v1/rpc/vertice_source_drive_authorize",bearer,key,"POST",{p_institution:inst});
  if(allowed!==true)throw E("access_denied",403);
  const token=await graphToken(),folder=await folderInfo(inst,token);
  const root="drives/"+driveId+"/items/";
  if(action==="list"){
   const list=await graph(root+encodeURIComponent(folder.id)+"/children?%24select=id,name,size,file,folder,parentReference,webUrl,lastModifiedDateTime&%24top=100",token);
   const files=(list.value??[]).filter((item:any)=>{
    const extension=String(item.name??"").split(".").pop()?.toLowerCase();
    return item.file&&item.parentReference?.id===folder.id&&extMime[extension??""]&&item.size>0&&item.size<=26214400;
   }).map((item:any)=>({id:item.id,name:item.name,size:item.size,modified:item.lastModifiedDateTime}));
   return respond({folder:"Migração / "+folders[inst],files,limit:100,notice:"Somente arquivos do diretório da IES; leitura sujeita à autorização Microsoft."});
  }
  const itemId=body.item_id,period=body.reference_period;
  const sourceKind=body.source_kind??"outro";
  if(typeof itemId!=="string"||!/^[A-Za-z0-9!_-]{8,180}$/.test(itemId)
     ||typeof period!=="string"||period.length>35||!["eorbit","emec","censo","enade","secretaria","site_institucional","outro"].includes(sourceKind))throw E("invalid_request");
  const metadata=await graph(root+encodeURIComponent(itemId)+"?%24select=id,name,size,file,parentReference,webUrl",token);
  const ext=String(metadata.name??"").split(".").pop()?.toLowerCase()??"";
  if(metadata.parentReference?.id!==folder.id||!metadata.file||!extMime[ext]||metadata.size<=0||metadata.size>26214400)throw E("file_not_authorized",403);
  const download=await fetch("https://graph.microsoft.com/v1.0/"+root+encodeURIComponent(itemId)+"/content",{
   headers:{Authorization:"Bearer "+token},redirect:"follow",signal:AbortSignal.timeout(25000)
  });
  if(!download.ok)throw E("file_download_failed",502);
  const bytes=new Uint8Array(await download.arrayBuffer());
  if(bytes.byteLength!==metadata.size||bytes.byteLength>26214400)throw E("file_size_mismatch",400);
  const id=crypto.randomUUID(),name=String(metadata.name).replace(/[\\/\u0000-\u001f]/g,"_").slice(0,250);
  const storagePath=inst+"/"+id+"/"+name;
  const driveUrl=String(metadata.webUrl??"");
  const validUrl=driveUrl.startsWith("https://")&&new URL(driveUrl).hostname.endsWith(".sharepoint.com");
  const info={id,institution_id:inst,source_kind:sourceKind,source_name:"OneDrive · Migração "+folders[inst],
    reference_period:period||null,original_name:name,mime_type:extMime[ext],bytes:bytes.byteLength,storage_path:storagePath,
    drive_url:validUrl?driveUrl:null,description:"Importação autenticada do diretório Microsoft cadastrado para esta IES."};
  await api("/rest/v1/vertice_source_uploads",bearer,key,"POST",info);
  const put=await fetch(Deno.env.get("SUPABASE_URL")!+"/storage/v1/object/vertice-fontes-ies/"+storagePath.split("/").map(encodeURIComponent).join("/"),{
   method:"POST",headers:{apikey:key,Authorization:bearer,"Content-Type":extMime[ext],"x-upsert":"false"},
   body:bytes,signal:AbortSignal.timeout(25000)
  });
  if(!put.ok)throw E("storage_upload_failed",502);
  await api("/rest/v1/vertice_source_uploads?id=eq."+id,bearer,key,"PATCH",{upload_status:"recebido"});
  return respond({imported:true,id,name,bytes:bytes.byteLength,notice:"Arquivo armazenado em staging; análise e validação humana obrigatórias."});
 }catch(e){const er=e as Error&{status?:number};return respond({error:er.message??"temporarily_unavailable"},er.status??503)}
});
