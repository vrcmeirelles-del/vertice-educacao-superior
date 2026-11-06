// Text PDF preview only (no OCR, no changes to approved indicators).
const origins=new Set(["https://www.verticesuperior.com.br","https://verticesuperior.com.br","https://vertice-portal.onrender.com","https://vertice-educacao-superior.onrender.com","https://vertice-educacao-superior-site.onrender.com"]);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
Deno.serve(async req=>{
 const origin=req.headers.get("origin")??"";
 const headers:Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
 if(origins.has(origin))headers["Access-Control-Allow-Origin"]=origin;
 const send=(payload:unknown,status=200)=>Response.json(payload,{status,headers});
 if(origin&&!origins.has(origin))return send({error:"origin_denied"},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return send({error:"method_not_allowed"},405);
 try{
  const bearer=req.headers.get("authorization")??"";
  if(!/^Bearer [\w.-]{16,8190}$/.test(bearer))return send({error:"authentication_required"},401);
  const key=Deno.env.get("SUPABASE_ANON_KEY")??JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"{}").default;
  if(!key)return send({error:"backend_unavailable"},503);
  const url=Deno.env.get("SUPABASE_URL")??"";
  const auth=await fetch(url+"/auth/v1/user",{headers:{Authorization:bearer,apikey:key},signal:AbortSignal.timeout(10000)});
  const user=await auth.json().catch(()=>null);
  if(!auth.ok||!user?.id||user.is_anonymous)return send({error:"authentication_required"},401);
  if(Number(req.headers.get("content-length")??0)>1024)return send({error:"request_too_large"},413);
  const p=await req.json();
  if(!p||!UUID.test(p.upload_id??""))return send({error:"invalid_request"},400);
  const select=await fetch(url+"/rest/v1/vertice_source_uploads?id=eq."+p.upload_id+"&select=institution_id,storage_path,bytes,mime_type,upload_status&limit=1",{
   headers:{Authorization:bearer,apikey:key},signal:AbortSignal.timeout(10000)
  });
  if(!select.ok)return send({error:"access_denied"},403);
  const records=await select.json();
  if(!Array.isArray(records)||records.length!==1)return send({error:"upload_not_visible"},404);
  const file=records[0];
  if(file.upload_status!=="recebido"||file.mime_type!=="application/pdf"||file.bytes>3*1024*1024)return send({error:"unsupported_or_large_pdf"},413);
  const download=await fetch(url+"/storage/v1/object/authenticated/vertice-fontes-ies/"+file.storage_path.split("/").map(encodeURIComponent).join("/"),{
   headers:{Authorization:bearer,apikey:key},signal:AbortSignal.timeout(15000),redirect:"error"
  });
  if(!download.ok)return send({error:"source_file_unavailable"},403);
  const bytes=new Uint8Array(await download.arrayBuffer());
  if(bytes.byteLength!==file.bytes||bytes.byteLength>3*1024*1024)return send({error:"size_mismatch"},400);
  // Pdfjs parses embedded text; scanned/image-only PDFs require separately approved OCR.
  const pdfjs=await import("npm:pdfjs-dist@5.4.624/legacy/build/pdf.mjs");
  const task=pdfjs.getDocument({data:bytes,useSystemFonts:false,disableFontFace:true,isEvalSupported:false,stopAtErrors:true});
  const doc=await task.promise;
  const lines:string[]=[];
  const maxPages=Math.min(doc.numPages,15);
  for(let i=1;i<=maxPages;i++){
   const page=await doc.getPage(i);
   const content=await page.getTextContent();
   const text=(content.items as Array<{str?:string}>).map(x=>x.str??"").join(" ").trim();
   if(text)lines.push("PÁGINA "+i+"\n"+text.slice(0,5000));
   if(lines.join("\n").length>24000)break;
  }
  await doc.destroy();
  if(!lines.length)return send({error:"no_embedded_text",message:"PDF sem texto selecionável. É necessário OCR autorizado para digitalizações."},422);
  return send({text:lines.join("\n\n").slice(0,24000),pages:doc.numPages,extracted_pages:maxPages,
   notice:"Prévia textual, não tabular. Confira o original; sem OCR e sem publicação automática."});
 }catch(e){return send({error:"pdf_extraction_unavailable",detail:(e as Error)?.name??"Error"},503);}
});
