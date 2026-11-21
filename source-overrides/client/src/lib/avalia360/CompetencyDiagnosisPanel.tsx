import {useEffect,useMemo,useState} from 'react';
import {loadCompetencyEvidence,type EvidenceScope} from './competency-api';
import {classMap,classRootCauses,classStatusLabel,computeMastery,diagnoseStudents,levelLabel,MASTERY_RULES,
 type CompetencyEvidence,type MasteryLevel,type StudentDiagnosis} from './competency-mastery';

const blue='#164B92',line='#DCE7F4';
const tone:Record<MasteryLevel,{bg:string;fg:string;mark:string}>={
 domina:{bg:'#DDF3E4',fg:'#14532D',mark:'●'},em_desenvolvimento:{bg:'#FFF1D6',fg:'#713F12',mark:'◐'},
 nao_demonstrado:{bg:'#FDE2E2',fg:'#7F1D1D',mark:'○'},evidencia_insuficiente:{bg:'#F1F5F9',fg:'#475569',mark:'·'},
};
const pct=(v:number|null)=>v===null?'—':Math.round(v*100)+'%';

/** Diagnóstico por competência: mapa da turma, ações e causa-raiz. Algoritmo em competency-mastery.ts. */
export default function CompetencyDiagnosisPanel({institutionId,courseId,scope,title}:{
 institutionId:string;courseId:string;scope:EvidenceScope;title:string;
}){
 const [data,setData]=useState<CompetencyEvidence|null>(null);
 const [msg,setMsg]=useState('');
 const [selected,setSelected]=useState<StudentDiagnosis|null>(null);
 const [history,setHistory]=useState<{label:string;data:CompetencyEvidence}|null>(null);
 const scopeKey=JSON.stringify(scope);
 useEffect(()=>{
  let live=true;setData(null);setMsg('');setSelected(null);setHistory(null);
  loadCompetencyEvidence(institutionId,courseId,JSON.parse(scopeKey) as EvidenceScope)
   .then(d=>{if(live)setData(d);}).catch(e=>{if(live)setMsg(e instanceof Error?e.message:'Diagnóstico indisponível.');});
  return()=>{live=false;};
 },[institutionId,courseId,scopeKey]);
 const view=useMemo(()=>{
  if(!data)return null;
  const masteries=computeMastery(data);
  const diagnoses=diagnoseStudents(masteries,data.relations);
  return {masteries,diagnoses,map:classMap(masteries,data.competencies),causes:classRootCauses(diagnoses),
   name:new Map(data.competencies.map(c=>[c.key,(c.code?c.code+' ':'')+(c.title||'')]))};
 },[data]);
 const openHistory=async(d:StudentDiagnosis)=>{
  if(!d.studentId)return;
  try{setHistory({label:d.label,data:await loadCompetencyEvidence(institutionId,courseId,{studentId:d.studentId})});}
  catch(e){setMsg(e instanceof Error?e.message:'Histórico indisponível.');}
 };
 if(msg)return <p role="alert" style={{fontSize:13,color:'#982F2F'}}>{msg}</p>;
 if(!data||!view)return <p role="status" style={{fontSize:13}}>Calculando o diagnóstico…</p>;
 const label=(k:string)=>view.name.get(k)||k;
 const retomar=view.map.filter(c=>c.status==='retomar');
 return <section aria-label={title} style={{border:'1px solid '+line,borderRadius:12,padding:14,margin:'14px 0',background:'#FBFDFF'}}>
  <h4 style={{margin:'0 0 6px',color:blue}}>{title}</h4>
  <p style={{fontSize:12,color:'#41566F',margin:'0 0 10px'}}>
   {data.applications.length} aplicação(ões){data.scope!=='application'?' encerrada(s)':''} · {view.diagnoses.length} aluno(s) · {data.competencies.length} competência(s).
   Domínio ≥ {MASTERY_RULES.mastered*100}% · em desenvolvimento ≥ {MASTERY_RULES.developing*100}% · mínimo de {MASTERY_RULES.minItems} questões por competência.
   {data.scope!=='application'&&' Aplicações recentes pesam mais (meia-vida de '+MASTERY_RULES.halfLifeDays+' dias).'} Regras v{MASTERY_RULES.version}.
  </p>
  {!data.competencies.length&&<p role="note" style={{fontSize:13}}>As questões aplicadas não têm competências vinculadas. Vincule competências no caderno para habilitar o diagnóstico.</p>}

  {(retomar.length>0||view.causes.length>0)&&<div style={{background:'#fff',border:'1px solid '+line,borderRadius:9,padding:'10px 12px',marginBottom:12}}>
   <strong style={{fontSize:14}}>Ações sugeridas para a turma</strong>
   <ul style={{margin:'6px 0 0',paddingLeft:18,fontSize:13}}>
    {retomar.map(c=><li key={c.competency}><strong>Retomar {label(c.competency)}</strong>: {pct(c.belowShare)} dos {c.evaluated} alunos avaliados abaixo de {MASTERY_RULES.classGapThreshold*100}% (média {pct(c.mean)}).</li>)}
    {view.causes.slice(0,6).map(c=><li key={c.competency+c.root}>Para <strong>{c.students} aluno(s)</strong>, a dificuldade em {label(c.competency)} tem origem provável no pré-requisito <strong>{label(c.root)}</strong>: trabalhe a base antes de insistir no conteúdo atual.</li>)}
   </ul>
  </div>}

  {data.competencies.length>0&&<div style={{overflowX:'auto'}}>
   <table style={{borderCollapse:'collapse',fontSize:12,minWidth:'100%'}}>
    <thead>
     <tr><th style={{textAlign:'left',padding:6,position:'sticky',left:0,background:'#FBFDFF'}}>Aluno</th>
      {data.competencies.map(c=><th key={c.key} title={c.title||''} style={{padding:6,textAlign:'center',minWidth:70}}>{c.code||c.title}</th>)}</tr>
     <tr><th style={{textAlign:'left',padding:6,fontWeight:400,color:'#41566F',position:'sticky',left:0,background:'#FBFDFF'}}>Turma</th>
      {view.map.map(c=><th key={c.competency} style={{padding:4,fontWeight:600,fontSize:11,color:c.status==='retomar'?'#982F2F':c.status==='consolidada'?'#14532D':'#41566F'}}>
       {pct(c.mean)}<div style={{fontWeight:400}}>{classStatusLabel[c.status]}</div></th>)}</tr>
    </thead>
    <tbody>{view.diagnoses.map(d=><tr key={d.studentKey} style={{borderTop:'1px solid '+line,cursor:'pointer',outline:selected?.studentKey===d.studentKey?'2px solid '+blue:undefined}}
      onClick={()=>{setSelected(selected?.studentKey===d.studentKey?null:d);setHistory(null);}}>
     <td style={{padding:6,position:'sticky',left:0,background:'#fff',whiteSpace:'nowrap'}}>{d.label}{d.causes.some(c=>c.roots.length)?' ⚑':''}</td>
     {data.competencies.map(c=>{const m=d.masteries.find(x=>x.competency===c.key);const t=tone[m?.level||'evidencia_insuficiente'];
      return <td key={c.key} title={m?levelLabel[m.level]+' · '+m.items+' questão(ões)':'Sem evidência'} style={{padding:6,textAlign:'center',background:t.bg,color:t.fg}}>
       {t.mark} {m?pct(m.value):'—'}</td>;})}
    </tr>)}</tbody>
   </table>
  </div>}
  <p style={{fontSize:11,color:'#64748b'}}>● domina · ◐ em desenvolvimento · ○ não demonstrado · · evidência insuficiente · ⚑ causa provável em pré-requisito. Clique no aluno para o diagnóstico individual.</p>

  {selected&&<div style={{background:'#fff',border:'1px solid '+line,borderRadius:9,padding:'10px 12px'}}>
   <strong>{selected.label}</strong>
   <ul style={{margin:'6px 0',paddingLeft:18,fontSize:13}}>
    {selected.masteries.map(m=><li key={m.competency}>{label(m.competency)}: <strong>{levelLabel[m.level]}</strong> ({pct(m.value)}, {m.items} questão(ões) em {m.applications} aplicação(ões))</li>)}
   </ul>
   {selected.causes.length>0?<ul style={{margin:'6px 0',paddingLeft:18,fontSize:13}}>
    {selected.causes.map(c=><li key={c.competency}>{label(c.competency)}:
     {c.roots.length>0&&<> origem provável em <strong>{c.roots.map(label).join(', ')}</strong>.</>}
     {c.unverified.length>0&&<> Pré-requisito sem evidência suficiente, a verificar: {c.unverified.map(label).join(', ')}.</>}</li>)}
   </ul>:<p style={{fontSize:13,margin:'6px 0'}}>Sem dificuldade com origem em pré-requisito registrada.</p>}
   {selected.studentId&&!history&&<button type="button" onClick={()=>void openHistory(selected)}
    style={{padding:'7px 12px',borderRadius:8,border:'1px solid '+blue,background:'#fff',color:blue,fontWeight:700,cursor:'pointer'}}>Histórico do aluno no curso</button>}
   {!selected.studentId&&<p style={{fontSize:12,color:'#64748b'}}>Folha identificada por código: o histórico longitudinal exige aluno vinculado ao cadastro.</p>}
   {history&&<HistoryView data={history.data}/>}
  </div>}
 </section>;
}

function HistoryView({data}:{data:CompetencyEvidence}){
 const masteries=computeMastery(data);
 const [d]=diagnoseStudents(masteries,data.relations);
 const name=new Map(data.competencies.map(c=>[c.key,(c.code?c.code+' ':'')+(c.title||'')]));
 const disciplines=[...new Set(data.applications.map(a=>a.discipline))];
 if(!d)return <p style={{fontSize:13}}>Sem aplicações encerradas com este aluno.</p>;
 return <div style={{marginTop:10,borderTop:'1px solid '+line,paddingTop:8}}>
  <strong style={{fontSize:13}}>Histórico no curso</strong> <span style={{fontSize:12,color:'#41566F'}}>· {data.applications.length} aplicação(ões) encerrada(s) em {disciplines.join(', ')}</span>
  <ul style={{margin:'6px 0',paddingLeft:18,fontSize:13}}>
   {d.masteries.map(m=><li key={m.competency}>{name.get(m.competency)||m.competency}: <strong>{levelLabel[m.level]}</strong> ({pct(m.value)}; última evidência em {new Date(m.lastAppliedOn+'T12:00:00').toLocaleDateString('pt-BR')})</li>)}
  </ul>
  {d.causes.map(c=>c.roots.length>0&&<p key={c.competency} style={{fontSize:13,margin:'4px 0'}}>{name.get(c.competency)}: origem provável em <strong>{c.roots.map(r=>name.get(r)||r).join(', ')}</strong>.</p>)}
 </div>;
}
