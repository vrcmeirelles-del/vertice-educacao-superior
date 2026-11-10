import {useEffect,useMemo,useState,type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import type {Role,Row} from "@/lib/area";
import RosterUpload from "./RosterUpload";
import ApiConnectorSetup from "./ApiConnectorSetup";
import StudentNotifications from "./StudentNotifications";
import "./learning-connected.css";

type Metric={
 institution_id:string;course_id:string;semester:string;subject_code:string;module:string;
 competency:string;participants:number;attempts:number;graded:number;correct:number;
 paired_students:number;curricular_average:number|null;external_accuracy:number|null;
 comparison_gap:number|null;updated_at:string;
};
type BridgeStatus={configured:boolean;tenantEnabled:boolean|null;tenantStatus:string;courseCount:number;metrics:Metric[];ok:boolean};
type MapForm={courseId:string;subjectCode:string;module:string;competency:string;evidenceRef:string;reviewed:boolean};
const MODULES=[
 ["oab","OAB"],["cfc","CFC"],["enade","ENADE"],["delegado","Delegado"],
 ["pf","Polícia Federal"],["estadual","Magistratura Estadual"],["federal","Magistratura Federal"],
 ["defensoria","Defensoria"],["mp","Ministério Público"]
] as const;
const MANAGEMENT:Role[]=["master","reitor","gestor","diretor_geral","diretor_pedagogico","procurador"];
const number=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
const percent=(n:number|null)=>n===null?"—":(n*100).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
const initial:MapForm={courseId:"",subjectCode:"",module:"enade",competency:"",evidenceRef:"",reviewed:false};
const errorMessage=(error:unknown)=>error instanceof Error?error.message:"Operação indisponível.";
function relativeDate(value:string){
 try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value));}
 catch{return"—";}
}
export default function LearningConnected({institutionId,courses,role}:{
 institutionId:string;courses:Row[];role:Role|null;
}){
 const [data,setData]=useState<Metric[]>([]);
 const [status,setStatus]=useState<BridgeStatus|null>(null);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [filterCourse,setFilterCourse]=useState("");
 const [filterPeriod,setFilterPeriod]=useState("");
 const [filterModule,setFilterModule]=useState("");
 const [mapping,setMapping]=useState<MapForm>(initial);
 const canManage=Boolean(role&&MANAGEMENT.includes(role));
 const courseNames=useMemo(()=>new Map(courses.map(c=>[String(c.id),String(c.display_name??c.name)])),[courses]);
 const periods=[...new Set(data.map(x=>x.semester))].sort().reverse();
 const filtered=data.filter(row=>(!filterCourse||row.course_id===filterCourse)&&
   (!filterPeriod||row.semester===filterPeriod)&&(!filterModule||row.module===filterModule));
 const totals={courses:courses.length,groups:filtered.length,
   attempts:filtered.reduce((s,x)=>s+x.attempts,0),
   coherent:filtered.filter(x=>x.paired_students>=5&&x.comparison_gap!==null).length};
 // Counts of attempts may repeat when one event maps to multiple validated competencies.
 const reload=async()=>{
   setLoading(true);
   try{
     const {data:rows,error}=await supabase.from("vertice_learning_course_metrics")
       .select("institution_id,course_id,semester,subject_code,module,competency,participants,attempts,graded,correct,paired_students,curricular_average,external_accuracy,comparison_gap,updated_at")
       .eq("institution_id",institutionId).order("updated_at",{ascending:false}).limit(1000);
     if(error)throw error;
     setData((rows??[]) as Metric[]);
     if(canManage){
       const {data:state,error:bridgeError}=await supabase.functions.invoke("vertice-learning-bridge",{
         body:{operation:"status",institutionId}
       });
       if(bridgeError)throw bridgeError;
       setStatus(state as BridgeStatus);
     }else setStatus(null);
     setMessage("");
   }catch(error){setMessage("Consulta parcial: "+errorMessage(error));}
   finally{setLoading(false);}
 };
 useEffect(()=>{setData([]);setStatus(null);void reload();},[institutionId]);
 const bridgeAction=async(body:Record<string,unknown>)=>{
   setBusy(true);setMessage("");
   try{
     const {data:answer,error}=await supabase.functions.invoke("vertice-learning-bridge",{
       body:{...body,institutionId}
     });
     if(error)throw error;
     setMessage(body.operation==="sync"
       ?"Vinculações confirmadas: "+number(answer?.confirmedLinks??0)+". Novos eventos: "+number(answer?.newEvents??0)+
        ". Grupos gerenciais: "+number(answer?.publishedGroups??0)+
        (answer?.remainingPages?". Há mais páginas para sincronizar.":"")
       :body.operation==="map_subject"?"Mapeamento validado. Indicadores serão calculados quando houver eventos e notas comparáveis."
       :body.operation==="provision_tenant"
          ?answer?.enabled?"Esta instituição foi habilitada para integração, mediante consentimento e matrícula confirmada."
           :"Integração suspensa para esta instituição; novos compartilhamentos foram interrompidos."
       :"Operação registrada.");
     if(body.operation==="provision_tenant")setStatus(previous=>previous?{
       ...previous,tenantEnabled:answer?.enabled===true,
       tenantStatus:answer?.enabled===true?"ativo":"inativo"
     }:previous);
     const {data:rows,error:refreshError}=await supabase.from("vertice_learning_course_metrics")
       .select("*").eq("institution_id",institutionId).limit(1000);
     if(!refreshError)setData((rows??[]) as Metric[]);
     return true;
   }catch(error){setMessage("Não foi possível concluir: "+errorMessage(error));return false;}
   finally{setBusy(false);}
 };
 const link="https://www.fatoeordem.com.br/vincular-vertice?institutionId="+encodeURIComponent(institutionId);
 const onMap=(event:FormEvent<HTMLFormElement>)=>{
   event.preventDefault();
   if(!canManage||!mapping.reviewed)return;
   if(!window.confirm("Confirmar que o vínculo disciplina–competência foi revisado com evidência?"))return;
   void bridgeAction({operation:"map_subject",...mapping}).then(ok=>{if(ok)setMapping(initial);});
 };
 return <section className="learning-connected">
   <header className="learning-hero">
     <div><small>VÉRTICE · INTELIGÊNCIA ACADÊMICA INTEGRADA</small>
       <h3>Aprendizagem Conectada</h3>
       <p>Resultados do Fato & Ordem × avaliações curriculares × competências × intervenções pedagógicas. Todos os cursos, sem atribuição por semelhança de nomes ou CPFs expostos.</p>
     </div>
     <button className="corp-button small" type="button" disabled={busy||loading} onClick={()=>void reload()}>Atualizar painel</button>
   </header>
   <div className="learning-kpis">
     <article><small>Cursos abrangidos</small><b>{number(totals.courses)}</b><span>Cadastro institucional atual</span></article>
     <article><small>Indicadores publicados</small><b>{number(totals.groups)}</b><span>Somente grupos com pelo menos 5 estudantes</span></article>
     <article><small>Tentativas por vínculo curricular</small><b>{totals.groups?number(totals.attempts):"—"}</b><span>Não representa total de tentativas únicas</span></article>
     <article><small>Comparações nota × exame</small><b>{number(totals.coherent)}</b><span>Amostra pareada validada</span></article>
   </div>
   {canManage&&<RosterUpload institutionId={institutionId} courses={courses} role={role}/>}
   {canManage&&<ApiConnectorSetup institutionId={institutionId} role={role}/>}
   {canManage&&<StudentNotifications institutionId={institutionId} role={role}/>}
   {loading&&<p role="status">Carregando indicadores com controle de acesso…</p>}
   {message&&<p role="status" className="learning-message">{message}</p>}
   <section className="learning-panel">
     <div className="learning-head"><div><h4>Radar de coerência avaliativa</h4>
       <p>Valores normalizados na escala 0–100%, sempre com amostras e proveniência. Divergência é um sinal para investigação, não uma nota do docente ou previsão oficial de exame.</p></div></div>
     <div className="learning-filters">
       <label>Curso <select value={filterCourse} onChange={e=>setFilterCourse(e.target.value)}><option value="">Todos os cursos</option>{courses.map(c=><option key={String(c.id)} value={String(c.id)}>{String(c.display_name??c.name)} · {String(c.code??"sem código")}</option>)}</select></label>
       <label>Semestre <select value={filterPeriod} onChange={e=>setFilterPeriod(e.target.value)}><option value="">Todos os períodos com evidência</option>{periods.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
       <label>Exame <select value={filterModule} onChange={e=>setFilterModule(e.target.value)}><option value="">Todas as avaliações</option>{MODULES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     </div>
     {!filtered.length?<div className="learning-empty">
       <strong>Nenhum diagnóstico pareado disponível nesta seleção.</strong>
       <p>O painel não presume vínculo acadêmico nem calcula índices artificiais. É necessário confirmar os estudantes por CPF, carregar notas curriculares verificadas, vincular as competências às disciplinas e sincronizar eventos do Fato & Ordem.</p>
     </div>:<div className="learning-scroll"><table><thead><tr><th>Curso / Disciplina</th><th>Período</th><th>Exame / competência</th><th>Participantes</th><th>Acertos objetivos</th><th>Nota curricular</th><th>Resultado externo</th><th>Diferença</th></tr></thead><tbody>
       {filtered.map((row,i)=>{
         const grade=row.comparison_gap,marker=grade===null?"indisponível":Math.abs(grade)>=.2?"atenção":"comparável";
         return <tr key={i}><td><strong>{courseNames.get(row.course_id)||"Curso cadastrado"}</strong><small>{row.subject_code}</small></td>
           <td>{row.semester}</td><td><strong>{MODULES.find(([k])=>k===row.module)?.[1]||row.module}</strong><small>{row.competency||"Competência geral"}</small></td>
           <td>{row.participants}</td><td>{row.graded?row.correct+" / "+row.graded+" ("+percent(row.correct/row.graded)+")":"—"}</td>
           <td>{percent(row.curricular_average)}</td><td>{percent(row.external_accuracy)}</td>
           <td><span className={"learning-signal "+marker}>{grade===null?"Amostra insuficiente":(grade>0?"+":"")+percent(grade)}</span></td>
         </tr>;
       })}</tbody></table></div>}
     <p className="learning-footnote">Amostras com menos de cinco participantes são omitidas. Para confrontar médias, são exigidos ao menos cinco estudantes com notas e cinco respostas objetivas corrigidas por estudante. Semestre acadêmico precisa ter janela documentalmente conferida.</p>
   </section>
   <div className="learning-columns">
     <section className="learning-panel"><h4>Identidade e autorização</h4>
       <p>O estudante confirma o CPF no Fato & Ordem. O servidor gera um HMAC específico da instituição e a Vértice só confirma o vínculo após localizar matrícula válida em fonte acadêmica autorizada.</p>
       <p><strong>Nenhum CPF bruto é armazenado na integração.</strong> A sincronização transmite apenas identificadores pseudônimos, área, competência, tipo de avaliação, horário e resultado autorizado.</p>
       <div className="learning-copy"><input type="text" readOnly value={link} aria-label="Link de vinculação da instituição"/><button className="corp-button small" onClick={()=>void navigator.clipboard.writeText(link)}>Copiar convite</button></div>
       <p className="learning-footnote">Distribua o link apenas aos estudantes da instituição. A confirmação nominal dependerá do cadastro acadêmico conferido, não apenas do clique.</p>
     </section>
     <section className="learning-panel"><h4>Sincronização e auditoria</h4>
       <p>O módulo opera em lotes idempotentes, com cursor por instituição, vinculação verificada e aprovação curricular. As credenciais são armazenadas somente no servidor.</p>
       <dl className="learning-status">
         <div><dt>Canal de integração</dt><dd>{status===null?"A verificar":status.configured?"Credenciais configuradas":"Aguardando configuração de credenciais"}</dd></div>
         <div><dt>Credenciamento deste cliente</dt><dd>{status?.tenantStatus||"A verificar"}</dd></div>
         <div><dt>Últimos indicadores</dt><dd>{data.length?relativeDate(data[0].updated_at):"Sem sincronização publicada"}</dd></div>
       </dl>
       {canManage&&<div className="learning-tenant-actions">
         <button type="button" className="corp-button small" disabled={busy||!status?.configured||status?.tenantStatus==="indisponível"||status?.tenantEnabled===true}
          onClick={()=>{if(window.confirm("Ativar a integração do Fato & Ordem para esta IES? O aluno ainda deverá autorizar o compartilhamento e a matrícula deverá ser verificada."))void bridgeAction({operation:"provision_tenant",enabled:true,reviewed:true});}}>
           Habilitar esta instituição
         </button>
         <button type="button" className="corp-button secondary small" disabled={busy||!status?.configured||status?.tenantEnabled!==true}
          onClick={()=>{if(window.confirm("Suspender esta instituição e revogar autorizações anteriores no Fato & Ordem?"))void bridgeAction({operation:"provision_tenant",enabled:false,reviewed:true});}}>
           Suspender integração
         </button>
       </div>}
       {canManage&&<button type="button" className="corp-button" disabled={busy||!status?.configured||status?.tenantEnabled!==true} onClick={()=>void bridgeAction({operation:"sync"})}>Sincronizar desempenho</button>}
       <p className="learning-footnote">Cada nova IES cadastrada pode ser habilitada aqui, sem alteração de código ou lista manual de clientes. A ativação não vincula alunos automaticamente. O botão de sincronização permanece bloqueado sem credenciais, credenciamento e matrícula verificada.</p>
     </section>
   </div>
   {canManage&&<section className="learning-panel">
     <h4>Mapa validado: disciplina × competência × exame</h4>
     <p>Utilize o código real da disciplina e a competência documentada. O sistema não associa conteúdos por nome parecido, nem presume que as provas avaliam automaticamente toda a matriz curricular.</p>
     <form className="learning-map" onSubmit={onMap}>
       <label>Curso <select value={mapping.courseId} required onChange={e=>setMapping(v=>({...v,courseId:e.target.value}))}><option value="">Selecione o curso</option>{courses.map(c=><option key={String(c.id)} value={String(c.id)}>{String(c.display_name??c.name)} · {String(c.code??"")}</option>)}</select></label>
       <label>Código da disciplina<input required value={mapping.subjectCode} maxLength={120} onChange={e=>setMapping(v=>({...v,subjectCode:e.target.value}))} placeholder="Código cadastrado no sistema acadêmico"/></label>
       <label>Exame <select value={mapping.module} onChange={e=>setMapping(v=>({...v,module:e.target.value}))}>{MODULES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
       <label>Competência avaliada<input required minLength={3} value={mapping.competency} maxLength={500} onChange={e=>setMapping(v=>({...v,competency:e.target.value}))} placeholder="Competência documentada na matriz e no plano de ensino"/></label>
       <label className="wide">Evidência de vínculo curricular<input required minLength={3} value={mapping.evidenceRef} maxLength={1000} onChange={e=>setMapping(v=>({...v,evidenceRef:e.target.value}))} placeholder="Matriz de referência, plano de ensino ou documentação institucional"/></label>
       <label className="wide learning-check"><input type="checkbox" checked={mapping.reviewed} onChange={e=>setMapping(v=>({...v,reviewed:e.target.checked}))} required/><span>Confirmei pessoalmente a correspondência entre disciplina, competência e instrumento de avaliação.</span></label>
       <button className="corp-button small" type="submit" disabled={busy||!status?.configured}>Validar mapeamento</button>
     </form>
   </section>}
 </section>;
}
