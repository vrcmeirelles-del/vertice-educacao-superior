import {useMemo,useState} from 'react';
import {loadCompetencyEvidence} from './competency-api';
import {computeMastery,type CompetencyEvidence,type Mastery} from './competency-mastery';
import {classReadiness,ENADE_TEMPLATE,READINESS_RULES,readinessLabel,studentReadiness,type ExamArea,type ExamMatrix} from './readiness';
import {evaluateRisk,RISK_RULES,type RiskSignal} from './academic-risk';
import {listExamMatrices,loadScoreSeries,publishRiskSignals,saveExamMatrix,validateExamMatrix} from './readiness-api';

const blue='#164B92',line='#DCE7F4';
const btn=(primary:boolean)=>({padding:'8px 12px',borderRadius:8,border:'1px solid '+blue,background:primary?blue:'#fff',color:primary?'#fff':blue,fontWeight:700,cursor:'pointer'} as const);
const input={padding:'7px 9px',border:'1px solid '+line,borderRadius:7,width:'100%',minWidth:0,background:'#fff'} as const;
const pct=(v:number|null)=>v===null?'—':Math.round(v*100)+'%';
const slug=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'area';
type Editing={id?:string;exam:'enade'|'oab'|'outro';label:string;edition:string;sourceRef:string;areas:ExamArea[]};

/** Prontidão ENADE/OAB e sinal de risco acadêmico do curso (aplicações encerradas). */
export default function ReadinessRiskPanel({institutionId,courseId,courseName}:{institutionId:string;courseId:string;courseName:string}){
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');
 const [evidence,setEvidence]=useState<CompetencyEvidence|null>(null);
 const [matrices,setMatrices]=useState<ExamMatrix[]>([]);
 const [series,setSeries]=useState<Awaited<ReturnType<typeof loadScoreSeries>>>([]);
 const [editing,setEditing]=useState<Editing|null>(null);
 const [selected,setSelected]=useState('');
 const load=async()=>{
  setBusy(true);setMsg('');
  try{
   const [e,m,s]=await Promise.all([loadCompetencyEvidence(institutionId,courseId,{course:true}),listExamMatrices(institutionId,courseId),loadScoreSeries(institutionId,courseId)]);
   setEvidence(e);setMatrices(m);setSeries(s);
   setSelected(m.find(x=>x.status==='validated')?.id||'');
   setMsg(e.applications.length+' aplicação(ões) encerrada(s) no curso · '+e.competencies.length+' competência(s) com evidência.');
  }catch(err){setMsg(err instanceof Error?err.message:'Dados indisponíveis.');}
  finally{setBusy(false);}
 };
 const masteriesByStudent=useMemo(()=>{
  const map=new Map<string,Mastery[]>();
  if(evidence)for(const m of computeMastery(evidence))if(m.studentId){const l=map.get(m.studentId)||[];l.push(m);map.set(m.studentId,l);}
  return map;
 },[evidence]);
 const matrix=matrices.find(m=>m.id===selected);
 const readiness=useMemo(()=>matrix?[...masteriesByStudent.values()].map(ms=>studentReadiness(ms,matrix)).sort((a,b)=>(a.index??-1)-(b.index??-1)||a.label.localeCompare(b.label,'pt-BR')):[],[matrix,masteriesByStudent]);
 const cls=matrix?classReadiness(readiness,matrix):null;
 const risks=useMemo(()=>series.map(s=>({studentId:s.studentId,label:s.label,signal:evaluateRisk(s.series,masteriesByStudent.get(s.studentId)||[])}))
  .filter((r):r is {studentId:string;label:string;signal:RiskSignal&{level:'alto'|'atencao'}}=>r.signal.level!==null)
  .sort((a,b)=>(a.signal.level==='alto'?0:1)-(b.signal.level==='alto'?0:1)||a.label.localeCompare(b.label,'pt-BR')),[series,masteriesByStudent]);
 const compName=(k:string)=>{const c=evidence?.competencies.find(x=>x.key===k);return c?(c.code?c.code+' ':'')+(c.title||''):k.replace(/^cmp:/,'');};
 const saveMatrix=async()=>{
  if(!editing)return;
  setBusy(true);
  try{await saveExamMatrix(institutionId,courseId,{...editing,areas:editing.areas.map(a=>({...a,key:a.key||slug(a.label)}))});
   setMatrices(await listExamMatrices(institutionId,courseId));setEditing(null);setMsg('Matriz salva em rascunho. Outra pessoa do colegiado precisa validá-la.');}
  catch(e){setMsg(e instanceof Error?e.message:'Matriz não salva.');}
  finally{setBusy(false);}
 };
 const validate=async(id:string)=>{
  setBusy(true);
  try{await validateExamMatrix(institutionId,courseId,id);const m=await listExamMatrices(institutionId,courseId);setMatrices(m);setSelected(id);setMsg('Matriz validada.');}
  catch(e){setMsg(e instanceof Error?e.message:'Validação recusada.');}
  finally{setBusy(false);}
 };
 const publish=async()=>{
  if(!window.confirm('Publicar '+risks.length+' sinal(is) no alerta de evasão? A publicação substitui os sinais anteriores do curso.'))return;
  setBusy(true);
  try{const out=await publishRiskSignals(institutionId,courseId,RISK_RULES.version,risks.map(r=>({studentId:r.studentId,level:r.signal.level,reasons:r.signal.reasons})));
   setMsg(out.published+' sinal(is) publicado(s). Eles aparecem na coluna "Desempenho (Avalia 360°)" do alerta de evasão.');}
  catch(e){setMsg(e instanceof Error?e.message:'Publicação recusada.');}
  finally{setBusy(false);}
 };
 return <section aria-label="Prontidão e risco acadêmico" style={{background:'#fff',border:'1px solid '+line,borderRadius:14,padding:18,marginBottom:16}}>
  <h3 style={{margin:'0 0 4px'}}>Prontidão ENADE/OAB e risco acadêmico · {courseName}</h3>
  <p style={{margin:'0 0 10px',fontSize:13,color:'#41566F'}}>Usa o domínio por competência de todas as aplicações encerradas do curso. A prontidão indica preparação nas competências avaliadas pela instituição; não é previsão de nota. Regras v{READINESS_RULES.version}.</p>
  <button type="button" style={btn(!evidence)} disabled={busy} onClick={()=>void load()}>{busy?'Carregando…':evidence?'Recalcular':'Calcular para o curso'}</button>
  {msg&&<p role="status" style={{fontSize:13,background:'#F5F9FF',padding:'8px 12px',borderRadius:8}}>{msg}</p>}
  {evidence&&<>
   <h4 style={{margin:'14px 0 6px'}}>Matrizes do exame</h4>
   <p style={{fontSize:12,color:'#41566F',margin:'0 0 6px'}}>A coordenação cadastra as áreas, os pesos e as competências a partir do edital; outra pessoa do colegiado valida. Para a OAB, use a distribuição de questões do edital vigente.</p>
   {matrices.length===0&&<p style={{fontSize:13}}>Nenhuma matriz cadastrada.</p>}
   <ul style={{listStyle:'none',padding:0,display:'grid',gap:6}}>{matrices.map(m=><li key={m.id} style={{border:'1px solid '+line,borderRadius:8,padding:'8px 10px',fontSize:13,display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
    <span><strong>{m.label}</strong> · {m.exam.toUpperCase()} {m.edition} · {m.areas.length} área(s) · {m.status==='validated'?'validada':'rascunho'} · fonte: {m.sourceRef}</span>
    <span style={{display:'flex',gap:6}}>
     {m.status==='draft'&&<button type="button" style={btn(false)} onClick={()=>setEditing({id:m.id,exam:m.exam,label:m.label,edition:m.edition,sourceRef:m.sourceRef,areas:m.areas})}>Editar</button>}
     {m.status==='draft'&&!m.mine&&<button type="button" style={btn(true)} disabled={busy} onClick={()=>void validate(m.id)}>Validar</button>}
    </span></li>)}</ul>
   {!editing&&<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
    <button type="button" style={btn(false)} onClick={()=>setEditing({exam:'enade',label:'ENADE · '+courseName,edition:'',sourceRef:'',areas:ENADE_TEMPLATE.map(a=>({...a}))})}>Nova matriz ENADE (modelo 25% FG / 75% CE)</button>
    <button type="button" style={btn(false)} onClick={()=>setEditing({exam:'oab',label:'OAB 1ª fase',edition:'',sourceRef:'',areas:[]})}>Nova matriz OAB</button>
   </div>}
   {editing&&<fieldset style={{border:'1px solid '+line,borderRadius:10,padding:12,marginTop:8}}>
    <legend style={{fontWeight:700}}>Matriz do exame</legend>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:8}}>
     <label style={{fontSize:13}}>Exame<select style={input} value={editing.exam} onChange={e=>setEditing({...editing,exam:e.target.value as Editing['exam']})}><option value="enade">ENADE</option><option value="oab">OAB</option><option value="outro">Outro</option></select></label>
     <label style={{fontSize:13}}>Nome<input style={input} value={editing.label} onChange={e=>setEditing({...editing,label:e.target.value})}/></label>
     <label style={{fontSize:13}}>Edição<input style={input} value={editing.edition} onChange={e=>setEditing({...editing,edition:e.target.value})} placeholder="Ex.: 2027 ou 45º Exame"/></label>
     <label style={{fontSize:13}}>Fonte (edital/portaria)<input style={input} value={editing.sourceRef} onChange={e=>setEditing({...editing,sourceRef:e.target.value})} placeholder="Nº e data do edital ou portaria"/></label>
    </div>
    {editing.areas.map((a,i)=><div key={i} style={{border:'1px solid '+line,borderRadius:8,padding:8,marginTop:8}}>
     <div style={{display:'grid',gridTemplateColumns:'1fr 110px auto',gap:6}}>
      <input style={input} value={a.label} placeholder="Área (ex.: Direito Civil)" onChange={e=>setEditing({...editing,areas:editing.areas.map((x,j)=>j===i?{...x,label:e.target.value,key:x.key||''}:x)})}/>
      <input style={input} type="number" min={0.1} step={0.5} value={a.weight} aria-label="Peso" onChange={e=>setEditing({...editing,areas:editing.areas.map((x,j)=>j===i?{...x,weight:Number(e.target.value)}:x)})}/>
      <button type="button" onClick={()=>setEditing({...editing,areas:editing.areas.filter((_,j)=>j!==i)})}>×</button>
     </div>
     <div style={{display:'flex',flexWrap:'wrap',gap:'4px 12px',marginTop:6,fontSize:12}}>
      {evidence.competencies.length===0&&<span>Sem competências com evidência no curso ainda.</span>}
      {evidence.competencies.map(c=><label key={c.key}><input type="checkbox" checked={a.competencies.includes(c.key)}
       onChange={e=>setEditing({...editing,areas:editing.areas.map((x,j)=>j===i?{...x,competencies:e.target.checked?[...x.competencies,c.key]:x.competencies.filter(k=>k!==c.key)}:x)})}/> {compName(c.key)}</label>)}
     </div></div>)}
    <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
     <button type="button" style={btn(false)} onClick={()=>setEditing({...editing,areas:[...editing.areas,{key:'',label:'',weight:1,competencies:[]}]})}>Adicionar área</button>
     <button type="button" style={btn(true)} disabled={busy} onClick={()=>void saveMatrix()}>Salvar rascunho</button>
     <button type="button" style={btn(false)} onClick={()=>setEditing(null)}>Cancelar</button>
    </div>
    {editing.exam==='enade'&&<p style={{fontSize:12,color:'#7A4B00'}}>Modelo: a nota do ENADE combina formação geral (25%) e componente específico (75%). Confira no edital da edição antes de validar.</p>}
   </fieldset>}

   <h4 style={{margin:'16px 0 6px'}}>Prontidão</h4>
   {matrices.some(m=>m.status==='validated')?<label style={{fontSize:13}}>Matriz validada <select value={selected} onChange={e=>setSelected(e.target.value)} style={{...input,width:'auto'}}>
    {matrices.filter(m=>m.status==='validated').map(m=><option key={m.id} value={m.id}>{m.label} ({m.edition})</option>)}</select></label>
    :<p style={{fontSize:13}}>Valide uma matriz do exame para calcular a prontidão.</p>}
   {matrix&&cls&&<>
    <p style={{fontSize:13}}>Índice médio da turma: <strong>{pct(cls.meanIndex)}</strong> · prontos {cls.counts.pronto} · em desenvolvimento {cls.counts.em_desenvolvimento} · em risco {cls.counts.risco} · evidência insuficiente {cls.counts.evidencia_insuficiente}</p>
    <p style={{fontSize:13}}>Por área: {cls.areaMeans.map(a=>a.label+' '+pct(a.mean)+(a.students?'':' (sem evidência)')).join(' · ')}</p>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{textAlign:'left',borderBottom:'2px solid '+line}}><th style={{padding:5}}>Aluno</th><th style={{padding:5}}>Índice</th><th style={{padding:5}}>Cobertura</th><th style={{padding:5}}>Leitura</th><th style={{padding:5}}>Áreas mais frágeis</th></tr></thead>
     <tbody>{readiness.map(r=><tr key={r.studentId||r.label} style={{borderBottom:'1px solid '+line}}><td style={{padding:5}}>{r.label}</td><td style={{padding:5}}>{pct(r.index)}</td><td style={{padding:5}}>{pct(r.coverage)}</td>
      <td style={{padding:5,color:r.level==='risco'?'#982F2F':r.level==='pronto'?'#1C6B3A':undefined}}>{readinessLabel[r.level]}</td>
      <td style={{padding:5,fontSize:12}}>{r.weakest.map(k=>matrix.areas.find(a=>a.key===k)?.label).join(', ')||'—'}</td></tr>)}</tbody></table>
   </>}

   <h4 style={{margin:'16px 0 6px'}}>Sinal de risco acadêmico</h4>
   <p style={{fontSize:12,color:'#41566F',margin:'0 0 6px'}}>Alto: queda de 10 p.p. ou mais a cada 90 dias (3+ provas), 3+ competências não demonstradas ou as duas últimas notas abaixo de 40%. Atenção: queda de 5 p.p., 1+ competência não demonstrada ou última nota abaixo de 50%. Regras v{RISK_RULES.version}.</p>
   {risks.length===0?<p style={{fontSize:13}}>Nenhum sinal de risco acadêmico pelas regras.</p>:<>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{textAlign:'left',borderBottom:'2px solid '+line}}><th style={{padding:5}}>Aluno</th><th style={{padding:5}}>Sinal</th><th style={{padding:5}}>Motivos</th></tr></thead>
     <tbody>{risks.map(r=><tr key={r.studentId} style={{borderBottom:'1px solid '+line}}><td style={{padding:5}}>{r.label}</td>
      <td style={{padding:5,fontWeight:700,color:r.signal.level==='alto'?'#982F2F':'#7A4B00'}}>{r.signal.level==='alto'?'Alto':'Atenção'}</td>
      <td style={{padding:5,fontSize:12}}>{r.signal.reasons.join('; ')}</td></tr>)}</tbody></table>
    <button type="button" style={{...btn(true),marginTop:8}} disabled={busy} onClick={()=>void publish()}>Publicar no alerta de evasão</button>
   </>}
  </>}
 </section>;
}
