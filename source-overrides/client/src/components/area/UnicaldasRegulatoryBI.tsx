import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import type {EmecRecord,EmecSnapshot} from "@/lib/emec";
import "./unicaldas-regulatory-bi.css";

const UNICALDAS="4224e2fc-6a96-4761-820f-6f8e809ca1c1";
type Kind=EmecRecord["kind"];
type Audit={courses:number|null;library:number|null;placeholders:number|null;catalog:number|null;documents:number|null;uniqueDocuments:number|null;backups:number|null;degree:Array<{name:string;count:number}>;errors:string[]};
const EMPTY:Audit={courses:null,library:null,placeholders:null,catalog:null,documents:null,uniqueDocuments:null,backups:null,degree:[],errors:[]};
const TYPES:{kind:Kind;label:string;symbol:string}[]=[
 {kind:"indicator",label:"Indicadores",symbol:"◫"},
 {kind:"act",label:"Atos",symbol:"▤"},
 {kind:"process",label:"Processos",symbol:"◇"},
 {kind:"course",label:"Cursos e-MEC",symbol:"▦"},
 {kind:"alert",label:"Alertas",symbol:"!"},
 {kind:"occurrence",label:"Ocorrências",symbol:"◉"}
];
const fmt=(n:number|null)=>n===null?"—":new Intl.NumberFormat("pt-BR").format(n);

export default function UnicaldasRegulatoryBI({institutionId,snapshot,onSelectKind}:{
 institutionId:string;snapshot:EmecSnapshot;onSelectKind:(kind:Kind|"all")=>void;
}){
 const [audit,setAudit]=useState<Audit>(EMPTY);
 const [loading,setLoading]=useState(true);
 const [updated,setUpdated]=useState(0);
 const [section,setSection]=useState<"regulacao"|"cadastro"|"pendencias">("regulacao");
 const body=snapshot.body;
 const byKind=useMemo(()=>new Map(TYPES.map(t=>[t.kind,body.records.filter(r=>r.kind===t.kind).length])),[body]);
 const count=(kind:Kind)=>byKind.get(kind)??0;
 const total=body.records.length;
 const alerts=body.records.filter(r=>r.kind==="alert");
 const maxKind=Math.max(1,...TYPES.map(t=>count(t.kind)));
 const maxDegree=Math.max(1,...audit.degree.map(t=>t.count));
 useEffect(()=>{
  if(institutionId!==UNICALDAS)return;
  let live=true;setLoading(true);
  const get=async(table:string,columns:string)=>{
   const {data,error}=await supabase.from(table).select(columns).eq("institution_id",institutionId).limit(1000);
   if(error)throw new Error(table+": consulta indisponível.");
   return (data??[]) as unknown as Record<string,unknown>[];
  };
  (async()=>{
   const [courses,library,catalog,docs,backups]=await Promise.allSettled([
    get("vertice_courses","degree,status"),
    get("vertice_inep_library","is_placeholder"),
    get("vertice_migration_catalog_tables","table_name"),
    get("vertice_repository_files","file_name,status"),
    get("vertice_academic_backups","stage")
   ]);
   const next:Audit={...EMPTY,degree:[],errors:[]};
   const take=(r:PromiseSettledResult<Record<string,unknown>[]>,key:string)=>{
    if(r.status==="fulfilled")return r.value;
    next.errors.push(key);return null;
   };
   const a=take(courses,"Cadastro de cursos");
   const b=take(library,"Biblioteca regulatória");
   const c=take(catalog,"Catálogo UNI_GIZ");
   const d=take(docs,"Documentos");
   const e=take(backups,"Backups");
   if(a){
    next.courses=a.length;
    const dmap=new Map<string,number>();
    for(const row of a){const name=String(row.degree||"Não informado");dmap.set(name,(dmap.get(name)||0)+1);}
    next.degree=[...dmap].map(([name,count])=>({name,count})).sort((x,y)=>y.count-x.count);
   }
   if(b){next.library=b.length;next.placeholders=b.filter(r=>r.is_placeholder===true).length;}
   if(c)next.catalog=c.length;
   if(d){next.documents=d.length;next.uniqueDocuments=new Set(d.map(x=>String(x.file_name||""))).size;}
   if(e)next.backups=e.length;
   if(live){setAudit(next);setLoading(false);}
  })().catch(()=>{if(live){setAudit({...EMPTY,errors:["Fontes de dados"]});setLoading(false);}});
  return()=>{live=false};
 },[institutionId,updated]);
 if(institutionId!==UNICALDAS)return null;
 const choose=(kind:Kind)=>{
  onSelectKind(kind);
  document.getElementById("emec-detalhamento")?.scrollIntoView({behavior:"smooth",block:"start"});
 };
 return <section className="uni-bi" aria-labelledby="uni-bi-title">
  <div className="uni-bi-hero">
   <div><span className="uni-bi-kicker">VÉRTICE · INTELIGÊNCIA GERENCIAL 360°</span>
    <h4 id="uni-bi-title">UNICALDAS | BI institucional e regulatório</h4>
    <p>Leitura dos dados reais disponíveis no Supabase. Consulta e-MEC de <strong>{body.consulted_on}</strong> · versão {snapshot.revision} · <strong>cobertura {body.coverage==="partial"?"parcial":"declarada como completa"}</strong>.</p>
   </div>
   <a href={body.source_url} target="_blank" rel="noopener noreferrer">Consultar fonte e-MEC</a>
  </div>
  <div className="uni-bi-tabs" role="group" aria-label="Explorar indicadores do BI">
   <button type="button" aria-pressed={section==="regulacao"} onClick={()=>setSection("regulacao")}>Regulação</button>
   <button type="button" aria-pressed={section==="cadastro"} onClick={()=>setSection("cadastro")}>Cadastro e acervo</button>
   <button type="button" aria-pressed={section==="pendencias"} onClick={()=>setSection("pendencias")}>Pendências e próximos passos</button>
   <button type="button" className="uni-bi-refresh" disabled={loading} onClick={()=>setUpdated(x=>x+1)}>{loading?"Consultando…":"Atualizar leituras"}</button>
  </div>
  {section==="regulacao"&&<>
   <div className="uni-bi-kpis">
    <article><span>Registros na consulta</span><strong>{fmt(total)}</strong><small>Não equivale a alunos</small></article>
    <article><span>Indicadores e-MEC</span><strong>{fmt(count("indicator"))}</strong><small>Registros, não conceitos</small></article>
    <article><span>Processos</span><strong>{fmt(count("process"))}</strong><small>Conforme arquivo de consulta</small></article>
    <article className="uni-bi-attention"><span>Alertas e lacunas</span><strong>{count("alert")} + {body.gaps.length}</strong><small>Tipos distintos, sem somar ocorrências</small></article>
   </div>
   <div className="uni-bi-panels">
    <article className="uni-bi-panel">
     <h5>Composição do levantamento e-MEC</h5>
     <p>Selecione uma faixa para abrir os respectivos registros e documentos.</p>
     <div className="uni-bi-bars">{TYPES.map((item,i)=><button type="button" onClick={()=>choose(item.kind)} key={item.kind} title={"Ver "+item.label}>
      <span className="uni-bi-bar-label"><span>{item.symbol} {item.label}</span><b>{count(item.kind)}</b></span>
      <span className="uni-bi-track"><span className={"uni-bi-fill tone-"+i} style={{width:(count(item.kind)/maxKind*100)+"%"}}/></span>
     </button>)}</div>
    </article>
    <article className="uni-bi-panel">
     <h5>Sinais para a governança</h5>
     <p>Alertas registrados na consulta; ainda exigem análise e curadoria.</p>
     {alerts.length===0?<p>Nenhum alerta cadastrado nesta versão.</p>:<ul className="uni-bi-alert-list">{alerts.slice(0,6).map(r=><li key={r.key}><button type="button" onClick={()=>choose("alert")}><span className="uni-bi-dot"/> {r.title}</button></li>)}</ul>}
     <p className="uni-bi-disclaimer">A ausência de um alerta na consulta parcial não significa ausência de risco institucional.</p>
    </article>
   </div>
  </>}
  {section==="cadastro"&&<>
   <div className="uni-bi-kpis">
    <article><span>Cursos no cadastro</span><strong>{loading?"…":fmt(audit.courses)}</strong><small>Não confundir com cursos no e-MEC</small></article>
    <article><span>Entradas na biblioteca INEP</span><strong>{loading?"…":fmt(audit.library)}</strong><small>{audit.placeholders===null?"Validação não disponível":audit.placeholders+" marcadas como modelos/placeholder"}</small></article>
    <article><span>Nomes de tabelas UNI_GIZ</span><strong>{loading?"…":fmt(audit.catalog)}</strong><small>Inventário, não linhas de alunos</small></article>
    <article><span>Documentos do repositório</span><strong>{loading?"…":fmt(audit.documents)}</strong><small>{audit.uniqueDocuments===null?"Sem verificação":audit.uniqueDocuments+" nome(s) distinto(s)"}</small></article>
   </div>
   <article className="uni-bi-panel uni-bi-course-panel"><h5>Distribuição do cadastro por formação</h5>
    {audit.degree.length?<div className="uni-bi-bars">{audit.degree.map((item,i)=><div key={item.name} className="uni-bi-degree">
     <span className="uni-bi-bar-label"><span>{item.name}</span><b>{item.count}</b></span>
     <span className="uni-bi-track"><span className={"uni-bi-fill tone-"+(i%6)} style={{width:(item.count/maxDegree*100)+"%"}}/></span>
    </div>)}</div>:<p>{loading?"Carregando distribuição…":"Cadastro indisponível para este perfil."}</p>}
    <p className="uni-bi-disclaimer">Situação cadastral não comprova oferta efetiva, vagas ocupadas ou matrículas. Os históricos regulatórios podem conter códigos adicionais e divergências.</p>
   </article>
  </>}
  {section==="pendencias"&&<div className="uni-bi-panels">
   <article className="uni-bi-panel"><h5>Lacunas da consulta oficial ({body.gaps.length})</h5>{body.gaps.length?<ol className="uni-bi-gaps">{body.gaps.map((s,i)=><li key={i}>{s}</li>)}</ol>:<p>Nenhuma lacuna declarada na versão selecionada.</p>}</article>
   <article className="uni-bi-panel"><h5>Integração acadêmica UNI_GIZ</h5><div className="uni-bi-stage"><span>Inventário de tabelas</span><b>{audit.catalog===null?"A conferir":audit.catalog+" nomes"}</b></div>
    <div className="uni-bi-stage"><span>Backups cadastrados</span><b>{audit.backups===null?"A conferir":audit.backups}</b></div>
    <div className="uni-bi-stage"><span>Restauração SQL Server</span><b className="uni-bi-pending">Pendente</b></div>
    <div className="uni-bi-stage"><span>Matrículas, notas, frequência e evasão</span><b className="uni-bi-pending">Não homologados</b></div>
    <p className="uni-bi-disclaimer">Não apresentar inventários, backups ou registros regulatórios como estudantes matriculados. O BI acadêmico depende de extração e conciliação após restauração do backup.</p>
   </article>
  </div>}
  {audit.errors.length>0&&<p className="uni-bi-error" role="status">Leituras indisponíveis para este perfil: {audit.errors.join(", ")}. Os valores ausentes são exibidos como “—”, não como zero.</p>}
  <p className="uni-bi-footer">Fonte: tabelas institucionais autorizadas da Vértice e histórico de consulta e-MEC. Acesso restrito ao perfil institucional. Não há sincronização automática com o GIZ nesta etapa.</p>
 </section>;
}
