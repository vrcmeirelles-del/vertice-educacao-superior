import type {ChecklistResult} from './item-checklist';

const tone={bloqueio:{bg:'#FFF0F0',fg:'#982F2F',label:'Bloqueio'},alerta:{bg:'#FFF7E6',fg:'#7A4B00',label:'Alerta'}} as const;

/** Resultado do checklist técnico. Regras determinísticas: ver item-checklist.ts. */
export default function ChecklistPanel({result,title='Checklist técnico do caderno'}:{result:ChecklistResult;title?:string}){
 const letters=Object.entries(result.answerKey).sort(([a],[b])=>a.localeCompare(b));
 const total=letters.reduce((s,[,n])=>s+n,0);
 return <section aria-label={title} style={{border:'1px solid #DCE7F4',borderRadius:12,padding:14,margin:'12px 0',background:'#fff'}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'baseline'}}>
   <h4 style={{margin:0,color:'#164B92'}}>{title}</h4>
   <span style={{fontSize:13}}>
    <strong style={{color:result.blocking?tone.bloqueio.fg:'#1C6B3A'}}>{result.blocking} bloqueio(s)</strong> · {result.warnings} alerta(s)
   </span>
  </div>
  {total>0&&<p style={{fontSize:13,margin:'8px 0'}}>Distribuição do gabarito ({total} objetiva{total>1?'s':''}): {letters.map(([l,n])=>l+' = '+n).join(' · ')}</p>}
  {result.issues.length===0
   ?<p role="status" style={{fontSize:13,color:'#1C6B3A',margin:'8px 0 0'}}>Nenhuma pendência técnica encontrada pelas regras do checklist.</p>
   :<ul style={{listStyle:'none',padding:0,margin:'8px 0 0',display:'grid',gap:6}}>
    {result.issues.map((i,k)=><li key={k} style={{background:tone[i.severity].bg,color:tone[i.severity].fg,borderRadius:8,padding:'7px 10px',fontSize:13}}>
     <strong>{tone[i.severity].label}</strong>{i.questionIndex!==undefined?' · Questão '+(i.questionIndex+1):' · Caderno'}: {i.message}
    </li>)}
   </ul>}
  <p style={{fontSize:11,color:'#64748b',margin:'8px 0 0'}}>Verificação por regras explícitas, sem IA. Alertas não impedem o envio, mas ficam visíveis ao colegiado.</p>
 </section>;
}
