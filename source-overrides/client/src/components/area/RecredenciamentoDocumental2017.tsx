import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {supabase} from "@/lib/supabase";
import {can,type Role} from "@/lib/area";
import {documentFile} from "@/lib/repository";
import type {IndicadorAvaliacao} from "@/lib/avaliacao-institucional";
import "./recredenciamento-documentos-2017.css";

export const REC2017_BUCKET="vertice-recredenciamento-2017";
export const REC2017_SECTION="recredenciamento_2017";
type Req={id:string;institution_id:string;indicator:string|null;document_code:string|null;title:string;instructions:string|null;semester:string|null;not_applicable:boolean|null;nsa_reason:string|null;due_date:string|null;assignee_email:string|null;assigned_to:string|null;active:boolean};
type Doc={id:string;request_id:string;file_name:string;storage_path:string;status:string;review_note:string|null;reference:string|null;created_at:string;size_bytes:number};
type Kind="obrig"|"compl"|"resultado";
type Item={id:string;kind:Kind;position:number;title:string};
const KINDS:Record<Kind,string>={obrig:"Evidência obrigatória",compl:"Evidência complementar",resultado:"Evidência de resultado"};
const STATUS:Record<string,string>={enviado:"Aguardando validação",validado:"Validado",devolvido:"Devolvido para ajustes"};
const codeFor=(indicator:string,kind:Kind,index:number,semester:string)=>"R2017:"+indicator+":"+kind+":"+index+":"+semester;
const itemsOf=(indicator:IndicadorAvaliacao,semester:string):Item[]=>
  (["obrig","compl","resultado"] as Kind[]).flatMap(kind=>(indicator[kind]??[]).map((title,index)=>({id:codeFor(indicator.code,kind,index,semester),kind,position:index,title})));
const dateDefault=()=>{const today=new Date();return today.getFullYear()+"-"+(today.getMonth()<6?"1":"2");};
const statusClass=(v:string)=>v==="validado"?"rec17-status-validado":v==="devolvido"?"rec17-status-devolvido":v==="nsa"?"rec17-status-nsa":v==="enviado"?"rec17-status-enviado":"rec17-status-pendente";

export function useRecredenciamentoDocs2017(institutionId:string){
  const [requests,setRequests]=useState<Req[]>([]);
  const [files,setFiles]=useState<Doc[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const reload=useCallback(async()=>{
    if(!institutionId){setRequests([]);setFiles([]);return;}
    setBusy(true);setError("");
    try{
      const a=await supabase.from("vertice_repository_requests")
        .select("id,institution_id,indicator,document_code,title,instructions,semester,not_applicable,nsa_reason,due_date,assignee_email,assigned_to,active")
        .eq("institution_id",institutionId).eq("repository_section",REC2017_SECTION)
        .order("created_at",{ascending:false}).limit(1000);
      if(a.error)throw a.error;
      const rs=(a.data??[]) as Req[];
      const ids=new Set(rs.map(r=>r.id));
      const idsArray=[...ids];
      const chunks:Array<Doc>=[];
      for(let start=0;start<idsArray.length;start+=80){
        const fileResult=await supabase.from("vertice_repository_files")
          .select("id,request_id,file_name,storage_path,status,review_note,reference,created_at,size_bytes")
          .eq("institution_id",institutionId).in("request_id",idsArray.slice(start,start+80))
          .order("created_at",{ascending:false}).limit(1000);
        if(fileResult.error)throw fileResult.error;
        chunks.push(...((fileResult.data??[]) as Doc[]));
      }
      setRequests(rs);setFiles(chunks.sort((x,y)=>y.created_at.localeCompare(x.created_at)));
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar o repositório de recredenciamento.");}
    finally{setBusy(false);}
  },[institutionId]);
  useEffect(()=>{void reload();},[reload]);
  const summary=useMemo(()=>{
    const latest=new Map<string,Doc>();
    for(const f of files)if(!latest.has(f.request_id))latest.set(f.request_id,f);
    return {requests:requests.filter(r=>r.active!==false).length,
      validated:requests.filter(r=>latest.get(r.id)?.status==="validado").length,
      pending:requests.filter(r=>r.active!==false&&!r.not_applicable&&!latest.has(r.id)).length,
      sent:requests.filter(r=>latest.get(r.id)?.status==="enviado").length,
      returned:requests.filter(r=>latest.get(r.id)?.status==="devolvido").length,
      nsa:requests.filter(r=>r.not_applicable).length};
  },[requests,files]);
  return {requests,files,busy,error,reload,summary};
}
export type RecredDocsState=ReturnType<typeof useRecredenciamentoDocs2017>;

export function Recred2017Overview({state}:{state:RecredDocsState}){
  return <section className="rec17-overview" aria-label="Gestão documental do Recredenciamento 2017">
    <header><div><h4>Repositório documental exclusivo · Recredenciamento 2017</h4><p>As evidências deste instrumento são armazenadas em área privada separada do Reconhecimento de Curso. Documentos só contam como validados após conferência da gestão.</p></div>
      <button type="button" onClick={()=>void state.reload()} disabled={state.busy}>{state.busy?"Consultando…":"Atualizar documentos"}</button>
    </header>
    <div className="rec17-summary">
      <div><small>Exigências cadastradas</small><strong>{state.summary.requests}</strong></div>
      <div><small>Validadas</small><strong>{state.summary.validated}</strong></div>
      <div><small>Aguardando análise</small><strong>{state.summary.sent}</strong></div>
      <div><small>Devolvidas</small><strong>{state.summary.returned}</strong></div>
      <div><small>NSA justificado</small><strong>{state.summary.nsa}</strong></div>
    </div>
    {state.error&&<p role="alert" className="rec17-error">{state.error}</p>}
    <p className="rec17-help">Abra um indicador e selecione a evidência exigida para cadastrar o documento, anexar o arquivo, revisar ou justificar a não aplicabilidade. O painel usa o mesmo ciclo documental do Reconhecimento de Curso, sem misturar os respectivos acervos.</p>
  </section>;
}

export function Recred2017IndicatorDocs({institutionId,role,indicador,state}:{
  institutionId:string;role:Role|null;indicador:IndicadorAvaliacao;state:RecredDocsState
}){
  const manager=can.manageGoals(role);
  const [period,setPeriod]=useState("2026-2");
  const [selected,setSelected]=useState<Item|null>(null);
  const [file,setFile]=useState<File|null>(null);
  const [reference,setReference]=useState("");
  const [note,setNote]=useState("");
  const [semester,setSemester]=useState(dateDefault());
  const [deadline,setDeadline]=useState("");
  const [assigneeId,setAssigneeId]=useState("");
  const [members,setMembers]=useState<{user_id:string;email:string;role:string}[]>([]);
  const [nsa,setNsa]=useState(false);
  const [justification,setJustification]=useState("");
  const [review,setReview]=useState<Doc|null>(null);
  const [decision,setDecision]=useState<"validado"|"devolvido">("validado");
  const [reviewNote,setReviewNote]=useState("");
  const [actionBusy,setActionBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{let active=true;if(manager){void supabase.rpc("vertice_team",{target:institutionId}).then(({data,error})=>{if(active&&!error)setMembers((data??[]) as {user_id:string;email:string;role:string}[]);});}return()=>{active=false;};},[institutionId,manager]);
  const items=useMemo(()=>itemsOf(indicador,period),[indicador,period]);
  const byCode=useMemo(()=>new Map(state.requests.filter(r=>r.active!==false).map(r=>[r.document_code??"",r])),[state.requests]);
  const latest=useMemo(()=>{
    const by=new Map<string,Doc>();
    for(const f of state.files)if(!by.has(f.request_id))by.set(f.request_id,f);
    return by;
  },[state.files]);
  const statusOf=(item:Item)=>{
    const r=byCode.get(item.id);if(!r)return "pendente";
    if(r.not_applicable)return "nsa";
    return latest.get(r.id)?.status??"pendente";
  };
  const openForm=(item:Item)=>{
    const req=byCode.get(item.id);
    setSelected(item);setFile(null);setNsa(false);setError("");setMessage("");
    setReference("");setNote("");setJustification("");setDeadline(req?.due_date??"");
    setAssigneeId(req?.assigned_to??"");setSemester(period);
  };
  async function ensureRequest(item:Item){
    const old=byCode.get(item.id);if(old)return old;
    const {data,error:e}=await supabase.from("vertice_repository_requests").insert({
      institution_id:institutionId,course_id:null,goal_id:null,
      repository_section:REC2017_SECTION,document_code:item.id,
      indicator:indicador.code,semester,title:item.title,
      instructions:KINDS[item.kind]+" · Eixo "+indicador.axis+" · Indicador "+indicador.code,
      due_date:deadline||null,assigned_to:assigneeId||null,
      assignee_email:members.find(m=>m.user_id===assigneeId)?.email??null,
      active:true
    }).select("id,document_code,institution_id,indicator,title,instructions,semester,not_applicable,nsa_reason,due_date,assignee_email,assigned_to,active").single();
    if(e||!data)throw e??new Error("Exigência não cadastrada");
    return data as Req;
  }
  async function submit(){
    if(!selected||actionBusy||!manager)return;
    setActionBusy(true);setError("");setMessage("");
    try{
      if(!nsa&&!file)throw new Error("Selecione um arquivo para anexar.");
      if(nsa&&!justification.trim())throw new Error("Informe a justificativa de não aplicabilidade.");
      const req=await ensureRequest(selected);
      if(nsa){
        const result=await supabase.rpc("vertice_repository_set_nsa",{target:req.id,marked:true,note:justification.trim()});
        if(result.error)throw result.error;
        setMessage("Não aplicabilidade registrada com justificativa.");
      }else{
        if(!file)throw new Error("Selecione o arquivo.");
        if(req.not_applicable){
          const unmark=await supabase.rpc("vertice_repository_set_nsa",{target:req.id,marked:false,note:null});
          if(unmark.error)throw unmark.error;
        }
        const {ext,mime}=documentFile(file);
        const {data:auth,error:authError}=await supabase.auth.getUser();
        if(authError||!auth.user)throw new Error("Sessão autenticada necessária.");
        const id=crypto.randomUUID();
        const path=institutionId+"/"+req.id+"/"+id+"."+ext;
        const saved=await supabase.storage.from(REC2017_BUCKET).upload(path,file,{contentType:mime,upsert:false});
        if(saved.error)throw saved.error;
        const registration=await supabase.from("vertice_repository_files").insert({
          id,institution_id:institutionId,request_id:req.id,storage_path:path,
          file_name:file.name.slice(0,250),size_bytes:file.size,mime_type:mime,
          uploaded_by:auth.user.id,status:"enviado",
          reference:reference.trim()||null,upload_note:note.trim()||null
        }).select("id").single();
        if(registration.error)throw new Error("Arquivo enviado, mas o registro da entrega falhou. Informe à gestão para conciliar o envio: "+registration.error.message);
        setMessage("Arquivo recebido; aguardando análise da gestão.");
      }
      await state.reload();
      setSelected(null);setFile(null);
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível registrar a evidência.");}
    finally{setActionBusy(false);}
  }
  async function reviewFile(){
    if(!review||actionBusy||!manager)return;
    setActionBusy(true);setError("");
    try{
      if(decision==="devolvido"&&!reviewNote.trim())throw new Error("Informe o motivo da devolução.");
      const result=await supabase.from("vertice_repository_files").update({
        status:decision,review_note:reviewNote.trim()||null
      }).eq("id",review.id).select("id").single();
      if(result.error)throw result.error;
      await state.reload();setReview(null);setMessage("Análise documental registrada.");
    }catch(e){setError(e instanceof Error?e.message:"A análise não foi gravada.");}
    finally{setActionBusy(false);}
  }
  async function download(f:Doc){
    setError("");
    const {data,error:e}=await supabase.storage.from(REC2017_BUCKET).download(f.storage_path);
    if(e||!data){setError("Arquivo não disponível para este perfil ou documento inexistente.");return;}
    const blobUrl=URL.createObjectURL(data);
    const a=document.createElement("a");a.href=blobUrl;a.download=f.file_name;a.click();
    window.setTimeout(()=>URL.revokeObjectURL(blobUrl),30000);
  }
  const total=items.length,validated=items.filter(i=>statusOf(i)==="validado").length;
  const pending=items.filter(i=>statusOf(i)==="enviado").length;
  return <section className="rec17-indicator-docs" aria-label={"Documentos do indicador "+indicador.code}>
    <div className="rec17-indicator-head"><h5>Formulários e evidências do indicador {indicador.code}</h5>
      <span>{validated}/{total} validadas · {pending} em análise</span></div>
    <p className="rec17-help">Cada evidência possui cadastro próprio, histórico de arquivos, decisão da gestão e justificativa de NSA. Nenhuma entrega altera automaticamente o conceito institucional simulado.</p>
    <label className="rec17-period-filter">Semestre da documentação <select value={period} onChange={e=>{setPeriod(e.target.value);setSelected(null);setReview(null);}}>{Array.from({length:12},(_,i)=>{const year=2023+Math.floor(i/2);const val=year+"-"+(i%2+1);return <option key={val} value={val}>{year}/{i%2+1}</option>;})}</select></label>
    {(["obrig","compl","resultado"] as Kind[]).map(kind=>{
      const list=items.filter(x=>x.kind===kind);
      return <div key={kind} className="rec17-kind">
        <strong>{KINDS[kind]}</strong>
        {!list.length?<p>Não há item descrito nessa categoria para este indicador.</p>:
        <div className="rec17-rows">{list.map(item=>{
          const req=byCode.get(item.id),f=req?latest.get(req.id):undefined,status=statusOf(item);
          return <div className="rec17-row" key={item.id}>
            <div className="rec17-row-main"><strong>{item.title}</strong>
              <small>{req?.semester?"Referência "+req.semester+" · ":""}{req?.assignee_email?"Responsável: "+req.assignee_email+" · ":""}{req?.due_date?"Prazo "+req.due_date:""}</small>
              {f&&<small>Última entrega: {f.file_name} · {new Date(f.created_at).toLocaleDateString("pt-BR")}{f.review_note?" · Análise: "+f.review_note:""}</small>}
              {req?.not_applicable&&req.nsa_reason&&<small>NSA: {req.nsa_reason}</small>}
            </div>
            <span className={"rec17-status "+statusClass(status)}>{status==="pendente"?"Sem envio":status==="nsa"?"Não se aplica":STATUS[status]??status}</span>
            <div className="rec17-actions">
              {f&&<button type="button" onClick={()=>void download(f)}>Baixar</button>}
              {manager&&f?.status==="enviado"&&<button type="button" onClick={()=>{setReview(f);setReviewNote("");setDecision("validado");}}>Analisar</button>}
              {manager&&<button type="button" onClick={()=>openForm(item)}>{f?"Nova versão":"Enviar documento"}</button>}
            </div>
          </div>;
        })}</div>}
      </div>;
    })}
    {message&&<p role="status" className="rec17-success">{message}</p>}
    {error&&<p role="alert" className="rec17-error">{error}</p>}
    {selected&&<div className="rec17-editor" role="group" aria-label="Formulário de entrega da evidência">
      <h5>Registrar evidência · Indicador {indicador.code}</h5><p>{selected.title}</p>
      <div className="rec17-form-grid">
        <label>Semestre de referência<select value={semester} onChange={e=>setSemester(e.target.value)} disabled={Boolean(byCode.get(selected.id))||actionBusy}>
          {Array.from({length:12},(_,i)=>{const year=2023+Math.floor(i/2);const v=year+"-"+(i%2+1);return <option value={v} key={v}>{year}/{i%2+1}</option>;})}
        </select></label>
        <label>Data limite (opcional)<input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} disabled={Boolean(byCode.get(selected.id))||actionBusy}/></label>
        <label>Responsável autorizado (opcional)<select value={assigneeId} onChange={e=>setAssigneeId(e.target.value)} disabled={Boolean(byCode.get(selected.id))||actionBusy}><option value="">Gestão institucional</option>{members.filter(m=>["gestor","equipe"].includes(m.role)).map(m=><option key={m.user_id} value={m.user_id}>{m.email} · {m.role}</option>)}</select></label>
        <label>Tipo de entrega<select value={nsa?"nsa":"arquivo"} onChange={e=>setNsa(e.target.value==="nsa")} disabled={actionBusy}>
          <option value="arquivo">Enviar arquivo</option><option value="nsa">Não se aplica (NSA)</option>
        </select></label>
      </div>
      {nsa?<label>Justificativa de NSA<textarea value={justification} onChange={e=>setJustification(e.target.value)} maxLength={4000} required placeholder="Explique por que esta evidência não se aplica à instituição"/></label>:
      <>
        <input ref={input} type="file" accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.txt,.csv" onChange={e=>setFile(e.target.files?.[0]??null)} disabled={actionBusy}/>
        <label>Referência do documento (opcional)<input value={reference} maxLength={250} onChange={e=>setReference(e.target.value)} placeholder="Ex.: Ata de reunião nº 03/2026"/></label>
        <label>Observações de envio<textarea value={note} maxLength={4000} onChange={e=>setNote(e.target.value)} placeholder="Descreva qual requisito é atendido e onde localizar a evidência no arquivo"/></label>
      </>}
      <div className="rec17-editor-actions"><button type="button" onClick={()=>{setSelected(null);setFile(null);}}>Cancelar</button>
        <button type="button" disabled={actionBusy||(!file&&!nsa)||(nsa&&!justification.trim())} onClick={()=>void submit()}>{actionBusy?"Registrando…":nsa?"Registrar NSA":"Enviar evidência"}</button></div>
    </div>}
    {review&&<div className="rec17-editor" role="group" aria-label="Formulário de validação">
      <h5>Análise pela gestão</h5><p>{review.file_name}</p>
      <label>Decisão<select value={decision} onChange={e=>setDecision(e.target.value as "validado"|"devolvido")}><option value="validado">Validar documento</option><option value="devolvido">Devolver para ajustes</option></select></label>
      <label>Parecer / justificativa<textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} maxLength={4000} placeholder="Descreva a conferência e eventuais pendências"/></label>
      <div className="rec17-editor-actions"><button type="button" onClick={()=>setReview(null)}>Cancelar</button><button type="button" disabled={actionBusy||(decision==="devolvido"&&!reviewNote.trim())} onClick={()=>void reviewFile()}>{actionBusy?"Salvando…":"Registrar decisão"}</button></div>
    </div>}
  </section>;
}
