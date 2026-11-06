import {useMemo, useState} from "react";
import {ACTION_STATUS, fmtDate, isLate, type Row} from "@/lib/area";
import "./action-kanban.css";

type Props = {
 actions: Row[];
 goals: Row[];
 canEdit: boolean;
 onEdit: (action: Row) => void;
 onMove: (action: Row, status: string) => Promise<void>;
};

const COLUMNS = [
 {status:"nao_iniciada",title:"A fazer",tone:"slate"},
 {status:"em_andamento",title:"Em andamento",tone:"blue"},
 {status:"bloqueada",title:"Bloqueadas",tone:"red"},
 {status:"concluida",title:"Concluídas",tone:"green"},
 {status:"cancelada",title:"Canceladas",tone:"gray"},
] as const;

function initials(name:string) {
 const parts=name.trim().split(/\\s+/).filter(Boolean);
 return parts.slice(0,2).map(p=>p[0]?.toLocaleUpperCase("pt-BR")??"").join("")||"?";
}

function Owner({name,title}:{name:string;title:string}) {
 return <span className="vx-task-owner" title={title+": "+name}>
   <span className="vx-task-avatar" aria-hidden="true">{initials(name)}</span>
   <span><small>{title}</small><strong>{name||"Não atribuído"}</strong></span>
 </span>;
}

export default function ActionKanban({actions,goals,canEdit,onEdit,onMove}:Props) {
 const [search,setSearch]=useState("");
 const [scope,setScope]=useState("ativas");
 const [busy,setBusy]=useState<string|null>(null);
 const [message,setMessage]=useState("");
 const goalById=useMemo(()=>new Map(goals.map(g=>[String(g.id),g])),[goals]);
 const filtered=actions.filter(a=>{
  if(scope==="ativas"&&["concluida","cancelada"].includes(String(a.status)))return false;
  if(scope==="atrasadas"&&!isLate(a.due_date,a.status))return false;
  const goal=goalById.get(String(a.goal_id??""));
  return [a.what,a.who,a.how,goal?.title,goal?.owner_name].some(v=>String(v??"").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
 });
 async function move(action:Row,status:string) {
  if(!canEdit||status===action.status||busy)return;
  setBusy(String(action.id));setMessage("");
  try {await onMove(action,status);setMessage("Situação atualizada e confirmada pelo banco.");}
  catch {setMessage("Não foi possível atualizar a tarefa. Verifique seu acesso e tente novamente.");}
  finally {setBusy(null);}
 }
 const total=filtered.length;
 const completed=filtered.filter(a=>a.status==="concluida").length;
 return <section className="vx-task-board" aria-label="Quadro Kanban de ações 5W2H">
  <div className="vx-task-header"><div><span className="vx-task-eyebrow">GESTÃO VISUAL · MISSÕES E AÇÕES</span><h3>Quadro de execução</h3><p>Cada cartão representa uma ação 5W2H real da instituição. A missão corresponde à meta vinculada.</p></div>
    <div className="vx-task-stats"><span><b>{total}</b> no filtro</span><span><b>{completed}</b> concluídas</span></div>
  </div>
  <div className="vx-task-filters">
   <label>Buscar tarefa ou responsável<input type="search" placeholder="Título, responsável, meta…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <label>Exibir<select value={scope} onChange={e=>setScope(e.target.value)}><option value="ativas">Em aberto</option><option value="todas">Todas</option><option value="atrasadas">Atrasadas</option></select></label>
  </div>
  {message&&<p role="status" className="vx-task-message">{message}</p>}
  <div className="vx-task-scroll"><div className="vx-task-columns">
   {COLUMNS.map(col=><section className={"vx-task-column vx-task-"+col.tone} key={col.status} aria-label={col.title}>
    <h4>{col.title} <span>{filtered.filter(a=>a.status===col.status).length}</span></h4>
    {filtered.filter(a=>a.status===col.status).map(action=>{
     const goal=goalById.get(String(action.goal_id??""));
     const late=isLate(action.due_date,action.status);
     const progress=Math.max(0,Math.min(100,Number(action.progress)||0));
     return <article className="vx-task-card" key={String(action.id)}>
      <div className="vx-task-pill">{goal?"MISSÃO VINCULADA":"AÇÃO AVULSA"}</div>
      <h5>{String(action.what)}</h5>
      {goal&&<p className="vx-task-goal">{String(goal.title)}</p>}
      <div className="vx-task-people">
       <Owner name={String(goal?.owner_name??goal?.owner_email??"")} title="Responsável pela meta"/>
       <Owner name={String(action.who??"")} title="Responsável pela ação"/>
      </div>
      <div className="vx-task-bottom"><span className={late?"vx-task-late":""}>{action.due_date?fmtDate(action.due_date):"Sem prazo"}{late?" · Atrasada":""}</span><b>{progress}%</b></div>
      <div className="vx-task-progress"><span style={{width:progress+"%"}}/></div>
      <div className="vx-task-controls">
       {canEdit?<><label>Alterar situação<select aria-label={"Situação: "+String(action.what)} value={String(action.status)} disabled={busy!==null} onChange={e=>void move(action,e.target.value)}>{ACTION_STATUS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button type="button" onClick={()=>onEdit(action)}>Editar</button></>:<small>Somente leitura</small>}
      </div>
     </article>;
    })}
    {!filtered.some(a=>a.status===col.status)&&<p className="vx-task-empty">Nenhuma ação</p>}
   </section>)}
  </div></div>
  <p className="vx-task-footer">Alterações de situação são persistidas na tabela atual de ações e sujeitas às permissões existentes. Fotografias reais, validação formal e notificações ainda não fazem parte desta etapa.</p>
 </section>;
}
