import {activeAction,documentActionSuggestions,mergeActionSuggestions} from "@/lib/portal-integration";
import {ACTION_STATUS,label as statusLabel} from "@/lib/area";
import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import type {Row} from "@/lib/area";
import {goalSignals} from "@/lib/goal-signals";
import {repositorySummary} from "@/lib/repository";
import "./action-cockpit.css";

type Data={courses:Row[];goals:Row[];measurements:Row[];diagnosis:Row[];requests:Row[];files:Row[];actions:Row[]};
export default function ActionCockpit({data,institutionId,onDraft}:{data:Data;institutionId:string;onDraft?:(draft:Record<string,unknown>)=>void}){
 const [course,setCourse]=useState("");
 const [person,setPerson]=useState("");
 const [contacts,setContacts]=useState<Row[]>([]);
 const [contactError,setContactError]=useState(false);
 useEffect(()=>{let active=true;void supabase.from("vertice_registry_contacts").select("id,name,position,course_id").eq("institution_id",institutionId).then(({data,error})=>{if(active){setContacts(data??[]);setContactError(Boolean(error));}});return()=>{active=false;};},[institutionId]);
 const scope=(rows:Row[])=>rows.filter(row=>!course||row.course_id===course);
 const actions=scope(data.actions);
 const goals=scope(data.goals);
 const findings=scope(data.diagnosis).filter(d=>d.status!=="resolvido");
 const signals=goalSignals(goals,data.measurements).filter(e=>e.signal==="red"||e.signal==="amber");
 const documents=repositorySummary(scope(data.requests),data.files);
 const candidates=contacts.filter(c=>c.course_id===course||!c.course_id);
 const selected=contacts.find(c=>c.id===person);
 const courseName=String(data.courses.find(c=>c.id===course)?.display_name??data.courses.find(c=>c.id===course)?.name??"Instituição");
 const suggestions=[
  ...signals.map(e=>({key:"goal-"+e.goal.id,title:String(e.goal.title),why:e.reasons.join(" "),goal_id:e.goal.id,course_id:e.goal.course_id,how:"Conferir a situação e a medição da meta, definir etapas e acompanhar o resultado.",evidence:"Sugestão de evidência: medição datada, relatório de acompanhamento e documento validado."})),
  ...findings.map(f=>({key:"finding-"+f.id,title:String(f.criterion),why:String(f.finding??"Tratar o achado registrado no diagnóstico."),finding_id:f.id,course_id:f.course_id,how:"Conferir o achado, pactuar a correção e registrar a verificação do resultado.",evidence:"Sugestão de evidência: registro da correção, ata de validação e documento revisado."}))
 ].filter(s=>!actions.some(a=>activeAction(a)&&(("goal_id" in s&&a.goal_id===s.goal_id)||("finding_id" in s&&a.finding_id===s.finding_id))));
 const priorities=mergeActionSuggestions(suggestions,documentActionSuggestions(data,course));
 function draft(s:typeof priorities[number]){
  const {key,title,evidence,...rest}=s;
  onDraft?.({...rest,what:title,who:selected&&(!selected.course_id||selected.course_id===s.course_id)?String(selected.name):"",where_at:data.courses.find(c=>c.id===s.course_id)?.name??"Instituição",how:rest.how+" "+evidence,how_much:"A estimar e aprovar",status:"nao_iniciada",progress:0});
 }
 function report(){
  const esc=(v:unknown)=>String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
  const fields=[["what","O quê"],["why","Por quê"],["who","Quem"],["where_at","Onde"],["due_date","Quando"],["how","Como"],["how_much","Custo"],["status","Situação"],["progress","Avanço (%)"],["evidence","Evidência"]];
  const html='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Plano de ação 5W2H</title><style>body{font:16px system-ui;color:#183c39;max-width:1000px;margin:40px auto;padding:20px}article{border:1px solid #bdd6ca;border-top:5px solid #287b61;padding:20px;margin:20px 0;break-inside:avoid}dt{font-weight:bold;margin-top:12px}dd{margin:4px 0;white-space:pre-wrap}h1{color:#205b4c}</style><h1>Plano de ação 5W2H</h1><p>'+esc(courseName)+' · '+esc(new Date().toLocaleString("pt-BR"))+'</p><p>'+actions.length+' ações · '+signals.length+' metas com alertas · '+findings.length+' achados abertos · '+documents.pending+' exigências sem envio</p>'+actions.map(a=>'<article><h2>'+esc(a.what)+'</h2><p>Curso: '+esc(data.courses.find(c=>c.id===a.course_id)?.name??"Institucional")+' · Meta: '+esc(data.goals.find(g=>g.id===a.goal_id)?.title)+' · Achado: '+esc(data.diagnosis.find(d=>d.id===a.finding_id)?.criterion)+'</p><dl>'+fields.map(([key,label])=>'<dt>'+label+'</dt><dd>'+esc(key==='status'?statusLabel(ACTION_STATUS,a[key]):a[key])+'</dd>').join("")+'</dl></article>').join("")+'<h2>Sugestões para revisão</h2>'+priorities.map(s=>'<article><h3>'+esc(s.title)+'</h3><p>'+esc(s.why)+'</p><p>'+esc(s.how)+'</p><p>'+esc(s.evidence)+'</p></article>').join("")+'</html>';
  const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download="plano-5w2h.html";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="action-cockpit">
  <header><small>DA ANÁLISE À EXECUÇÃO</small><h3>Plano integrado da instituição</h3><p>Selecione o curso, confira as prioridades e transforme cada sugestão em uma ação acompanhável.</p></header>
  <label>Curso <select value={course} onChange={e=>{setCourse(e.target.value);setPerson("");}}><option value="">Toda a instituição</option>{data.courses.map(c=><option key={c.id} value={c.id}>{String(c.display_name??c.name)}</option>)}</select></label>
  <div className="action-metrics">{[[actions.length,"Ações cadastradas"],[signals.length,"Metas com alertas"],[findings.length,"Achados abertos"],[documents.pending,"Exigências sem envio"]].map(([n,label])=><article key={label}><strong>{n}</strong><span>{label}</span></article>)}</div>
  <button className="corp-button small" onClick={report}>Baixar relatório para apresentação</button><p>O relatório inclui as ações cadastradas e as sugestões do recorte selecionado. Abra o arquivo para apresentar ou imprimir em PDF.</p>
  <details><summary>❔ Como preencher e acompanhar o 5W2H</summary><p><b>O quê e por quê</b> descrevem a entrega e a situação que ela pretende melhorar. Vincule a meta e o achado quando existirem.</p><p><b>Quem, onde e quando</b> definem responsável, curso ou setor e prazo pactuado. Coordenação e NDE podem conduzir ações acadêmicas; decisões de orçamento e abrangência institucional precisam da gestão competente.</p><p><b>Como e quanto custa</b> detalham etapas, recursos e orçamento. Registre “a estimar” até a aprovação.</p><p><b>Avanço</b> representa etapas verificadas. <b>Evidência</b> registra a entrega realizada, como ata, relatório, medição ou documento validado.</p></details>
  <details><summary>Sugestões de responsáveis do organograma</summary><p>Selecione um nome para preparar a próxima sugestão. Confirme atribuições e disponibilidade com a instituição.</p>{contactError?<p>Contatos indisponíveis para esta sessão. O responsável pode ser preenchido na ação.</p>:<label>Responsável sugerido <select value={person} onChange={e=>setPerson(e.target.value)}><option value="">Definir na ação</option>{candidates.map(c=><option key={c.id} value={c.id}>{String(c.name)} · {String(c.position)}</option>)}</select></label>}</details>
  <h4>Prioridades sugeridas ({priorities.length})</h4><p>Reúne metas em atenção, achados abertos e exigências documentais sem validação. Ações concluídas não ocultam pendências que continuam abertas nas fontes.</p>{!priorities.length&&<p className="area-note">Sem novas sugestões neste recorte. Confira as ações existentes e atualize suas fontes de acompanhamento.</p>}<div className="action-suggestions">{priorities.slice(0,12).map(s=><article key={s.key}><small>SUGESTÃO PARA REVISÃO</small><h4>{s.title}</h4><p>{String(data.courses.find(c=>c.id===s.course_id)?.name??"Institucional")}</p><p>{s.why}</p><details><summary>Execução e evidências sugeridas</summary><p>{s.how}</p><p>{s.evidence}</p></details>{onDraft&&<button className="corp-login-text-button" onClick={()=>draft(s)}>Preparar esta ação →</button>}</article>)}</div>{priorities.length>12&&<p>Exibindo 12 sugestões. Selecione um curso para detalhar. O relatório inclui todas as sugestões deste recorte.</p>}
 </section>;
}
