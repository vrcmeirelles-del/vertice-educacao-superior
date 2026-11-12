/** Retired unsafe alternative. Deploy together with v2 only after release approval.
 * No documents, service-role reads, AI calls, deletes, compliance scores or writes. */
declare const Deno:{serve:(handler:(request:Request)=>Promise<Response>)=>void};
Deno.serve(async()=>new Response(JSON.stringify({error:'legacy_analysis_retired',message:'Use o painel de pré-análise para revisar os trechos e as sugestões.'}),{status:410,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
