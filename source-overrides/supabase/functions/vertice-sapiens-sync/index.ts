import {createClient} from "npm:@supabase/supabase-js@2.45.4";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")||"";
 let key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 try{key=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||key;}catch{}
 if(!url||!key)return json({error:"unavailable"},503);
 const auth=req.headers.get("authorization")||"",secret=Deno.env.get("SAPIENS_CRON_SECRET")||"";
 // Fail closed when a cron secret is absent. The gateway also requires a valid JWT.
 if(auth!=="Bearer "+key&&!(secret.length>=32&&auth==="Bearer "+secret))return json({error:"unauthorized"},401);
 const db=createClient(url,key,{auth:{persistSession:false}});
 const {data:institutions,error}=await db.from("vertice_institutions").select("id,name,tier").eq("status","ativa");
 if(error)return json({error:"institution_query_failed"},503);
 const results=[];
 for(const inst of institutions||[]){
  if(!["superior","escolas"].includes(inst.tier)||/teste|fict[ií]ci|demonstra/i.test(inst.name))continue;
  try{
   const refreshed=await db.rpc("vertice_bridge_refresh_metrics",{p_institution:inst.id});
   if(refreshed.error)throw Error("metrics_refresh_failed");
   const metrics=await db.from("vertice_learning_course_metrics").select("course_id,semester,module,subject_code,competency,participants,graded,correct,attempts").eq("institution_id",inst.id);
   if(metrics.error)throw Error("metrics_read_failed");
   if(!metrics.data?.length){results.push({institutionId:inst.id,status:"no_learning_data",publishedGroups:0,ingestion:"not_run"});continue;}
   // Incremental source fingerprint excludes refresh timestamps.
   const input=JSON.stringify(metrics.data.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input)))).map(x=>x.toString(16).padStart(2,"0")).join("");
   const previous=await db.from("vertice_sapiens_audit_trail").select("id").eq("institution_id",inst.id).contains("details",{type:"metrics_analysis",source_hash:hash}).limit(1);
   if(previous.error)throw Error("audit_read_failed");
   if(previous.data?.length){results.push({institutionId:inst.id,status:"unchanged",ingestion:"not_run"});continue;}
   const response=await fetch(url+"/functions/v1/vertice-sapiens-analyze",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({institutionId:inst.id,trigger:"metrics_refresh"}),signal:AbortSignal.timeout(120000)});
   const outcome=await response.json();
   if(!response.ok||outcome.error)throw Error("analysis_failed");
   const audited=await db.from("vertice_sapiens_audit_trail").insert({institution_id:inst.id,entity_type:"diagnosis",entity_id:outcome.diagnosisIds?.[0]||"00000000-0000-0000-0000-000000000000",action:"created",actor_type:"system",details:{type:"metrics_analysis",source_hash:hash,diagnoses:outcome.diagnoses||0,ingestion:"not_run"}});
   if(audited.error)throw Error("audit_write_failed");
   results.push({institutionId:inst.id,status:"analyzed",diagnoses:outcome.diagnoses||0,ingestion:"not_run"});
  }catch(e){results.push({institutionId:inst.id,status:"failed",error:(e as Error).message,ingestion:"not_run"});}
 }
 return json({ok:!results.some(r=>r.status==="failed"),results,notice:"Recalcula indicadores locais. A ingestão externa mantém o fluxo autenticado da ponte de aprendizagem."});
});
