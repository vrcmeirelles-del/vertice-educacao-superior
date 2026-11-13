import { HelpLabel } from '@/components/ContextHelp';
import {useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {can,type Role} from "@/lib/area";
import {documentFile} from "@/lib/repository";
import "./recredenciamento-documentos-2017.css";

type Scope="institucional"|"curso";
type Request={id:string;course_id:string|null;document_code:string|null;title:string;semester:string|null;not_applicable:boolean|null;nsa_reason:string|null;assignee_email:string|null;assigned_to:string|null;due_date:string|null;active:boolean};
type Evidence={id:string;request_id:string;file_name:string;storage_path:string;status:string;reference:string|null;upload_note:string|null;review_note:string|null;created_at:string};
type Member={user_id:string;email:string;role:string};
export type ItemDoc={code:string;title:string;hint:string};
const settings={
 institucional:{bucket:"vertice-novo-instrumento-2026-institucional",section:"novo_instrumento_2026_institucional",prefix:"NI26I"},
 curso:{bucket:"vertice-novo-instrumento-2026-cursos",section:"novo_instrumento_2026_curso",prefix:"NI26C"}
};
const options=Array.from({length:12},(_,i)=>({value:(2023+Math.floor(i/2))+"-"+((i%2)+1),label:(2023+Math.floor(i/2))+"/"+((i%2)+1)}));
const stateLabel=(status:string)=>status==="validado"?"Validado":status==="enviado"?"Aguardando análise":status==="devolvido"?"Devolvido para ajustes":status==="nsa"?"Não se aplica":"Sem envio";

export function useNovoInstrumentoDocs2026(institutionId:string,role:Role|null,scope:Scope,courseId:string|null){
 const [requests,setRequests]=useState<Request[]>([]),[files,setFiles]=useState<Evidence[]>([]);
 const [members,setMembers]=useState<Member[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const reload=useCallback(async()=>{
  setBusy(true);setError("");setRequests([]);setFiles([]);
  if(!institutionId||(scope==="curso"&&!courseId)){setBusy(false);return;}
  try{
   const config=settings[scope];
   let query=supabase.from("vertice_repository_requests").select("id,course_id,document_code,title,semester,not_applicable,nsa_reason,assignee_email,assigned_to,due_date,active")
     .eq("institution_id",institutionId).eq("repository_section",config.section).eq("active",true);
   query=scope==="curso"?query.eq("course_id",courseId!):query.is("course_id",null);
   const response=await query.order("created_at",{ascending:false}).limit(1000);
   if(response.error)throw response.error;
   const rs=(response.data??[]) as Request[];
   const fs:Evidence[]=[];
   for(let i=0;i<rs.length;i+=80){
    const ids=rs.slice(i,i+80).map(r=>r.id);
    const fetched=await supabase.from("vertice_repository_files")
      .select("id,request_id,file_name,storage_path,status,reference,upload_note,review_note,created_at")
      .eq("institution_id",institutionId).in("request_id",ids).order("created_at",{ascending:false}).limit(1000);
    if(fetched.error)throw fetched.error;
    fs.push(...(fetched.data??[] as Evidence[]));
   }
   setRequests(rs);setFiles(fs.sort((a,b)=>b.created_at.localeCompare(a.created_at)));
  }catch(e){setError(e instanceof Error?e.message:"Falha ao consultar o acervo privado.");}
  finally{setBusy(false);}
 },[institutionId,scope,courseId]);
 useEffect(()=>{void reload();},[reload]);
 useEffect(()=>{let active=true;setMembers([]);if(can.manageGoals(role)) void supabase.rpc("vertice_team",{target:institutionId}).then(({data,error})=>{if(active&&!error)setMembers((data??[]) as Member[]);});return()=>{active=false;};},[institutionId,role]);
 return {requests,files,members,busy,error,reload,scope,courseId,institutionId};
}
export type NewDocsState=ReturnType<typeof useNovoInstrumentoDocs2026>;

export function NovoDocumentosResumo2026({state}:{state:NewDocsState}){
 const summary=useMemo(()=>{
  const latest=new Map<string,Evidence>();
  for(const f of state.files)if(!latest.has(f.request_id))latest.set(f.request_id,f);
  return {count:state.requests.length,approved:state.requests.filter(r=>latest.get(r.id)?.status==="validado").length,
   waiting:state.requests.filter(r=>latest.get(r.id)?.status==="enviado").length,
   returned:state.requests.filter(r=>latest.get(r.id)?.status==="devolvido").length,
   nsa:state.requests.filter(r=>r.not_applicable).length};
 },[state.requests,state.files]);
 return <section className="rec17-overview" aria-label="Documentos do Novo Instrumento 2026">
  <header><div><h4>Gestão documental · Novo Instrumento 2026</h4><p>Arquivos privados separados por instrumento, instituição, curso (quando aplicável), objeto e período. A proposta é preliminar; documentos enviados não representam conformidade ou conceito oficial.</p></div><button type="button" disabled={state.busy} onClick={()=>void state.reload()}>{state.busy?"Atualizando…":"Atualizar documentos"}</button></header>
  <div className="rec17-summary">
   {([["Exigências cadastradas",summary.count],["Validadas pela gestão",summary.approved],["Aguardando análise",summary.waiting],["Devolvidas",summary.returned],["NSA justificado",summary.nsa]] as [string,number][]).map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}
  </div>
  {state.error&&<p role="alert" className="rec17-error">{state.error}</p>}
  <p className="rec17-help">Selecione um objeto para anexar evidência, indicar responsável, justificar NSA e consultar o histórico de versões. Cada instrumento mantém seu acervo próprio.</p>
 </section>;
}

export function NovoObjetoDocumentos2026({state,role,object,initialPeriod="2026-2"}:{
 state:NewDocsState;role:Role|null;object:ItemDoc;initialPeriod?:string
}){
 const manager=can.manageGoals(role);
 const [period,setPeriod]=useState(initialPeriod);
 const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null);
 const [reference,setReference]=useState(""),[note,setNote]=useState("");
 const [deadline,setDeadline]=useState(""),[assigneeId,setAssigneeId]=useState("");
 const [nsa,setNsa]=useState(false),[nsaReason,setNsaReason]=useState("");
 const [reviewing,setReviewing]=useState<Evidence|null>(null),[decision,setDecision]=useState<"validado"|"devolvido">("validado"),[reviewNote,setReviewNote]=useState("");
 const [saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[showHistory,setShowHistory]=useState(false);
 const config=settings[state.scope];
 const code=config.prefix+":"+object.code+":"+period;
 const request=state.requests.find(r=>r.document_code===code);
 const history=request?state.files.filter(f=>f.request_id===request.id):[];
 const latest=history[0];
 const status=request?.not_applicable?"nsa":latest?.status??"pendente";
 const openForm=()=>{setOpen(true);setError("");setNotice("");setFile(null);setNsa(false);setNote("");setReference("");setNsaReason("");setDeadline(request?.due_date??"");setAssigneeId(request?.assigned_to??"");};
 const ensure=async()=>{
  if(request)return request;
  const r=await supabase.from("vertice_repository_requests").insert({
   institution_id:state.institutionId,course_id:state.scope==="curso"?state.courseId:null,
   repository_section:config.section,document_code:code,
   indicator:object.code,semester:period,
   title:"Evidência do objeto "+object.code+" · "+object.title,
   instructions:"Proposta preliminar 2026. Roteiro: "+object.hint,
   active:true,due_date:deadline||null,assigned_to:assigneeId||null,
   assignee_email:state.members.find(m=>m.user_id===assigneeId)?.email??null
  }).select("id,course_id,document_code,title,semester,not_applicable,nsa_reason,assignee_email,assigned_to,due_date,active").single();
  if(r.error||!r.data)throw r.error??new Error("Exigência não registrada.");
  return r.data as Request;
 };
 async function submit(){
  if(!manager||saving)return;
  setSaving(true);setError("");setNotice("");
  try{
   if(nsa&&!nsaReason.trim())throw new Error("Informe uma justificativa para NSA.");
   if(!nsa&&!file)throw new Error("Selecione um arquivo.");
   const req=await ensure();
   if(nsa){
    const r=await supabase.rpc("vertice_repository_set_nsa",{target:req.id,marked:true,note:nsaReason.trim()});
    if(r.error)throw r.error;
   }else{
    if(!file)throw new Error("Selecione o arquivo.");
    if(req.not_applicable){const r=await supabase.rpc("vertice_repository_set_nsa",{target:req.id,marked:false,note:null});if(r.error)throw r.error;}
    const {ext,mime}=documentFile(file);
    const user=await supabase.auth.getUser();
    if(user.error||!user.data.user)throw new Error("Sessão autenticada necessária.");
    const id=crypto.randomUUID(),path=state.institutionId+"/"+req.id+"/"+id+"."+ext;
    const stored=await supabase.storage.from(config.bucket).upload(path,file,{upsert:false,contentType:mime});
    if(stored.error)throw stored.error;
    const entry=await supabase.from("vertice_repository_files").insert({
     id,institution_id:state.institutionId,request_id:req.id,storage_path:path,
     file_name:file.name.slice(0,250),size_bytes:file.size,mime_type:mime,
     uploaded_by:user.data.user.id,status:"enviado",reference:reference.trim()||null,upload_note:note.trim()||null
    }).select("id").single();
    if(entry.error||!entry.data)throw entry.error??new Error("Registro de entrega não confirmado.");
   }
   await state.reload();setOpen(false);setFile(null);setNotice(nsa?"NSA registrado com justificativa.":"Arquivo recebido para conferência da gestão.");
  }catch(e){setError(e instanceof Error?e.message:"Falha no envio.");}finally{setSaving(false);}
 }
 async function review(){
  if(!manager||!reviewing||saving)return;
  setSaving(true);setError("");
  try{
   if(decision==="devolvido"&&!reviewNote.trim())throw new Error("Justifique a devolução.");
   const r=await supabase.from("vertice_repository_files").update({status:decision,review_note:reviewNote.trim()||null}).eq("id",reviewing.id).select("id").single();
   if(r.error||!r.data)throw r.error??new Error("Parecer não confirmado.");
   await state.reload();setReviewing(null);setNotice("Decisão registrada pela gestão.");
  }catch(e){setError(e instanceof Error?e.message:"Erro na revisão.");}finally{setSaving(false);}
 }
 async function download(f:Evidence){
  setError("");
  const r=await supabase.storage.from(config.bucket).download(f.storage_path);
  if(r.error||!r.data){setError("O arquivo não está disponível para seu perfil.");return;}
  const url=URL.createObjectURL(r.data);
  const a=document.createElement("a");a.href=url;a.download=f.file_name;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 return <div className="rec17-indicator-docs">
  <div className="rec17-indicator-head"><h5>Documentos e evidências · {object.code}</h5><span className={"rec17-status "+(status==="validado"?"rec17-status-validado":status==="enviado"?"rec17-status-enviado":status==="devolvido"?"rec17-status-devolvido":status==="nsa"?"rec17-status-nsa":"rec17-status-pendente")}>{stateLabel(status)}</span></div>
  <p className="rec17-help">{object.hint} — roteiro preliminar, não rol oficial definitivo de exigências.</p>
  <HelpLabel className="rec17-period-filter">Semestre da documentação <select value={period} onChange={e=>{setPeriod(e.target.value);setOpen(false);setReviewing(null);setShowHistory(false);}}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></HelpLabel>
  <div className="rec17-row">
   <div className="rec17-row-main"><strong>{request?.title??"Documento de suporte ao objeto "+object.code}</strong>
    <small>{request?.due_date?"Prazo: "+request.due_date+" · ":""}{request?.assignee_email?"Responsável: "+request.assignee_email:""}</small>
    {latest&&<small>Último envio: {latest.file_name} · {new Date(latest.created_at).toLocaleDateString("pt-BR")}</small>}
    {request?.not_applicable&&<small>NSA: {request.nsa_reason}</small>}
   </div>
   <div className="rec17-actions">
    {latest&&<button type="button" onClick={()=>void download(latest)}>Baixar</button>}
    {history.length>0&&<button type="button" onClick={()=>setShowHistory(x=>!x)} aria-expanded={showHistory}>Histórico ({history.length})</button>}
    {manager&&latest?.status==="enviado"&&<button type="button" onClick={()=>{setReviewing(latest);setReviewNote("");setDecision("validado");}}>Analisar</button>}
    {manager&&<button type="button" onClick={openForm}>{latest?"Nova versão":"Enviar documento"}</button>}
   </div>
   {showHistory&&history.length>0&&<div className="rec17-history"><strong>Versões anteriores</strong>{history.map(f=><div key={f.id}><span>{f.file_name} · {stateLabel(f.status)} · {new Date(f.created_at).toLocaleDateString("pt-BR")}</span><button type="button" onClick={()=>void download(f)}>Baixar</button>{manager&&f.status==="enviado"&&<button type="button" onClick={()=>{setReviewing(f);setReviewNote("");setDecision("validado");}}>Analisar</button>}{f.review_note&&<small>Parecer: {f.review_note}</small>}</div>)}</div>}
  </div>
  {notice&&<p className="rec17-success" role="status">{notice}</p>}
  {error&&<p className="rec17-error" role="alert">{error}</p>}
  {open&&manager&&<div className="rec17-editor" role="group" aria-label={"Enviar documento ao objeto "+object.code}>
    <h5>Registrar evidência · {object.title}</h5>
    <div className="rec17-form-grid">
      <HelpLabel>Semestre de referência<input value={period.replace("-","/")} disabled readOnly/></HelpLabel>
      <HelpLabel>Prazo (opcional)<input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} disabled={!!request}/></HelpLabel>
      <HelpLabel>Responsável pela entrega<select value={assigneeId} onChange={e=>setAssigneeId(e.target.value)} disabled={!!request}><option value="">Gestão da instituição</option>{state.members.filter(m=>["gestor","equipe"].includes(m.role)).map(m=><option key={m.user_id} value={m.user_id}>{m.email}</option>)}</select></HelpLabel>
      <HelpLabel>Tipo de registro<select value={nsa?"nsa":"arquivo"} onChange={e=>setNsa(e.target.value==="nsa")}><option value="arquivo">Arquivo</option><option value="nsa">Não se aplica (NSA)</option></select></HelpLabel>
    </div>
    {nsa?<HelpLabel>Justificativa de não aplicabilidade<textarea required value={nsaReason} onChange={e=>setNsaReason(e.target.value)} maxLength={4000}/></HelpLabel>:<>
      <HelpLabel>Arquivo<input type="file" accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.txt,.csv" onChange={e=>setFile(e.target.files?.[0]??null)}/></HelpLabel>
      <HelpLabel>Referência<input value={reference} maxLength={250} onChange={e=>setReference(e.target.value)} placeholder="Ex.: PDI, relatório de CPA, ata"/></HelpLabel>
      <HelpLabel>Observação de entrega<textarea value={note} maxLength={4000} onChange={e=>setNote(e.target.value)} placeholder="Identifique páginas e critérios atendidos"/></HelpLabel>
    </>}
    <div className="rec17-editor-actions"><button type="button" onClick={()=>setOpen(false)}>Cancelar</button><button type="button" disabled={saving||(!nsa&&!file)||(nsa&&!nsaReason.trim())} onClick={()=>void submit()}>{saving?"Gravando…":nsa?"Registrar NSA":"Enviar evidência"}</button></div>
   </div>}
  {reviewing&&manager&&<div className="rec17-editor"><h5>Analisar versão · {reviewing.file_name}</h5>
    <HelpLabel>Decisão<select value={decision} onChange={e=>setDecision(e.target.value as "validado"|"devolvido")}><option value="validado">Validar</option><option value="devolvido">Devolver</option></select></HelpLabel>
    <HelpLabel>Parecer<textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} maxLength={4000}/></HelpLabel>
    <div className="rec17-editor-actions"><button type="button" onClick={()=>setReviewing(null)}>Cancelar</button><button type="button" disabled={saving||(decision==="devolvido"&&!reviewNote.trim())} onClick={()=>void review()}>{saving?"Salvando…":"Registrar decisão"}</button></div>
   </div>}
 </div>;
}
