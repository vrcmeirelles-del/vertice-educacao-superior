import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {LISTS,parseLinks,parseSec,type Sighting} from './parser.ts';
const cors={'Access-Control-Allow-Origin':'https://www.verticesuperior.com.br','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const send=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers:cors});
 if(req.method!=='POST')return send({error:'method_not_allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')??'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
 const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  let authorized=false;
  const token=req.headers.get('x-market-token');
  if(token){const r=await service.rpc('vertice_market_collector_token',{p_token:token});authorized=!r.error&&r.data===true;}
  else{
   const jwt=req.headers.get('authorization')??'';
   const userClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')??'',{global:{headers:{Authorization:jwt}},auth:{persistSession:false,autoRefreshToken:false}});
   const user=await userClient.auth.getUser();
   if(!user.error&&user.data.user){const r=await userClient.rpc('vertice_market_can_collect');authorized=!r.error&&r.data===true;}
  }
  if(!authorized)return send({error:'access_denied'},403);
  const start=await service.rpc('vertice_market_collect',{p_action:'start'});
  if(start.error)throw start.error;if(start.data?.skipped)return send({skipped:true});
  const results:{source:string;status:string;items:number;detail?:string}[]=[],items:Sighting[]=[];
  // Fixed, public endpoints only. No user-provided URL, redirects or AI instructions.
  for(const source of LISTS){
   try{
    const response=await fetch(source.url,{redirect:'error',signal:AbortSignal.timeout(9000),headers:{'User-Agent':'VerticeMarketIntelligence/1.0 (public institutional monitoring)'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const content=await response.text();if(content.length>2500000)throw new Error('source_too_large');
    const found=parseLinks(content,source);items.push(...found);results.push({source:source.name,status:found.length?'ok':'no_candidates',items:found.length});
   }catch(e){results.push({source:source.name,status:'failed',items:0,detail:e instanceof Error?e.message.slice(0,180):'fetch_failed'});}
  }
  try{
   const response=await fetch('https://data.sec.gov/submissions/CIK0001771007.json',{redirect:'error',signal:AbortSignal.timeout(9000),headers:{'User-Agent':'Vertice Educacao Superior vertice@verticesuperior.com.br','Accept':'application/json'}});
   if(!response.ok)throw new Error(`HTTP ${response.status}`);
   const cutoff=new Date(Date.now()-8*86400000).toISOString().slice(0,10);const found=parseSec(await response.json(),cutoff);
   items.push(...found);results.push({source:'Afya / SEC',status:found.length?'ok':'no_candidates',items:found.length});
  }catch(e){results.push({source:'Afya / SEC',status:'failed',items:0,detail:e instanceof Error?e.message.slice(0,180):'fetch_failed'});}
  const failed=results.filter(r=>r.status==='failed').length,status=failed===results.length?'failed':failed?'partial':'ok';
  const done=await service.rpc('vertice_market_collect',{p_action:'finish',p_payload:{id:start.data.id,status,items,result:{sources:results,note:'Descoberta de publicações; não valida nem conclui negócios. Datas desconhecidas permanecem nulas.'}}});
  if(done.error)throw done.error;return send({status,items:items.length,sources:results});
 }catch(e){console.error('market_collection_failed',e instanceof Error?e.message:'unknown');return send({error:'collection_failed'},500);}
});
