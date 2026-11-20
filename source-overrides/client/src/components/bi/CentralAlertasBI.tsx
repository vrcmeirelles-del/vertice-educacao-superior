import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";

type Alert={id:string;algorithm:string;severity:"alta"|"media"|"informativa";title:string;detail:string|null;status:string;first_seen_at:string;last_seen_at:string};
type Run={algorithm:string;ran_at:string;published:boolean;validation:Record<string,any>};
const ALG:Record<string,string>={evasao:"Alerta de evasão",gargalo:"Disciplinas-gargalo",ritmo_repositorio:"Ritmo do Repositório",titulacao:"Titulação docente (4.1)"};
const SEV:Record<string,[string,string]>={alta:["Alta","#b4232f"],media:["Média","#a7660c"],informativa:["Informativa","#2e6a3f"]};
const when=(s:string)=>new Date(s).toLocaleDateString("pt-BR");

/** Alertas gravados pela rotina diária dos algoritmos (vertice-algoritmos), com abertura e resolução automáticas. */
export default function CentralAlertasBI({institutionId}:{institutionId:string}){
 const [alerts,setAlerts]=useState<Alert[]|null>(null);
 const [runs,setRuns]=useState<Run[]>([]);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let alive=true;setError("");
  Promise.all([
   supabase.from("vertice_algorithm_alerts").select("id,algorithm,severity,title,detail,status,first_seen_at,last_seen_at").eq("institution_id",institutionId).is("resolved_at",null).order("last_seen_at",{ascending:false}).range(0,499),
   supabase.from("vertice_algorithm_runs").select("algorithm,ran_at,published,validation").eq("institution_id",institutionId).order("ran_at",{ascending:false}).range(0,39),
  ]).then(([a,r])=>{if(!alive)return;if(a.error||r.error){setError("Não foi possível consultar os alertas dos algoritmos.");return;}
   const rank={alta:0,media:1,informativa:2} as const;
   setAlerts(((a.data??[]) as Alert[]).sort((x,y)=>rank[x.severity]-rank[y.severity]));
   const seen=new Set<string>();setRuns(((r.data??[]) as Run[]).filter(x=>!seen.has(x.algorithm)&&seen.add(x.algorithm)));
  });
  return()=>{alive=false;};},[institutionId,refresh]);
 const ack=async(id:string)=>{setNotice("");const {error:e}=await supabase.rpc("vertice_algorithm_alert_ack",{p_alert:id});
  if(e)setNotice(e.code==="42501"?"Somente master ou gestor pode reconhecer alertas.":"Não foi possível reconhecer o alerta.");else{setNotice("Alerta reconhecido.");setRefresh(x=>x+1);}};
 if(error)return <p role="alert" className="vxa-error">{error}</p>;
 if(!alerts)return <p role="status">Consultando os alertas dos algoritmos…</p>;
 const groups=Object.keys(ALG).map(k=>[k,alerts.filter(a=>a.algorithm===k)] as const);
 return <div className="vxa-card">
  <h3>Central de alertas dos algoritmos</h3>
  <p>Gerada todos os dias pela rotina automática, sem IA, com o mesmo cálculo das abas. Um alerta abre quando o sinal aparece e se resolve sozinho quando deixa de aparecer. Evasão e disciplinas-gargalo só geram alertas quando a validação nos dados da instituição passa.</p>
  <div className="vxa-submetrics">{groups.map(([k,list])=><article key={k}><small>{ALG[k]}</small><strong>{list.length}</strong><span>{list.filter(a=>a.severity==="alta").length} de severidade alta</span></article>)}</div>
  {notice&&<p role="status">{notice}</p>}
  {groups.map(([k,list])=>{const run=runs.find(r=>r.algorithm===k);return <section key={k} style={{display:"grid",gap:6}}>
   <h4 style={{margin:"8px 0 0",color:"#213e72"}}>{ALG[k]}</h4>
   <small style={{color:"#61718b"}}>{run?`Última execução: ${new Date(run.ran_at).toLocaleString("pt-BR")} · ${run.published?"alertas publicados":`não publicado${run.validation?.reason?` — ${run.validation.reason}`:""}`}`:"Ainda sem execução registrada."}</small>
   {list.length?<div className="vxa-scroll"><table><thead><tr><th>Severidade</th><th>Alerta</th><th>Detalhe</th><th>Desde</th><th>Situação</th></tr></thead><tbody>
    {list.slice(0,100).map(a=><tr key={a.id}>
     <td><strong style={{color:SEV[a.severity][1]}}>{SEV[a.severity][0]}</strong></td><td>{a.title}</td><td><small>{a.detail}</small></td><td>{when(a.first_seen_at)}</td>
     <td>{a.status==="reconhecido"?"Reconhecido":<button type="button" onClick={()=>void ack(a.id)}>Reconhecer</button>}</td>
    </tr>)}</tbody></table></div>:<p style={{margin:0}}>Nenhum alerta aberto.</p>}
  </section>;})}
  <p className="vxa-source">Fonte: vertice_algorithm_alerts e vertice_algorithm_runs, atualizadas diariamente pela função vertice-algoritmos. "Reconhecer" registra quem viu o alerta; ele só se resolve quando o dado deixa de indicar o problema.</p>
 </div>;
}
