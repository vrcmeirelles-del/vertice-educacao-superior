import {useCallback,useEffect,useMemo,useState} from 'react';
import type {ApplicationDetail} from './application-api';
import {buildVariantMap,discursivePositions,objectivePositions,parseAnswerString,snapshotQuestions} from './answer-entry';
import {loadAuthorizedClassRoster} from './class-roster';
import {editableQuestionsFromSnapshot,type StoredAssessmentDraft} from './draft-api';
import {buildIndividualizedPdf,downloadPdf,registeredIssues} from './individualized-pdf';
import {downloadDraftImages} from './private-image-upload';
import {assignVariants,issuePapers,listPapers,normalizeScannedCode,savePaperSheet,scanPaper,voidPaper,type IssuedPaper} from './papers-api';
import type {ShuffleMode} from './exam-variants';
import QrPaperScanner from './QrPaperScanner';

const blue='#164B92',line='#DCE7F4';
const btn=(primary:boolean)=>({padding:'9px 14px',borderRadius:9,border:'1px solid '+blue,background:primary?blue:'#fff',
 color:primary?'#fff':blue,fontWeight:700,cursor:'pointer'} as const);
const input={padding:'8px 10px',border:'1px solid '+line,borderRadius:7,width:'100%',minWidth:0,background:'#fff'} as const;
const short=(c:string)=>c.slice(0,4)+'-'+c.slice(4);
const sameMap=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** Descobre o embaralhamento que reproduz exatamente o mapa gravado na aplicação. */
export function matchingShuffleMode(draft:StoredAssessmentDraft,detail:Pick<ApplicationDetail,'variantCount'|'variantMap'>):ShuffleMode|null{
 const qs=snapshotQuestions(draft.snapshot.questions);
 for(const m of ['ambos','questoes','alternativas'] as ShuffleMode[]){
  try{if(sameMap(buildVariantMap(qs,detail.variantCount,m),detail.variantMap))return m;}catch{/* modo impossível */}
 }
 return null;
}

type Student={id:string;name:string;selected:boolean};
/** Etapas 1 e 2: cadernos com QR registrado e lançamento pela leitura do QR. O servidor corrige. */
export default function IssuedPapersPanel({institutionId,courseId,discipline,courseName,institutionName,detail,draft,onSaved}:{
 institutionId:string;courseId:string;discipline:string;courseName:string;institutionName:string;
 detail:ApplicationDetail;draft:StoredAssessmentDraft;onSaved:()=>Promise<void>;
}){
 const [papers,setPapers]=useState<IssuedPaper[]>([]);
 const [students,setStudents]=useState<Student[]>([]);
 const [extra,setExtra]=useState('');
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');const [errs,setErrs]=useState<string[]>([]);
 const [current,setCurrent]=useState<IssuedPaper|null>(null);
 const [seq,setSeq]=useState('');const [disc,setDisc]=useState<Record<string,string>>({});
 const questions=useMemo(()=>snapshotQuestions(draft.snapshot.questions),[draft]);
 const mode=useMemo(()=>matchingShuffleMode(draft,detail),[draft,detail]);
 const editable=detail.status==='open';
 const refresh=useCallback(async()=>setPapers(await listPapers(institutionId,courseId,detail.id)),[institutionId,courseId,detail.id]);
 useEffect(()=>{void refresh().catch(e=>setErrs([e instanceof Error?e.message:'Cadernos indisponíveis.']));},[refresh]);

 const loadRoster=async()=>{
  setBusy(true);setErrs([]);
  try{
   const r=await loadAuthorizedClassRoster({institutionId,courseId,disciplineId:discipline,classLabel:detail.classLabel});
   setStudents(r.students.map(s=>({id:s.id,name:s.name,selected:true})));
   setMsg(r.students.length+' aluno(s) do período. Desmarque quem não fará a prova.');
  }catch(e){setErrs([e instanceof Error?e.message:'Lista da turma indisponível.']);}
  finally{setBusy(false);}
 };
 const issue=async()=>{
  setErrs([]);setMsg('');
  if(!mode){setErrs(['O mapa de versões desta aplicação não corresponde a nenhum embaralhamento do caderno. Registre uma nova aplicação para imprimir cadernos com QR.']);return;}
  const labels=extra.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const chosen:Array<{studentId?:string;label?:string}>=[...students.filter(s=>s.selected).map(s=>({studentId:s.id})),...labels.map(label=>({label}))];
  if(!chosen.length){setErrs(['Selecione alunos ou informe identificações.']);return;}
  if(chosen.length>120){setErrs(['Emita no máximo 120 cadernos por PDF.']);return;}
  const already=chosen.filter(c=>papers.some(p=>c.studentId?p.studentId===c.studentId:p.label.toLowerCase()===String(c.label).toLowerCase())).length;
  if(already&&!window.confirm(already+' aluno(s) já têm caderno emitido. Reemitir anula o caderno anterior. Continuar?'))return;
  setBusy(true);
  try{
   setMsg('Recuperando o caderno validado e as imagens…');
   const ctx={institutionId,courseId,disciplineId:discipline,draftId:detail.draftId};
   const hasImages=draft.snapshot.questions.some(q=>Array.isArray(q.images)&&q.images.length>0);
   const restored=hasImages?await downloadDraftImages(ctx):undefined;
   const full=editableQuestionsFromSnapshot(draft.snapshot,restored);
   if(!full)throw new Error('Não foi possível recuperar todas as imagens do caderno validado.');
   if(!sameMap(buildVariantMap(snapshotQuestions(draft.snapshot.questions),detail.variantCount,mode),detail.variantMap))
    throw new Error('O caderno não reproduz o mapa de versões da aplicação.');
   const codes=Object.keys(detail.variantMap).sort();
   const issued=await issuePapers(institutionId,courseId,detail.id,assignVariants(chosen,codes));
   setMsg('Gerando o PDF de '+issued.length+' caderno(s)…');
   const meta=draft.snapshot.meta??{};
   const bytes=await buildIndividualizedPdf({institutionName,courseName,discipline,title:meta.title||detail.title,teacherName:meta.teacherName,
    instructions:meta.instructions,semester:meta.semester||'',classLabel:detail.classLabel,questions:full.questions,
    variantCount:detail.variantCount,shuffleMode:mode},registeredIssues(issued));
   downloadPdf(bytes,'Avalia360-'+detail.classLabel+'-cadernos-QR');
   await refresh();setStudents([]);setExtra('');
   setMsg(issued.length+' caderno(s) registrado(s) e PDF gerado. Cada QR identifica aluno e versão na correção.');
  }catch(e){setErrs([e instanceof Error?e.message:'Emissão não concluída.']);setMsg('');await refresh().catch(()=>{});}
  finally{setBusy(false);}
 };
 const openCode=async(raw:string)=>{
  setErrs([]);setMsg('');
  try{
   const p=await scanPaper(institutionId,courseId,normalizeScannedCode(raw),detail.id);
   if(p.applicationId!==detail.id){setErrs(['Este caderno é de outra aplicação ('+p.label+'). Abra a aplicação correspondente.']);return;}
   setCurrent(p);
   const items=p.sheet?.items||[];
   setSeq(items.filter(i=>i.kind==='objetiva').sort((a,b)=>a.n-b.n).map(i=>i.mark||(i.outcome==='multiple'?'*':'-')).join(''));
   setDisc(Object.fromEntries(items.filter(i=>i.kind==='discursiva'&&i.score!==null).map(i=>[i.q,String(i.score)])));
  }catch(e){setCurrent(null);setErrs([e instanceof Error?e.message:'Caderno não localizado.']);}
 };
 const save=async()=>{
  if(!current)return;
  const parsed=parseAnswerString(seq,objectivePositions(detail.variantMap,questions,current.variant));
  if(parsed.error){setErrs([parsed.error]);return;}
  const discursive:Record<string,number>={};
  for(const p of discursivePositions(detail.variantMap,questions,current.variant)){
   const raw=(disc[p.questionId]||'').trim().replace(',','.');if(!raw)continue;
   const v=Number(raw),max=questions.find(q=>q.id===p.questionId)?.points??0;
   if(!Number.isFinite(v)||v<0||v>max){setErrs(['Nota da questão '+p.n+' deve ficar entre 0 e '+max+'.']);return;}
   discursive[p.questionId]=v;
  }
  setBusy(true);setErrs([]);
  try{
   const saved=await savePaperSheet(institutionId,courseId,current.paperId,parsed.answers,discursive);
   setMsg(saved.label+' · versão '+saved.variant+': '+Number(saved.sheet?.total??0).toFixed(2)+' de '+Number(saved.sheet?.max??0).toFixed(2)+'. Leia o próximo QR.');
   setCurrent(null);setSeq('');setDisc({});
   await Promise.all([refresh(),onSaved()]);
  }catch(e){setErrs([e instanceof Error?e.message:'Lançamento não salvo.']);}
  finally{setBusy(false);}
 };
 const annul=async(p:IssuedPaper)=>{
  if(!window.confirm('Anular o caderno de '+p.label+' ('+short(p.shortCode)+')? O QR deixa de valer.'))return;
  setBusy(true);
  try{await voidPaper(institutionId,courseId,p.paperId);await refresh();}catch(e){setErrs([e instanceof Error?e.message:'Anulação recusada.']);}
  finally{setBusy(false);}
 };

 const positions=current?objectivePositions(detail.variantMap,questions,current.variant):[];
 const check=current&&seq?parseAnswerString(seq,positions):{answers:{}};
 const pending=papers.filter(p=>!p.sheetId).length;
 return <section aria-label="Cadernos com QR" style={{border:'1px solid '+line,borderRadius:12,padding:14,margin:'14px 0',background:'#FAFCFF'}}>
  <h4 style={{margin:'0 0 6px'}}>Cadernos com QR registrado</h4>
  <p style={{fontSize:12,color:'#41566F',margin:'0 0 8px'}}>Cada caderno recebe um QR único ligado ao aluno e à versão desta aplicação. Na correção, leia o QR e digite as marcações: aluno e versão vêm do servidor. A leitura automática das marcações ainda não está ativada.</p>
  {msg&&<p role="status" style={{fontSize:13,background:'#F5F9FF',padding:'8px 12px',borderRadius:8}}>{msg}</p>}
  {errs.length>0&&<div role="alert" style={{background:'#FFF0F0',padding:10,borderRadius:9,color:'#982F2F',fontSize:13}}><ul style={{margin:0}}>{errs.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}
  {!mode&&<p role="alert" style={{fontSize:13,color:'#982F2F'}}>O mapa de versões desta aplicação não corresponde a nenhum embaralhamento do caderno; a emissão com QR fica indisponível.</p>}

  {editable&&<details style={{marginTop:8}}>
   <summary style={{cursor:'pointer',fontWeight:700}}>1. Emitir cadernos com QR</summary>
   <div style={{display:'grid',gap:8,marginTop:8}}>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
     <button type="button" style={btn(false)} disabled={busy} onClick={()=>void loadRoster()}>Carregar alunos do período ({detail.classLabel})</button>
    </div>
    {students.length>0&&<div style={{maxHeight:220,overflow:'auto',border:'1px solid '+line,borderRadius:8,padding:8}}>
     {students.map(s=><label key={s.id} style={{display:'flex',gap:8,padding:'3px 0',fontSize:13}}>
      <input type="checkbox" checked={s.selected} onChange={e=>setStudents(all=>all.map(x=>x.id===s.id?{...x,selected:e.target.checked}:x))}/>
      {s.name}{papers.some(p=>p.studentId===s.id)&&<small style={{color:'#7A4B00'}}> · já tem caderno</small>}</label>)}
    </div>}
    <label style={{fontSize:13,fontWeight:600}}>Identificações livres (uma por linha, para quem não está no cadastro)
     <textarea style={{...input,minHeight:60}} value={extra} onChange={e=>setExtra(e.target.value)} placeholder={'Ouvinte 01\nOuvinte 02'}/></label>
    <p style={{fontSize:12,color:'#64748b',margin:0}}>As versões são distribuídas alternadamente ({Object.keys(detail.variantMap).sort().join(', ')}). O PDF usa o caderno validado desta aplicação (versão {detail.revision}).</p>
    <button type="button" style={btn(true)} disabled={busy||!mode} onClick={()=>void issue()}>{busy?'Processando…':'Emitir e gerar PDF'}</button>
   </div>
  </details>}

  <details style={{marginTop:8}} open={papers.length>0}>
   <summary style={{cursor:'pointer',fontWeight:700}}>2. Ler QR e lançar respostas · {papers.length} caderno(s), {pending} sem lançamento</summary>
   <div style={{display:'grid',gap:10,marginTop:8}}>
    <QrPaperScanner disabled={busy} onCode={code=>void openCode(code)}/>
    {current&&<div style={{border:'2px solid '+blue,borderRadius:10,padding:12,background:'#fff'}}>
     <strong>{current.label}</strong>{current.enrollment&&<> · {current.enrollment}</>} · versão <strong>{current.variant}</strong> · caderno {short(current.shortCode)}
     {current.sheetId&&<small style={{color:'#7A4B00'}}> · já lançado; salvar substitui</small>}
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:8,marginTop:8}}>
      <label style={{fontSize:13,fontWeight:600}}>Objetivas ({positions.length}) na ordem do cartão
       <input autoFocus style={{...input,fontFamily:'monospace',letterSpacing:2}} value={seq} disabled={!editable}
        onChange={e=>setSeq(e.target.value.toUpperCase())} placeholder={'-'.repeat(positions.length)} aria-invalid={Boolean(check.error)}/>
       <small style={{color:check.error?'#982F2F':'#64748b'}}>{check.error||'"-" branco · "*" dupla marcação'}</small></label>
      {discursivePositions(detail.variantMap,questions,current.variant).map(p=><label key={p.questionId} style={{fontSize:13,fontWeight:600}}>
       Discursiva nº {p.n} (máx. {questions.find(q=>q.id===p.questionId)?.points})
       <input style={input} inputMode="decimal" value={disc[p.questionId]||''} disabled={!editable} onChange={e=>setDisc(d=>({...d,[p.questionId]:e.target.value}))} placeholder="—"/></label>)}
     </div>
     <div style={{display:'flex',gap:8,marginTop:8}}>
      {editable&&<button type="button" style={btn(true)} disabled={busy} onClick={()=>void save()}>Salvar e ler o próximo</button>}
      <button type="button" style={btn(false)} onClick={()=>setCurrent(null)}>Cancelar</button>
     </div>
     {!editable&&<p style={{fontSize:12,color:'#64748b'}}>Aplicação encerrada: só consulta.</p>}
    </div>}
    {papers.length>0&&<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
     <thead><tr style={{textAlign:'left',borderBottom:'2px solid '+line}}><th style={{padding:5}}>Aluno</th><th style={{padding:5}}>Versão</th><th style={{padding:5}}>Código</th><th style={{padding:5}}>Lançamento</th><th/></tr></thead>
     <tbody>{papers.map(p=><tr key={p.paperId} style={{borderBottom:'1px solid '+line}}>
      <td style={{padding:5}}>{p.label}</td><td style={{padding:5}}>{p.variant}</td><td style={{padding:5,fontFamily:'monospace'}}>{short(p.shortCode)}</td>
      <td style={{padding:5}}>{p.sheet?Number(p.sheet.total).toFixed(2)+' / '+Number(p.sheet.max).toFixed(2):'pendente'}</td>
      <td style={{padding:5}}>{editable&&<button type="button" style={{...btn(false),padding:'3px 8px'}} disabled={busy} onClick={()=>void annul(p)}>Anular</button>}</td>
     </tr>)}</tbody></table></div>}
   </div>
  </details>
 </section>;
}
