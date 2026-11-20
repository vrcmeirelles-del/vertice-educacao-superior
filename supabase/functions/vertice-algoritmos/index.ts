// Vértice · rotina diária dos algoritmos (21/11/2026). Sem IA.
// Chamada pelo cron (vertice-algoritmos-diario) com o segredo de cron já usado pelas rotinas existentes.
// Para cada instituição: lê os dados com service_role, roda os algoritmos (mesmo código das telas) e
// sincroniza os alertas por vertice_algorithm_alerts_sync. Falha numa instituição não derruba as demais.
import {evasionAlerts,bottleneckAlerts,paceAlerts,titulationAlerts,RULES_VERSION,type AlgorithmResult} from './alerts.ts';
// Recorte do indicador 4.1 do instrumento oficial; o teste algorithms-runtime garante que é idêntico à fonte.
import indicador41 from './indicador-4-1.json' with {type:'json'};

const env=(k:string)=>Deno.env.get(k)??'';
const BASE=()=>env('SUPABASE_URL');
const KEY=()=>{try{const k=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}');if(k.default)return k.default;}catch{/* */}return env('SUPABASE_SERVICE_ROLE_KEY');};
const H=()=>({apikey:KEY(),Authorization:'Bearer '+KEY(),'Content-Type':'application/json'});
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});

async function rpc(name:string,body:unknown){
 const r=await fetch(`${BASE()}/rest/v1/rpc/${name}`,{method:'POST',headers:H(),body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error(`${name}_${r.status}`);return r.json();
}
async function all<T>(table:string,select:string,filter:string):Promise<T[]>{
 const out:T[]=[];
 for(let from=0;;from+=1000){
  const r=await fetch(`${BASE()}/rest/v1/${table}?select=${select}&${filter}&order=id`,{headers:{...H(),Range:`${from}-${from+999}`,'Range-Unit':'items'},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`${table}_${r.status}`);
  const page=await r.json() as T[];out.push(...page);if(page.length<1000)break;
 }
 return out;
}

async function runInstitution(inst:string){
 const f=`institution_id=eq.${inst}`;
 const [stats,offers,reqs,files,faculty,courses]=await Promise.all([
  all<any>('vertice_course_semester_stats','codigo,curso,modalidade,semestre,total_registros,abandono,cancelado,transferido,troca_curso,trancado',f),
  all<any>('vertice_offering_outcomes','course_code,discipline,semester,teachers,passed_direct,passed_final,source_failures,rf,rn,ra,other_status',f),
  all<any>('vertice_repository_requests','id,course_id,due_date,active,not_applicable',f),
  all<any>('vertice_repository_files','request_id,created_at,status',f),
  all<any>('vertice_professor_titulacao','titulacao,regime,ch_semanal,cursos_vinculados',f),
  all<any>('vertice_courses','id,name,code',f),
 ]);
 const byCode=(c:string)=>courses.find((x:any)=>x.code===c)?.name??`Curso ${c}`;
 const byId=(id:string|null)=>courses.find((x:any)=>x.id===id)?.name??'Sem curso';
  const results:AlgorithmResult[]=[];
 if(stats.length)results.push(evasionAlerts(stats));
 if(offers.length)results.push(bottleneckAlerts(offers,byCode));
 if(reqs.length)results.push(paceAlerts(reqs,files,byId));
 if(faculty.length)results.push(titulationAlerts(faculty,(indicador41 as any).criteria));
 const out:Record<string,unknown>={};
 for(const r of results){
  out[r.algorithm]=await rpc('vertice_algorithm_alerts_sync',{p_institution:inst,p_algorithm:r.algorithm,p_rules_version:RULES_VERSION,p_published:r.published,p_alerts:r.alerts,p_validation:r.validation,p_summary:r.summary});
 }
 return out;
}

Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const secret=req.headers.get('x-cron-secret');
 if(!secret)return json({error:'cron_only'},401);
 try{
  const ok=await rpc('vertice_espelho_cron_ok',{p_secret:secret});
  if(ok!==true)return json({error:'invalid_cron_secret'},403);
  const insts=await all<any>('vertice_institutions','id','id=not.is.null');
  const result:Record<string,unknown>={};
  for(const i of insts){
   try{result[i.id]=await runInstitution(i.id);}catch(e){result[i.id]={erro:(e as Error).message};}
  }
  return json({rules_version:RULES_VERSION,instituicoes:insts.length,result});
 }catch(e){console.error('vertice-algoritmos',(e as Error).message);return json({error:'algorithms_unavailable'},503);}
});
