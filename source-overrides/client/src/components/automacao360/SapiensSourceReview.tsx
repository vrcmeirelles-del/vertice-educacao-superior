import {useEffect, useState} from 'react';
import {supabase} from '@/lib/supabase';
import {mensagemErro} from './modelo';

type Aggregate = {key:string;hash:string;semester:string;module:string;subject:string;competency:string;
 graded:number;correct:number;students:number;updatedAt:string;reviewId:string|null;decision:string|null;reviewCurrent:boolean|null};

// Recebe o escopo do painel; o servidor impõe o vínculo e MFA novamente.
export default function SapiensSourceReview({institutionId,courseId}:{institutionId:string;courseId:string}) {
 const [rows,setRows]=useState<Aggregate[]>([]),[selected,setSelected]=useState('');
 const [graded,setGraded]=useState(''),[correct,setCorrect]=useState(''),[students,setStudents]=useState('');
 const [evidence,setEvidence]=useState(''),[note,setNote]=useState(''),[excluded,setExcluded]=useState(false);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let live=true;setRows([]);setSelected('');setMessage('Consultando agregados do curso…');
  void supabase.rpc('vertice_automation_sapiens_review',{p_institution:institutionId,p_course:courseId,p_action:'list',p_payload:{}})
   .then(({data,error})=>{if(!live)return;if(error){setMessage(mensagemErro(error));return;}
    if(!Array.isArray(data)){setMessage('Fonte indisponível: resposta não verificada.');return;}
    setRows(data as Aggregate[]);setMessage(data.length?'':'Sem agregados disponíveis para revisão neste curso.');});
  return()=>{live=false;};
 },[institutionId,courseId,refresh]);
 const row=rows.find(x=>x.key===selected);
 async function decide(action:'validate'|'revoke') {
  if(!row)return;setBusy(true);setMessage('');
  const {error}=await supabase.rpc('vertice_automation_sapiens_review',{p_institution:institutionId,p_course:courseId,p_action:action,
   p_payload:{key:row.key,hash:row.hash,expectedReviewId:row.reviewId,
    finalGraded:Number(graded),finalCorrect:Number(correct),finalStudents:Number(students),
    provisionalExcluded:excluded,evidenceRef:evidence,note}});
  setBusy(false);
  if(error){setMessage(mensagemErro(error));return;}
  setGraded('');setCorrect('');setStudents('');setExcluded(false);setEvidence('');setNote('');setRefresh(n=>n+1);
 }
 return <section className="a360-painel" aria-labelledby="sapiens-source-heading">
  <h3 id="sapiens-source-heading">Sapiens · revisão dos resultados definitivos</h3>
  <p>Confira a origem e informe somente respostas com correção definitiva. Pré-notas e resultados provisórios ficam fora.
   A revisão não altera notas e perde validade se a fonte mudar. A execução continua sujeita à configuração aprovada por outra pessoa.</p>
  <label>Agregado do curso <select value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setGraded('');setCorrect('');setStudents('');setExcluded(false);setEvidence('');setNote('');}}>
   <option value="">Selecione</option>{rows.map(x=><option key={x.key} value={x.key}>{x.semester} · {x.module} · {x.subject} · {x.competency||'Competência não informada'}</option>)}
  </select></label>
  {row&&<>
   <p>Fonte: {row.graded} respostas corrigidas, {row.correct} acertos, {row.students} estudantes pareados.
    Situação da revisão: {row.reviewCurrent&&row.decision==='validated'?'validada':row.reviewId?'revogada ou desatualizada':'aguardando revisão'}.</p>
   <div className="a360-filtros">
    <label>Respostas definitivas <input type="number" min={30} value={graded} onChange={e=>setGraded(e.target.value)} disabled={busy}/></label>
    <label>Acertos definitivos <input type="number" min={0} value={correct} onChange={e=>setCorrect(e.target.value)} disabled={busy}/></label>
    <label>Estudantes da amostra definitiva <input type="number" min={5} value={students} onChange={e=>setStudents(e.target.value)} disabled={busy}/></label>
   </div>
   <label>Referência da evidência <input value={evidence} maxLength={1000} onChange={e=>setEvidence(e.target.value)} disabled={busy} placeholder="Identificador do relatório ou registro de conferência"/></label>
   <label>Justificativa da conferência <textarea value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} disabled={busy}/></label>
   <label><input type="checkbox" checked={excluded} onChange={e=>setExcluded(e.target.checked)} disabled={busy}/> Conferi a amostra e excluí todos os resultados provisórios.</label>
   <div className="a360-acoes">
    <button type="button" disabled={busy||!excluded||!graded||correct===''||!students||evidence.trim().length<10||note.trim().length<20} onClick={()=>void decide('validate')}>Registrar revisão humana</button>
    {row.decision==='validated'&&<button type="button" disabled={busy||evidence.trim().length<10||note.trim().length<20} onClick={()=>void decide('revoke')}>Revogar revisão, preservando histórico</button>}
   </div>
  </>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
