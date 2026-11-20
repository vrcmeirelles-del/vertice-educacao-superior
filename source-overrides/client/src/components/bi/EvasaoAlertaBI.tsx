import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {evasionAlert,RECENT,MIN_PAIRS,MIN_LIFT,type CohortRow,type Level} from "@/lib/evasion-alert";

const LEVEL:Record<Level,string>={alerta:"Alerta",atencao:"Atenção",normal:"Dentro dos pares"};
const pct=(v:number|null|undefined)=>v==null?"—":`${(v*100).toFixed(1).replace(".",",")}%`;
const COLS="codigo,curso,modalidade,semestre,total_registros,abandono,cancelado,transferido,troca_curso,trancado";

/** Alerta precoce de evasão por curso: algoritmo estatístico validado nos dados da própria instituição. */
export default function EvasaoAlertaBI({institutionId}:{institutionId:string}){
 const [rows,setRows]=useState<CohortRow[]|null>(null);
 const [error,setError]=useState("");
 const [all,setAll]=useState(false);
 useEffect(()=>{
  let alive=true;setRows(null);setError("");
  void (async()=>{
   const out:CohortRow[]=[];
   for(let page=0;;page++){
    const {data,error:e}=await supabase.from("vertice_course_semester_stats").select(COLS).eq("institution_id",institutionId).order("id").range(page*1000,page*1000+999);
    if(e)throw e;out.push(...(data??[]) as CohortRow[]);if(!data||data.length<1000)break;
   }
   return out;
  })().then(r=>{if(alive)setRows(r);}).catch(()=>{if(alive)setError("Não foi possível consultar a evasão por curso. Verifique o acesso institucional.");});
  return()=>{alive=false;};
 },[institutionId]);
 const result=useMemo(()=>rows?evasionAlert(rows):null,[rows]);
 if(error)return <p role="alert" className="vxa-error">{error}</p>;
 if(!result)return <p role="status">Calculando o alerta de evasão…</p>;
 const {validation:v,courses}=result;
 const shown=v.ready?courses.filter(c=>all||c.level!=="normal"):[];
 return <div className="vxa-card">
  <h3>Alerta precoce de evasão por curso</h3>
  <p>Compara cada curso com os pares da mesma modalidade <strong>dentro da mesma coorte de ingresso</strong>, em que todos tiveram o mesmo tempo para evadir. Coortes recentes sempre parecem melhores porque ainda estão no início; por isso o painel não projeta "queda da evasão". Evasão definitiva = abandono, cancelamento, transferência e troca de curso. Trancamento aparece à parte.</p>
  {v.ready?<div className="vxa-submetrics" aria-label="Validação do alerta">
   <article><small>Acerto do alerta</small><strong>{pct(v.hitRate)}</strong><span>curso alertado seguiu acima dos pares na coorte seguinte (acaso: {pct(v.baseRate)})</span></article>
   <article><small>Alerta que se repete</small><strong>{pct(v.repeatRate)}</strong><span>contra {pct(v.baseRepeat)} ao acaso</span></article>
   <article><small>Correlação entre coortes</small><strong>{v.corr==null?"—":v.corr.toFixed(2).replace(".",",")}</strong><span>posição relativa de uma coorte para a seguinte</span></article>
   <article><small>Comparações no histórico</small><strong>{v.pairs}</strong><span>{v.alerts} desvios fortes observados</span></article>
  </div>:<p className="vxa-alert" role="status"><strong>Alerta não publicado.</strong> {v.reason} O alerta só aparece quando, nos dados desta instituição, antecipa a coorte seguinte ao menos {Math.round(MIN_LIFT*100)} pontos acima do acaso, com no mínimo {MIN_PAIRS} comparações.</p>}
  {v.ready&&<>
   <label style={{display:"flex",gap:8,alignItems:"center",fontWeight:600}}><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)} style={{width:"auto"}}/>Mostrar também os cursos dentro dos pares</label>
   {shown.length?<div className="vxa-scroll"><table>
    <thead><tr><th>Curso</th><th>Modalidade</th><th>Nível</th><th>Coortes recentes: curso × pares</th><th>Trancamento</th></tr></thead>
    <tbody>{shown.map(c=><tr key={c.codigo}>
     <td>{c.curso}</td><td>{c.modalidade}</td>
     <td><strong style={{color:c.level==="alerta"?"#b4232f":c.level==="atencao"?"#a7660c":"#2e6a3f"}}>{LEVEL[c.level]}</strong></td>
     <td>{c.recent.map(r=><div key={r.cohort}>{r.cohort}: {pct(r.rate)} × {pct(r.peerRate)} <small>({r.n} registros)</small></div>)}</td>
     <td>{c.lockAtypical?"Atípico: verificar se foi movimento administrativo":"—"}</td>
    </tr>)}</tbody>
   </table></div>:<p>Nenhum curso destoa dos pares nas {RECENT} coortes mais recentes.</p>}
  </>}
  <p className="vxa-source"><strong>Como ler:</strong> "Alerta" = evasão muito acima dos pares (desvio binomial ≥ 2) numa das duas coortes mais recentes; "Atenção" = desvio moderado e persistente nas últimas {RECENT} coortes. Cursos com menos de 10 registros na coorte e grupos com menos de 4 cursos não são comparados. É um sinal para investigar, não uma previsão de taxa nem um diagnóstico de causa. Fonte: vertice_course_semester_stats (retrato atual por coorte de ingresso).</p>
 </div>;
}
