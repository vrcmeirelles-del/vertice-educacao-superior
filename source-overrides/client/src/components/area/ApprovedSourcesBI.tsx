import {useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import "./source-curation.css";
type Entry={indicador:string;periodo:string;valor:number;unidade:string};
type Review={id:string;upload_id:string;state:string;candidate_rows:Entry[];reviewed_at:string|null;created_at:string};
export default function ApprovedSourcesBI({institutionId}:{institutionId:string}){
 const [reviews,setReviews]=useState<Review[]>([]);
 const [error,setError]=useState("");
 const [period,setPeriod]=useState("");
 const load=useCallback(async()=>{
  const {data,error}=await supabase.from("vertice_source_analyses").select("id,upload_id,state,candidate_rows,reviewed_at,created_at").eq("institution_id",institutionId).eq("state","aprovado").order("reviewed_at",{ascending:false}).limit(100);
  if(error)throw error;setReviews((data??[]) as Review[]);
 },[institutionId]);
 useEffect(()=>{let valid=true;void load().catch(()=>{if(valid)setError("Indicadores homologados indisponíveis para este usuário.");});return()=>{valid=false;};},[load]);
 const all=useMemo(()=>reviews.flatMap(r=>r.candidate_rows.map(row=>({...row,version:r.id,approvedAt:r.reviewed_at}))),[reviews]);
 const periods=useMemo(()=>[...new Set(all.map(r=>r.periodo))].sort().reverse(),[all]);
 const shown=all.filter(r=>!period||r.periodo===period);
 const distinct=shown.length,indicators=new Set(shown.map(x=>x.indicador.toLocaleLowerCase("pt-BR"))).size;
 const date=(r:string|null)=>r?new Date(r).toLocaleDateString("pt-BR"):"Não informada";
 return <section className="vx-approved-bi" aria-label="Indicadores externos homologados">
  <div className="vx-curation-heading"><div><span>ETAPA 4 — PUBLICAÇÃO CONTROLADA</span><h3>BI · Indicadores externos homologados</h3>
   <p>Somente dados aprovados por revisor distinto do autor. São exibidos separadamente dos KPIs acadêmicos oficiais.</p></div>
   <button type="button" onClick={()=>void load()}>Atualizar BI</button>
  </div>
  {error&&<p role="alert" className="vx-curation-error">{error}</p>}
  <div className="vx-approved-kpis"><div><small>Fontes aprovadas</small><strong>{reviews.length}</strong></div><div><small>Registros no recorte</small><strong>{distinct}</strong></div><div><small>Indicadores distintos</small><strong>{indicators}</strong></div></div>
  <label>Competência<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="">Todos os períodos homologados</option>{periods.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
  {shown.length?<div className="vx-curation-scroll"><table><thead><tr><th>Indicador</th><th>Semestre</th><th>Valor</th><th>Unidade</th><th>Homologação</th></tr></thead><tbody>
   {shown.slice(0,150).map((r,i)=><tr key={r.version+"-"+i}><td>{r.indicador}</td><td>{r.periodo}</td><td>{r.valor.toLocaleString("pt-BR",{maximumFractionDigits:3})}</td><td>{r.unidade}</td><td>{date(r.approvedAt)}</td></tr>)}
  </tbody></table></div>:<p>Não existem cargas externas aprovadas nesta instituição e competência.</p>}
  <small>Exibição limitada às últimas 100 análises aprovadas e 150 linhas no recorte. Revisões históricas podem apresentar indicadores repetidos; não somar versões sem escolher a fonte vigente. A publicação não altera matrículas, relatórios nem tabelas do e-ORBIT.</small>
 </section>;
}
