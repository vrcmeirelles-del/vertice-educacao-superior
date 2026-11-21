import {useMemo,useState} from 'react';
import {listInstitutionalBank} from './question-bank-api';
import {loadBankCalibration,loadBankExposure} from './analysis-api';
import {ASSEMBLY_RULES,assembleExam,toAssemblyItems,toDraftQuestions,type AssemblyItem,type AssemblyResult} from './exam-assembly';
import {competencyKeyOf} from './competency-key';
import type {DeclaredCompetency} from './declared-analysis';
import type {QuestionDraft} from './question-draft';

const blue='#164B92',line='#DCE7F4';
const btn=(primary:boolean)=>({padding:'9px 14px',borderRadius:9,border:'1px solid '+blue,background:primary?blue:'#fff',
 color:primary?'#fff':blue,fontWeight:700,cursor:'pointer'} as const);
const input={padding:'8px 10px',border:'1px solid '+line,borderRadius:7,width:'100%',minWidth:0,background:'#fff'} as const;
const levelName=['','muito fácil','fácil','média','difícil','muito difícil'];

/** Montagem automática de prova pelo Banco de Questões calibrado. Gera um rascunho comum, que segue o fluxo do colegiado. */
export default function AssemblyPanel({institutionId,courseId,discipline,catalog,defaultTarget,onAssemble}:{
 institutionId:string;courseId:string;discipline:string;catalog:DeclaredCompetency[];defaultTarget:number;
 onAssemble:(questions:QuestionDraft[],catalog:DeclaredCompetency[],requiredIds:string[])=>void;
}){
 const [items,setItems]=useState<AssemblyItem[]|null>(null);
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');
 const [classLabel,setClassLabel]=useState('');const [months,setMonths]=useState(6);
 const [total,setTotal]=useState(10);const [target,setTarget]=useState(defaultTarget||3);
 const [kinds,setKinds]=useState<Array<'objetiva'|'discursiva'>>(['objetiva','discursiva']);
 const [counts,setCounts]=useState<Record<string,number>>({});
 const [result,setResult]=useState<AssemblyResult|null>(null);
 const load=async()=>{
  setBusy(true);setMsg('');setResult(null);
  try{
   const [records,calibration,exposure]=await Promise.all([
    listInstitutionalBank(institutionId,courseId,discipline,''),
    loadBankCalibration(institutionId,courseId,discipline).catch(()=>({})),
    loadBankExposure(institutionId,courseId,discipline,classLabel.trim())]);
   setItems(toAssemblyItems(records,calibration,exposure));
   setMsg(records.length+' questão(ões) no banco desta disciplina.'+(classLabel.trim()?' Exposição calculada para a turma "'+classLabel.trim()+'".':' Exposição calculada em todas as turmas da disciplina.'));
  }catch(e){setMsg(e instanceof Error?e.message:'Banco indisponível.');}
  finally{setBusy(false);}
 };
 const comps=useMemo(()=>{
  const m=new Map<string,{key:string;code:string;title:string;available:number}>();
  for(const it of items||[])for(const d of it.record.competencies??[]){
   const key=competencyKeyOf(d);if(!it.competencyKeys.includes(key))continue;
   const cur=m.get(key)||{key,code:d.code,title:d.title,available:0};cur.available++;m.set(key,cur);
  }
  return [...m.values()].sort((a,b)=>a.code.localeCompare(b.code,'pt-BR')||a.key.localeCompare(b.key));
 },[items]);
 const run=()=>{
  if(!items)return;
  try{
   setResult(assembleExam(items,{total,targetLevel:target,kinds,exposureMonths:months,referenceDate:new Date().toISOString().slice(0,10),
    requirements:Object.entries(counts).filter(([,n])=>n>0).map(([key,count])=>({key,count}))}));
   setMsg('');
  }catch(e){setMsg(e instanceof Error?e.message:'Especificação inválida.');}
 };
 const apply=()=>{
  if(!result?.selected.length)return;
  const {questions,catalog:next}=toDraftQuestions(result.selected,discipline,catalog);
  const required=Object.entries(counts).filter(([,n])=>n>0).map(([k])=>next.find(c=>competencyKeyOf(c)===k)?.id).filter((x):x is string=>Boolean(x));
  onAssemble(questions,next,required);
 };
 const name=(k:string)=>{const c=comps.find(x=>x.key===k);return c?c.code+' '+c.title:k.replace(/^cmp:/,'');};
 return <section aria-label="Montagem automática de prova" style={{background:'#fff',border:'1px solid '+line,borderRadius:14,padding:18,marginBottom:16}}>
  <h3 style={{margin:'0 0 4px'}}>Montar prova a partir do Banco de Questões</h3>
  <p style={{margin:'0 0 10px',fontSize:13,color:'#41566F'}}>Algoritmo determinístico: cobre as competências pedidas, aproxima a dificuldade-alvo usando a dificuldade <strong>observada</strong> nas aplicações encerradas, prioriza as questões que mais discriminam e evita repetir questões aplicadas recentemente à turma. A prova vira um rascunho e segue checklist e colegiado. Regras v{ASSEMBLY_RULES.version}.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>
   <label style={{fontSize:13,fontWeight:600}}>Turma (para exposição)<input style={input} value={classLabel} onChange={e=>setClassLabel(e.target.value)} placeholder="Ex.: 3º período (vazio = todas)"/></label>
   <label style={{fontSize:13,fontWeight:600}}>Não repetir aplicadas nos últimos<select style={input} value={months} onChange={e=>setMonths(Number(e.target.value))}>
    {[0,3,6,12,24].map(m=><option key={m} value={m}>{m===0?'sem restrição':m+' meses'}</option>)}</select></label>
  </div>
  <button type="button" style={{...btn(!items),marginTop:10}} disabled={busy||!discipline.trim()} onClick={()=>void load()}>{busy?'Carregando…':items?'Recarregar banco':'Carregar banco calibrado'}</button>
  {msg&&<p role="status" style={{fontSize:13,background:'#F5F9FF',padding:'8px 12px',borderRadius:8}}>{msg}</p>}
  {items&&<>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginTop:12}}>
    <label style={{fontSize:13,fontWeight:600}}>Total de questões<input style={input} type="number" min={1} max={200} value={total} onChange={e=>setTotal(Number(e.target.value))}/></label>
    <label style={{fontSize:13,fontWeight:600}}>Dificuldade-alvo (média)<select style={input} value={target} onChange={e=>setTarget(Number(e.target.value))}>
     {[1,1.5,2,2.5,3,3.5,4,4.5,5].map(v=><option key={v} value={v}>{String(v).replace('.',',')}{Number.isInteger(v)?' · '+levelName[v]:''}</option>)}</select></label>
    <fieldset style={{border:'none',padding:0,margin:0,fontSize:13}}><legend style={{fontWeight:600}}>Tipos</legend>
     {(['objetiva','discursiva'] as const).map(k=><label key={k} style={{marginRight:10}}><input type="checkbox" checked={kinds.includes(k)}
      onChange={e=>setKinds(v=>e.target.checked?[...v,k]:v.filter(x=>x!==k))}/> {k}</label>)}</fieldset>
   </div>
   <h4 style={{margin:'14px 0 6px'}}>Tabela de especificação</h4>
   {comps.length===0?<p style={{fontSize:13}}>As questões do banco não têm competências identificáveis. Elas ainda podem ser usadas pelo total e pela dificuldade.</p>:
    <table style={{borderCollapse:'collapse',fontSize:13}}><thead><tr><th style={{textAlign:'left',padding:4}}>Competência</th><th style={{padding:4}}>No banco</th><th style={{padding:4}}>Questões pedidas</th></tr></thead>
     <tbody>{comps.map(c=><tr key={c.key}><td style={{padding:4}}>{c.code} {c.title}</td><td style={{padding:4,textAlign:'center'}}>{c.available}</td>
      <td style={{padding:4}}><input style={{...input,width:80}} type="number" min={0} max={200} value={counts[c.key]||0}
       onChange={e=>setCounts(v=>({...v,[c.key]:Math.max(0,Number(e.target.value)||0)}))}/></td></tr>)}</tbody></table>}
   <button type="button" style={{...btn(true),marginTop:10}} disabled={!kinds.length} onClick={run}>Montar prova</button>
  </>}
  {result&&<div style={{marginTop:12,borderTop:'1px solid '+line,paddingTop:10}}>
   <p style={{fontSize:13,margin:'0 0 6px'}}><strong>{result.selected.length} questão(ões)</strong> · dificuldade média {result.meanLevel===null?'—':result.meanLevel.toFixed(2).replace('.',',')} (alvo {String(target).replace('.',',')})
    · {result.observedCount} com dificuldade observada, {result.declaredCount} só com a declarada · {result.eligible} elegíveis
    · excluídas: {result.excluded.exposure} por exposição, {result.excluded.weak} por discriminação fraca, {result.excluded.kind} pelo tipo</p>
   {result.shortfalls.length>0&&<ul role="alert" style={{background:'#FFF7E6',color:'#7A4B00',borderRadius:8,padding:'8px 12px 8px 28px',fontSize:13,margin:'6px 0'}}>{result.shortfalls.map((s,i)=><li key={i}>{s}</li>)}</ul>}
   {result.coverage.length>0&&<p style={{fontSize:13}}>Cobertura: {result.coverage.map(c=>name(c.key)+' '+c.obtained+'/'+c.requested).join(' · ')}</p>}
   <ol style={{fontSize:13,paddingLeft:20}}>{result.selected.map(s=><li key={s.bankId} style={{marginBottom:4}}>
    {s.record.question.statement.slice(0,110)}{s.record.question.statement.length>110?'…':''}
    <span style={{color:'#41566F'}}> · nível {s.level} ({s.levelSource}) · discriminação {s.discrimination===null?'—':s.discrimination.toFixed(2).replace('.',',')}
     {s.competencyKeys.length?' · '+s.competencyKeys.map(name).join(', '):''}{s.lastAppliedOn?' · última aplicação '+new Date(s.lastAppliedOn+'T12:00:00').toLocaleDateString('pt-BR'):''}</span></li>)}</ol>
   <button type="button" style={btn(true)} disabled={!result.selected.length} onClick={apply}>Abrir como novo rascunho</button>
  </div>}
 </section>;
}
