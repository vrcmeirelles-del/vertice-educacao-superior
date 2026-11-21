import {useEffect,useState} from 'react';
import {loadAgreement,loadDoubleSample,loadResponseMatrix,saveSecondScores,type DoubleSample} from './quality-api';
import {difByVariant,FAIRNESS_RULES,variantEffects,type DifResult,type ResponseMatrix} from './fairness';
import {AGREEMENT_RULES,summarizeAgreement} from './agreement';

const blue='#164B92',line='#DCE7F4';
const btn=(primary:boolean)=>({padding:'8px 12px',borderRadius:8,border:'1px solid '+blue,background:primary?blue:'#fff',color:primary?'#fff':blue,fontWeight:700,cursor:'pointer'} as const);
const n2=(v:number|null|undefined,d=2)=>v===null||v===undefined?'—':v.toFixed(d).replace('.',',');
const catText:Record<DifResult['category'],string>={A:'A · sem diferença relevante',B:'B · diferença moderada',C:'C · diferença grande',amostra_insuficiente:'amostra insuficiente',indeterminado:'indeterminado'};

/** Qualidade da aplicação: justiça entre versões (Mantel-Haenszel) e dupla correção cega (ICC). */
export default function QualityPanel({institutionId,courseId,applicationId}:{institutionId:string;courseId:string;applicationId:string}){
 const [matrix,setMatrix]=useState<ResponseMatrix|null>(null);const [msg,setMsg]=useState('');
 const [sample,setSample]=useState<DoubleSample|null>(null);const [share,setShare]=useState(0.2);
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [agreement,setAgreement]=useState<Awaited<ReturnType<typeof loadAgreement>>|null>(null);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;
  loadResponseMatrix(institutionId,courseId,applicationId).then(m=>{if(live)setMatrix(m);}).catch(e=>{if(live)setMsg(e instanceof Error?e.message:'Matriz indisponível.');});
  loadAgreement(institutionId,courseId,applicationId).then(a=>{if(live)setAgreement(a);}).catch(()=>{});
  return()=>{live=false;};},[institutionId,courseId,applicationId]);
 const openSample=async()=>{
  setBusy(true);setMsg('');
  try{const s=await loadDoubleSample(institutionId,courseId,applicationId,share,10);setSample(s);
   const init:Record<string,string>={};
   for(const sh of s.sheets)for(const q of s.questions){const ex=sh.secondScores?.[q.id];if(ex){init[sh.sheetId+'|'+q.id]=String(ex.score);
    for(const c of q.rubricCriteria)if(ex.criteria?.[c.id]!==undefined)init[sh.sheetId+'|'+q.id+'|'+c.id]=String(ex.criteria[c.id]);}}
   setDraft(init);}
  catch(e){setMsg(e instanceof Error?e.message:'Amostra indisponível.');}
  finally{setBusy(false);}
 };
 const save=async()=>{
  if(!sample)return;
  const scores:Array<{sheetId:string;questionId:string;score:number;criteria?:Record<string,number>}>=[];const problems:string[]=[];
  for(const sh of sample.sheets)for(const q of sample.questions){
   const k=sh.sheetId+'|'+q.id;
   if(q.rubricCriteria.length){
    const vals=q.rubricCriteria.map(c=>({c,raw:(draft[k+'|'+c.id]||'').trim().replace(',','.')}));
    if(vals.every(v=>!v.raw))continue;
    if(vals.some(v=>!v.raw)){problems.push(sh.code+': preencha todos os critérios.');continue;}
    const crit=Object.fromEntries(vals.map(v=>[v.c.id,Number(v.raw)]));
    if(vals.some(v=>!Number.isFinite(Number(v.raw))||Number(v.raw)<0||Number(v.raw)>v.c.points)){problems.push(sh.code+': critério fora do intervalo.');continue;}
    scores.push({sheetId:sh.sheetId,questionId:q.id,score:Math.round(Object.values(crit).reduce((a,b)=>a+b,0)*100)/100,criteria:crit});
   }else{
    const raw=(draft[k]||'').trim().replace(',','.');if(!raw)continue;
    const v=Number(raw);if(!Number.isFinite(v)||v<0||v>q.points){problems.push(sh.code+': nota fora do intervalo 0–'+q.points+'.');continue;}
    scores.push({sheetId:sh.sheetId,questionId:q.id,score:v});
   }
  }
  if(problems.length){setMsg(problems.slice(0,10).join(' '));return;}
  if(!scores.length){setMsg('Nenhuma nota preenchida.');return;}
  setBusy(true);
  try{const out=await saveSecondScores(institutionId,courseId,applicationId,scores);setAgreement(await loadAgreement(institutionId,courseId,applicationId));
   setMsg(out.saved+' nota(s) da segunda correção registrada(s).');}
  catch(e){setMsg(e instanceof Error?e.message:'Notas não salvas.');}
  finally{setBusy(false);}
 };
 const dif=matrix?difByVariant(matrix):[];const eff=matrix?variantEffects(matrix):[];
 const qName=(id:string)=>matrix?.questions.findIndex(q=>q.id===id)??-1;
 const flagged=dif.filter(d=>d.category==='B'||d.category==='C');
 return <section aria-label="Qualidade da aplicação" style={{border:'1px solid '+line,borderRadius:12,padding:14,margin:'14px 0',background:'#FBFDFF'}}>
  <h4 style={{margin:'0 0 6px',color:blue}}>Justiça entre versões</h4>
  {msg&&<p role="status" style={{fontSize:13,background:'#F5F9FF',padding:'8px 12px',borderRadius:8}}>{msg}</p>}
  {!matrix?<p style={{fontSize:13}}>Carregando…</p>:matrix.variantCount<2?<p style={{fontSize:13}}>Aplicação com uma única versão: não há comparação entre versões.</p>:<>
   <p style={{fontSize:12,color:'#41566F',margin:'0 0 8px'}}>Compara alunos de desempenho equivalente (Mantel-Haenszel, estratos pela nota). Cada versão é comparada com as demais; mínimo de {FAIRNESS_RULES.minGroup} alunos por grupo. D-DIF negativo = questão mais difícil naquela versão. Dados anonimizados. Regras v{FAIRNESS_RULES.version}.</p>
   <table style={{borderCollapse:'collapse',fontSize:13,marginBottom:8}}><thead><tr><th style={{padding:4,textAlign:'left'}}>Versão</th><th style={{padding:4}}>Alunos</th><th style={{padding:4}}>Média</th><th style={{padding:4}}>d (vs. demais)</th></tr></thead>
    <tbody>{eff.map(e=><tr key={e.variant} style={{color:e.flag?'#982F2F':undefined,fontWeight:e.flag?700:400}}><td style={{padding:4}}>{e.variant}</td><td style={{padding:4,textAlign:'center'}}>{e.n}</td>
     <td style={{padding:4,textAlign:'center'}}>{n2(e.mean)}</td><td style={{padding:4,textAlign:'center'}}>{n2(e.d)}{e.flag?' · diferença relevante':''}</td></tr>)}</tbody></table>
   {flagged.length===0?<p style={{fontSize:13,color:'#1C6B3A'}}>Nenhuma questão com diferença moderada ou grande entre versões{dif.some(d=>d.category==='amostra_insuficiente')?' (algumas comparações sem amostra suficiente)':''}.</p>:
    <ul style={{fontSize:13,paddingLeft:18}}>{flagged.map(d=><li key={d.questionId+d.variant} style={{color:d.category==='C'?'#982F2F':'#7A4B00'}}>
     Questão {qName(d.questionId)+1} na versão {d.variant}: {catText[d.category]} (D-DIF {n2(d.deltaD)}; χ² {n2(d.chi2)}). {d.deltaD!==null&&d.deltaD<0?'Mais difícil nesta versão: verifique a posição da questão e a ordem das alternativas.':'Mais fácil nesta versão.'}</li>)}</ul>}
   <details style={{fontSize:12}}><summary>Todas as comparações</summary>
    <table style={{borderCollapse:'collapse'}}><tbody>{dif.map(d=><tr key={d.questionId+d.variant}><td style={{padding:'2px 8px'}}>Q{qName(d.questionId)+1}</td><td style={{padding:'2px 8px'}}>versão {d.variant}</td>
     <td style={{padding:'2px 8px'}}>{d.nFocal}/{d.nReference}</td><td style={{padding:'2px 8px'}}>D {n2(d.deltaD)}</td><td style={{padding:'2px 8px'}}>{catText[d.category]}</td></tr>)}</tbody></table></details>
  </>}

  <h4 style={{margin:'14px 0 6px',color:blue}}>Dupla correção cega das discursivas</h4>
  <p style={{fontSize:12,color:'#41566F',margin:'0 0 8px'}}>Uma amostra das folhas é corrigida de novo por outra pessoa, sem ver a primeira nota. A concordância usa o ICC(2,1): ≥ 0,75 boa; ≥ 0,90 excelente; mínimo de {AGREEMENT_RULES.minPairs} pares. Regras v{AGREEMENT_RULES.version}.</p>
  {agreement&&agreement.length>0&&<table style={{borderCollapse:'collapse',fontSize:13,marginBottom:8}}>
   <thead><tr><th style={{padding:4,textAlign:'left'}}>Discursiva</th><th style={{padding:4}}>Pares</th><th style={{padding:4}}>ICC</th><th style={{padding:4}}>Diferença média</th><th style={{padding:4}}>Viés (2ª − 1ª)</th><th style={{padding:4}}>Dentro de 10%</th></tr></thead>
   <tbody>{agreement.map(a=>{const s=summarizeAgreement(a.pairs,a.points);return <tr key={a.questionId}>
    <td style={{padding:4}}>{a.statement.slice(0,60)}…</td><td style={{padding:4,textAlign:'center'}}>{s.pairs}</td>
    <td style={{padding:4,textAlign:'center',color:s.icc!==null&&s.icc<0.5?'#982F2F':undefined}}>{n2(s.icc)} · {s.label}</td>
    <td style={{padding:4,textAlign:'center'}}>{n2(s.meanAbsDiff)}</td><td style={{padding:4,textAlign:'center'}}>{n2(s.bias)}</td>
    <td style={{padding:4,textAlign:'center'}}>{s.withinTolerance===null?'—':Math.round(s.withinTolerance*100)+'%'}</td></tr>;})}</tbody></table>}
  <div style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}>
   <label style={{fontSize:13,fontWeight:600}}>Tamanho da amostra<select value={share} onChange={e=>setShare(Number(e.target.value))} style={{display:'block',padding:'7px 9px',border:'1px solid '+line,borderRadius:7}}>
    {[0.1,0.2,0.3,0.5,1].map(s=><option key={s} value={s}>{s*100}% (mínimo 10 folhas)</option>)}</select></label>
   <button type="button" style={btn(!sample)} disabled={busy} onClick={()=>void openSample()}>{sample?'Recarregar amostra':'Abrir amostra para segunda correção'}</button>
  </div>
  {sample&&<div style={{marginTop:10}}>
   <p style={{fontSize:13}}>{sample.size} de {sample.population} folha(s) com discursiva corrigida. As folhas aparecem por código; a primeira nota não é exibida.</p>
   {sample.questions.map(q=><div key={q.id} style={{marginBottom:10}}>
    <strong style={{fontSize:13}}>{q.statement.slice(0,120)} (máx. {n2(q.points)})</strong>
    {q.rubricCriteria.length===0&&q.rubric&&<p style={{fontSize:12,color:'#41566F',whiteSpace:'pre-wrap',margin:'4px 0'}}>Rubrica: {q.rubric}</p>}
    <table style={{borderCollapse:'collapse',fontSize:13}}><thead><tr><th style={{padding:4,textAlign:'left'}}>Folha</th>
     {q.rubricCriteria.length?q.rubricCriteria.map(c=><th key={c.id} style={{padding:4}}>{c.label} ({n2(c.points)})</th>):<th style={{padding:4}}>Nota</th>}</tr></thead>
     <tbody>{sample.sheets.map(sh=>{const k=sh.sheetId+'|'+q.id;const other=sh.secondScores?.[q.id]&&!sh.secondScores[q.id].byMe;
      const disabled=sh.mine||Boolean(other);
      return <tr key={sh.sheetId}><td style={{padding:4}}>{sh.code} · versão {sh.variant}{sh.mine?' · você fez a 1ª correção':''}{other?' · já corrigida por outra pessoa':''}</td>
       {q.rubricCriteria.length?q.rubricCriteria.map(c=><td key={c.id} style={{padding:4}}><input style={{width:70,padding:'5px 7px',border:'1px solid '+line,borderRadius:6}} inputMode="decimal" disabled={disabled}
         value={draft[k+'|'+c.id]||''} onChange={e=>setDraft(d=>({...d,[k+'|'+c.id]:e.target.value}))}/></td>)
        :<td style={{padding:4}}><input style={{width:80,padding:'5px 7px',border:'1px solid '+line,borderRadius:6}} inputMode="decimal" disabled={disabled}
         value={draft[k]||''} onChange={e=>setDraft(d=>({...d,[k]:e.target.value}))}/></td>}</tr>;})}</tbody></table>
   </div>)}
   <button type="button" style={btn(true)} disabled={busy} onClick={()=>void save()}>Salvar segunda correção</button>
  </div>}
 </section>;
}
