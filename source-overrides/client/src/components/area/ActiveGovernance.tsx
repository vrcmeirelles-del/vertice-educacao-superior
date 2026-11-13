import { HelpLabel } from '@/components/ContextHelp';
import {useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {fmtDate,type Row} from "@/lib/area";
import "./active-governance.css";

type G={
 action_id:string;institution_id:string;declared_progress:number;validated_progress:number;
 review_status:"rascunho"|"enviado"|"aprovado"|"devolvido";note:string;blocker:string;
 last_actor:string|null;checked_at:string|null;submitted_by:string|null;submitted_at:string|null;
 reviewed_by:string|null;reviewed_at:string|null;review_note:string|null;
};
type Event={id:number;action_id:string;actor:string|null;event_type:string;progress_before:number|null;progress_after:number;event_note:string|null;occurred_at:string};
type Ack={action_id:string;actor:string;acknowledged_at:string};
type Props={institutionId:string;actions:Row[];role:string|null;onChanged:()=>Promise<void>};
type Member={user_id:string;email:string;role:string};
function timeRemaining(date:unknown,clock:number):string{
 if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date))return "Sem vencimento";
 const end=new Date(date+"T23:59:59").getTime(),diff=end-clock;
 if(!Number.isFinite(diff))return "Prazo inválido";
 if(diff<=0)return "Prazo encerrado";
 const days=Math.floor(diff/86400000),hours=Math.floor(diff%86400000/3600000),mins=Math.floor(diff%3600000/60000);
 return days+"d "+String(hours).padStart(2,"0")+"h "+String(mins).padStart(2,"0")+"min";
}
function vitality(g:G|undefined,due:number|null):number|null{
 if(!g)return null;
 const activityDays=g.checked_at?Math.max(0,Math.floor((Date.now()-Date.parse(g.checked_at))/86400000)):null;
 return Math.max(0,Math.min(100,Math.round(
  (g.declared_progress/100)*40
  +(activityDays!==null&&activityDays<=7?25:activityDays!==null&&activityDays<=14?10:0)
  +(g.blocker.trim()?0:15)
  +(due===null?10:due>=7?20:due>=0?10:0)
 )));
}
const formatTime=(value:string|null)=>value?new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"Sem atualização";
const stateName:Record<string,string>={rascunho:"Em execução",enviado:"Aguardando validação",aprovado:"Validada",devolvido:"Devolvida"};
function daysUntil(date:unknown):number|null {
 if(typeof date!=="string"||!/\d{4}-\d{2}-\d{2}/.test(date))return null;
 const now=new Date(),todayUTC=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
 const due=Date.parse(date.slice(0,10)+"T00:00:00Z");
 return Number.isFinite(due)?Math.ceil((due-todayUTC)/86400000):null;
}
export default function ActiveGovernance({institutionId,actions,role,onChanged}:Props){
 const [rows,setRows]=useState<Record<string,G>>({});
 const [events,setEvents]=useState<Event[]>([]);
 const [acknowledgements,setAcknowledgements]=useState<Ack[]>([]);
 const [selected,setSelected]=useState<string>("");
 const [percent,setPercent]=useState(0);
 const [note,setNote]=useState("");
 const [blocker,setBlocker]=useState("");
 const [reviewNote,setReviewNote]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [userId,setUserId]=useState<string|null>(null);
 const [lastRead,setLastRead]=useState<string>("");
 const [clock,setClock]=useState(()=>Date.now());
 const [members,setMembers]=useState<Member[]>([]);
 const [assigned,setAssigned]=useState("");
 useEffect(()=>{const handle=window.setInterval(()=>setClock(Date.now()),60000);return()=>window.clearInterval(handle);},[]);
 const reviewer=role==="master"||role==="gestor";
 const contributor=reviewer||role==="equipe";
 const load=useCallback(async()=>{
  const [{data,error:dbError},{data:history,error:eventsError},{data:user},{data:acks,error:ackError}]=await Promise.all([
    supabase.from("vertice_action_governance").select("*").eq("institution_id",institutionId),
    supabase.from("vertice_action_governance_events").select("*").eq("institution_id",institutionId).order("occurred_at",{ascending:false}).limit(300),
    supabase.auth.getUser(),
    supabase.from("vertice_action_acknowledgements").select("action_id,actor,acknowledged_at").eq("institution_id",institutionId).order("acknowledged_at",{ascending:false}).limit(500)
  ]);
  if(dbError||eventsError||ackError){setError("Governança indisponível: confira se a migração foi aplicada e se seu perfil permite leitura.");return;}
  setRows(Object.fromEntries(((data??[]) as G[]).map(r=>[r.action_id,r])));
  setEvents((history??[]) as Event[]);
  setAcknowledgements((acks??[]) as Ack[]);
  setUserId(user.user?.id??null);setLastRead(new Date().toISOString());
 },[institutionId]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(!reviewer)return;let current=true;void supabase.rpc("vertice_team",{target:institutionId}).then(({data,error})=>{
  if(current&&!error)setMembers(((data??[]) as Member[]).filter(x=>["gestor","equipe"].includes(x.role)));
 });return()=>{current=false;};},[institutionId,reviewer]);
 const selectedAction=useMemo(()=>actions.find(a=>String(a.id)===selected),[actions,selected]);
 const current=rows[selected]??null;
 const pending=Object.values(rows).filter(g=>g.review_status==="enviado").length;
 const overdue=actions.filter(a=>{const days=daysUntil(a.due_date);return days!==null&&days<0&&!["concluida","cancelada"].includes(String(a.status));}).length;
 const inactive=Object.values(rows).filter(g=>g.review_status==="rascunho"&&g.checked_at&&Date.now()-Date.parse(g.checked_at)>7*86400000).length;
 function open(action:Row){
  const id=String(action.id),g=rows[id];setSelected(id);setPercent(g?.declared_progress??Number(action.progress??0));
  setNote(g?.note??"");setBlocker(g?.blocker??"");setReviewNote("");setAssigned(String(action.responsible_user_id??""));setError("");setSuccess("");
 }
 async function save(kind:"checkin"|"enviado"|"aprovado"|"devolvido"){
  if(!selectedAction||busy)return;setError("");setSuccess("");setBusy(true);
  try{
   const {error:failure}=kind==="checkin"
    ?await supabase.rpc("vertice_action_checkin",{p_action:selected,p_progress:percent,p_note:note.trim(),p_blocker:blocker.trim()})
    :await supabase.rpc("vertice_action_review",{p_action:selected,p_decision:kind,p_note:reviewNote.trim()});
   if(failure)throw failure;
   await load();await onChanged();
   setSuccess(kind==="checkin"?"Check-in gravado com autoria e data.":kind==="enviado"?"Entrega enviada à instância superior.":kind==="aprovado"?"Validação registrada.":"Devolução registrada com justificativa.");
  }catch(e){setError((e as {message?:string})?.message??"Operação não concluída.");}
  finally{setBusy(false);}
 }
 const active=selectedAction?daysUntil(selectedAction.due_date):null;
 const history=events.filter(e=>e.action_id===selected).slice(0,12);
 const lastAcknowledgement=acknowledgements.find(a=>a.action_id===selected);
 const vitalityScore=vitality(current,active);
 const alerts=actions.flatMap(action=>{
  const remain=daysUntil(action.due_date),g=rows[String(action.id)];
  const alert=remain!==null&&remain<0?"Vencida":remain!==null&&[15,7,3,1,0].includes(remain)?"Prazo: "+(remain===0?"hoje":remain+" dia(s)"):"";
  const approval=g?.review_status==="enviado"?"Aguardando decisão superior":"";
  const inactive=g?.checked_at&&Date.now()-Date.parse(g.checked_at)>7*86400000?"Sem check-in há mais de 7 dias":"";
  return [alert,approval,inactive].filter(Boolean).map(kind=>({kind,action:String(action.what),id:String(action.id)}));
 }).slice(0,12);
 async function acknowledge(){
  if(!selectedAction||!contributor||busy)return;setBusy(true);setError("");setSuccess("");
  try {
   const {error:failure}=await supabase.rpc("vertice_action_acknowledge",{p_action:selected});
   if(failure)throw failure;
   await load();
   setSuccess("Ciência registrada com sua identificação e data. O registro não contabiliza tempo online.");
  } catch(e){setError((e as {message?:string})?.message??"Não foi possível registrar ciência.");}
  finally{setBusy(false);}
 }
 async function assignExecutor(){
  if(!selectedAction||!reviewer||busy)return;setBusy(true);setError("");setSuccess("");
  try{
   const {data,error}=await supabase.from("vertice_actions").update({responsible_user_id:assigned||null}).eq("id",selected).eq("institution_id",institutionId).select("id").single();
   if(error||!data)throw error??new Error("Atribuição não confirmada");
   await onChanged();setSuccess("Executor vinculado à conta institucional.");
  }catch(e){setError((e as {message?:string})?.message??"Não foi possível atribuir o executor.");}
  finally{setBusy(false);}
 }
 return <section className="vx-active-gov" aria-label="Governança ativa das ações">
  <div className="vx-active-gov-title"><div><span>GOVERNANÇA ATIVA</span><h3>Execução, prazos e validações</h3><p>Progresso informado é diferente de entrega aprovada. Acompanhamento por eventos relevantes, sem vigilância de tempo online.</p></div>
   <button type="button" onClick={()=>void load()}>Atualizar registros</button></div>
  <div className="vx-active-gov-kpis"><div><small>Em validação</small><strong>{pending}</strong></div><div><small>Ações vencidas</small><strong>{overdue}</strong></div><div><small>Sem check-in há 7 dias</small><strong>{inactive}</strong></div><div><small>Última leitura</small><span>{lastRead?formatTime(lastRead):"Carregando"}</span></div></div>
  {alerts.length>0&&<details className="vx-active-gov-alerts"><summary>Central de alertas · {alerts.length} ocorrência(s)</summary>
   <ul>{alerts.map((a,i)=><li key={a.id+"-"+i}><strong>{a.kind}</strong> — {a.action}</li>)}</ul>
   <small>Alertas internos calculados a partir dos registros; não são mensagens externas nem notificações enviadas.</small>
  </details>}
  <div className="vx-active-gov-grid"><div className="vx-active-gov-list"><h4>Selecione uma missão</h4>
   {actions.filter(a=>!["cancelada"].includes(String(a.status))).map(a=>{
    const g=rows[String(a.id)],remaining=daysUntil(a.due_date);
    const state=g?.review_status??"rascunho";const elapsed=g?.checked_at?Math.floor((Date.now()-Date.parse(g.checked_at))/86400000):null;
    return <button type="button" className={selected===String(a.id)?"chosen":""} key={String(a.id)} onClick={()=>open(a)}>
     <strong>{String(a.what)}</strong><span>{stateName[state]} · {g?.declared_progress??a.progress??0}% informado</span>
     <small>{remaining===null?"Sem prazo":remaining<0?Math.abs(remaining)+" dia(s) vencido(s)":remaining===0?"Vence hoje":remaining+" dia(s) restantes"} · {elapsed===null?"Sem check-in":elapsed+" dia(s) desde a atividade"}</small>
    </button>;
   })}
   {!actions.length&&<p>Sem ações cadastradas no plano 5W2H.</p>}
  </div>
  <div className="vx-active-gov-detail">
   {!selectedAction?<p>Escolha uma ação para atualizar o avanço e consultar o histórico.</p>:<>
    <h4>{String(selectedAction.what)}</h4>
    <div className="vx-active-gov-deadline"><strong>{active===null?"Sem vencimento":active<0?"Vencida há "+Math.abs(active)+" dia(s)":active===0?"Vence hoje":active+" dia(s) para vencer"}</strong><small>Contagem regressiva: {timeRemaining(selectedAction.due_date,clock)} · Prazo: {selectedAction.due_date?fmtDate(selectedAction.due_date):"Não definido"}</small></div>
    <div className="vx-active-gov-vitality"><span>Vitalidade operacional: <b>{vitalityScore===null?"Sem check-in":vitalityScore+"/100"}</b></span><small>Critérios: progresso (40), atualização nos últimos 7 dias (25), ausência de bloqueio (15), prazo (20). Não equivale à aprovação.</small></div>
    {reviewer&&<HelpLabel>Executor responsável (conta institucional)
     <select value={assigned} onChange={e=>setAssigned(e.target.value)}><option value="">Sem vínculo nominal</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.email} · {m.role}</option>)}</select>
     <button type="button" disabled={busy||assigned===String(selectedAction.responsible_user_id??"")} onClick={()=>void assignExecutor()}>Salvar atribuição</button>
    </HelpLabel>}
    <div className="vx-active-gov-pair"><span>Declarado: <b>{current?.declared_progress??selectedAction.progress??0}%</b></span><span>Validado: <b>{current?.validated_progress??0}%</b></span></div>
    <p><strong>Situação da prestação de contas:</strong> {stateName[current?.review_status??"rascunho"]}</p>
    <div className="vx-active-gov-ack"><span><strong>Última ciência da tarefa:</strong> {lastAcknowledgement?formatTime(lastAcknowledgement.acknowledged_at):"Ainda não registrada"}</span>
    {contributor&&<button type="button" disabled={busy} onClick={()=>void acknowledge()}>Registrar que tomei ciência</button>}</div>
    {contributor&&(!current||current.review_status==="rascunho"||current.review_status==="devolvido")&&<>
     <HelpLabel className="vx-active-gov-progress">Progresso da execução <b>{percent}%</b><input type="range" min="0" max="100" step="5" value={percent} onChange={e=>setPercent(Number(e.target.value))}/></HelpLabel>
     <HelpLabel>O que foi realizado? <textarea maxLength={3000} rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Descreva a entrega, o link da evidência ou a atividade realizada"/></HelpLabel>
     <HelpLabel>O que está impedindo o avanço? <textarea maxLength={2000} rows={2} value={blocker} onChange={e=>setBlocker(e.target.value)} placeholder="Opcional: obstáculo ou dependência"/></HelpLabel>
     <div className="vx-active-gov-buttons"><button type="button" disabled={busy} onClick={()=>void save("checkin")}>Registrar check-in</button>
     {current&&current.declared_progress===100&&current.note.trim().length>=5&&<button type="button" disabled={busy} onClick={()=>void save("enviado")}>Enviar para validação</button>}</div>
    </>}
    {reviewer&&current?.review_status==="enviado"&&<>
     <HelpLabel>Justificativa da decisão<textarea rows={2} maxLength={3000} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Motivo da validação ou correções solicitadas"/></HelpLabel>
     {current.submitted_by===userId?<p role="status">O responsável pelo envio não pode aprovar a própria entrega.</p>:<div className="vx-active-gov-buttons"><button type="button" disabled={busy||reviewNote.trim().length<5} onClick={()=>void save("aprovado")}>Validar entrega</button><button type="button" disabled={busy||reviewNote.trim().length<5} onClick={()=>void save("devolvido")}>Devolver para ajuste</button></div>}
    </>}
    {current?.review_status==="devolvido"&&<p><strong>Justificativa da devolução:</strong> {current.review_note??"Não informada"}</p>}
    {current?.review_status==="aprovado"&&<p>Validação registrada em {formatTime(current.reviewed_at)}. As evidências devem permanecer acessíveis no repositório.</p>}
    <h5>Trilha de auditoria</h5>
    <ol className="vx-active-gov-history">{history.map(e=><li key={e.id}><strong>{({checkin:"Check-in",envio:"Enviado",aprovacao:"Aprovado",devolucao:"Devolvido"} as Record<string,string>)[e.event_type]??e.event_type}</strong> · {formatTime(e.occurred_at)} · {e.progress_after}%<span>{e.event_note??""}</span></li>)}</ol>
    {!history.length&&<p>Não há movimentações registradas nesta ação.</p>}
   </>}
  </div></div>
  {error&&<p role="alert" className="vx-active-gov-error">{error}</p>}{success&&<p role="status" className="vx-active-gov-success">{success}</p>}
 </section>;
}
