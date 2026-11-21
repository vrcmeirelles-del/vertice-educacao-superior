import {useEffect,useState} from 'react';
import {loadErrorEvidence} from './recovery-api';
import {classErrorMap,ERROR_RULES,studentMisconceptions,type ErrorEvidence} from './error-map';

const blue='#164B92',line='#DCE7F4';
const pct=(v:number)=>Math.round(v*100)+'%';
const compName=(k:string)=>k.replace(/^cmp:/,'').split('|').map((s,i)=>i===0?s.toUpperCase():s).join(' ');

/** Mapa de erros conceituais da turma: soma das alternativas erradas pela descrição do professor. */
export default function ErrorMapPanel({institutionId,courseId,scope,title}:{institutionId:string;courseId:string;scope:{applicationId:string}|{discipline:string};title:string}){
 const [data,setData]=useState<ErrorEvidence|null>(null);const [msg,setMsg]=useState('');const [who,setWho]=useState('');
 const key=JSON.stringify(scope);
 useEffect(()=>{let live=true;setData(null);setMsg('');
  loadErrorEvidence(institutionId,courseId,JSON.parse(key)).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setMsg(e instanceof Error?e.message:'Mapa indisponível.');});
  return()=>{live=false;};},[institutionId,courseId,key]);
 if(msg)return <p role="alert" style={{fontSize:13,color:'#982F2F'}}>{msg}</p>;
 if(!data)return <p role="status" style={{fontSize:13}}>Calculando o mapa de erros…</p>;
 const map=classErrorMap(data);
 const student=data.students.find(s=>(s.studentId||s.label)===who);
 const mine=student?studentMisconceptions(data,student):[];
 return <section aria-label={title} style={{border:'1px solid '+line,borderRadius:12,padding:14,margin:'14px 0',background:'#FBFDFF'}}>
  <h4 style={{margin:'0 0 6px',color:blue}}>{title}</h4>
  <p style={{fontSize:12,color:'#41566F',margin:'0 0 10px'}}>{map.totalStudents} aluno(s) · {data.errors.length} resposta(s) errada(s) em objetivas.
   Erro recorrente: atinge ao menos {ERROR_RULES.classShare*100}% da turma (mínimo de {ERROR_RULES.minStudents} alunos). Regras v{ERROR_RULES.version}.</p>
  {map.misconceptions.length===0?<p style={{fontSize:13}}>Nenhum erro conceitual mapeado nas alternativas escolhidas. Descreva, no editor da questão, o que cada alternativa errada revela.</p>:
   <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
    <thead><tr style={{textAlign:'left',borderBottom:'2px solid '+line}}><th style={{padding:6}}>Erro conceitual</th><th style={{padding:6}}>Alunos</th><th style={{padding:6}}>Ocorrências</th><th style={{padding:6}}>Questões</th><th style={{padding:6}}>Competências</th></tr></thead>
    <tbody>{map.misconceptions.map(m=><tr key={m.key} style={{borderBottom:'1px solid '+line,background:m.recurrent?'#FFF4F0':undefined}}>
     <td style={{padding:6}}>{m.recurrent&&<strong style={{color:'#982F2F'}}>Recorrente · </strong>}{m.note}</td>
     <td style={{padding:6}}>{m.students} ({pct(m.share)})</td><td style={{padding:6}}>{m.occurrences}</td><td style={{padding:6}}>{m.questions}</td>
     <td style={{padding:6,fontSize:12}}>{m.competencies.map(compName).join(', ')||'—'}</td></tr>)}</tbody>
   </table>}
  {map.unmapped.length>0&&<p style={{fontSize:12,color:'#7A4B00',marginTop:8}}>Erros sem erro conceitual mapeado: {map.unmapped.slice(0,5).map(u=>'“'+u.statement.slice(0,50)+'…” ('+u.wrong+')').join(' · ')}
   {map.unmapped.length>5?' e mais '+(map.unmapped.length-5)+' questão(ões)':''}. Mapeie as alternativas dessas questões para o diagnóstico ficar completo.</p>}
  {data.students.length>0&&<label style={{display:'block',fontSize:13,marginTop:10}}>Erros de um aluno
   <select value={who} onChange={e=>setWho(e.target.value)} style={{marginLeft:8,padding:'6px 8px',border:'1px solid '+line,borderRadius:7}}>
    <option value="">Selecione</option>{data.students.map(s=><option key={s.studentId||s.label} value={s.studentId||s.label}>{s.label}</option>)}</select></label>}
  {student&&(mine.length?<ul style={{fontSize:13,margin:'6px 0',paddingLeft:18}}>{mine.map(x=><li key={x.note}>{x.note} ({x.count}×)</li>)}</ul>
   :<p style={{fontSize:13}}>Nenhum erro mapeado para {student.label}.</p>)}
 </section>;
}
