import {useState} from 'react';
import {loadCompetencyEvidence} from './competency-api';
import {computeMastery,levelLabel,type CompetencyEvidence} from './competency-mastery';
import {listInstitutionalBank} from './question-bank-api';
import {loadBankCalibration} from './analysis-api';
import {toAssemblyItems,type AssemblyItem,type Calibration} from './exam-assembly';
import {buildRecoveryPlan,nextDue,RECOVERY_RULES,recoveryCsv,scheduleItems,type RecoveryProposal} from './recovery';
import {closeRecoveryPlan,createRecoveryPlans,listRecoveryPlans,loadErrorEvidence,recordReview,type StoredPlan} from './recovery-api';
import {studentMisconceptions,type ErrorEvidence} from './error-map';
import ErrorMapPanel from './ErrorMapPanel';

const blue='#164B92',line='#DCE7F4';
const btn=(primary:boolean)=>({padding:'8px 12px',borderRadius:8,border:'1px solid '+blue,background:primary?blue:'#fff',color:primary?'#fff':blue,fontWeight:700,cursor:'pointer'} as const);
const today=()=>new Date().toISOString().slice(0,10);
const br=(iso:string|null)=>iso?new Date(iso+'T12:00:00').toLocaleDateString('pt-BR'):'—';

/** Recuperação personalizada: planos por aluno a partir do diagnóstico por competência, com repetição espaçada. */
export default function RecoveryPanel({institutionId,courseId,discipline}:{institutionId:string;courseId:string;discipline:string}){
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');
 const [ctx,setCtx]=useState<{evidence:CompetencyEvidence;errors:ErrorEvidence;items:AssemblyItem[];calibration:Record<string,Calibration>}|null>(null);
 const [proposals,setProposals]=useState<Array<{studentId:string;label:string;proposal:RecoveryProposal}>>([]);
 const [selected,setSelected]=useState<Set<string>>(new Set());
 const [plans,setPlans]=useState<StoredPlan[]>([]);
 const [startOn,setStartOn]=useState(today());
 const [showMap,setShowMap]=useState(false);
 const name=(k:string)=>{const c=ctx?.evidence.competencies.find(x=>x.key===k);return c?(c.code?c.code+' ':'')+(c.title||''):k.replace(/^cmp:/,'');};
 const refreshPlans=async()=>setPlans(await listRecoveryPlans(institutionId,courseId,discipline));
 const load=async()=>{
  setBusy(true);setMsg('');
  try{
   const [evidence,errors,records,calibration]=await Promise.all([
    loadCompetencyEvidence(institutionId,courseId,{discipline}),loadErrorEvidence(institutionId,courseId,{discipline}),
    listInstitutionalBank(institutionId,courseId,discipline,''),loadBankCalibration(institutionId,courseId,discipline).catch(()=>({}))]);
   const items=toAssemblyItems(records,calibration,{});
   const masteries=computeMastery(evidence);
   const byStudent=new Map<string,{label:string;list:typeof masteries}>();
   for(const m of masteries)if(m.studentId){const cur=byStudent.get(m.studentId)||{label:m.label,list:[]};cur.list.push(m);byStudent.set(m.studentId,cur);}
   const answered=new Map(errors.answeredBank.filter(a=>a.studentId).map(a=>[a.studentId as string,new Set(a.bankIds)]));
   const props=[...byStudent.entries()].map(([studentId,v])=>({studentId,label:v.label,
    proposal:buildRecoveryPlan({masteries:v.list,items,calibration,answered:answered.get(studentId)||new Set()})}))
    .filter(p=>p.proposal.competencies.length>0).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
   setCtx({evidence,errors,items,calibration});setProposals(props);
   setSelected(new Set(props.filter(p=>p.proposal.items.length).map(p=>p.studentId)));
   await refreshPlans();
   setMsg(props.length+' aluno(s) com competência não demonstrada ou em desenvolvimento, nas aplicações encerradas desta disciplina.');
  }catch(e){setMsg(e instanceof Error?e.message:'Não foi possível montar a recuperação.');}
  finally{setBusy(false);}
 };
 const create=async()=>{
  const chosen=proposals.filter(p=>selected.has(p.studentId)&&p.proposal.items.length);
  if(!chosen.length)return;
  setBusy(true);
  try{
   const out=await createRecoveryPlans(institutionId,courseId,discipline,chosen.map(p=>({studentId:p.studentId,startOn,rulesVersion:RECOVERY_RULES.version,
    competencies:p.proposal.competencies,items:p.proposal.items})));
   await refreshPlans();setMsg(out.created+' plano(s) de recuperação criado(s).');
  }catch(e){setMsg(e instanceof Error?e.message:'Planos não criados.');}
  finally{setBusy(false);}
 };
 const record=async(plan:StoredPlan,bankId:string,correct:boolean)=>{
  setBusy(true);
  try{await recordReview(institutionId,courseId,plan.id,{bankId,on:today(),correct});await refreshPlans();}
  catch(e){setMsg(e instanceof Error?e.message:'Revisão não registrada.');}
  finally{setBusy(false);}
 };
 const close=async(plan:StoredPlan)=>{
  if(!window.confirm('Encerrar o plano de '+plan.label+'?'))return;
  setBusy(true);
  try{await closeRecoveryPlan(institutionId,courseId,plan.id);await refreshPlans();}
  catch(e){setMsg(e instanceof Error?e.message:'Não foi possível encerrar.');}
  finally{setBusy(false);}
 };
 const exportCsv=()=>{
  const rows=plans.flatMap(p=>{const s=scheduleItems(p.items,p.startOn,p.log);
   return p.items.map(it=>{const st=s.find(x=>x.bankId===it.bankId)!;
    return {student:p.label,competency:name(it.competency),statement:it.statement||it.bankId,due:st.due,status:st.status==='consolidado'?'consolidado':'em revisão',reviews:st.reviews};});});
  const blob=new Blob(['﻿'+recoveryCsv(rows)],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='recuperacao-'+discipline.replace(/\s+/g,'-').toLowerCase()+'.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 };
 return <section aria-label="Recuperação personalizada" style={{background:'#fff',border:'1px solid '+line,borderRadius:14,padding:18,marginBottom:16}}>
  <h3 style={{margin:'0 0 4px'}}>Recuperação personalizada · {discipline}</h3>
  <p style={{margin:'0 0 10px',fontSize:13,color:'#41566F'}}>Para cada aluno, questões do banco ainda não respondidas nas competências que ele não demonstrou, com acerto esperado entre {RECOVERY_RULES.bandLow*100}% e {RECOVERY_RULES.bandHigh*100}%.
   Revisões em {RECOVERY_RULES.intervals.join(', ')} dias: acerto avança, erro recomeça. Regras v{RECOVERY_RULES.version}.</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
   <button type="button" style={btn(!ctx)} disabled={busy} onClick={()=>void load()}>{busy?'Carregando…':ctx?'Recalcular':'Calcular recuperação da disciplina'}</button>
   {ctx&&<button type="button" style={btn(showMap)} onClick={()=>setShowMap(v=>!v)}>{showMap?'Ocultar mapa de erros':'Mapa de erros da disciplina'}</button>}
   {plans.length>0&&<button type="button" style={btn(false)} onClick={exportCsv}>Exportar planos (CSV)</button>}
  </div>
  {msg&&<p role="status" style={{fontSize:13,background:'#F5F9FF',padding:'8px 12px',borderRadius:8}}>{msg}</p>}
  {showMap&&<ErrorMapPanel institutionId={institutionId} courseId={courseId} scope={{discipline}} title={'Mapa de erros · '+discipline+' (aplicações encerradas)'}/>}
  {ctx&&proposals.length>0&&<div style={{marginTop:10}}>
   <h4 style={{margin:'6px 0'}}>Propostas de plano</h4>
   <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
    <thead><tr style={{textAlign:'left',borderBottom:'2px solid '+line}}><th style={{padding:6}}/><th style={{padding:6}}>Aluno</th><th style={{padding:6}}>Competências-alvo</th><th style={{padding:6}}>Questões</th><th style={{padding:6}}>Erros mais frequentes</th></tr></thead>
    <tbody>{proposals.map(p=>{const mis=studentMisconceptions(ctx.errors,{studentId:p.studentId,label:p.label}).slice(0,2);
     const ms=computeMastery(ctx.evidence).filter(m=>m.studentId===p.studentId);
     return <tr key={p.studentId} style={{borderBottom:'1px solid '+line}}>
      <td style={{padding:6}}><input type="checkbox" disabled={!p.proposal.items.length} checked={selected.has(p.studentId)} aria-label={'Incluir '+p.label}
       onChange={e=>setSelected(s=>{const n=new Set(s);if(e.target.checked)n.add(p.studentId);else n.delete(p.studentId);return n;})}/></td>
      <td style={{padding:6}}>{p.label}</td>
      <td style={{padding:6,fontSize:12}}>{p.proposal.competencies.map(k=>{const mm=ms.find(x=>x.competency===k);return name(k)+(mm?' ('+levelLabel[mm.level].toLowerCase()+')':'');}).join('; ')}
       {p.proposal.gaps.length>0&&<div style={{color:'#7A4B00'}}>Sem questão adequada no banco: {p.proposal.gaps.map(name).join(', ')}</div>}</td>
      <td style={{padding:6}}>{p.proposal.items.length}{p.proposal.items.some(i=>i.source==='declarada')?' (algumas só com dificuldade declarada)':''}</td>
      <td style={{padding:6,fontSize:12}}>{mis.map(x=>x.note).join('; ')||'—'}</td></tr>;})}</tbody>
   </table>
   <div style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap',marginTop:8}}>
    <label style={{fontSize:13,fontWeight:600}}>Início<input type="date" value={startOn} onChange={e=>setStartOn(e.target.value)} style={{display:'block',padding:'7px 9px',border:'1px solid '+line,borderRadius:7}}/></label>
    <button type="button" style={btn(true)} disabled={busy||!selected.size} onClick={()=>void create()}>Criar {selected.size} plano(s)</button>
   </div>
  </div>}
  {plans.length>0&&<div style={{marginTop:14}}>
   <h4 style={{margin:'6px 0'}}>Planos ativos</h4>
   {plans.map(p=>{const s=scheduleItems(p.items,p.startOn,p.log);const due=nextDue(s);const late=due!==null&&due<today();
    return <details key={p.id} style={{border:'1px solid '+line,borderRadius:9,padding:'8px 12px',marginBottom:8}}>
     <summary style={{cursor:'pointer',fontSize:13}}><strong>{p.label}</strong> · {p.items.length} questão(ões) · {s.filter(x=>x.status==='consolidado').length} consolidada(s)
      · próxima revisão <span style={{color:late?'#982F2F':undefined,fontWeight:late?700:400}}>{due?br(due)+(late?' (atrasada)':''):'concluído'}</span></summary>
     <ul style={{listStyle:'none',padding:0,margin:'8px 0',display:'grid',gap:6}}>
      {p.items.map(it=>{const st=s.find(x=>x.bankId===it.bankId)!;
       return <li key={it.bankId} style={{fontSize:13,display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <span>{(it.statement||it.bankId).slice(0,110)} <span style={{color:'#41566F'}}>· {name(it.competency)} · {st.status==='consolidado'?'consolidada':'caixa '+(st.box+1)+' de '+RECOVERY_RULES.intervals.length+', revisar em '+br(st.due)}</span></span>
        {st.status!=='consolidado'&&<span style={{display:'flex',gap:6}}>
         <button type="button" style={btn(false)} disabled={busy} onClick={()=>void record(p,it.bankId,true)}>Acertou</button>
         <button type="button" style={btn(false)} disabled={busy} onClick={()=>void record(p,it.bankId,false)}>Errou</button></span>}
       </li>;})}
     </ul>
     <button type="button" style={btn(false)} disabled={busy} onClick={()=>void close(p)}>Encerrar plano</button>
    </details>;})}
  </div>}
 </section>;
}
