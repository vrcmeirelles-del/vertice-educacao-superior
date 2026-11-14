declare const Deno: { env: { get: (key: string) => string | undefined }; serve: (fn: (req: Request) => Promise<Response>) => void };
const origins = new Set(['https://www.verticesuperior.com.br','https://verticesuperior.com.br','https://vertice-educacao-superior-jlri.onrender.com','https://vertice-portal.onrender.com','https://vertice-educacao-superior-site.onrender.com','https://vertice-educacao-superior.onrender.com']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SECTIONS = ['introducao','dados_ies','composicao_cpa','planejamento','metodologia','resultados','avaliacoes_externas','participacao','diagnostico','sensibilizacao','planos_melhoria','consideracoes'];
const TITLES: Record<string,string> = {introducao:'1. Introdução e Contextualização Regulatória',dados_ies:'2. Dados da Instituição',composicao_cpa:'3. Composição e Funcionamento da CPA',planejamento:'4. Planejamento Estratégico',metodologia:'5. Metodologia',resultados:'6. Resultados por Segmento e Eixo',avaliacoes_externas:'7. Avaliações Externas',participacao:'8. Participação',diagnostico:'9. Análise Integrada e Diagnóstico',sensibilizacao:'10. Sensibilização e Devolutivas',planos_melhoria:'11. Ações e Plano de Melhoria',consideracoes:'12. Considerações Finais'};
const PROMPTS: Record<string,string> = {introducao:'Introdução regulatória. Cite SINAES, Lei 10.861/2004, NT 65/2014.',dados_ies:'Dados da IES — mantida, mantenedora, histórico. Só dados fornecidos.',composicao_cpa:'CPA — membros, representações, mandato.',planejamento:'Planejamento — projeto, instrumentos, cronograma.',metodologia:'Metodologia — população, adesão, escalas, limitações.',resultados:'Resultados por segmento/eixo SINAES. Use médias reais. NÃO invente.',avaliacoes_externas:'Avaliações externas (ENADE/CPC/IGC). Se sem dados: "Não disponível".',participacao:'Participação — adesão, representatividade.',diagnostico:'Diagnóstico — PDI, potencialidades, fragilidades.',sensibilizacao:'Sensibilização e devolutivas à comunidade.',planos_melhoria:'Ações e plano de melhoria baseado nos achados.',consideracoes:'Considerações finais — síntese, limitações.'};

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
    const oai = Deno.env.get('OPENAI_API_KEY');
    if (!oai) return send({error:'ai_not_configured'},503);
    const auth = await fetch(url+'/auth/v1/user',{headers:{Authorization:authorization,apikey:ak},signal:AbortSignal.timeout(10000)});
    const user = await auth.json();
    if (!auth.ok || !user.id) return send({error:'auth_required'},401);
    const body = await req.json();
    const {institution_id, report_id, section: secParam} = body;
    if (!UUID.test(institution_id||'')) return send({error:'invalid'},400);
    const svc = {Authorization:`Bearer ${sk}`,apikey:sk,'Content-Type':'application/json'};
    const get = async (path: string) => (await fetch(`${url}/rest/v1/${path}`,{headers:svc,signal:AbortSignal.timeout(15000)})).json();
    const inst = (await get(`vertice_institutions?id=eq.${institution_id}&select=name,code_emec`))?.[0];
    if (!inst) return send({error:'not_found'},404);
    const members = await get(`vertice_cpa_members?institution_id=eq.${institution_id}&active=eq.true&select=full_name,role,segment`);
    const camps = await get(`vertice_cpa_campaigns?institution_id=eq.${institution_id}&status=in.(ativa,encerrada)&select=id,title,target_audience`);
    const results: any[] = [];
    for (const c of (camps||[])) {
      const r = await (await fetch(`${url}/rest/v1/rpc/vertice_cpa_campaign_results`,{method:'POST',headers:svc,body:JSON.stringify({p_campaign_id:c.id}),signal:AbortSignal.timeout(30000)})).json();
      if (r && !r.error) results.push(r);
    }
    const findings = await get(`vertice_cpa_findings?institution_id=eq.${institution_id}&select=finding_type,title,dimension,decision_status&order=created_at.desc&limit=20`);
    const actions = await get(`vertice_cpa_actions?institution_id=eq.${institution_id}&select=title,status,responsible&order=created_at.desc&limit=15`);
    const ctx = JSON.stringify({inst,members_list:(members||[]).map((m:any)=>`${m.full_name}(${m.role}/${m.segment})`),camps_count:(camps||[]).length,total_resp:results.reduce((s:number,r:any)=>s+(r.total_responses||0),0),results:results.map((r:any)=>({aud:r.target_audience,n:r.total_responses,avg:r.institutional_avg,top2:r.top2_pct,axes:r.by_axis,dims:r.by_dimension,best:(r.questions||[]).filter((q:any)=>q.avg_score).sort((a:any,b:any)=>b.avg_score-a.avg_score).slice(0,5).map((q:any)=>({c:q.stable_code,t:q.question_text,a:q.avg_score})),worst:(r.questions||[]).filter((q:any)=>q.avg_score).sort((a:any,b:any)=>a.avg_score-b.avg_score).slice(0,5).map((q:any)=>({c:q.stable_code,t:q.question_text,a:q.avg_score})),open:(r.questions||[]).filter((q:any)=>q.open_answers?.length).flatMap((q:any)=>q.open_answers.filter(Boolean).slice(0,5))})),findings:(findings||[]).map((f:any)=>({t:f.finding_type,title:f.title,dim:f.dimension})),actions:(actions||[]).map((a:any)=>({title:a.title,status:a.status}))});
    const secs = secParam ? [secParam] : SECTIONS;
    const gen: Record<string,{title:string;content:string;ai_notes:string}> = {};
    for (const sec of secs) {
      if (!PROMPTS[sec]) continue;
      const r = await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${oai}`},body:JSON.stringify({model:'gpt-4o',messages:[{role:'system',content:`Redator acadêmico SINAES. NÃO invente dados. Se ausente: "Não informado". Português formal.\nDADOS:\n${ctx}`},{role:'user',content:PROMPTS[sec]}],max_tokens:2000,temperature:0.3}),signal:AbortSignal.timeout(90000)});
      gen[sec] = {title:TITLES[sec]||sec,content:r.ok?(await r.json()).choices?.[0]?.message?.content||'[vazio]':'[erro]',ai_notes:'Gerado por IA — requer aprovação CPA'};
    }
    if (report_id && UUID.test(report_id)) {
      await fetch(`${url}/rest/v1/vertice_cpa_reports?id=eq.${report_id}`,{method:'PATCH',headers:svc,body:JSON.stringify({content_json:gen,status:'minuta_gerada',generated_at:new Date().toISOString(),generated_by:'ai',updated_at:new Date().toISOString()})});
      return send({ok:true,report_id,sections:Object.keys(gen)});
    }
    const saved = await (await fetch(`${url}/rest/v1/vertice_cpa_reports`,{method:'POST',headers:{...svc,Prefer:'return=representation'},body:JSON.stringify({institution_id,title:`Relatório CPA ${new Date().getFullYear()}`,report_type:body.report_type||'parcial',year_base:body.year_base||String(new Date().getFullYear()),content_json:gen,campaigns_included:(camps||[]).map((c:any)=>c.id),status:'minuta_gerada',generated_at:new Date().toISOString(),generated_by:'ai'})})).json();
    return send({ok:true,report_id:saved?.[0]?.id||saved?.id,sections:Object.keys(gen)});
  } catch (e) { return send({error:'internal',message:(e as Error).message},500); }
});
