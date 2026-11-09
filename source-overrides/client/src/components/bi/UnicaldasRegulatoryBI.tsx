import {useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import "./unicaldas-regulatory-bi.css";

type RegulatoryRecord={kind:string;key:string;title:string;data?:Record<string,unknown>};
type Snapshot={revision:number;body:{records?:RegulatoryRecord[];gaps?:string[];coverage?:string;consulted_on?:string;source_url?:string}};
type Course={id:string;name:string;code:string|null;degree:string|null;modality:string|null;status:string|null};
type Library={id:string;title:string|null;code:string|null;dimension:string|null;indicator:string|null;file_name:string|null;is_placeholder:boolean|null;active:boolean|null};
type Document={id:string;file_name:string;status:string;document_category:string|null};
type Catalog={table_name:string;area_sugerida:string|null;prioridade_sugerida:number|null;confirmation_state:string};
type Data={snapshot:Snapshot|null;courses:Course[]|null;library:Library[]|null;documents:Document[]|null;catalog:Catalog[]|null;warnings:string[]};
type View="emec"|"courses"|"library"|"documents"|"catalog"|"gaps"|"academic";
const UNICALDAS="4224e2fc-6a96-4761-820f-6f8e809ca1c1";
const kindName:Record<string,string>={indicator:"Indicadores",act:"Atos regulatórios",process:"Processos",course:"Cursos no e-MEC",alert:"Alertas",occurrence:"Ocorrências",institution:"Instituição",address:"Endereços",attachment:"Anexos"};
const number=(v:number|null)=>v===null?"Indisponível":v.toLocaleString("pt-BR");
const readable=(v:unknown)=>v===null||v===undefined||v===""?"Não informado":typeof v==="object"?JSON.stringify(v):String(v);
const includes=(s:string,q:string)=>s.toLocaleLowerCase("pt-BR").includes(q.toLocaleLowerCase("pt-BR"));

export default function UnicaldasRegulatoryBI({institutionId}:{institutionId:string}){
 const [data,setData]=useState<Data|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [view,setView]=useState<View>("emec");
 const [kind,setKind]=useState("all");
 const [search,setSearch]=useState("");
 const [limit,setLimit]=useState(35);
 const load=useCallback(async()=>{
  if(institutionId!==UNICALDAS)return;
  setLoading(true);setError("");
  try{
   // Todas as consultas são limitadas à IES e permanecem submetidas às políticas RLS.
   const [s,c,l,d,t]=await Promise.all([
    supabase.from("vertice_emec_snapshots").select("revision,body").eq("institution_id",institutionId).order("revision",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("vertice_courses").select("id,name,code,degree,modality,status").eq("institution_id",institutionId).order("name").limit(200),
    supabase.from("vertice_inep_library").select("id,title,code,dimension,indicator,file_name,is_placeholder,active").eq("institution_id",institutionId).eq("active",true).limit(500),
    supabase.from("vertice_repository_files").select("id,file_name,status,document_category").eq("institution_id",institutionId).limit(500),
    supabase.from("vertice_migration_catalog_tables").select("table_name,area_sugerida,prioridade_sugerida,confirmation_state").eq("institution_id",institutionId).order("table_name").limit(1000)
   ]);
   const warnings=[
    s.error?"Consulta e-MEC indisponível para esta sessão.":null,
    c.error?"Cadastro de cursos indisponível.":null,
    l.error?"Biblioteca INEP indisponível.":null,
    d.error?"Repositório documental indisponível.":null,
    t.error?"Inventário GIZ indisponível.":null
   ].filter((x):x is string=>Boolean(x));
   if(warnings.length===5)throw new Error("Nenhuma fonte autorizada está disponível. Verifique seu perfil e a conexão.");
   setData({
    snapshot:s.error?null:(s.data as Snapshot|null),
    courses:c.error?null:(c.data as Course[]),
    library:l.error?null:(l.data as Library[]),
    documents:d.error?null:(d.data as Document[]),
    catalog:t.error?null:(t.data as Catalog[]),
    warnings
   });
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar o BI.");}
  finally{setLoading(false);}
 },[institutionId]);
 useEffect(()=>{void load();},[load]);
 const records=data?.snapshot?.body?.records??[];
 const gaps=data?.snapshot?.body?.gaps??[];
 const counts=useMemo(()=>{
  const result:Record<string,number>={};
  for(const r of records)result[r.kind]=(result[r.kind]??0)+1;
  return result;
 },[records]);
 const uniqueDocs=useMemo(()=>new Set((data?.documents??[]).map(d=>d.file_name)).size,[data?.documents]);
 const kpis:{id:View;kind?:string;label:string;value:number|null;sub:string}[]=[
  {id:"courses",label:"Cursos cadastrados",value:data?.courses?.length??null,sub:"Graduação e especialização"},
  {id:"emec",kind:"indicator",label:"Indicadores e-MEC",value:data?.snapshot?counts.indicator??0:null,sub:"Consulta regulatória datada"},
  {id:"emec",kind:"process",label:"Processos",value:data?.snapshot?counts.process??0:null,sub:"Acompanhamento regulatório"},
  {id:"emec",kind:"act",label:"Atos",value:data?.snapshot?counts.act??0:null,sub:"Histórico no e-MEC"},
  {id:"emec",kind:"alert",label:"Alertas",value:data?.snapshot?counts.alert??0:null,sub:"Itens para análise"},
  {id:"library",label:"Biblioteca INEP",value:data?.library?.length??null,sub:"Itens ativos cadastrados"},
  {id:"documents",label:"Documentos",value:data?.documents?.length??null,sub:"Registros no repositório"},
  {id:"catalog",label:"Inventário GIZ",value:data?.catalog?.length??null,sub:"Nomes de tabelas, sem linhas"}
 ];
 const open=(target:View,category="all")=>{setView(target);setKind(category);setSearch("");setLimit(35);};
 const filtered=useMemo(()=>{
  const q=search.trim();
  if(view==="emec")return records.filter(r=>(kind==="all"||r.kind===kind)&&(!q||includes(r.title+" "+r.key+" "+JSON.stringify(r.data??{}),q)));
  if(view==="courses")return (data?.courses??[]).filter(r=>!q||includes(r.name+" "+(r.code??"")+" "+(r.degree??"")+" "+(r.modality??""),q));
  if(view==="library")return (data?.library??[]).filter(r=>!q||includes((r.title??"")+" "+(r.code??"")+" "+(r.indicator??"")+" "+(r.file_name??""),q));
  if(view==="documents")return (data?.documents??[]).filter(r=>!q||includes(r.file_name+" "+r.status,q));
  if(view==="catalog")return (data?.catalog??[]).filter(r=>!q||includes(r.table_name+" "+(r.area_sugerida??""),q));
  if(view==="gaps")return gaps.filter(r=>!q||includes(r,q));
  return [];
 },[search,view,records,kind,data,gaps]);
 if(institutionId!==UNICALDAS)return null;
 return <section className="ub-root" aria-label="BI institucional e regulatório da UNICALDAS">
  <div className="ub-head">
   <div><span className="ub-overline">VÉRTICE · INTELIGÊNCIA INSTITUCIONAL</span><h3>UNICALDAS | Visão 360 de dados disponíveis</h3>
    <p>Informações reais já registradas na base da Vértice, com rastreabilidade de origem e cobertura. Não equivale a indicadores acadêmicos do GIZ nem a parecer oficial do MEC.</p>
   </div>
   <button type="button" className="ub-reload" onClick={()=>void load()} disabled={loading}>Atualizar consulta</button>
  </div>
  {error&&<div className="ub-warning" role="alert">{error}</div>}
  {loading?<p role="status">Consultando cursos, e-MEC, biblioteca, documentos e catálogo da UNICALDAS…</p>:data&&<>
   <div className="ub-source-line">
    <span className="ub-status">Base institucional consultada</span>
    <span>e-MEC: {data.snapshot?.body?.consulted_on??"Data indisponível"} · versão {data.snapshot?.revision??"—"} · {data.snapshot?.body?.coverage==="partial"?"cobertura parcial":"cobertura não comprovada"}</span>
    <span>{records.length.toLocaleString("pt-BR")} registros na consulta e-MEC</span>
   </div>
   {data.warnings.length>0&&<div className="ub-warning" role="status">{data.warnings.join(" ")}</div>}
   <div className="ub-kpis">
    {kpis.map((x,i)=><button key={i} type="button" className={"ub-kpi "+(view===x.id&&(x.id!=="emec"||kind===x.kind)?"ub-kpi-selected":"")} onClick={()=>open(x.id,x.kind??"all")} aria-pressed={view===x.id&&(x.id!=="emec"||kind===x.kind)}>
     <span className="ub-kpi-label">{x.label}</span><strong>{number(x.value)}</strong><small>{x.sub}</small><span className="ub-kpi-open">Explorar dados</span>
    </button>)}
   </div>
   <div className="ub-chart">
    <div className="ub-chart-heading"><div><strong>Composição da consulta e-MEC</strong><small>Quantidade de registros por categoria; não são conceitos ou notas.</small></div>
     <button type="button" onClick={()=>open("gaps")}>Conferir {gaps.length} lacunas</button>
    </div>
    <div className="ub-bars">
     {(["indicator","act","process","course","alert"] as const).map((key)=>{
      const n=counts[key]??0;
      return <button type="button" key={key} className="ub-bar-row" onClick={()=>open("emec",key)}>
       <span>{kindName[key]}</span><div className="ub-bar-track"><span style={{width:String(records.length?100*n/records.length:0)+"%"}}/></div><strong>{data.snapshot?n:"—"}</strong>
      </button>;
     })}
    </div>
   </div>
   <div className="ub-sections" role="navigation" aria-label="Fontes da UNICALDAS">
    {([["emec","e-MEC"],["courses","Cursos"],["library","Biblioteca"],["documents","Documentos"],["catalog","Catálogo GIZ"],["gaps","Pendências"],["academic","Dados acadêmicos"]] as [View,string][]).map(([id,label])=>
     <button type="button" key={id} className={view===id?"active":""} aria-pressed={view===id} onClick={()=>open(id)}>{label}</button>)}
   </div>
   {view==="academic"?<div className="ub-empty">
    <strong>Informações acadêmicas ainda não importadas do GIZ</strong>
    <p>Matrículas por semestre, evasão, retenção, reprovações por nota/falta e desempenho docente aguardam a restauração isolada e conciliação do backup UNI_GIZ. Não exibimos zeros nem estimativas artificiais.</p>
    <p>O catálogo com {number(data.catalog?.length??null)} nomes de tabelas está disponível, mas não contém registros de alunos.</p>
   </div>:<>
    <div className="ub-filter">
     <div><strong>{view==="emec"?"Registros regulatórios":view==="courses"?"Cadastro de cursos":view==="library"?"Itens da biblioteca":view==="documents"?"Documentos recebidos":view==="catalog"?"Estrutura do sistema GIZ":"Lacunas de cobertura"}</strong>
     <small>{filtered.length.toLocaleString("pt-BR")} resultados · clique nos cartões, barras ou abas para explorar</small></div>
     <label>Pesquisar nesta seção<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(35);}} placeholder="Nome, código, assunto ou situação"/></label>
    </div>
    {view==="emec"&&<div className="ub-types">
     <button type="button" aria-pressed={kind==="all"} onClick={()=>{setKind("all");setLimit(35)}}>Todos ({records.length})</button>
     {Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,n])=><button type="button" key={k} aria-pressed={kind===k} onClick={()=>{setKind(k);setLimit(35)}}>{kindName[k]??k} ({n})</button>)}
    </div>}
    {view==="documents"&&<p className="ub-note">Há {data.documents?.length??0} registros documentais, correspondentes a {uniqueDocs} nome(s) de arquivo distinto(s). Registros duplicados não são documentos adicionais.</p>}
    {view==="library"&&<p className="ub-note">Biblioteca cadastrada: a presença de um item não comprova que ele atende a um indicador do INEP. Entradas-modelo devem passar por curadoria.</p>}
    {view==="catalog"&&<p className="ub-note">Inventário estrutural somente: {data.catalog?.filter(x=>x.confirmation_state==="confirmado_restauracao").length??0} tabelas confirmadas por restauração. Não há contagens de alunos importadas.</p>}
    <div className="ub-list">
     {filtered.slice(0,limit).map((item,i)=>{
      if(typeof item==="string")return <article className="ub-item" key={i}><span className="ub-item-tag">Ponto de conferência</span><p>{item}</p></article>;
      if(view==="emec"){const r=item as RegulatoryRecord;return <details key={r.kind+":"+r.key+":"+i} className="ub-item">
       <summary><span className="ub-item-tag">{kindName[r.kind]??r.kind}</span><strong>{r.title}</strong><small>{r.key}</small></summary>
       <dl>{Object.entries(r.data??{}).map(([key,value])=><div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd>{readable(value)}</dd></div>)}</dl>
      </details>;}
      if(view==="courses"){const r=item as Course;return <article className="ub-item" key={r.id}><span className="ub-item-tag">{r.degree??"Categoria não informada"}</span><strong>{r.name}</strong><p>Código {r.code??"não informado"} · {r.modality??"Modalidade não informada"} · {r.status??"Situação não informada"}</p><button type="button" className="ub-inline" onClick={()=>{open("emec");setSearch(r.name)}}>Consultar menções no e-MEC</button></article>;}
      if(view==="library"){const r=item as Library;return <article className="ub-item" key={r.id}><span className="ub-item-tag">{r.is_placeholder?"Modelo a conferir":"Item cadastrado"}</span><strong>{r.title??r.file_name??"Sem título"}</strong><p>{[r.code,r.dimension,r.indicator].filter(Boolean).join(" · ")||"Sem classificação complementar"}</p></article>;}
      if(view==="documents"){const r=item as Document;return <article className="ub-item" key={r.id}><span className="ub-item-tag">{r.status}</span><strong>{r.file_name}</strong><p>{r.document_category??"Categoria não informada"}</p></article>;}
      const r=item as Catalog;return <article className="ub-item" key={r.table_name}><span className="ub-item-tag">Prioridade {r.prioridade_sugerida??"—"} · {r.confirmation_state}</span><strong>{r.table_name}</strong><p>{r.area_sugerida??"Área não classificada"}</p></article>;
     })}
     {filtered.length===0&&<p className="ub-empty">Nenhum registro corresponde ao filtro; isso não significa ausência de dados em outras fontes.</p>}
    </div>
    {filtered.length>limit&&<button type="button" className="ub-more" onClick={()=>setLimit(x=>x+50)}>Mostrar mais {Math.min(50,filtered.length-limit)} resultados</button>}
   </>}
   <footer className="ub-foot">
    Fonte: Supabase Vértice, com acesso condicionado ao perfil institucional. Dados e-MEC são uma consulta histórica parcial, não sincronização oficial em tempo real. O catálogo GIZ é somente estrutural; avaliações, matrículas e taxas não são inferidas.
   </footer>
  </>}
 </section>;
}
