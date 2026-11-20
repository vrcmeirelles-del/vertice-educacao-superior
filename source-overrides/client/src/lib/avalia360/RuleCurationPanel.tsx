import {useEffect,useState} from 'react';
import {curateQuestion,type CurationResult} from './rule-curation';
import type {QuestionDraft} from './question-draft';
import type {PedagogicalDraft} from './declared-analysis';
type Props={question:QuestionDraft;pedagogy:PedagogicalDraft;onApply:(statement:string)=>void};
type Decision={action:'accepted'|'rejected';at:string;ruleVersion:string;questionId:string;before:string;after:string};
const noteStyle={padding:12,borderRadius:9,background:'#f0f6ff',fontSize:13} as const;
export default function RuleCurationPanel({question,pedagogy,onApply}:Props){
 const [report,setReport]=useState<CurationResult|null>(null);
 const [decisions,setDecisions]=useState<Decision[]>([]);
 const [open,setOpen]=useState(false);
 const [changed,setChanged]=useState(false);
 useEffect(()=>{setReport(null);setOpen(false);setChanged(false)},[question.id]);
 // Não é um parecer silencioso: resultado só exibido depois da submissão explícita.
 const submit=()=>{setReport(curateQuestion(question,pedagogy));setOpen(true);setChanged(false)};
 const decide=(action:'accepted'|'rejected')=>{
  if(!report?.suggestedStatement)return;
  const before=question.statement,after=report.suggestedStatement;
  setDecisions(x=>[...x,{action,at:new Date().toISOString(),ruleVersion:report.version,questionId:question.id,before,after}]);
  if(action==='accepted')onApply(after);
  setReport(null);setChanged(false);
 };
 const stale=report!==null&&changed;
 return <section aria-label="Curadoria algorítmica da questão" style={{border:'1px solid #bdd2eb',borderRadius:12,padding:14,marginTop:8}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
   <div><strong>Curadoria pedagógica por regras</strong>
    <p style={{fontSize:12,margin:'4px 0 0',color:'#475569'}}>Alertas estruturais e sugestões editoriais; sem avaliação da correção jurídica.</p>
   </div>
   <button type="button" onClick={submit} style={{background:'#164b92',color:'#fff',border:0,borderRadius:8,padding:'10px 14px',fontWeight:700}}>Submeter à curadoria</button>
  </div>
  {open&&report&&<div role="region" aria-label="Parecer algorítmico" style={{marginTop:14}}>
   <div style={noteStyle}>
    <strong>Resultado: {report.findings.length} apontamento(s)</strong>
    <p style={{margin:'6px 0 0'}}>O motor verificou apenas consistência estrutural, vínculos declarados e formatação. Não leu a legislação, não consultou fontes e não validou a aderência semântica ao PPC.</p>
   </div>
   {report.findings.length===0?<p role="status">Nenhuma pendência estrutural encontrada. Isso não significa aprovação jurídica ou pedagógica.</p>:
    <ul>{report.findings.map((f,i)=><li key={f.code+i} style={{margin:'10px 0'}}>
     <strong>{f.level==='blocked'?'Bloqueio':f.level==='attention'?'Atenção':'Informação'} · {f.code}</strong>
     <div>{f.message}</div>
     <div style={{color:'#475569',fontSize:13}}>Providência: {f.recommendation}</div>
    </li>)}</ul>}
   {report.suggestedStatement&&<div style={{marginTop:14}}>
    <strong>Proposta de ajuste exclusivamente formal</strong>
    <p style={{fontSize:12}}>Compare antes de aceitar. Não é reescrita jurídica.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
     <div style={noteStyle}><strong>Original</strong><p>{question.statement}</p></div>
     <div style={noteStyle}><strong>Sugestão</strong><p>{report.suggestedStatement}</p></div>
    </div>
    <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
     <button type="button" onClick={()=>decide('accepted')}>Aceitar ajuste formal</button>
     <button type="button" onClick={()=>decide('rejected')}>Manter redação original</button>
    </div>
   </div>}
  </div>}
  {decisions.length>0&&<details style={{marginTop:12}}>
   <summary>Histórico local de decisões ({decisions.length})</summary>
   <p style={{fontSize:12}}>Registro apenas nesta sessão do navegador. Não equivale à trilha de auditoria institucional.</p>
   <ul>{decisions.map((d,i)=><li key={i}>{d.at} · {d.action==='accepted'?'Ajuste aceito':'Redação mantida'} · {d.ruleVersion}</li>)}</ul>
  </details>}
 </section>;
}
