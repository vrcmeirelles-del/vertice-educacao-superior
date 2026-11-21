import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {loadAssessmentDraft} from './draft-api';
import {answerKeyByVariant,buildVariantMap,discursivePositions,objectivePositions,parseAnswerString,parseCsv,
 parseResponseRows,snapshotQuestions,type SnapshotQuestion} from './answer-entry';
import {closeApplication,createApplication,deleteSheet,getApplication,listApplications,saveSheets,
 type ApplicationDetail,type ApplicationSummary,type SheetInput} from './application-api';
import {loadAuthorizedClassRoster} from './class-roster';
import {maxDistinctVariants,type ShuffleMode} from './exam-variants';
import type {QuestionDraft} from './question-draft';
import ItemAnalysisPanel from './ItemAnalysisPanel';
import CompetencyDiagnosisPanel from './CompetencyDiagnosisPanel';
import ErrorMapPanel from './ErrorMapPanel';
import QualityPanel from './QualityPanel';
import IssuedPapersPanel from './IssuedPapersPanel';
import type {StoredAssessmentDraft} from './draft-api';

const blue='#164B92',line='#DCE7F4';
const btn=(primary:boolean)=>({padding:'9px 14px',borderRadius:9,border:'1px solid '+blue,background:primary?blue:'#fff',
 color:primary?'#fff':blue,fontWeight:700,cursor:'pointer'} as const);
const input={padding:'8px 10px',border:'1px solid '+line,borderRadius:7,width:'100%',minWidth:0,background:'#fff'} as const;
const outcomeMark={correct:'✓',wrong:'✗',blank:'–',multiple:'*',scored:'●',pending:'?'} as const;
type Row={key:string;studentId?:string;label:string;variant:string;seq:string;disc:Record<string,string>;dirty:boolean;sheetId?:string};
const today=()=>new Date().toISOString().slice(0,10);

function rowsFromDetail(d:ApplicationDetail):Row[]{
 return d.sheets.map(s=>({key:s.id,sheetId:s.id,...(s.studentId?{studentId:s.studentId}:{}),label:s.label,variant:s.variant,dirty:false,
  seq:(s.items||[]).filter(i=>i.kind==='objetiva').sort((a,b)=>a.n-b.n).map(i=>i.mark||(i.outcome==='multiple'?'*':'-')).join(''),
  disc:Object.fromEntries((s.items||[]).filter(i=>i.kind==='discursiva'&&i.score!==null).map(i=>[i.q,String(i.score)]))}));
}

/** Aplicação de caderno validado e lançamento de respostas. O servidor corrige. */
export default function ApplicationPanel({institutionId,courseId,discipline,draftId,onClose,courseName='',institutionName=''}:{
 institutionId:string;courseId:string;discipline:string;draftId:string;onClose:()=>void;courseName?:string;institutionName?:string;
}){
 const [draft,setDraft]=useState<StoredAssessmentDraft|null>(null);
 const [questions,setQuestions]=useState<SnapshotQuestion[]|null>(null);
 const [revision,setRevision]=useState(0);
 const [title,setTitle]=useState('');
 const [apps,setApps]=useState<ApplicationSummary[]>([]);
 const [detail,setDetail]=useState<ApplicationDetail|null>(null);
 const [rows,setRows]=useState<Row[]>([]);
 const [msg,setMsg]=useState('');const [errs,setErrs]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [classLabel,setClassLabel]=useState('');const [appliedOn,setAppliedOn]=useState(today());
 const [count,setCount]=useState(1);const [mode,setMode]=useState<ShuffleMode>('ambos');
 const file=useRef<HTMLInputElement>(null);
 const [showAnalysis,setShowAnalysis]=useState(false);
 const [showMastery,setShowMastery]=useState(false);
 const [showErrors,setShowErrors]=useState(false);
 const [showQuality,setShowQuality]=useState(false);

 const refreshList=useCallback(async()=>setApps(await listApplications(institutionId,courseId,draftId)),[institutionId,courseId,draftId]);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   setBusy(true);
   try{
    const found=await loadAssessmentDraft({institutionId,courseId,disciplineId:discipline,draftId});
    if(!found.ok)throw new Error(found.error.message);
    if(found.draft.status!=='validated')throw new Error('Somente caderno validado pelo colegiado pode ser aplicado.');
    if(!live)return;
    setQuestions(snapshotQuestions(found.draft.snapshot.questions));setRevision(found.draft.revision);setDraft(found.draft);
    setTitle(found.draft.snapshot.meta?.title||'Avaliação');
    await refreshList();
   }catch(e){if(live)setMsg(e instanceof Error?e.message:'Não foi possível abrir o caderno.');}
   finally{if(live)setBusy(false);}
  })();
  return()=>{live=false;};
 },[institutionId,courseId,discipline,draftId,refreshList]);

 const maxVariants=questions?maxDistinctVariants(questions as unknown as QuestionDraft[],mode):1;
 const preview=useMemo(()=>{
  if(!questions||count>maxVariants)return null;
  try{const map=buildVariantMap(questions,count,mode);return {map,key:answerKeyByVariant(map,questions)};}catch{return null;}
 },[questions,count,mode,maxVariants]);

 const open=async(id:string)=>{
  setBusy(true);setErrs([]);setMsg('');
  try{const d=await getApplication(institutionId,courseId,id);setDetail(d);setRows(rowsFromDetail(d));setShowAnalysis(false);setShowMastery(false);setShowErrors(false);setShowQuality(false);}
  catch(e){setMsg(e instanceof Error?e.message:'Aplicação indisponível.');}
  finally{setBusy(false);}
 };
 const create=async()=>{
  if(!questions||!preview){setErrs(['Ajuste a quantidade de versões.']);return;}
  if(!classLabel.trim()){setErrs(['Informe a turma.']);return;}
  setBusy(true);setErrs([]);
  try{
   const out=await createApplication(institutionId,courseId,{draftId,revision,classLabel:classLabel.trim(),appliedOn,variantCount:count,variantMap:preview.map});
   await refreshList();await open(out.id);
   setMsg('Aplicação registrada. Lance as respostas na ordem do cartão de cada versão.');
  }catch(e){setErrs([e instanceof Error?e.message:'Falha ao registrar a aplicação.']);}
  finally{setBusy(false);}
 };
 const update=(key:string,change:Partial<Row>)=>setRows(all=>all.map(r=>r.key===key?{...r,...change,dirty:true}:r));
 const loadRoster=async()=>{
  if(!detail)return;
  setBusy(true);setErrs([]);
  try{
   const roster=await loadAuthorizedClassRoster({institutionId,courseId,disciplineId:discipline,classLabel:detail.classLabel});
   const have=new Set(rows.map(r=>r.studentId).filter(Boolean));
   const add=roster.students.filter(s=>!have.has(s.id)).map((s,i)=>({key:'new-'+s.id,studentId:s.id,label:s.name,
    variant:String.fromCharCode(65+((rows.length+i)%detail.variantCount)),seq:'',disc:{},dirty:true}));
   setRows(all=>[...all,...add]);
   setMsg(add.length+' aluno(s) do período incluído(s). Confira a versão de cada folha antes de salvar.');
  }catch(e){setErrs([e instanceof Error?e.message:'Lista da turma indisponível.']);}
  finally{setBusy(false);}
 };
 const importFile=async(f:File)=>{
  if(!detail||!questions)return;
  if(f.size>5*1024*1024){setErrs(['Planilha acima de 5 MB.']);return;}
  setBusy(true);setErrs([]);
  try{
   let data:unknown[][];
   if(/\.csv$/i.test(f.name))data=parseCsv(await f.text());
   else if(/\.xlsx$/i.test(f.name)){const {readSheet}=await import('read-excel-file/browser');data=await readSheet(f);}
   else throw new Error('Use .xlsx ou .csv.');
   const roster=rows.filter(r=>r.studentId).map(r=>({id:r.studentId!,name:r.label}));
   const parsed=parseResponseRows(data,detail.variantMap,questions,roster);
   if(parsed.errors.length){setErrs(parsed.errors.slice(0,30));return;}
   setRows(all=>{
    const next=[...all];
    for(const s of parsed.sheets){
     const positions=objectivePositions(detail.variantMap,questions,s.variant);
     const seq=positions.map(n=>s.objective[String(n)]||'-').join('');
     const disc=Object.fromEntries(Object.entries(s.discursive).map(([k,v])=>[k,String(v)]));
     const idx=next.findIndex(r=>(s.studentId&&r.studentId===s.studentId)||(!s.studentId&&!r.studentId&&r.label.toLowerCase()===s.label.toLowerCase()));
     const row={key:idx>=0?next[idx].key:'imp-'+s.label,...(s.studentId?{studentId:s.studentId}:{}),label:s.label,variant:s.variant,seq,disc,dirty:true,
      ...(idx>=0&&next[idx].sheetId?{sheetId:next[idx].sheetId}:{})};
     if(idx>=0)next[idx]=row;else next.push(row);
    }
    return next;
   });
   setMsg(parsed.sheets.length+' folha(s) lidas da planilha. Revise e clique em "Salvar lançamentos".');
  }catch(e){setErrs([e instanceof Error?e.message:'Falha ao ler a planilha.']);}
  finally{setBusy(false);}
 };
 const save=async()=>{
  if(!detail||!questions)return;
  const problems:string[]=[];const sheets:SheetInput[]=[];
  for(const r of rows.filter(x=>x.dirty)){
   if(!r.studentId&&!r.label.trim()){problems.push('Há folha sem identificação.');continue;}
   const parsed=parseAnswerString(r.seq,objectivePositions(detail.variantMap,questions,r.variant));
   if(parsed.error){problems.push(r.label+': '+parsed.error);continue;}
   const discursive:Record<string,number>={};
   for(const p of discursivePositions(detail.variantMap,questions,r.variant)){
    const raw=(r.disc[p.questionId]||'').trim().replace(',','.');
    if(!raw)continue;
    const v=Number(raw),max=questions.find(q=>q.id===p.questionId)?.points??0;
    if(!Number.isFinite(v)||v<0||v>max){problems.push(r.label+': nota da questão '+p.n+' deve ficar entre 0 e '+max+'.');continue;}
    discursive[p.questionId]=v;
   }
   sheets.push({...(r.studentId?{studentId:r.studentId}:{label:r.label.trim()}),variant:r.variant,objective:parsed.answers,discursive});
  }
  if(problems.length){setErrs(problems.slice(0,30));return;}
  if(!sheets.length){setMsg('Nenhuma alteração para salvar.');return;}
  setBusy(true);setErrs([]);
  try{
   const n=await saveSheets(institutionId,courseId,detail.id,sheets);
   const d=await getApplication(institutionId,courseId,detail.id);setDetail(d);setRows(rowsFromDetail(d));
   setMsg(n+' folha(s) corrigida(s) pelo servidor a partir do gabarito validado.');
   await refreshList();
  }catch(e){setErrs([e instanceof Error?e.message:'Lançamento não salvo.']);}
  finally{setBusy(false);}
 };
 const removeRow=async(r:Row)=>{
  if(!detail)return;
  if(!r.sheetId){setRows(all=>all.filter(x=>x.key!==r.key));return;}
  if(!window.confirm('Excluir a folha de '+r.label+'?'))return;
  setBusy(true);
  try{await deleteSheet(institutionId,courseId,detail.id,r.sheetId);setRows(all=>all.filter(x=>x.key!==r.key));await refreshList();}
  catch(e){setErrs([e instanceof Error?e.message:'Exclusão recusada.']);}
  finally{setBusy(false);}
 };
 const close=async()=>{
  if(!detail||!window.confirm('Encerrar a aplicação? Os lançamentos ficam bloqueados para alteração.'))return;
  setBusy(true);
  try{await closeApplication(institutionId,courseId,detail.id);await open(detail.id);await refreshList();setMsg('Aplicação encerrada.');}
  catch(e){setErrs([e instanceof Error?e.message:'Não foi possível encerrar.']);}
  finally{setBusy(false);}
 };

 const results=detail?new Map(detail.sheets.map(s=>[s.id,s])):new Map();
 const discQs=questions?.filter(q=>q.kind==='discursiva')||[];
 const editable=detail?.status==='open';
 const scored=detail?.sheets.filter(s=>s.items)||[];
 const mean=scored.length?scored.reduce((a,s)=>a+Number(s.total),0)/scored.length:null;

 return <section aria-label="Aplicação e lançamento de respostas" style={{background:'#fff',border:'1px solid '+line,borderRadius:14,padding:18,marginBottom:16}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}>
   <div><h3 style={{margin:'0 0 4px'}}>Aplicação e respostas · {title}</h3>
    <p style={{margin:0,fontSize:13,color:'#41566F'}}>Caderno validado, versão {revision}. A correção das objetivas é feita no servidor pelo gabarito validado.</p></div>
   <button type="button" style={btn(false)} onClick={onClose}>Fechar</button>
  </div>
  {msg&&<p role="status" style={{fontSize:13,background:'#F5F9FF',padding:'8px 12px',borderRadius:8}}>{msg}</p>}
  {errs.length>0&&<div role="alert" style={{background:'#FFF0F0',padding:12,borderRadius:9,color:'#982F2F',fontSize:13}}><ul style={{margin:0}}>{errs.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}

  {questions&&!detail&&<>
   {apps.length>0&&<><h4>Aplicações registradas</h4><ul style={{listStyle:'none',padding:0,display:'grid',gap:8}}>
    {apps.map(a=><li key={a.id} style={{border:'1px solid '+line,borderRadius:9,padding:'10px 12px',display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}>
     <span><strong>{a.classLabel}</strong> · {new Date(a.appliedOn+'T12:00:00').toLocaleDateString('pt-BR')} · {a.variantCount} versão(ões) · {a.sheets} folha(s){a.status==='closed'?' · encerrada':''}</span>
     <button type="button" style={btn(true)} disabled={busy} onClick={()=>void open(a.id)}>Abrir lançamentos</button>
    </li>)}</ul></>}
   <fieldset style={{border:'1px solid '+line,borderRadius:10,padding:12,marginTop:12}}>
    <legend style={{fontWeight:700}}>Registrar nova aplicação</legend>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
     <label style={{fontSize:13,fontWeight:600}}>Turma (período)<input style={input} value={classLabel} onChange={e=>setClassLabel(e.target.value)} placeholder="Ex.: 3º período"/></label>
     <label style={{fontSize:13,fontWeight:600}}>Data<input style={input} type="date" value={appliedOn} onChange={e=>setAppliedOn(e.target.value)}/></label>
     <label style={{fontSize:13,fontWeight:600}}>Versões impressas<select style={input} value={count} onChange={e=>setCount(Number(e.target.value))}>
      {Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
     <label style={{fontSize:13,fontWeight:600}}>Embaralhamento<select style={input} value={mode} onChange={e=>setMode(e.target.value as ShuffleMode)}>
      <option value="ambos">Questões e alternativas</option><option value="questoes">Só questões</option><option value="alternativas">Só alternativas</option></select></label>
    </div>
    <p style={{fontSize:12,color:'#7A4B00'}}>Use exatamente a quantidade de versões e o embaralhamento usados na impressão. Confira o gabarito abaixo com o gabarito impresso antes de registrar.</p>
    {count>maxVariants&&<p role="alert" style={{fontSize:13,color:'#982F2F'}}>Este caderno admite no máximo {maxVariants} versão(ões) distintas nesse modo.</p>}
    {preview&&<table style={{fontSize:13,borderCollapse:'collapse'}}><tbody>
     {Object.entries(preview.key).map(([v,k])=><tr key={v}><th style={{textAlign:'left',padding:'2px 10px 2px 0'}}>Versão {v}</th>
      <td style={{fontFamily:'monospace',letterSpacing:2}}>{k||'(sem objetivas)'}</td></tr>)}
    </tbody></table>}
    <button type="button" style={{...btn(true),marginTop:10}} disabled={busy||!preview} onClick={()=>void create()}>Registrar aplicação</button>
   </fieldset>
  </>}

  {detail&&questions&&<div>
   <p style={{fontSize:13}}><strong>{detail.classLabel}</strong> · {new Date(detail.appliedOn+'T12:00:00').toLocaleDateString('pt-BR')} · {detail.variantCount} versão(ões) · {detail.sheets.length} folha(s)
    {mean!==null&&<> · média {mean.toFixed(2)} de {Number(detail.sheets[0]?.max??0).toFixed(2)}</>}{!editable&&' · encerrada'}</p>
   {draft&&<IssuedPapersPanel key={detail.id} institutionId={institutionId} courseId={courseId} discipline={discipline}
     courseName={courseName} institutionName={institutionName||'Instituição'} detail={detail} draft={draft}
     onSaved={async()=>{const d=await getApplication(institutionId,courseId,detail.id);setDetail(d);setRows(rowsFromDetail(d));await refreshList();}}/>}
   <p style={{fontSize:12,color:'#41566F'}}>Digite as letras na ordem do cartão da versão do aluno (ex.: ABDCA). Use "-" para branco e "*" para dupla marcação. Planilha: colunas Aluno, Versão, Respostas (ou Q1, Q2…) e D&lt;n&gt; para as notas das discursivas pelo número impresso.</p>
   {editable&&<div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'8px 0'}}>
    <button type="button" style={btn(false)} disabled={busy} onClick={()=>void loadRoster()}>Carregar alunos do período</button>
    <button type="button" style={btn(false)} disabled={busy} onClick={()=>setRows(all=>[...all,{key:'man-'+crypto.randomUUID(),label:'',variant:'A',seq:'',disc:{},dirty:true}])}>Adicionar folha</button>
    <button type="button" style={btn(false)} disabled={busy} onClick={()=>file.current?.click()}>Importar planilha (.xlsx ou .csv)</button>
    <input hidden ref={file} type="file" accept=".xlsx,.csv" aria-label="Planilha de respostas" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';if(f)void importFile(f);}}/>
   </div>}
   <div style={{overflowX:'auto'}}>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
     <thead><tr style={{textAlign:'left',borderBottom:'2px solid '+line}}>
      <th style={{padding:6}}>Aluno</th><th style={{padding:6}}>Versão</th><th style={{padding:6}}>Objetivas</th>
      {discQs.map((q,i)=><th key={q.id} style={{padding:6}} title={q.statement}>Discursiva {i+1} (máx. {q.points})</th>)}
      <th style={{padding:6}}>Resultado</th><th/></tr></thead>
     <tbody>{rows.map(r=>{
      const res=r.sheetId&&!r.dirty?results.get(r.sheetId):undefined;
      const positions=objectivePositions(detail.variantMap,questions,r.variant);
      const check=r.seq?parseAnswerString(r.seq,positions):{answers:{}};
      return <tr key={r.key} style={{borderBottom:'1px solid '+line,background:r.dirty?'#FFFDF5':undefined}}>
       <td style={{padding:6,minWidth:160}}>{r.studentId?r.label:<input style={input} value={r.label} disabled={!editable} onChange={e=>update(r.key,{label:e.target.value})} placeholder="Nome ou código"/>}</td>
       <td style={{padding:6}}><select style={input} value={r.variant} disabled={!editable} onChange={e=>update(r.key,{variant:e.target.value})}>
        {Object.keys(detail.variantMap).sort().map(v=><option key={v}>{v}</option>)}</select></td>
       <td style={{padding:6,minWidth:150}}><input style={{...input,fontFamily:'monospace',letterSpacing:2}} value={r.seq} disabled={!editable}
        aria-invalid={Boolean(check.error)} onChange={e=>update(r.key,{seq:e.target.value.toUpperCase()})} placeholder={'-'.repeat(positions.length)}/>
        <small style={{color:check.error?'#982F2F':'#64748b'}}>{check.error||positions.length+' objetiva(s)'}</small></td>
       {discQs.map(q=><td key={q.id} style={{padding:6,width:90}}><input style={input} inputMode="decimal" value={r.disc[q.id]||''} disabled={!editable}
        onChange={e=>update(r.key,{disc:{...r.disc,[q.id]:e.target.value}})} placeholder="—"/></td>)}
       <td style={{padding:6,whiteSpace:'nowrap'}}>{res?<><strong>{Number(res.total).toFixed(2)}</strong> / {Number(res.max).toFixed(2)}
        <div style={{fontFamily:'monospace',letterSpacing:1}}>{(res.items||[]).map((i:{outcome:keyof typeof outcomeMark})=>outcomeMark[i.outcome]).join('')}</div></>:r.dirty?'não salvo':'—'}</td>
       <td style={{padding:6}}>{editable&&<button type="button" style={{...btn(false),padding:'4px 8px'}} disabled={busy} onClick={()=>void removeRow(r)} aria-label={'Remover '+r.label}>×</button>}</td>
      </tr>;})}</tbody>
    </table>
   </div>
   <p style={{fontSize:12,color:'#64748b'}}>Legenda: ✓ acerto · ✗ erro · – branco · * dupla marcação · ● discursiva com nota · ? discursiva sem nota. A ordem segue o número impresso na versão do aluno.</p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
    <button type="button" style={btn(false)} onClick={()=>{setDetail(null);setRows([]);setMsg('');setErrs([]);}}>← Aplicações</button>
    {editable&&<button type="button" style={btn(true)} disabled={busy||!rows.some(r=>r.dirty)} onClick={()=>void save()}>Salvar lançamentos</button>}
    {editable&&<button type="button" style={btn(false)} disabled={busy} onClick={()=>void close()}>Encerrar aplicação</button>}
    <button type="button" style={btn(showAnalysis)} disabled={busy||!detail.sheets.length||rows.some(r=>r.dirty)}
     onClick={()=>setShowAnalysis(v=>!v)}>{showAnalysis?'Ocultar análise':'Análise das questões'}</button>
    <button type="button" style={btn(showMastery)} disabled={busy||!detail.sheets.length||rows.some(r=>r.dirty)}
     onClick={()=>setShowMastery(v=>!v)}>{showMastery?'Ocultar domínio':'Domínio por competência'}</button>
    <button type="button" style={btn(showErrors)} disabled={busy||!detail.sheets.length||rows.some(r=>r.dirty)}
     onClick={()=>setShowErrors(v=>!v)}>{showErrors?'Ocultar mapa de erros':'Mapa de erros'}</button>
    <button type="button" style={btn(showQuality)} disabled={busy||!detail.sheets.length||rows.some(r=>r.dirty)}
     onClick={()=>setShowQuality(v=>!v)}>{showQuality?'Ocultar qualidade':'Justiça e dupla correção'}</button>
   </div>
   {showQuality&&<QualityPanel key={'q'+detail.id+':'+detail.sheets.length} institutionId={institutionId} courseId={courseId} applicationId={detail.id}/>}
   {showErrors&&<ErrorMapPanel key={'e'+detail.id+':'+detail.sheets.length} institutionId={institutionId} courseId={courseId}
     scope={{applicationId:detail.id}} title={'Mapa de erros · '+detail.classLabel}/>}
   {showMastery&&<CompetencyDiagnosisPanel key={'m'+detail.id+':'+detail.sheets.length} institutionId={institutionId} courseId={courseId}
     scope={{applicationId:detail.id}} title={'Domínio por competência · '+detail.classLabel}/>}
   {showAnalysis&&<ItemAnalysisPanel key={detail.id+':'+detail.sheets.length+':'+detail.status} institutionId={institutionId} courseId={courseId} applicationId={detail.id}/>}
  </div>}
 </section>;
}
