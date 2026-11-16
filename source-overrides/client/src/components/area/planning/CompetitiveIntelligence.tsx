import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Competitor = {name:string;official_hosts:string[]};
type Config = {campus:string;relevance_criteria:string;minimum_relevance:'low'|'medium'|'high';competitors:Competitor[]};
type Objective = {theme:string;indicator?:string};
type Plan = {id:string;version:number;status:string;updated_at:string;objectives:Objective[]};
type Report = {external_key:string;competitor:string;title:string;current_condition:string;previous_condition?:string;event_type:'baseline'|'change';kind:'fact'|'inference';verification:'confirmed'|'unverified';relevance:'low'|'medium'|'high';source_url:string;consulted_on:string;published_on?:string;document_on?:string;valid_from?:string;valid_until?:string;limitations?:string;impact?:string;suggested_action?:string};
type Finding = {id:string;report:Report;plan_id:string;objective_index:number;objective_snapshot:Objective;status:'pending'|'approved'|'rejected';action_id?:string};
type Context = {profile:{config:Config;updated_at:string}|null;plans:Plan[];goals:{id:string;title:string;indicator?:string}[];findings:Finding[];history:{id:number;event:string;finding_id?:string;actor_id?:string;created_at:string;details:unknown}[]};
const EMPTY:Config={campus:'',relevance_criteria:'Bolsas de transferência, condições de matrícula, vagas, turnos, turmas e modalidade local do curso.',minimum_relevance:'medium',competitors:[{name:'',official_hosts:[]}]};
const levels={low:'Baixa',medium:'Média',high:'Alta'};
const statuses={pending:'Proposta pendente de revisão',approved:'Ação criada por decisão do gestor',rejected:'Não acolhida pelo gestor'};
const events:Record<string,string>={configured:'Configuração salva',imported:'Achado importado',approve:'Sugestão acolhida',reject:'Sugestão não acolhida'};
const date=(value?:string)=>value?new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR'):'Não informada';

export async function competitiveRequest(institutionId:string,courseId:string,operation:string,payload:object={}) {
  const {data,error}=await supabase.rpc('vertice_competitive_intelligence',{p_institution_id:institutionId,p_course_id:courseId,p_operation:operation,p_payload:payload});
  if(error)throw new Error(error.message);
  return data;
}

export default function CompetitiveIntelligence({institutionId,courseId,planId,dirty,canWrite}:{institutionId:string;courseId:string;planId:string;dirty:boolean;canWrite:boolean}) {
  const [context,setContext]=useState<Context|null>(null),[config,setConfig]=useState<Config>(EMPTY);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [selected,setSelected]=useState(''),[objective,setObjective]=useState(''),[goal,setGoal]=useState('');
  const [what,setWhat]=useState(''),[who,setWho]=useState(''),[due,setDue]=useState(''),[how,setHow]=useState(''),[cost,setCost]=useState(''),[note,setNote]=useState('');
  const plan=context?.plans.find(p=>p.id===planId);
  const finding=context?.findings.find(f=>f.id===selected);
  async function load(){const result=await competitiveRequest(institutionId,courseId,'context') as Context;setContext(result);setConfig(result.profile?.config??EMPTY);}
  useEffect(()=>{let active=true;setContext(null);setSelected('');competitiveRequest(institutionId,courseId,'context').then((result:Context)=>{if(active){setContext(result);setConfig(result.profile?.config??EMPTY);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[institutionId,courseId,planId,dirty]);
  async function run(operation:string,payload:object){setBusy(true);setError('');setNotice('');try{const result=await competitiveRequest(institutionId,courseId,operation,payload);await load();setNotice(operation==='import'?`Importação concluída: ${result.inserted} achado(s), ${result.skipped} já existente(s). Sugestões aguardam revisão.`:operation==='approve'?'Ação 5W2H criada como não iniciada. O plano continua com sua situação original.':operation==='reject'?'Decisão registrada no histórico.':'Configuração salva.');if(operation==='approve'||operation==='reject')setSelected('');}catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir.');}finally{setBusy(false);}}
  function choose(f:Finding){setSelected(f.id);setObjective(f.plan_id===planId?String(f.objective_index):'');setGoal('');setWhat(f.report.suggested_action??'');setWho('');setDue('');setHow('');setCost('');setNote('');setNotice('');}
  function template(){if(!plan)return;const body={campus:config.campus,plan_id:plan.id,expected_updated_at:plan.updated_at,origin:'Informe a identificação do relatório e sua versão',findings:[{external_key:'identificador-estavel-unico',competitor:config.competitors[0]?.name,title:'Título do achado',event_type:'baseline',kind:'fact',verification:'unverified',relevance:'medium',source_url:`https://${config.competitors[0]?.official_hosts[0]??'dominio-oficial'}/`,consulted_on:new Date().toISOString().slice(0,10),published_on:null,document_on:null,valid_from:null,valid_until:null,previous_condition:'Anterior não localizada',current_condition:'Descreva apenas o que a fonte documenta',objective_index:0,limitations:'Registre o que não foi confirmado',impact:'Hipótese de impacto, sujeita à revisão',suggested_action:'Proposta para decisão do gestor'}]};const url=URL.createObjectURL(new Blob([JSON.stringify(body,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='achados-concorrencia-modelo.json';a.click();URL.revokeObjectURL(url);}
  async function importFile(file?:File){if(!file)return;if(file.size>1000000){setError('O relatório deve ter até 1 MB.');return;}try{const payload=JSON.parse(await file.text());if(payload.plan_id!==planId)throw new Error('O arquivo deve indicar a versão do plano aberta nesta tela.');await run('import',payload);}catch(e){setError(e instanceof Error?e.message:'Arquivo JSON inválido.');}}
  if(!context)return <p role={error?'alert':'status'}>{error||'Carregando inteligência competitiva…'}</p>;
  const rank={low:1,medium:2,high:3};
  const visible=context.findings.filter(f=>rank[f.report.relevance]>=rank[context.profile?.config.minimum_relevance??'low']);
  return <section className="competitive-intelligence" aria-label="Inteligência competitiva do curso">
    <h3>Inteligência competitiva</h3>
    <p>Achados de fontes oficiais, vinculados à versão salva do planejamento. Linha de base não comprova mudança histórica. Acolher uma sugestão cria uma ação não iniciada; resultados exigem evidências de execução.</p>
    {error&&<p className="planning-error" role="alert">{error}</p>}{notice&&<p className="planning-success" role="status">{notice}</p>}
    {dirty&&<p role="status">Salve as alterações do planejamento antes de importar ou decidir sobre ações.</p>}
    <details><summary>Personalizar campus, concorrentes e fontes oficiais</summary>
      <fieldset disabled={!canWrite||busy}><legend>Configuração deste curso e desta IES</legend>
        <label className="planning-field"><span>Campus / localidade</span><input value={config.campus} maxLength={250} onChange={e=>setConfig({...config,campus:e.target.value})}/><small>Use o campus efetivamente anunciado nas ofertas monitoradas.</small></label>
        <label className="planning-field"><span>Critérios de relevância</span><textarea value={config.relevance_criteria} maxLength={4000} onChange={e=>setConfig({...config,relevance_criteria:e.target.value})}/></label>
        <label className="planning-field"><span>Relevância mínima para exibição</span><select value={config.minimum_relevance} onChange={e=>setConfig({...config,minimum_relevance:e.target.value as Config['minimum_relevance']})}>{Object.entries(levels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><small>Achados abaixo deste nível permanecem preservados no histórico.</small></label>
        {config.competitors.map((comp,i)=><div className="competitive-config-row" key={i}>
          <label className="planning-field"><span>Instituição / marca e campus</span><input value={comp.name} maxLength={250} onChange={e=>setConfig({...config,competitors:config.competitors.map((c,j)=>j===i?{...c,name:e.target.value}:c)})}/></label>
          <label className="planning-field"><span>Domínios oficiais autorizados</span><input value={comp.official_hosts.join(', ')} onChange={e=>setConfig({...config,competitors:config.competitors.map((c,j)=>j===i?{...c,official_hosts:e.target.value.split(',').map(v=>v.trim())}:c)})}/><small>Separe por vírgula, sem https://. Cada subdomínio precisa ser indicado.</small></label>
          <button type="button" onClick={()=>setConfig({...config,competitors:config.competitors.filter((_,j)=>j!==i)})}>Remover concorrente {i+1}</button>
        </div>)}
        <div className="planning-toolbar"><button type="button" onClick={()=>setConfig({...config,competitors:[...config.competitors,{name:'',official_hosts:[]}]})}>Adicionar concorrente</button><button type="button" onClick={()=>run('configure',{config,expected_updated_at:context.profile?.updated_at??null})}>Salvar configuração</button></div>
      </fieldset>
    </details>
    <details><summary>Importar relatório do monitoramento existente</summary><p>A importação é explícita. Este painel não cria outra rotina de busca nem recebe automaticamente as conversas do ChatGPT. Fontes fora dos domínios configurados são recusadas; chaves já importadas não geram duplicações.</p>
      <div className="planning-toolbar"><button type="button" disabled={!plan||!context.profile} onClick={template}>Baixar modelo de relatório</button><label className="planning-field"><span>Selecionar relatório JSON</span><input aria-label="Importar relatório JSON" type="file" accept="application/json,.json" disabled={!canWrite||busy||dirty||!plan||!context.profile} onChange={e=>{void importFile(e.target.files?.[0]);e.target.value='';}}/></label></div>
    </details>
    <p>{visible.length} de {context.findings.length} achado(s) exibido(s). Campus: {context.profile?.config.campus??'Ainda não configurado'}.</p>
    {!visible.length?<p>Nenhum achado neste nível de relevância. Configure e importe um relatório verificado.</p>:visible.map(f=><article className="competitive-finding" key={f.id}>
      <h4>{f.report.competitor} · {f.report.title}</h4><p><strong>{f.report.event_type==='baseline'?'Linha de base':'Mudança reportada'} · {f.report.kind==='inference'?'[Inferência]':f.report.verification==='confirmed'?'Fato documentado':'Informação não verificável'} · {f.report.verification==='confirmed'?'Fonte conferida':'Informação não verificável'} · {levels[f.report.relevance]}</strong></p>
      <dl><dt>Condição anterior</dt><dd>{f.report.previous_condition||'Anterior não localizada'}</dd><dt>Condição atual / evidência</dt><dd>{f.report.current_condition}</dd><dt>Publicação / documento</dt><dd>{date(f.report.published_on)} / {date(f.report.document_on)}</dd><dt>Vigência / prazo</dt><dd>{date(f.report.valid_from)} a {date(f.report.valid_until)}</dd><dt>Consulta</dt><dd>{date(f.report.consulted_on)}</dd><dt>Fonte oficial</dt><dd><a href={f.report.source_url} target="_blank" rel="noopener noreferrer">Abrir evidência oficial</a></dd><dt>Objetivo sugerido{f.status==='approved'?' · vínculo revisado':''}</dt><dd>{f.objective_snapshot.theme} · indicador: {f.objective_snapshot.indicator||'Não informado'}</dd></dl>
      {f.report.limitations&&<p>Limitações: {f.report.limitations}</p>}{f.report.impact&&<p>[Inferência] {f.report.impact}</p>}{f.report.suggested_action&&<p>Proposta: {f.report.suggested_action}</p>}
      <p>{statuses[f.status]}{f.action_id&&` · Identificador da ação 5W2H: ${f.action_id}`}</p>
      {canWrite&&f.status==='pending'&&<button type="button" disabled={busy||dirty||!plan} onClick={()=>choose(f)}>Revisar sugestão</button>}
    </article>)}
    {finding&&plan&&<form onSubmit={e=>{e.preventDefault();void run('approve',{finding_id:finding.id,plan_id:plan.id,expected_updated_at:plan.updated_at,objective_index:Number(objective),goal_id:goal||null,what,who,due_date:due,how,how_much:cost,review_note:note});}}>
      <fieldset disabled={!canWrite||busy||dirty}><legend>Decisão do gestor · {finding.report.title}</legend>
        <p>A decisão vale para esta sugestão. Não publica o planejamento nem altera metas ou preços.</p>
        <label className="planning-field"><span>Objetivo estratégico</span><select required value={objective} onChange={e=>setObjective(e.target.value)}><option value="">Selecione</option>{plan.objectives.map((o,i)=><option key={i} value={i}>{o.theme}</option>)}</select></label>
        <label className="planning-field"><span>Meta existente (opcional)</span><select value={goal} onChange={e=>setGoal(e.target.value)}><option value="">Sem vínculo adicional</option>{context.goals.map(g=><option key={g.id} value={g.id}>{g.title}{g.indicator?` · ${g.indicator}`:''}</option>)}</select></label>
        <label className="planning-field"><span>O que fazer</span><input required maxLength={500} value={what} onChange={e=>setWhat(e.target.value)}/></label>
        <label className="planning-field"><span>Responsável pela ação</span><input required maxLength={250} value={who} onChange={e=>setWho(e.target.value)}/></label>
        <label className="planning-field"><span>Prazo</span><input required type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
        <label className="planning-field"><span>Como executar</span><textarea required maxLength={4000} value={how} onChange={e=>setHow(e.target.value)}/></label>
        <label className="planning-field"><span>Custo / condição orçamentária</span><input maxLength={250} placeholder="Informe somente condição deliberada; vazio se pendente" value={cost} onChange={e=>setCost(e.target.value)}/></label>
        <label className="planning-field"><span>Justificativa da decisão</span><textarea required maxLength={4000} value={note} onChange={e=>setNote(e.target.value)}/></label>
        <div className="planning-toolbar"><button type="submit" disabled={finding.report.verification!=='confirmed'||objective===''}>Acolher sugestão e criar ação 5W2H</button><button type="button" onClick={()=>run('reject',{finding_id:finding.id,review_note:note})}>Não acolher sugestão</button><button type="button" onClick={()=>setSelected('')}>Cancelar revisão</button></div>
        {finding.report.verification!=='confirmed'&&<p>Revalide a fonte e importe um novo achado antes de criar ação para esta informação.</p>}
      </fieldset>
    </form>}
    <details><summary>Histórico de importações e decisões · {context.history.length} registro(s) mais recente(s)</summary>{context.history.map(h=><details key={h.id}><summary>{new Date(h.created_at).toLocaleString('pt-BR')} · {events[h.event]??h.event} · {h.actor_id?'Usuário identificado':'Importação de sistema'}</summary><p>Achado: {h.finding_id??'Configuração do curso'} · Ator: {h.actor_id??'Sistema'}</p><pre className="competitive-event">{JSON.stringify(h.details,null,2)}</pre></details>)}</details>
  </section>;
}
