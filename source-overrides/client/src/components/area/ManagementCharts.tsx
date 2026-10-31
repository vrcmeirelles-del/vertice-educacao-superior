import type { managementReview } from '@/lib/management-review';
import './management-review.css';
type Report = ReturnType<typeof managementReview>;
import { reviewMetrics } from '@/lib/management-metrics';
function Meter({label,value,total,color}:{label:string;value:number;total:number;color:string}) {
 return <div className="mr-meter"><div><span>{label}</span><strong>{value} / {total}</strong></div><div className="mr-track" aria-hidden="true"><span style={{width:`${total?value/total*100:0}%`,background:color}}/></div></div>;
}
export default function ManagementCharts({report}:{report:Report}) {
 const m=reviewMetrics(report);const states=[...m.states,...(m.unknown?[{key:'unknown',label:'Status não reconhecido',color:'#485569',value:m.unknown}]:[])];
 let angle=0;const stops=states.filter(s=>s.value).map(s=>{const start=angle;angle+=s.value/m.total*100;return `${s.color} ${start}% ${angle}%`;});
 return <div className="mr-dashboard">
  <div className="mr-kpis">
   <article className="mr-kpi mr-blue"><span>Carteira do curso</span><strong>{m.planned}</strong><small>metas não canceladas</small></article>
   <article className="mr-kpi mr-green"><span>Metas com medição</span><strong>{m.measured}<em> / {m.planned}</em></strong><small>registro numérico válido; não significa meta atingida</small></article>
   <article className="mr-kpi mr-amber"><span>Revisão gerencial</span><strong>{m.attention}</strong><small>metas com lacunas de dados ou documentos</small></article>
   <article className="mr-kpi mr-violet"><span>Base documental</span><strong>{m.total}</strong><small>exigências no período selecionado, incluindo NSA</small></article>
  </div>
  <div className="mr-chart-grid">
   <section className="mr-chart" aria-labelledby="mr-document-title"><p className="mr-eyebrow">DOCUMENTAÇÃO</p><h4 id="mr-document-title">Onde estão as evidências?</h4>
    {m.total ? <div className="mr-composition"><div className="mr-donut" role="img" aria-label={`Distribuição de ${m.total} exigências. ${states.map(s=>`${s.label}: ${s.value}`).join('; ')}`} style={{background:`conic-gradient(${stops.join(',')})`}}><div><strong>{m.total}</strong><span>exigências</span></div></div><ul className="mr-legend">{states.map(s=><li key={s.key}><i aria-hidden="true" style={{background:s.color}}/><span>{s.label}</span><strong>{s.value}</strong></li>)}</ul></div> : <div className="mr-empty-chart"><strong>Sem exigências neste recorte</strong><p>Configure os documentos esperados para visualizar a distribuição. Não há percentual calculado.</p></div>}
    <p className="mr-caption">Conta a última versão de cada exigência. NSA é uma declaração a revisar, não uma aprovação.</p>
   </section>
   <section className="mr-chart" aria-labelledby="mr-goal-title"><p className="mr-eyebrow">ACOMPANHAMENTO</p><h4 id="mr-goal-title">O plano tem base para acompanhar?</h4>
    {m.planned ? <div className="mr-meters"><Meter label="Com medição registrada" value={m.measured} total={m.planned} color="#2867be"/><Meter label="Com ação 5W2H vinculada" value={m.withAction} total={m.planned} color="#7652a5"/><Meter label="Com exigência documental no recorte" value={m.withDocuments} total={m.planned} color="#147d64"/></div> : <div className="mr-empty-chart"><strong>O curso ainda não tem metas</strong><p>Cadastre objetivos e indicadores para iniciar o acompanhamento.</p></div>}
    <p className="mr-caption">Cada barra usa o total de metas como base. As categorias se sobrepõem; não medem cumprimento nem conceito INEP.</p>
   </section>
  </div>
  <aside className="mr-next"><span className="mr-next-symbol" aria-hidden="true">→</span><div><strong>Foco da próxima reunião</strong><p>{!m.planned?'Definir metas e responsáveis para o curso.':m.measured<m.planned?`Registrar medições para ${m.planned-m.measured} metas ainda sem dados numéricos válidos.`:'Revisar a atualidade e a qualidade das medições antes de julgar resultados.'} {m.states.find(s=>s.key==='enviado')?.value ? 'Priorizar também a análise humana dos documentos enviados.' : ''}</p></div></aside>
 </div>;
}
