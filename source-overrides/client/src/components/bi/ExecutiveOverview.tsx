import {useState} from "react";
import "./executive-overview.css";

export type ExecutiveMetric={label:string;value:number|null;note:string;target:string;tone:"mint"|"gold"|"cyan"|"rose"};
export type ExecutivePeriod={term:string;enrolled:number};
export type ExecutiveCourse={name:string;current:number;previous:number|null;growth:number|null;href:string};
export type ExecutiveDocument={status:string;count:number};
export type ExecutiveAction={name:string;status:string;due:string;owner:string};
export type ExecutiveOverviewProps={
 institutionName:string; term:string; comparison:string|null; metrics:ExecutiveMetric[];
 periods:ExecutivePeriod[]; courses:ExecutiveCourse[]; documentStatuses:ExecutiveDocument[];
 actions:ExecutiveAction[]; diagnosticAvailable:boolean; errors:string[];
 onNavigate:(target:string)=>void;
};
const fmt=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
const percent=(n:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(n)+"%";
const palette=["#00796b","#f3b844","#e05b4e","#a5b7c5","#3a91ad"];
function Card({title,description,children,action}:{title:string;description?:string;children:React.ReactNode;action?:()=>void}){
 return <section className="exe-card">
  <header><div><h3>{title}</h3>{description&&<p>{description}</p>}</div>{action&&<button onClick={action} type="button" aria-label={"Abrir "+title}>Abrir análise ↗</button>}</header>
  {children}
 </section>;
}
function Trend({periods,onNavigate}:{periods:ExecutivePeriod[];onNavigate:()=>void}){
 if(periods.length===0)return <p className="exe-empty">Sem série histórica de matrículas validada para este recorte.</p>;
 const vals=periods.map(p=>p.enrolled);const min=Math.min(...vals),max=Math.max(...vals);const delta=Math.max(1,max-min);const x=(i:number)=>50+(periods.length===1?210:i*420/(periods.length-1));const y=(v:number)=>183-((v-min)/delta)*123;
 const pts=periods.map((p,i)=>x(i)+","+y(p.enrolled)).join(" ");
 return <div><svg viewBox="0 0 520 225" role="img" aria-label={"Matrículas por semestre: "+periods.map(p=>p.term+" "+fmt(p.enrolled)).join("; ")}>
  {[0,1,2,3,4].map(i=><line key={i} x1="42" x2="476" y1={60+i*31} y2={60+i*31} stroke="#e4eeee"/> )}
  <polygon points={x(0)+",183 "+pts+" "+x(periods.length-1)+",183"} fill="#17b49f33"/>
  <polyline points={pts} fill="none" stroke="#087e73" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  {periods.map((p,i)=><g key={p.term}><circle cx={x(i)} cy={y(p.enrolled)} r="6" fill="#00988c" stroke="white" strokeWidth="2"/><text x={x(i)} y={Math.max(15,y(p.enrolled)-12)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0e514d">{fmt(p.enrolled)}</text><text x={x(i)} y="210" textAnchor="middle" fontSize="12" fill="#567173">{p.term.replace("-","/")}</text></g>)}
 </svg><button className="exe-more" type="button" onClick={onNavigate}>Consultar matrículas e fontes ↗</button></div>;
}
function Donut({data,caption}:{data:ExecutiveDocument[];caption:string}){
 const total=data.reduce((s,x)=>s+x.count,0);let offset=0;
 if(!total)return <p className="exe-empty">Sem exigências documentais no recorte institucional. Não é possível calcular conformidade.</p>;
 return <div className="exe-donut-wrap"><div className="exe-donut">
  <svg viewBox="0 0 160 160" role="img" aria-label={caption+": "+data.map(x=>x.status+" "+x.count).join(", ")}><circle cx="80" cy="80" r="57" stroke="#e8eeed" strokeWidth="22" fill="none"/>
  {data.filter(d=>d.count>0).map((d,i)=>{const n=d.count/total*100,o=offset;offset+=n;return <circle key={d.status} cx="80" cy="80" r="57" pathLength="100" stroke={palette[i%palette.length]} strokeWidth="22" fill="none" strokeDasharray={n+" "+(100-n)} strokeDashoffset={-o} transform="rotate(-90 80 80)"/>})}</svg>
  <span><small>Validados</small><strong>{percent(100*(data.find(d=>d.status==="Validado")?.count??0)/total)}</strong></span></div>
  <div className="exe-legend">{data.map((d,i)=><div key={d.status}><i style={{background:palette[i%palette.length]}}/><span>{d.status}</span><strong>{fmt(d.count)}</strong></div>)}</div></div>;
}
export default function ExecutiveOverview({institutionName,term,comparison,metrics,periods,courses,documentStatuses,actions,diagnosticAvailable,errors,onNavigate}:ExecutiveOverviewProps){
 const [selected,setSelected]=useState<ExecutiveCourse|null>(null);
 const growing=courses.filter(c=>c.growth!==null).sort((a,b)=>(b.growth??0)-(a.growth??0)).slice(0,6);
 const max=Math.max(1,...growing.map(c=>Math.abs(c.growth??0)));
 const top=actions.slice(0,5);
 return <div className="exe-board">
  <div className="exe-banner"><div><small>PAINEL EXECUTIVO · FONTES AUTENTICADAS</small><h3>{institutionName}</h3><p>Inteligência de gestão por período, evidências e prioridades verificáveis.</p></div><span>Dados reais disponíveis · sem projeções automáticas</span></div>
  <div className="exe-kpis">{metrics.map((m,i)=><button key={m.label} type="button" onClick={()=>onNavigate(m.target)} className={"exe-kpi exe-"+m.tone}><span className="exe-kpi-icon">{["▥","◎","◈","⚑"][i%4]}</span><span className="exe-kpi-title">{m.label}</span><strong>{m.value===null?"Sem dados":fmt(m.value)}</strong><small>{m.note}</small><em>Explorar ↗</em></button>)}</div>
  <div className="exe-layout exe-first">
   <Card title="Matrículas por semestre" description="Histórico registrado; períodos sem fonte não são estimados" action={()=>onNavigate("Matrículas")}><Trend periods={periods} onNavigate={()=>onNavigate("Matrículas")}/></Card>
   <Card title="Crescimento por curso" description={"Comparação "+(comparison?comparison+" × "+term:"anual indisponível")} action={()=>onNavigate("Matrículas")}>
    {!growing.length?<p className="exe-empty">Sem pares de cursos e semestres equivalentes comparáveis.</p>:<div className="exe-course-bars">{growing.map(c=><button type="button" key={c.href} onClick={()=>setSelected(c)}><span>{c.name}</span><span className="exe-track"><i style={{width:Math.max(4,Math.abs(c.growth??0)/max*100)+"%",background:(c.growth??0)>=0?"#059a84":"#d86957"}}/></span><b>{(c.growth??0)>0?"+":""}{percent(c.growth??0)}</b></button>)}</div>}
   </Card>
   <Card title="Situação documental" description="Evidências do repositório: validado ≠ conceito do INEP" action={()=>onNavigate("Documentação")}><Donut data={documentStatuses} caption="Status das exigências documentais"/></Card>
  </div>
  <div className="exe-layout exe-second">
   <Card title="Regulação MEC / INEP" description="Pendências e revisão das evidências" action={()=>onNavigate("Documentação")}>
    <div className="exe-reg">{documentStatuses.map((s,i)=><button type="button" key={s.status} onClick={()=>onNavigate("Documentação")}><span><i style={{background:palette[i%palette.length]}}/>{s.status}</span><b>{fmt(s.count)}</b></button>)}</div>
    {!diagnosticAvailable&&<p className="exe-empty">Não há conceito regulatório validado disponível para este painel. A cobertura de documentos não é nota MEC.</p>}
   </Card>
   <Card title="Plano de ação · 5W2H" description="Registros da instituição, com responsáveis e prazos" action={()=>onNavigate("Planos de ação")}>
    {top.length?<div className="exe-table-scroll"><table><thead><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead><tbody>{top.map((a,i)=><tr key={i}><td>{a.name}</td><td>{a.owner}</td><td>{a.due}</td><td><span className="exe-chip">{a.status}</span></td></tr>)}</tbody></table></div>:<p className="exe-empty">Nenhuma ação 5W2H registrada no recorte. Abra o plano para cadastrar e acompanhar ações.</p>}
   </Card>
   <Card title="Risco acadêmico" description="Evasão e reprovação por nota × falta" action={()=>onNavigate("Matrículas")}>
    <div className="exe-risk"><span>EVASÃO</span><strong>Não apurada</strong><small>Exige coortes conciliadas e definição de desligamento</small><span>REPROVAÇÃO</span><strong>Não apurada</strong><small>Exige notas, faltas e ofertas vinculadas ao semestre</small></div>
   </Card>
  </div>
  <div className="exe-layout exe-third">
   <Card title="Leituras rápidas do BI" description="Resumo baseado apenas nas fontes disponíveis">
    <div className="exe-insights">
     <button type="button" onClick={()=>onNavigate("Matrículas")}><b>Onde houve evolução?</b><span>{growing.length?growing[0].name+" apresenta variação de "+percent(growing[0].growth??0)+".":"Não há base anual comparável por curso."}</span></button>
     <button type="button" onClick={()=>onNavigate("Documentação")}><b>Onde atuar na regulação?</b><span>{fmt(documentStatuses.filter(d=>d.status!=="Validado"&&d.status!=="NSA").reduce((s,d)=>s+d.count,0))} exigências não validadas no acervo consultado.</span></button>
     <button type="button" onClick={()=>onNavigate("Planos de ação")}><b>Quais ações acompanhar?</b><span>{top.length?fmt(actions.length)+" ações registradas para consulta.":"Nenhum plano 5W2H disponível neste recorte."}</span></button>
    </div>
   </Card>
   <Card title="Integração Fato & Ordem" description="OAB, CFC e ENADE por instituição"><p className="exe-empty">Sem feed de desempenho autenticado e conciliado nesta visão. Nenhum resultado individual foi inferido.</p><button className="exe-more" type="button" onClick={()=>onNavigate("Documentação")}>Abrir indicadores e evidências ↗</button></Card>
  </div>
  {!!errors.length&&<p role="status" className="exe-warning">Fontes com carregamento indisponível: {errors.join(", ")}. Os indicadores afetados permanecem sem dados.</p>}
  {selected&&<div className="exe-detail-backdrop" role="presentation" onClick={()=>setSelected(null)}><section role="dialog" aria-modal="true" aria-label={"Comparativo "+selected.name} onClick={e=>e.stopPropagation()}><button aria-label="Fechar" type="button" onClick={()=>setSelected(null)}>×</button><h3>{selected.name}</h3><p>Semestre {term}: {fmt(selected.current)} matrículas no recorte informado.</p><p>{comparison??"Período anterior"}: {selected.previous===null?"Sem dados":fmt(selected.previous)+" matrículas"}.</p><p>Variação anual calculada: {selected.growth===null?"Indisponível":percent(selected.growth)}.</p><a href={selected.href}>Abrir curso e registros →</a></section></div>}
 </div>;
}
