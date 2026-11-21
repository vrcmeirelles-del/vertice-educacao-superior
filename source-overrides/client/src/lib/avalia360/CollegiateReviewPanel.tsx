import {useEffect,useState} from 'react';
import {loadAssessmentDraft,type StoredAssessmentDraft} from './draft-api';
import {checkAssessment,checklistQuestionsFromSnapshot,RETURN_REASONS,type ReturnReason} from './item-checklist';
import {decideReview,listReviewQueue,loadReviewHistory,loadReviewIndicators,ReviewError,
 type QueueItem,type ReviewEvent,type ReviewIndicators} from './review-api';
import ChecklistPanel from './ChecklistPanel';
import SavedPreview from './SavedDraftPreview';

const blue='#164B92',line='#DCE7F4';
const btn=(primary:boolean)=>({padding:'9px 14px',borderRadius:9,border:'1px solid '+blue,background:primary?blue:'#fff',
 color:primary?'#fff':blue,fontWeight:700,cursor:'pointer'} as const);
const reasonLabel=Object.fromEntries(RETURN_REASONS) as Record<ReturnReason,string>;
const actionLabel={submitted:'Enviado para validação',validated:'Validado',returned:'Devolvido ao autor'} as const;

export function ReviewHistory({events}:{events:ReviewEvent[]}){
 if(!events.length)return null;
 return <ol style={{margin:'8px 0',paddingLeft:18,fontSize:13}}>
  {events.map((e,i)=><li key={i} style={{marginBottom:6}}>
   <strong>{actionLabel[e.action]}</strong> · versão {e.revision} · {new Date(e.createdAt).toLocaleString('pt-BR')}
   {e.reasons.length>0&&<> · motivos: {e.reasons.map(r=>reasonLabel[r]||r).join('; ')}</>}
   {e.justification&&<div style={{whiteSpace:'pre-wrap',color:'#41566F'}}>{e.justification}</div>}
  </li>)}
 </ol>;
}

/** Fila e decisão do colegiado. A RPC define quem pode ver e decidir. */
export default function CollegiateReviewPanel({institutionId,courseId}:{institutionId:string;courseId:string}){
 const [queue,setQueue]=useState<QueueItem[]|null>(null);
 const [ind,setInd]=useState<ReviewIndicators|null>(null);
 const [denied,setDenied]=useState(false);
 const [open,setOpen]=useState<{item:QueueItem;draft:StoredAssessmentDraft;history:ReviewEvent[]}|null>(null);
 const [reasons,setReasons]=useState<ReturnReason[]>([]);
 const [justification,setJustification]=useState('');
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState('');
 useEffect(()=>{setQueue(null);setInd(null);setDenied(false);setOpen(null);setMsg('');},[institutionId,courseId]);
 const load=async()=>{
  setBusy(true);setMsg('');
  try{
   const [q,i]=await Promise.all([listReviewQueue(institutionId,courseId),loadReviewIndicators(institutionId,courseId)]);
   setQueue(q);setInd(i);setDenied(false);
  }catch(e){
   if(e instanceof ReviewError&&e.code==='42501')setDenied(true);
   else setMsg(e instanceof Error?e.message:'Fila indisponível.');
  }finally{setBusy(false);}
 };
 const inspect=async(item:QueueItem)=>{
  setBusy(true);setMsg('');setReasons([]);setJustification('');
  try{
   const found=await loadAssessmentDraft({institutionId,courseId,disciplineId:item.discipline,draftId:item.id});
   if(!found.ok)throw new Error(found.error.message);
   const history=await loadReviewHistory(institutionId,courseId,item.id);
   setOpen({item,draft:found.draft,history});
  }catch(e){setMsg(e instanceof Error?e.message:'Não foi possível abrir o caderno.');}
  finally{setBusy(false);}
 };
 const decide=async(decision:'validate'|'return')=>{
  if(!open)return;
  if(justification.trim().length<10){setMsg('Justifique a decisão (mínimo de 10 caracteres).');return;}
  if(decision==='return'&&!reasons.length){setMsg('Indique ao menos um motivo da devolução.');return;}
  setBusy(true);setMsg('');
  try{
   await decideReview(institutionId,courseId,{id:open.item.id,revision:open.draft.revision,decision,justification:justification.trim(),reasons:decision==='return'?reasons:[]});
   setMsg(decision==='validate'?'Caderno validado. A versão '+open.draft.revision+' fica registrada e imutável.':'Caderno devolvido ao autor com os motivos indicados.');
   setOpen(null);await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Decisão não registrada.');}
  finally{setBusy(false);}
 };
 const checklist=open?checkAssessment(checklistQuestionsFromSnapshot(open.draft.snapshot.questions),{
  requiredCompetencyIds:open.draft.snapshot.meta?.declaredPedagogy?.requiredCompetencyIds||[],
  requiredTopicIds:open.draft.snapshot.meta?.declaredPedagogy?.requiredTopicIds||[],
  competencyLabels:Object.fromEntries((open.draft.snapshot.meta?.declaredPedagogy?.competencies||[]).map(c=>[c.id,c.code+' '+c.title])),
  topicLabels:Object.fromEntries((open.draft.snapshot.meta?.declaredPedagogy?.topics||[]).map(t=>[t.id,t.title])),
 },{purpose:open.draft.snapshot.meta?.purpose,period:open.draft.snapshot.meta?.declaredPedagogy?.currentPeriod}):null;
 const returnRate=ind&&ind.decisions?Math.round(100*ind.returns/ind.decisions):null;
 return <section aria-label="Validação pelo colegiado" style={{background:'#fff',border:'1px solid '+line,borderRadius:14,padding:18,marginBottom:16}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}>
   <div>
    <h3 style={{margin:'0 0 4px'}}>Validação pelo colegiado</h3>
    <p style={{margin:0,fontSize:13,color:'#41566F'}}>Coordenação, NDE e gestão analisam os cadernos enviados. Quem elaborou não valida o próprio caderno.</p>
   </div>
   <button type="button" style={btn(false)} disabled={busy} onClick={()=>void load()}>{queue?'Atualizar fila':'Abrir fila de validação'}</button>
  </div>
  {denied&&<p role="note" style={{fontSize:13,marginBottom:0}}>A fila de validação é restrita à coordenação, ao NDE e à gestão do curso. Seus cadernos enviados aparecem como "enviado" em "Meus rascunhos".</p>}
  {msg&&<p role="status" style={{fontSize:13,background:'#F5F9FF',padding:'8px 12px',borderRadius:8}}>{msg}</p>}
  {ind&&<dl aria-label="Indicadores do colegiado" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8,margin:'12px 0'}}>
   {([['Aguardando',ind.awaiting],['Validados',ind.validated],['Questões validadas',ind.validatedQuestions],
     ['Em elaboração',ind.inDraft],['Taxa de devolução',returnRate===null?'—':returnRate+'%'],
     ['Tempo médio de análise',ind.avgReviewHours===null?'—':ind.avgReviewHours+' h']] as const).map(([k,v])=>
    <div key={k} style={{border:'1px solid '+line,borderRadius:9,padding:'8px 10px'}}>
     <dt style={{fontSize:12,color:'#41566F'}}>{k}</dt><dd style={{margin:0,fontWeight:700,fontSize:18,color:blue}}>{v}</dd>
    </div>)}
  </dl>}
  {ind&&Object.keys(ind.returnReasons).length>0&&<p style={{fontSize:13}}>Motivos de devolução: {Object.entries(ind.returnReasons)
   .sort((a,b)=>(b[1]||0)-(a[1]||0)).map(([r,n])=>(reasonLabel[r as ReturnReason]||r)+' ('+n+')').join(' · ')}</p>}
  {queue&&!open&&(queue.length===0?<p role="status" style={{fontSize:13}}>Nenhum caderno aguardando validação neste curso.</p>:
   <ul style={{listStyle:'none',padding:0,display:'grid',gap:8}}>
    {queue.map(q=><li key={q.id} style={{border:'1px solid '+line,borderRadius:9,padding:'10px 12px',display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}>
     <span><strong>{q.title}</strong> · {q.discipline} · {q.semester} · {q.questionCount} questão(ões) · versão {q.revision}
      {q.submittedAt&&<> · enviado em {new Date(q.submittedAt).toLocaleString('pt-BR')}</>}{q.mine&&' · de sua autoria'}</span>
     <button type="button" style={btn(true)} disabled={busy} onClick={()=>void inspect(q)}>Analisar</button>
    </li>)}
   </ul>)}
  {open&&checklist&&<div>
   <button type="button" style={btn(false)} onClick={()=>setOpen(null)}>← Voltar à fila</button>
   <ChecklistPanel result={checklist} title="Checklist técnico (recalculado sobre a versão enviada)"/>
   <SavedPreview value={open.draft} showAnswerKey/>
   {open.history.length>0&&<div><h4 style={{margin:'8px 0 0'}}>Histórico</h4><ReviewHistory events={open.history}/></div>}
   {open.item.mine?<p role="note" style={{fontSize:13}}>Você é o autor deste caderno: a decisão cabe a outro membro do colegiado.</p>:
   <fieldset style={{border:'1px solid '+line,borderRadius:10,padding:12}}>
    <legend style={{fontWeight:700}}>Parecer</legend>
    <p style={{fontSize:13,margin:'0 0 6px'}}>Motivos (obrigatório na devolução):</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:'6px 14px'}}>
     {RETURN_REASONS.map(([code,label])=><label key={code} style={{fontSize:13}}>
      <input type="checkbox" checked={reasons.includes(code)} onChange={e=>setReasons(r=>e.target.checked?[...r,code]:r.filter(x=>x!==code))}/> {label}
     </label>)}
    </div>
    <label style={{display:'grid',gap:5,fontWeight:600,fontSize:13,marginTop:10}}>Justificativa
     <textarea rows={4} value={justification} onChange={e=>setJustification(e.target.value)} maxLength={4000}
      style={{padding:'10px 12px',border:'1px solid '+line,borderRadius:8}} placeholder="Fundamente a decisão com referência às questões."/>
    </label>
    <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
     <button type="button" style={btn(true)} disabled={busy||checklist.blocking>0} onClick={()=>void decide('validate')}>Validar caderno</button>
     <button type="button" style={btn(false)} disabled={busy} onClick={()=>void decide('return')}>Devolver ao autor</button>
    </div>
    {checklist.blocking>0&&<p style={{fontSize:12,color:'#982F2F'}}>Caderno com bloqueio técnico não pode ser validado.</p>}
   </fieldset>}
  </div>}
 </section>;
}
