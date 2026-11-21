import {useRef,useState} from 'react';
import {parseQuestionRows} from './question-spreadsheet';
import type {QuestionDraft} from './question-draft';

type Props={
 disciplineId:string;
 catalog:Parameters<typeof parseQuestionRows>[2];
 onImport:(questions:QuestionDraft[])=>void;
};

export default function QuestionSpreadsheetImport({disciplineId,catalog,onImport}:Props){
 const input=useRef<HTMLInputElement>(null);
 const [pending,setPending]=useState<ReturnType<typeof parseQuestionRows>|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const open=async(file:File)=>{
  setPending(null);
  setMessage('');
  if(!/\.xlsx$/i.test(file.name)||file.size>5*1024*1024){
   setMessage('Selecione uma planilha .xlsx de até 5 MB.');
   return;
  }
  setBusy(true);
  try{
   const {readSheet}=await import('read-excel-file/browser');
   const rows=await readSheet(file,'Questões');
   setPending(parseQuestionRows(rows,disciplineId,catalog));
  }catch(error){
   setMessage('Falha ao ler a aba Questões. Confira o arquivo e os cabeçalhos do modelo. '
    +(error instanceof Error?error.message:''));
  }finally{setBusy(false);}
 };
 return <>
  <button type="button" onClick={()=>input.current?.click()} disabled={busy}>
   {busy?'Lendo planilha…':'Importar questões do Excel'}
  </button>
  <input hidden ref={input} type="file" accept=".xlsx" aria-label="Planilha de questões"
   onChange={event=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(file)void open(file);
   }}/>
  {message&&<p role="status" style={{flexBasis:'100%'}}>{message}</p>}
  {pending&&<div style={{flexBasis:'100%',minWidth:0,padding:12,background:'#eff5fc',borderRadius:8}}>
   <strong>{pending.questions.length} questão(ões) pronta(s) para acrescentar</strong>
   {pending.errors.length>0&&<div role="alert">
    <p>Corrija estas linhas na planilha e envie o arquivo novamente.</p>
    <ul>{pending.errors.map((error,i)=><li key={i}>{error}</li>)}</ul>
   </div>}
   {pending.warnings.length>0&&<ul>{pending.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>}
   {pending.questions.length>0&&<ol style={{maxHeight:200,overflow:'auto',overflowWrap:'anywhere'}}>
    {pending.questions.map(q=><li key={q.id}>{q.kind==='objetiva'?'Objetiva':'Discursiva'} · {q.points} ponto(s) · {q.statement}</li>)}
   </ol>}
   <button type="button" disabled={pending.errors.length>0||!pending.questions.length} onClick={()=>{
    onImport(pending.questions);
    setMessage(`${pending.questions.length} questão(ões) acrescentada(s) ao rascunho.`);
    setPending(null);
   }}>Acrescentar ao rascunho</button>{' '}
   <button type="button" onClick={()=>setPending(null)}>Cancelar importação</button>
  </div>}
 </>;
}
