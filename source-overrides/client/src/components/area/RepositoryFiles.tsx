import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { type Row, explain } from "@/lib/area";
import { REPOSITORY_CATEGORIES, REPOSITORY_DIMENSIONS, instrumentIndicators } from "@/lib/repository";
const fileIndicators = (f: Row): string[] => Array.isArray(f.instrument_indicators) ? f.instrument_indicators.map(String) : [];
export default function RepositoryFiles({ files, requests, other=false, manager, download, reload, review }: {
 files: Row[]; requests: Row[]; other?: boolean; manager: boolean;
 download:(f:Row)=>Promise<void>; reload:()=>Promise<void>; review:(f:Row)=>void;
}) {
 const [query,setQuery]=useState(""),[dimension,setDimension]=useState(""),[category,setCategory]=useState(""),[page,setPage]=useState(0);
 const [editing,setEditing]=useState<Row|null>(null),[selection,setSelection]=useState("nao_classificado"),[indicators,setIndicators]=useState(""),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>setPage(0),[query,dimension,category,other,files.length]);
 const rows=files.filter(f=> {
  const cat=String(f.document_category??"nao_classificado"),codes=Array.isArray(f.instrument_indicators)? f.instrument_indicators:[];
  return (other?cat!=="instrumento":cat==="instrumento") && (!category||cat===category) && (!dimension||codes.some(c=>String(c).startsWith(dimension+"."))) && `${f.file_name} ${codes.join(" ")} ${requests.find(r=>r.id===f.request_id)?.title??""}`.toLowerCase().includes(query.toLowerCase());
 });
 const pages=Math.max(1,Math.ceil(rows.length/20)),current=Math.min(page,pages-1);
 async function save(){
  if(!editing)return;setBusy(true);setError("");
  try {
   const codes=instrumentIndicators(indicators);
   if(selection==="instrumento"&&!codes.length)throw new Error("Informe um indicador válido (ex.: 1.5, 2.1 ou 3.15).");
   const {error}=await supabase.from("vertice_repository_files").update({document_category:selection,instrument_indicators:selection==="instrumento"?codes:[],classification_note:note.trim()||null}).eq("id",editing.id);
   if(error)throw error;await reload();setEditing(null);
  }catch(e){setError(explain(e));}finally{setBusy(false);}
 }
 return <section className="er-card">
  <header className="er-card-head"><h3>{other?"Outros documentos":"Evidências do instrumento"}</h3><span>{rows.length} arquivos</span></header>
  <div className="er-toolbar">
   <label>Buscar arquivo<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome ou indicador" /></label>
   {other?<label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Todas</option>{Object.entries(REPOSITORY_CATEGORIES).filter(([k])=>k!=="instrumento").map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>:<label>Dimensão<select value={dimension} onChange={e=>setDimension(e.target.value)}><option value="">Todas</option>{["1","2","3"].map(k=><option key={k} value={k}>{k} — {REPOSITORY_DIMENSIONS[k]}</option>)}</select></label>}
  </div>
  {error&&<p role="alert" className="er-alert error">{error}</p>}
  {editing&&<form className="er-classify" onSubmit={e=>{e.preventDefault();void save();}}>
   <strong>Classificar: {String(editing.file_name)}</strong>
   <label>Categoria<select value={selection} onChange={e=>setSelection(e.target.value)}>{Object.entries(REPOSITORY_CATEGORIES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   {selection==="instrumento"&&<label>Indicadores<input value={indicators} onChange={e=>setIndicators(e.target.value)} placeholder="1.5, 3.6" required /></label>}
   <label>Justificativa<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={4000}/></label>
   <div className="er-actions"><button className="er-btn er-primary" disabled={busy}>Salvar classificação</button><button className="er-btn" type="button" disabled={busy} onClick={()=>setEditing(null)}>Cancelar</button></div>
  </form>}
  {!rows.length?<p className="er-empty">Nenhum arquivo nesta seleção.</p>:<div className="er-table-scroll"><table className="er-table"><thead><tr><th>Documento</th><th>{other?"Categoria":"Indicadores"}</th><th/></tr></thead><tbody>{rows.slice(current*20,current*20+20).map(f=><tr key={f.id}>
   <td><strong>{String(f.file_name)}</strong><small>{(Number(f.size_bytes)/1024/1024).toFixed(2)} MB</small>
    <details className="er-file-details"><summary>Detalhes</summary><p>{String(f.classification_note??"Classificação pendente de conferência.")}</p>{Boolean(f.upload_note)&&<p>{String(f.upload_note)}</p>}<p>Situação: {String(f.status)} · Enviado por {String(f.uploaded_email??"Conta vinculada")}</p></details>
   </td><td>{other?REPOSITORY_CATEGORIES[String(f.document_category??"nao_classificado")]:String(fileIndicators(f).join(", "))}</td>
   <td><div className="er-actions"><button className="er-btn er-small" onClick={()=>void download(f)}>Baixar</button>{manager&&<><button className="er-btn er-small" onClick={()=>{setEditing(f);setSelection(String(f.document_category??"nao_classificado"));setIndicators(fileIndicators(f).join(", "));setNote(String(f.classification_note??""));}}>Classificar</button><button className="er-btn er-small" onClick={()=>review(f)}>Analisar</button></>}</div></td>
  </tr>)}</tbody></table></div>}
  {pages>1&&<div className="er-toolbar"><button className="er-btn" disabled={current===0} onClick={()=>setPage(current-1)}>Anterior</button><span>Página {current+1} de {pages}</span><button className="er-btn" disabled={current===pages-1} onClick={()=>setPage(current+1)}>Próxima</button></div>}
 </section>;
}
