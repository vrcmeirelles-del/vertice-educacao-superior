import {useMemo,useState} from "react";
import {repositoryPace,OBSERVATION_DAYS,type PaceFile,type PaceRequest,type PaceStatus} from "@/lib/repository-pace";

const LABEL:Record<PaceStatus,string>={concluido:"Concluído",no_ritmo:"No ritmo",em_risco:"Em risco",critico:"Crítico",vencido:"Vencido"};
const COLOR:Record<PaceStatus,string>={concluido:"#2e6a3f",no_ritmo:"#2e6a3f",em_risco:"#a7660c",critico:"#b4232f",vencido:"#7a1020"};
const date=(s:string|null)=>s?s.slice(0,10).split("-").reverse().join("/"):"sem projeção";
const perWeek=(v:number)=>Number.isFinite(v)?v.toFixed(1).replace(".",","):"—";

/** Ritmo de entregas por prazo e curso: algoritmo determinístico sobre as datas reais de envio. */
export default function RitmoRepositorio({requests,files,courses}:{requests:PaceRequest[];files:PaceFile[];courses:{id:string;name:string}[]}){
 const [open,setOpen]=useState(false);
 const pace=useMemo(()=>repositoryPace(requests,files),[requests,files]);
 if(!pace.deadlines.length)return null;
 const name=(id:string|null)=>courses.find(c=>c.id===id)?.name??"Sem curso";
 const attention=pace.courses.filter(c=>c.status==="critico"||c.status==="vencido"||c.status==="em_risco");
 return <section aria-label="Ritmo de entregas" style={{border:"1px solid #dfe6f2",borderRadius:14,padding:"14px 16px",background:"#fff",display:"grid",gap:10,margin:"0 0 14px"}}>
  <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"baseline"}}>
   <strong style={{fontSize:"1.02rem",color:"#213e72"}}>Ritmo de entregas por prazo</strong>
   <small style={{color:"#61718b"}}>Ritmo observado: {perWeek(pace.observedPerWeek)} entregas/semana nos últimos {OBSERVATION_DAYS} dias (só pedidos com prazo)</small>
  </div>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:".85rem",minWidth:560}}>
   <thead><tr style={{textAlign:"left",color:"#2e4e78"}}><th>Prazo</th><th>Entregues</th><th>Faltam</th><th>Dias</th><th>Necessário/semana</th><th>Conclusão projetada</th><th>Situação</th></tr></thead>
   <tbody>{pace.deadlines.map(d=><tr key={d.key} style={{borderTop:"1px solid #ecedf1"}}>
    <td>{date(d.due)}</td><td>{d.delivered} de {d.total}</td><td>{d.pending}</td><td>{d.daysLeft}</td><td>{perWeek(d.requiredPerWeek)}</td><td>{date(d.projectedDate)}</td>
    <td><strong style={{color:COLOR[d.status]}}>{LABEL[d.status]}</strong></td>
   </tr>)}</tbody>
  </table></div>
  {attention.length>0&&<details open={open} onToggle={e=>setOpen((e.target as HTMLDetailsElement).open)}>
   <summary style={{cursor:"pointer",fontWeight:700,color:"#294a79"}}>{attention.length} combinação(ões) de curso e prazo fora do ritmo</summary>
   <ul style={{margin:"8px 0 0",paddingLeft:18,lineHeight:1.6,fontSize:".85rem"}}>{attention.slice(0,60).map(c=><li key={c.key}>
    <strong style={{color:COLOR[c.status]}}>{LABEL[c.status]}</strong> · {name(c.courseId)} · prazo {date(c.due)}: faltam {c.pending} de {c.total}; necessário {perWeek(c.requiredPerWeek)}/semana, observado {perWeek(c.observedPerWeek)}/semana
   </li>)}</ul>
  </details>}
  <small style={{color:"#66748b"}}>Projeção linear pelo ritmo recente; não é previsão garantida. Situação: no ritmo (observado ≥ necessário), em risco (entre metade e o necessário), crítico (abaixo da metade). Documentos devolvidos não contam como entrega. {pace.undated>0?`${pace.undated} pedidos sem prazo ficam fora do cálculo.`:""}</small>
 </section>;
}
