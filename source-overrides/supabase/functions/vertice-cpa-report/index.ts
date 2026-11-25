// Política de IA (20/11/2026): o algoritmo é o padrão em todo o portal. A IA só é chamada para as funções
// listadas em AI_FEATURES (padrão desde 25/11/2026: só transcrição de manuscrito e geração de questão
// nova; a segunda opinião na correção e a redação da CPA passaram ao algoritmo) e com a chave geral AI_SUSPENDED=false (suspensa desde 19/11/2026).
const AI_FEATURES_DEFAULT="discursiva.transcribe,discursiva.generate";
const aiPolicy=(get:(k:string)=>string|undefined)=>(feature:string)=>String(get("AI_SUSPENDED")??"true").toLowerCase()==="false"&&String(get("AI_FEATURES")??AI_FEATURES_DEFAULT).split(",").map(x=>x.trim()).includes(feature);
const aiAllowed=aiPolicy(k=>Deno.env.get(k));
// Relatório da CPA só por algoritmo desde 25/11/2026: nenhuma função de IA liberada aqui.
const __AI_FN_FEATURES:string[]=[];
{const __aiFetch=globalThis.fetch;const __aiHosts=/(^|\.)(api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com)$/i;
globalThis.fetch=((input:any,init?:any)=>{let host="";try{host=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url).hostname;}catch{}
if(__aiHosts.test(host)&&!__AI_FN_FEATURES.some(aiAllowed))
 return Promise.resolve(new Response(JSON.stringify({error:{type:"ai_suspended",message:"IA suspensa temporariamente."}}),{status:503,headers:{"content-type":"application/json"}}));
return __aiFetch(input,init);}) as typeof fetch;}
declare const Deno: { env: { get: (key: string) => string | undefined }; serve: (fn: (req: Request) => Promise<Response>) => void };
const origins = new Set(['https://www.verticesuperior.com.br','https://verticesuperior.com.br','https://vertice-educacao-superior-jlri.onrender.com','https://vertice-portal.onrender.com','https://vertice-educacao-superior-site.onrender.com','https://vertice-educacao-superior.onrender.com']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
import { buildCpaSections, TITLES } from "./report.ts";
// Todas as 12 seções saem dos dados por algoritmo (report.ts, regras cpa-analise-v1 nas analíticas 9, 10 e 12).
// Nada é inventado: dado ausente aparece como "Não informado" ou como lacuna declarada para a CPA.

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const h: Record<string,string> = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if (origins.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  const send = (b: unknown, s = 200) => Response.json(b, {status: s, headers: h});
  if (origin && !origins.has(origin)) return send({error:'origin_denied'},403);
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:h});
  if (req.method !== 'POST') return send({error:'method_not_allowed'},405);
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return send({error:'auth_required'},401);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const sk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ak = Deno.env.get('SUPABASE_ANON_KEY') || JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default;
    const auth = await fetch(url+'/auth/v1/user',{headers:{Authorization:authorization,apikey:ak},signal:AbortSignal.timeout(10000)});
    const user = await auth.json();
    if (!auth.ok || !user.id) return send({error:'auth_required'},401);
    const body = await req.json();
    const {institution_id, report_id, section: secParam} = body;
    if (!UUID.test(institution_id||'')) return send({error:'invalid'},400);
    const svc = {Authorization:`Bearer ${sk}`,apikey:sk,'Content-Type':'application/json'};
    const get = async (path: string) => (await fetch(`${url}/rest/v1/${path}`,{headers:svc,signal:AbortSignal.timeout(15000)})).json();
    // Só administrador geral ou membro da própria instituição gera ou altera o relatório da CPA.
    const isAdmin = await get(`vertice_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`);
    const membership = await get(`vertice_memberships?user_id=eq.${encodeURIComponent(user.id)}&institution_id=eq.${institution_id}&select=role`);
    if (!(Array.isArray(isAdmin) && isAdmin.length) && !(Array.isArray(membership) && membership.length)) return send({error:'forbidden'},403);
    const inst = (await get(`vertice_institutions?id=eq.${institution_id}&select=name,acronym,cnpj,maintainer,city,state,emec_code,admin_dependency`))?.[0];
    if (!inst) return send({error:'not_found'},404);
    const members = await get(`vertice_cpa_members?institution_id=eq.${institution_id}&active=eq.true&select=full_name,role,segment,appointment_ref,start_date,end_date&order=segment`);
    const camps = await get(`vertice_cpa_campaigns?institution_id=eq.${institution_id}&status=in.(ativa,encerrada)&select=id,title,target_audience,opens_at,closes_at,status,channels&order=opens_at`);
    const results: any[] = [];
    for (const c of (camps||[])) {
      const r = await (await fetch(`${url}/rest/v1/rpc/vertice_cpa_campaign_results`,{method:'POST',headers:svc,body:JSON.stringify({p_campaign_id:c.id}),signal:AbortSignal.timeout(30000)})).json();
      if (r && !r.error) results.push(r);
    }
    const findings = await get(`vertice_cpa_findings?institution_id=eq.${institution_id}&select=finding_type,title,dimension,decision_status,indicator_name,indicator_value&decision_status=neq.arquivado&order=created_at.desc&limit=40`);
    const actions = await get(`vertice_cpa_actions?institution_id=eq.${institution_id}&select=title,status,responsible,due_date&status=neq.cancelada&order=due_date.asc.nullslast&limit=40`);
    if (secParam && !TITLES[secParam]) return send({error:'invalid_section'},400);
    const reportType = body.report_type === 'integral' ? 'integral' : 'parcial';
    const yearBase = String(body.year_base || new Date().getFullYear());
    const list = (v: unknown) => Array.isArray(v) ? v : [];
    const gen = buildCpaSections({inst, reportType, yearBase, members:list(members), campaigns:list(camps), results, findings:list(findings), actions:list(actions)}, secParam ? [secParam] : undefined);
    const generatedBy = 'algoritmo';
    if (report_id && UUID.test(report_id)) {
      // Regerar uma seção não apaga as demais: mescla com o conteúdo já salvo.
      const current = await get(`vertice_cpa_reports?id=eq.${report_id}&institution_id=eq.${institution_id}&select=content_json`);
      if (!Array.isArray(current) || !current[0]) return send({error:'not_found'},404);
      const merged = {...(current[0].content_json||{}), ...gen};
      await fetch(`${url}/rest/v1/vertice_cpa_reports?id=eq.${report_id}&institution_id=eq.${institution_id}`,{method:'PATCH',headers:svc,body:JSON.stringify({content_json:merged,status:'minuta_gerada',generated_at:new Date().toISOString(),generated_by:generatedBy,updated_at:new Date().toISOString()})});
      return send({ok:true,report_id,sections:Object.keys(gen)});
    }
    const saved = await (await fetch(`${url}/rest/v1/vertice_cpa_reports`,{method:'POST',headers:{...svc,Prefer:'return=representation'},body:JSON.stringify({institution_id,title:`Relatório CPA ${yearBase}`,report_type:reportType,year_base:yearBase,content_json:gen,campaigns_included:(camps||[]).map((c:any)=>c.id),status:'minuta_gerada',generated_at:new Date().toISOString(),generated_by:generatedBy})})).json();
    return send({ok:true,report_id:saved?.[0]?.id||saved?.id,sections:Object.keys(gen)});
  } catch (e) { return send({error:'internal',message:(e as Error).message},500); }
});
