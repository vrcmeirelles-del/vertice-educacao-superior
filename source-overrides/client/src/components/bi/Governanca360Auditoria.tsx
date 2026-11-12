import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import "./governanca-360-auditoria.css";

/** Diagnóstico somente leitura. Nenhum registro é alterado, vinculado ou validado automaticamente. */
type Metric={name:string;count:number|null;source:string;error?:string};
type Finding={id:string;severity:"critico"|"atencao"|"informativo";title:string;detail:string;action:string};
type Audit={metrics:Metric[];findings:Finding[];scannedAt:string;coverage:{
  snapshots:number|null;coursesSnapshot:number|null;gradeTotal:number|null;gradeCourses:number|null;historicalTotal:number|null;historicalCourses:number|null;
  snapshotRows:number|null;gradeRows:number|null;goals:number|null;goalsUnassigned:number|null;
  goalsMeasured:number|null;actions:number|null;requests:number|null;files:number|null;
  docsWithoutFile:number|null;docAwaiting:number|null;docValidated:number|null;diagnoses:number|null;
  captacaoLeads:number|null;captacaoCosts:number|null;enade:number|null;offerings:number|null;
}};

const LEGACY_UNITOP="cda828bd-4f55-432a-a824-387716c3cb2b";
const CANONICAL_UNITOP="1f5fd5b4-93c6-4626-834d-136884915587";
const normalizeTerm=(s:string)=>s.replace(/-/g,"/");
const MODULE_BY_FINDING:Record<string,string>={
 "metas-responsavel":"metas","metas-sem-afericao":"metas","acoes-inexistentes":"plano",
 "fila-revisao":"repositorio","exigencias-vazias":"repositorio","matriculas-divergentes":"visao",
 "eorbit-restrito":"eorbit","enade-ausente":"enade","aprendizagem-sem-feed":"aprendizagem",
 "correspondencias-pendentes":"novo_instrumento","fontes-sem-analise":"fontes",
 "convites-sem-vinculo":"equipe","novo-instrumento-sem-envio":"novo_instrumento"
};

const fmt=(v:number|null)=>v===null?"Indisponível":new Intl.NumberFormat("pt-BR").format(v);
type Table="vertice_courses"|"vertice_enrollment_snapshots"|"vertice_offering_outcomes"|"vertice_goals"|"vertice_goal_measurements"|"vertice_actions"|"vertice_diagnosis_items"|"vertice_repository_requests"|"vertice_repository_files"|"vertice_captacao_leads"|"vertice_captacao_custos"|"vertice_enade360_records"|"vertice_eorbit_quantitativo"|"vertice_memberships"|"vertice_invites"|"vertice_source_uploads"|"vertice_source_analyses"|"vertice_learning_course_metrics"|"vertice_instrumento_correspondencias"|"vertice_emec_snapshots"|"vertice_ebitda_calculations"|"vertice_cost_parameters"|"vertice_inep_library";
export default function Governanca360Auditoria({institutionId}:{institutionId:string}){
 const [audit,setAudit]=useState<Audit|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  if(!institutionId){setAudit(null);setLoading(false);return;}
  setLoading(true);setError("");
  try{
   // Cada consulta tem isolamento por IES. A chave legada só se aplica à UNITOP,
   // desde que a política RLS também permita ler a origem acadêmica.
   const count=async(table:Table,extra?:{eq?:[string,string];is?:[string,null]})=>{
     let q=supabase.from(table).select(table==="vertice_memberships"?"user_id":table==="vertice_learning_course_metrics"?"course_id":"id",{count:"exact",head:true}).eq("institution_id",institutionId);
     if(extra?.eq)q=q.eq(extra.eq[0],extra.eq[1]);
     if(extra?.is)q=q.is(extra.is[0],extra.is[1]);
     const r=await q;
     if(r.error)throw new Error(table+": "+r.error.message);
     return r.count??null;
   };
   const counts=await Promise.allSettled([
    count("vertice_courses"),
    count("vertice_actions"),
    count("vertice_diagnosis_items"),
    count("vertice_goal_measurements"),
    count("vertice_captacao_leads"),
    count("vertice_captacao_custos"),
    count("vertice_enade360_records"),
    count("vertice_offering_outcomes",{eq:["semester","2026/02"]}),
    count("vertice_memberships"),
    count("vertice_invites"),
    count("vertice_source_uploads"),
    count("vertice_source_analyses"),
    count("vertice_learning_course_metrics"),
    count("vertice_instrumento_correspondencias"),
    count("vertice_emec_snapshots"),
    count("vertice_ebitda_calculations"),
    count("vertice_cost_parameters"),
    count("vertice_inep_library")
   ]);
   const metric=(i:number,name:string,source:string):Metric=>{
    const r=counts[i];
    return {name,count:r.status==="fulfilled"?r.value:null,source,error:r.status==="rejected"?String(r.reason):undefined};
   };
   const metrics=[
    metric(0,"Cursos cadastrados","vertice_courses"),
    metric(1,"Planos 5W2H","vertice_actions"),
    metric(2,"Diagnósticos cadastrados","vertice_diagnosis_items"),
    metric(3,"Aferições de metas","vertice_goal_measurements"),
    metric(4,"Leads de captação","vertice_captacao_leads"),
    metric(5,"Custos de captação","vertice_captacao_custos"),
    metric(6,"Resultados ENADE 360","vertice_enade360_records"),
    metric(7,"Ofertas de disciplina em 2026/2","vertice_offering_outcomes"),
    metric(8,"Membros vinculados à IES","vertice_memberships"),
    metric(9,"Convites da IES","vertice_invites"),
    metric(10,"Arquivos de origem enviados","vertice_source_uploads"),
    metric(11,"Análises de origem","vertice_source_analyses"),
    metric(12,"Desempenho integrado Fato & Ordem","vertice_learning_course_metrics"),
    metric(13,"Correspondências 2017–2026","vertice_instrumento_correspondencias"),
    metric(14,"Registros e-MEC","vertice_emec_snapshots"),
    metric(15,"Apurações EBITDA","vertice_ebitda_calculations"),
    metric(16,"Premissas de custos cadastradas","vertice_cost_parameters"),
    metric(17,"Documentos Biblioteca INEP","vertice_inep_library")
   ];
   const result=await Promise.allSettled([
    supabase.from("vertice_goals").select("id,status,owner_user_id").eq("institution_id",institutionId).limit(2000),
    supabase.from("vertice_repository_requests").select("id,repository_section,course_id,not_applicable,active").eq("institution_id",institutionId).limit(2000),
    supabase.from("vertice_repository_files").select("request_id,status,created_at").eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(2000),
    supabase.from("vertice_enrollment_snapshots").select("course_id,semester,class_label,enrolled").eq("institution_id",institutionId).eq("semester","2026/02").ilike("student_status","matriculado").limit(2000),
    institutionId===CANONICAL_UNITOP?supabase.from("vertice_eorbit_quantitativo").select("curso_id,total_matriculados,total_vinculos,semestre:vertice_eorbit_semestres!inner(semestre)").eq("instituicao_id",LEGACY_UNITOP).eq("vertice_eorbit_semestres.semestre","2026/02").limit(2000):Promise.resolve({data:[],error:null}),
    supabase.from("vertice_course_semester_stats").select("codigo,matriculados").eq("institution_id",institutionId).eq("semestre","2026/02").limit(2000)
   ]);
   const sourceErrors:string[]=[];
   const vals=result.map((r,i)=>{
     if(r.status==="rejected"){
       if(i>=4){sourceErrors.push("A origem adicional "+i+" não pôde ser consultada.");return [];}
       throw new Error("Fonte essencial "+i+": "+String(r.reason));
     }
     if(r.value.error){
       if(i>=4){sourceErrors.push("Origem adicional "+i+": "+r.value.error.message);return [];}
       throw new Error("Fonte essencial "+i+": "+r.value.error.message);
     }
     return r.value.data??[];
   });
   const [goals,reqs,files,snapshots,grades,semesterStats]=vals as any[][];
   const snapCount=snapshots.reduce((n,e)=>n+Math.max(0,Number(e.enrolled)||0),0);
   const gradeCount=grades.reduce((n,g)=>n+Math.max(0,Number(g.total_matriculados)||0),0);
   const statsCount=semesterStats.reduce((n,r)=>n+Math.max(0,Number(r.matriculados)||0),0);
   const latest=new Map<string,any>();
   for(const f of files)if(!latest.has(String(f.request_id)))latest.set(String(f.request_id),f);
   const findings:Finding[]=[];
   const add=(id:string,severity:Finding["severity"],title:string,detail:string,action:string)=>findings.push({id,severity,title,detail,action});
   const unassigned=goals.filter(g=>!g.owner_user_id).length;
   const latestStatus=(status:string)=>reqs.filter(r=>latest.get(r.id)?.status===status).length;
   const withoutFile=reqs.filter(r=>r.active!==false&&!r.not_applicable&&!latest.has(r.id)).length;
   if(goals.length&&unassigned)add("metas-responsavel","critico","Metas sem responsáveis",fmt(unassigned)+" de "+fmt(goals.length)+" metas não possuem owner_user_id. O cadastro da meta não equivale a acompanhamento.", "Definir responsáveis e iniciar as aferições no módulo Metas e Indicadores.");
   if(goals.length&&metrics[3].count===0)add("metas-sem-afericao","critico","Metas sem aferição longitudinal","Existem "+fmt(goals.length)+" metas e nenhuma aferição registrada neste recorte.", "Implementar coleta periódica de medições com fonte, responsável, prazo e validação.");
   if(goals.length&&metrics[1].count===0)add("acoes-inexistentes","critico","Planejamento não convertido em 5W2H","Nenhuma ação cadastrada, embora existam metas. Isso não comprova que não há ações fora do portal.", "Vincular achados e metas a planos com evidência, responsável, custo e prazo.");
   if(latestStatus("enviado"))add("fila-revisao","critico","Fila documental sem decisão","O arquivo mais recente de "+fmt(latestStatus("enviado"))+" exigências segue como enviado, aguardando validação.", "Priorizar triagem, análise e parecer por responsáveis de cada IES.");
   if(withoutFile)add("exigencias-vazias","atencao","Exigências sem evidência",fmt(withoutFile)+" exigências ativas sem arquivo ligado ao registro consultado.", "Filtrar por curso, semestre e indicador; distinguir sem envio de NSA.");
   if(institutionId===CANONICAL_UNITOP && grades.length && snapshots.length && gradeCount!==snapCount)add("matriculas-divergentes","critico","Três bases de matrículas divergentes","2026/2: e-ORBIT por grade "+fmt(gradeCount)+"; estatística histórica por curso "+(semesterStats.length?fmt(statsCount):"fonte indisponível")+"; snapshots do portal "+fmt(snapCount)+". As coberturas não são equivalentes.", "Definir a fonte oficial, conciliar curso × semestre × grade e versionar a reconciliação antes de publicar KPIs.");
   if(institutionId===CANONICAL_UNITOP && !grades.length)add("eorbit-restrito","atencao","Fonte e-ORBIT não disponível nesta sessão","Não houve linhas de quantitativos da origem legada na consulta autenticada. Isso pode indicar falta de acesso ou cobertura.", "Verificar a permissão à origem e a correspondência entre IES canônica e chave legada.");
   for(const m of metrics)if(m.error)add("fonte-"+m.source,"atencao","Fonte não consultada: "+m.name,"A consulta retornou erro. O valor não foi convertido em zero.", "Conferir políticas RLS, ingestão e autenticação da fonte.");
   sourceErrors.forEach((message,index)=>add("origem-adicional-"+index,"atencao","Origem histórica indisponível",message+" O painel não atribui zero a esta fonte.","Conferir conciliação de identidade da IES e permissões de acesso à origem."));
   if(metrics[4].count===0&&metrics[5].count===0)add("captacao-ausente","atencao","Captação sem alimentação estruturada","Nenhum lead ou custo de campanha cadastrado nesta fonte para a IES.", "Conectar CRM/captação com opt-in e fonte legitimamente autorizada.");
   if(metrics[6].count===0)add("enade-ausente","atencao","ENADE 360 sem desempenho validado","Não existem resultados cadastrados na tabela de desempenho ENADE 360.", "Importar resultados homologados por curso e período; não deduzir notas de outras avaliações.");
   if(metrics[8].count===0&&metrics[9].count!==null&&metrics[9].count>0)add("convites-sem-vinculo","atencao","Convites sem membro institucional ativo","Há "+fmt(metrics[9].count)+" convite(s) nesta IES, mas nenhum membro vinculado na tabela de acesso. Isso não indica que o convidado aceitou ou recusou.","Conferir convites e consentimento; registrar acesso apenas após validação da identidade e do perfil.");
   if(metrics[10].count!==null&&metrics[10].count>0&&metrics[11].count===0)add("fontes-sem-analise","atencao","Fontes enviadas sem análise registrada","Existem "+fmt(metrics[10].count)+" arquivo(s) de origem e nenhuma análise registrada no módulo de fontes.","Conferir o pipeline, o estado da ingestão, a autorização e os relatórios produzidos.");
   if(metrics[12].count===0)add("aprendizagem-sem-feed","atencao","Fato & Ordem sem resultados integrados na Vértice","Não há registros de desempenho longitudinal por disciplina na tabela de integração desta instituição.","Verificar consentimento, identidade institucional, ligação por curso e envio dos indicadores agregados sem expor alunos desnecessariamente.");
   if(metrics[13].count===0&&reqs.length)add("correspondencias-pendentes","informativo","Instrumentos sem correspondências validadas","Não existem vínculos documentais registrados entre os instrumentos 2017 e 2026 para a IES.","Executar a sugestão assistida e a validação manual, sem replicar conceito nem confundir os buckets.");
   if(reqs.length && !reqs.some(r=>String(r.repository_section).startsWith("novo_instrumento_2026")))add("novo-instrumento-sem-envio","informativo","Novo Instrumento sem documentos cadastrados","Formulários estão disponíveis, mas nenhum pedido deste instrumento aparece neste recorte.", "Solicitar evidências e registrar a análise manual antes de declarar cobertura.");
   findings.sort((a,b)=>({critico:0,atencao:1,informativo:2}[a.severity]-{critico:0,atencao:1,informativo:2}[b.severity]));
   setAudit({metrics,findings,scannedAt:new Date().toISOString(),coverage:{
    snapshots:snapshots.length?snapCount:null,coursesSnapshot:snapshots.length?new Set(snapshots.map(e=>e.course_id)).size:null,
    gradeTotal:grades.length?gradeCount:null,gradeCourses:grades.length?new Set(grades.map(g=>g.curso_id)).size:null,
    snapshotRows:snapshots.length?snapshots.length:null,gradeRows:grades.length?grades.length:null,
    historicalTotal:semesterStats.length?statsCount:null,historicalCourses:semesterStats.length?new Set(semesterStats.map(r=>r.codigo)).size:null,
    goals:goals.length,goalsUnassigned:unassigned,goalsMeasured:metrics[3].count,actions:metrics[1].count,
    requests:reqs.length,files:files.length,docsWithoutFile:withoutFile,docAwaiting:latestStatus("enviado"),docValidated:latestStatus("validado"),
    diagnoses:metrics[2].count,captacaoLeads:metrics[4].count,captacaoCosts:metrics[5].count,
    enade:metrics[6].count,offerings:metrics[7].count
   }});
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível executar a auditoria.");setAudit(null);}
  finally{setLoading(false);}
 },[institutionId]);
 useEffect(()=>{void load();},[load]);
 return <section className="gov-audit" aria-label="Auditoria integrada de Governança 360">
  <header className="gov-audit-header"><div><small>GOVERNANÇA 360 · AUDITORIA DE INTEGRAÇÕES</small><h3>Conexões entre dados, metas, evidências e decisões</h3><p>Verificação de leitura: não cria metas, não valida documentos e não altera dados acadêmicos.</p></div><button type="button" disabled={loading||!institutionId} onClick={()=>void load()}>{loading?"Verificando…":"Recalcular auditoria"}</button></header>
  {error&&<p role="alert" className="gov-audit-error">{error}</p>}
  {!institutionId?<p>Selecione uma instituição autorizada antes de consultar os dados.</p>:loading&&!audit?<p role="status">Conferindo fontes e vínculos da instituição…</p>:audit&&<>
   <div className="gov-audit-kpis">{[
    ["Metas sem responsável",audit.coverage.goalsUnassigned],
    ["Planos 5W2H",audit.coverage.actions],
    ["Documentos aguardando análise",audit.coverage.docAwaiting],
    ["Aferições realizadas",audit.coverage.goalsMeasured]
   ].map(([label,v])=><div key={String(label)}><small>{label}</small><strong>{fmt(v as number|null)}</strong></div>)}</div>
   <div className="gov-audit-columns">
    <div className="gov-audit-panel"><h4>Fontes efetivamente consultadas</h4><div className="gov-audit-sources">{audit.metrics.map(m=><div key={m.source}><span>{m.name}<small>{m.source}</small></span><strong>{fmt(m.count)}</strong></div>)}</div></div>
    <div className="gov-audit-panel"><h4>Matrículas · reconciliação de 2026/2</h4>
      <div className="gov-audit-comparison">
       <div><small>Snapshots do portal</small><strong>{fmt(audit.coverage.snapshots)}</strong><span>{fmt(audit.coverage.coursesSnapshot)} cursos cobertos</span></div>
       <div><small>Série histórica por curso</small><strong>{fmt(audit.coverage.historicalTotal)}</strong><span>{fmt(audit.coverage.historicalCourses)} códigos de curso</span></div>
       <div><small>e-ORBIT · por grade</small><strong>{fmt(audit.coverage.gradeTotal)}</strong><span>{fmt(audit.coverage.gradeCourses)} cursos de origem</span></div>
      </div>
      <p>Os indicadores pertencem a recortes diferentes. Nem matrículas em disciplinas nem vínculos agregados comprovam pessoas únicas.</p>
      <p><b>Base documental:</b> {fmt(audit.coverage.requests)} exigências, {fmt(audit.coverage.files)} arquivos consultados; {fmt(audit.coverage.docValidated)} exigência(s) com última versão validada.</p>
    </div>
   </div>
   <div className="gov-audit-findings"><h4>Desconexões e providências identificadas</h4>{audit.findings.length===0?<p>Nenhuma das regras verificadas apontou inconsistências. Isso não dispensa auditoria documental e regulatória.</p>:audit.findings.map(f=><article key={f.id}>
    <span className={"gov-audit-severity "+f.severity}>{f.severity==="critico"?"Crítico":f.severity==="atencao"?"Atenção":"Informativo"}</span><div><strong>{f.title}</strong><p>{f.detail}</p><small>Providência: {f.action}</small>{MODULE_BY_FINDING[f.id]&&<a className="gov-audit-action-link" href={"/master#instituicao="+encodeURIComponent(institutionId)+"&aba="+MODULE_BY_FINDING[f.id]}>Abrir módulo relacionado ↗</a>}</div>
   </article>)}</div>
   <footer>Última verificação desta sessão: {new Date(audit.scannedAt).toLocaleString("pt-BR")}. Dados com visibilidade sujeita às permissões da IES; nenhuma situação desconhecida é apresentada como zero. Não é um parecer oficial do MEC/INEP.</footer>
  </>}
 </section>;
}
