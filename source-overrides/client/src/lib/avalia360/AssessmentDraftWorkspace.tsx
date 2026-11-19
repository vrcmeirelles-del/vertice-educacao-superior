import {useState} from 'react';
import {QuestionDraftEditor, type QuestionOption} from './QuestionDraftEditor';
import {saveAssessmentDraft, type DraftReceipt} from './draft-api';
import type {QuestionDraft} from './question-draft';

export interface AssessmentDraftWorkspaceProps {
 institutionId:string;courseId:string;disciplineId:string;
 topics:QuestionOption[];competencies:QuestionOption[];
 /**
  * O backend deverá fornecer apenas opções autorizadas por IES, curso e PPC.
  * Estas props não constituem, por si, autorização institucional.
  */
}
export function AssessmentDraftWorkspace(props:AssessmentDraftWorkspaceProps){
 const [status,setStatus]=useState<'idle'|'saving'|'saved'|'error'>('idle');
 const [message,setMessage]=useState('');
 const [receipt,setReceipt]=useState<DraftReceipt|null>(null);
 const [question,setQuestion]=useState<QuestionDraft|null>(null);
 const prepare=async(next:QuestionDraft)=>{
  if(status==='saving')return;
  setStatus('saving');setMessage('');
  const result=await saveAssessmentDraft({
    institutionId:props.institutionId,courseId:props.courseId,
    disciplineId:props.disciplineId,questions:[next]
  });
  if(result.ok){
   setReceipt(result.receipt);setQuestion(next);
   setStatus('saved');setMessage('Rascunho salvo no servidor. Nenhuma prova foi publicada.');
  } else {
   setStatus('error');setMessage(result.error.message);
  }
 };
 return <section aria-label="Rascunho da avaliação — Avalia 360°">
   <QuestionDraftEditor disciplineId={props.disciplineId}
     topics={props.topics} competencies={props.competencies}
     disabled={status==='saving'} onPrepare={prepare}/>
   <div role="status" aria-live="polite">
     {status==='saving'?'Salvando rascunho…':message}
   </div>
   {receipt&&<p>Rascunho {receipt.id} · versão {receipt.revision} · situação {receipt.status}</p>}
   {status==='saved'&&question&&question.images.length===0&&
      <p>A curadoria curricular somente estará disponível com PPC, temas e competências efetivamente validados.</p>}
   {status==='error'&&
      <p>As informações permanecem no formulário; confira o erro antes de tentar novamente.</p>}
 </section>;
}
