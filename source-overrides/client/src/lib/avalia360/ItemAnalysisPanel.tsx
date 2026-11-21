import {useEffect,useState} from 'react';
import {loadItemAnalysis} from './analysis-api';
import {ANALYSIS_RULES,readItem,recommendationLabel,reliabilityLabel,sampleLabel,type AnalysisResult,type Recommendation} from './item-analysis-rules';

const blue='#164B92',line='#DCE7F4';
const fmt=(v:number|null|undefined,d=2)=>v===null||v===undefined?'—':Number(v).toFixed(d).replace('.',',');
const pct=(v:number|null|undefined)=>v===null||v===undefined?'—':Math.round(Number(v)*100)+'%';
const recTone:Record<Recommendation,{bg:string;fg:string}>={
 manter:{bg:'#EAF7EF',fg:'#1C6B3A'},revisar:{bg:'#FFF7E6',fg:'#7A4B00'},revisar_gabarito:{bg:'#FFF0F0',fg:'#982F2F'},
 amostra_insuficiente:{bg:'#F1F5F9',fg:'#475569'},sem_dados:{bg:'#F1F5F9',fg:'#475569'},
};
const letter=(i:number)=>String.fromCharCode(65+i);

/** Análise estatística da aplicação (Teoria Clássica dos Testes). Cálculo no servidor; leitura por regras explícitas. */
export default function ItemAnalysisPanel({institutionId,courseId,applicationId}:{institutionId:string;courseId:string;applicationId:string}){
 const [data,setData]=useState<AnalysisResult|null>(null);
 const [msg,setMsg]=useState('');
 const [open,setOpen]=useState<string|null>(null);
 useEffect(()=>{
  let live=true;
  setData(null);setMsg('');
  loadItemAnalysis(institutionId,courseId,applicationId).then(d=>{if(live)setData(d);})
   .catch(e=>{if(live)setMsg(e instanceof Error?e.message:'Análise indisponível.');});
  return()=>{live=false;};
 },[institutionId,courseId,applicationId]);
 if(msg)return <p role="alert" style={{fontSize:13,color:'#982F2F'}}>{msg}</p>;
 if(!data)return <p role="status" style={{fontSize:13}}>Calculando a análise…</p>;
 const readings=new Map(data.items.map(i=>[i.questionId,readItem(i,data.complete)]));
 const counts=data.items.reduce((acc,i)=>{const r=readings.get(i.questionId)!.recommendation;acc[r]=(acc[r]||0)+1;return acc;},{} as Partial<Record<Recommendation,number>>);
 const maxBin=Math.max(1,...data.scoreDistribution.map(b=>b.count));
 const sem=data.alpha!==null&&data.sdScore!==null?data.sdScore*Math.sqrt(Math.max(0,1-data.alpha)):null;
 return <section aria-label="Análise das questões" style={{border:'1px solid '+line,borderRadius:12,padding:14,margin:'14px 0',background:'#FBFDFF'}}>
  <h4 style={{margin:'0 0 6px',color:blue}}>Análise das questões · {data.classLabel}</h4>
  <p style={{fontSize:12,color:'#41566F',margin:'0 0 10px'}}>
   Teoria Clássica dos Testes, calculada no servidor sobre {data.complete} folha(s) completa(s) de {data.sheets}
   {data.sheets>data.complete?' (folhas com discursiva sem nota ficam fora)':''}. Amostra {sampleLabel(data.complete)}. Regras v{ANALYSIS_RULES.version}.
   {data.status==='open'&&' A aplicação ainda está aberta: os números mudam com novos lançamentos e só entram na calibração do banco após o encerramento.'}
  </p>
  <dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,margin:'0 0 12px'}}>
   {([['Média da turma',fmt(data.meanScore)+' / '+fmt(data.maxScore)],['Desvio-padrão',fmt(data.sdScore)],
     ['Confiabilidade (α)',fmt(data.alpha)+' · '+reliabilityLabel(data.alpha)],['Erro-padrão de medida',sem===null?'—':'± '+fmt(sem)],
     ['Questões a manter',String(counts.manter||0)],['A revisar',String((counts.revisar||0)+(counts.revisar_gabarito||0))]] as const).map(([k,v])=>
    <div key={k} style={{border:'1px solid '+line,borderRadius:9,padding:'8px 10px',background:'#fff'}}>
     <dt style={{fontSize:12,color:'#41566F'}}>{k}</dt><dd style={{margin:0,fontWeight:700,color:blue}}>{v}</dd></div>)}
  </dl>
  {data.scoreDistribution.length>0&&<figure style={{margin:'0 0 12px'}} aria-label="Distribuição das notas">
   <div style={{display:'flex',alignItems:'flex-end',gap:4,height:70,borderBottom:'1px solid '+line}}>
    {Array.from({length:10},(_,b)=>{const c=data.scoreDistribution.find(x=>x.bin===b)?.count||0;
     return <div key={b} title={(b*10)+'–'+(b===9?100:b*10+9)+'%: '+c+' aluno(s)'} style={{flex:1,height:(c/maxBin*100)+'%',background:c?blue:'transparent',borderRadius:'3px 3px 0 0',minHeight:c?2:0}}/>;})}
   </div>
   <figcaption style={{fontSize:11,color:'#64748b',display:'flex',justifyContent:'space-between'}}><span>0%</span><span>Distribuição das notas (faixas de 10%)</span><span>100%</span></figcaption>
  </figure>}
  <div style={{overflowX:'auto'}}>
   <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
    <thead><tr style={{textAlign:'left',borderBottom:'2px solid '+line}}>
     <th style={{padding:6}}>Questão</th><th style={{padding:6}}>Facilidade</th><th style={{padding:6}}>Dificuldade declarada → observada</th>
     <th style={{padding:6}}>Discriminação</th><th style={{padding:6}}>Ponto-bisserial</th><th style={{padding:6}}>Leitura</th></tr></thead>
    <tbody>{data.items.map(item=>{const r=readings.get(item.questionId)!;const tone=recTone[r.recommendation];
     return [<tr key={item.questionId} style={{borderBottom:'1px solid '+line,cursor:'pointer'}} onClick={()=>setOpen(open===item.questionId?null:item.questionId)}>
      <td style={{padding:6,maxWidth:280}}><strong>{item.order}.</strong> {item.statement.slice(0,90)}{item.statement.length>90?'…':''}
       <div style={{fontSize:11,color:'#64748b'}}>{item.kind}{item.sourceBankId?' · do Banco de Questões':''}</div></td>
      <td style={{padding:6}}>{pct(item.p)}<div style={{fontSize:11}}>{r.facility}</div></td>
      <td style={{padding:6}}>{item.declaredDifficulty??'—'} → {r.observedLevel??'—'}</td>
      <td style={{padding:6}}>{fmt(item.discrimination)}<div style={{fontSize:11}}>{r.discrimination}</div></td>
      <td style={{padding:6}}>{fmt(item.pointBiserial)}</td>
      <td style={{padding:6}}><span style={{background:tone.bg,color:tone.fg,borderRadius:6,padding:'2px 8px',fontWeight:700,whiteSpace:'nowrap'}}>{recommendationLabel[r.recommendation]}</span></td>
     </tr>,
     open===item.questionId&&<tr key={item.questionId+'-d'}><td colSpan={6} style={{padding:'8px 10px',background:'#fff'}}>
      {r.flags.length?<ul style={{margin:'0 0 8px',paddingLeft:18}}>{r.flags.map((f,k)=><li key={k}>{f}</li>)}</ul>:<p style={{margin:'0 0 8px'}}>Nenhum alerta pelas regras.</p>}
      <p style={{margin:'0 0 6px',fontSize:12}}>Acerto no grupo superior (27%): {pct(item.pUpper)} · no grupo inferior: {pct(item.pLower)}
       {item.blanks?' · em branco: '+item.blanks:''}{item.multiples?' · dupla marcação: '+item.multiples:''}</p>
      {item.options&&<table style={{borderCollapse:'collapse',fontSize:12}}>
       <thead><tr><th style={{padding:'2px 10px 2px 0',textAlign:'left'}}>Alternativa (ordem original)</th><th style={{padding:'2px 10px'}}>Total</th><th style={{padding:'2px 10px'}}>Grupo superior</th><th style={{padding:'2px 10px'}}>Grupo inferior</th><th/></tr></thead>
       <tbody>{item.options.map((o,k)=>{const flag=r.distractors.find(d=>d.optionId===o.optionId)?.flag;
        return <tr key={o.optionId} style={{fontWeight:o.correct?700:400}}>
         <td style={{padding:'2px 10px 2px 0'}}>{letter(k)}{o.correct?' (gabarito)':''}</td>
         <td style={{padding:'2px 10px',textAlign:'center'}}>{o.n}</td><td style={{padding:'2px 10px',textAlign:'center'}}>{o.nUpper}</td><td style={{padding:'2px 10px',textAlign:'center'}}>{o.nLower}</td>
         <td style={{padding:'2px 10px',color:flag==='atrai_melhores'?'#982F2F':'#7A4B00'}}>{flag==='atrai_melhores'?'atrai os melhores':flag==='nao_funciona'?'não funciona':''}</td></tr>;})}</tbody>
      </table>}
     </td></tr>];})}</tbody>
   </table>
  </div>
  <details style={{marginTop:10,fontSize:12,color:'#41566F'}}><summary>Como ler os indicadores</summary>
   <ul>
    <li><strong>Facilidade</strong>: proporção de acerto (nas discursivas, nota média ÷ valor). Abaixo de 15% ou acima de 90% a questão informa pouco.</li>
    <li><strong>Discriminação</strong>: acerto dos 27% de maior nota menos o dos 27% de menor nota. ≥ 0,40 muito boa; 0,30–0,39 boa; 0,20–0,29 marginal; &lt; 0,20 fraca.</li>
    <li><strong>Ponto-bisserial</strong>: correlação entre a questão e o restante da prova. Negativa indica gabarito suspeito.</li>
    <li><strong>Alternativas</strong>: escolhida por menos de 5% não funciona; se atrai mais os melhores alunos, pode haver ambiguidade.</li>
    <li><strong>Confiabilidade (α de Cronbach, igual ao KR-20 em prova só objetiva)</strong>: ≥ 0,80 boa; 0,70–0,79 aceitável; 0,60–0,69 questionável. Provas curtas e formativas tendem a valores menores.</li>
    <li>Com menos de {ANALYSIS_RULES.minSample} folhas completas não há recomendação por questão; abaixo de {ANALYSIS_RULES.smallSample}, interprete com cautela.</li>
   </ul></details>
 </section>;
}
