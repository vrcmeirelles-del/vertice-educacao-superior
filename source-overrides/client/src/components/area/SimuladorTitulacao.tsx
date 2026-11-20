import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import type {IndicadorAvaliacao} from "@/lib/avaliacao-institucional";
import {thresholdsFrom,titulationIndicator,simulate,type FacultyRow,type Degree} from "@/lib/faculty-titulation";

const LABEL:Record<Degree,string>={doutor:"Doutores",mestre:"Mestres",especialista:"Especialistas",graduado:"Graduados",nao_informado:"Não informado"};
const pct=(v:number)=>`${(v*100).toFixed(1).replace(".",",")}%`;

/** Cálculo e simulação do indicador 4.1 a partir do cadastro de titulação, com as faixas do próprio instrumento. */
export default function SimuladorTitulacao({institutionId,indicador}:{institutionId:string;indicador:IndicadorAvaliacao}){
 const [rows,setRows]=useState<FacultyRow[]|null>(null);
 const [error,setError]=useState("");
 const [delta,setDelta]=useState<Partial<Record<Degree,number>>>({});
 useEffect(()=>{let alive=true;setRows(null);setError("");
  Promise.resolve(supabase.from("vertice_professor_titulacao").select("titulacao,regime,ch_semanal,cursos_vinculados").eq("institution_id",institutionId))
   .then(({data,error:e})=>{if(!alive)return;if(e)setError("Não foi possível consultar o cadastro de titulação.");else setRows((data??[]) as FacultyRow[]);});
  return()=>{alive=false;};},[institutionId]);
 const thresholds=useMemo(()=>thresholdsFrom(indicador.criteria as unknown as Record<string,string>),[indicador]);
 const r=useMemo(()=>rows?titulationIndicator(rows,thresholds):null,[rows,thresholds]);
 const sim=r&&thresholds?simulate(r.mix,delta,thresholds):null;
 const box={border:"1px solid #dfe6f2",borderRadius:12,padding:"12px 14px",background:"#fbfcff",display:"grid",gap:8,marginTop:10} as const;
 if(error)return <p role="alert" style={box}>{error}</p>;
 if(!r)return <p role="status" style={box}>Calculando a titulação do corpo docente…</p>;
 if(!thresholds)return <p role="status" style={box}>As faixas do indicador não puderam ser lidas do texto do instrumento; o cálculo não é exibido para não adivinhar critérios.</p>;
 if(!r.total)return <p role="status" style={box}>Sem docentes no cadastro de titulação desta instituição.</p>;
 return <section aria-label="Cálculo do indicador 4.1" style={box}>
  <strong style={{color:"#213e72"}}>Cálculo pelo cadastro de titulação (algoritmo)</strong>
  {!r.reliable&&<p role="status" style={{margin:0,padding:"8px 10px",borderRadius:8,background:"#fffaf0",border:"1px solid #ead4aa",color:"#765111"}}>
   <strong>Conceito não confiável.</strong> {r.suspicious?`Todos os ${r.total} docentes aparecem com a mesma titulação, o mesmo regime, a mesma carga horária e sem curso vinculado — padrão típico de valor padrão de importação.`:`${r.mix.nao_informado} docente(s) sem titulação informada.`} Confirme o cadastro antes de usar este resultado.</p>}
  <p style={{margin:0}}>{(["doutor","mestre","especialista","graduado","nao_informado"] as Degree[]).filter(k=>r.mix[k]).map(k=>`${LABEL[k]}: ${r.mix[k]}`).join(" · ")} — <strong>{pct(r.share)}</strong> de mestres e doutores → conceito estimado <strong>{r.concept}</strong>{r.reliable?"":" (não confiável)"}.</p>
  {r.next&&<p style={{margin:0}}>Para o conceito {r.next.level} (ao menos {pct(r.next.min)}): contratar {r.hiresToNext} mestre(s)/doutor(es) sem desligamentos, <em>ou</em> {r.upgradesToNext} docente(s) atual(is) concluírem mestrado/doutorado.</p>}
  <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"end"}}>
   {(["doutor","mestre","especialista"] as Degree[]).map(k=><label key={k} style={{display:"grid",gap:4,fontSize:".82rem"}}>{LABEL[k]} (+/−)
    <input type="number" value={delta[k]??0} onChange={e=>setDelta(d=>({...d,[k]:Math.trunc(Number(e.target.value)||0)}))} style={{width:90}}/></label>)}
   {sim&&<span>Simulação: {sim.total} docentes, {pct(sim.share)} → conceito <strong>{sim.concept}</strong></span>}
  </div>
  <small style={{color:"#66748b"}}>Faixas lidas do texto oficial do indicador 4.1 neste instrumento. Estimativa de apoio à gestão; o conceito é atribuído pela comissão avaliadora com base nos documentos comprobatórios. Fonte: vertice_professor_titulacao.</small>
 </section>;
}
