import {useRef,useState} from 'react';
import {parseQuestionRows} from './question-spreadsheet';
import type {QuestionDraft} from './question-draft';
import {buildQuestionTemplate,parseHeaderRows,type HeaderValues} from './question-template';

type Props={
 disciplineId:string;
 catalog:Parameters<typeof parseQuestionRows>[2];
 /** Dados do cabeçalho na tela: vão preenchidos no modelo. */
 header:HeaderValues;
 onImport:(questions:QuestionDraft[],header:HeaderValues)=>void;
};

export default function QuestionSpreadsheetImport({disciplineId,catalog,header,onImport}:Props){
 const input=useRef<HTMLInputElement>(null);
 const [pending,setPending]=useState<(ReturnType<typeof parseQuestionRows>&{header:HeaderValues})|null>(null);
 const download=()=>{
  const bytes=buildQuestionTemplate({header,competencyCodes:catalog.competencies.map(c=>c.code?`${c.code} — ${c.title}`:c.title),
   topics:catalog.topics.map(t=>t.title)});
  const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a');a.href=url;
  a.download=`modelo-questoes-avalia360${header['Disciplina']?'-'+header['Disciplina'].normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase():''}.xlsx`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
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
   let sheetHeader:HeaderValues={};
   try{sheetHeader=parseHeaderRows(await readSheet(file,'Cabeçalho'));}catch{/* planilhas antigas sem a aba Cabeçalho */}
   const discipline=disciplineId.trim()||sheetHeader['Disciplina']||'';
   setPending({...parseQuestionRows(rows,discipline,catalog),header:sheetHeader});
  }catch(error){
   setMessage('Falha ao ler a aba Questões. Confira o arquivo e os cabeçalhos do modelo. '
    +(error instanceof Error?error.message:''));
  }finally{setBusy(false);}
 };
 return <>
  <button type="button" onClick={download}>Baixar modelo da planilha</button>
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
   {Object.keys(pending.header).length>0&&<p style={{margin:'6px 0'}}>Cabeçalho da planilha: {Object.entries(pending.header).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p>}
   {pending.errors.length>0&&<div role="alert">
    <p>Corrija estas linhas na planilha e envie o arquivo novamente.</p>
    <ul>{pending.errors.map((error,i)=><li key={i}>{error}</li>)}</ul>
   </div>}
   {pending.warnings.length>0&&<ul>{pending.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>}
   {pending.questions.length>0&&<ol style={{maxHeight:200,overflow:'auto',overflowWrap:'anywhere'}}>
    {pending.questions.map(q=><li key={q.id}>{q.kind==='objetiva'?'Objetiva':'Discursiva'} · {q.points} ponto(s) · {q.statement}</li>)}
   </ol>}
   <button type="button" disabled={pending.errors.length>0||!pending.questions.length} onClick={()=>{
    onImport(pending.questions,pending.header);
    setMessage(`${pending.questions.length} questão(ões) acrescentada(s) ao rascunho.`);
    setPending(null);
   }}>Acrescentar ao rascunho</button>{' '}
   <button type="button" onClick={()=>setPending(null)}>Cancelar importação</button>
  </div>}
 </>;
}
