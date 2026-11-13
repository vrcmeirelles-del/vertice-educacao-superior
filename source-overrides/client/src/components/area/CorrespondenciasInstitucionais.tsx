import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { can, type Role } from "@/lib/area";
import { OBJETOS_INSTITUCIONAL } from "@/lib/novo-instrumento";

type LinkRow = { id: string; source_file_id: string; target_object_code: string; suggestion_status: "sugerido" | "confirmado" | "descartado"; confidence: number; method: string; rationale: string; created_at: string };
type FileRow = { id: string; file_name: string; storage_path: string; request_id: string; status: string };
type RequestRow = { id: string; title: string; course_id: string | null; repository_section:string|null };
const titleByCode = new Map(OBJETOS_INSTITUCIONAL.map(o => [o.code, o.title]));

export type DocumentoVinculado = { object_code: string; file_name: string; source_file_id: string };
export default function CorrespondenciasInstitucionais({ institutionId, role, onLinksUpdated }: { institutionId: string; role: Role | null; onLinksUpdated?: (items: DocumentoVinculado[]) => void }) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showDiscarded, setShowDiscarded] = useState(false);
  const edit = can.record(role);

  const reload = useCallback(async () => {
    const [a,b,c] = await Promise.all([
      supabase.from("vertice_instrumento_correspondencias").select("id,source_file_id,target_object_code,suggestion_status,confidence,method,rationale,created_at").eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(300),
      supabase.from("vertice_repository_files").select("id,file_name,storage_path,request_id,status").eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(600),
      supabase.from("vertice_repository_requests").select("id,title,course_id,repository_section").eq("institution_id",institutionId).is("course_id",null)
    ]);
    if(a.error || b.error || c.error) throw new Error("Não foi possível carregar os vínculos institucionais.");
    setLinks((a.data??[]) as LinkRow[]);
    setFiles((b.data??[]) as FileRow[]);
    setRequests((c.data??[]) as RequestRow[]);
  },[institutionId]);

  useEffect(()=>{let active=true;reload().catch(e=>{if(active)setError(String(e.message??e));});return()=>{active=false;};},[reload]);

  async function sync() {
    if (!edit || busy) return;
    setBusy(true);setError("");setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("vertice-instrumento-sync",{body:{institution_id:institutionId}});
      if(error) throw error;
      if(data?.error) throw new Error(String(data.error));
      await reload();
      const n=Number(data?.created??0);
      setMessage(n>0 ? `${n} correspondência(s) sugerida(s). Revise os vínculos antes de confirmar.` : "Conferência concluída: nenhuma sugestão nova no lote analisado.");
    } catch(e) {setError("Não foi possível analisar as evidências: "+String(e instanceof Error?e.message:e));}
    finally {setBusy(false);}
  }

  async function decide(row: LinkRow, status:"confirmado"|"descartado") {
    if (!edit || updating) return;
    setUpdating(row.id);setError("");setMessage("");
    try {
      const {error}=await supabase.from("vertice_instrumento_correspondencias").update({suggestion_status:status}).eq("id",row.id).eq("suggestion_status","sugerido");
      if(error)throw error;
      await reload();
      setMessage(status==="confirmado"?"Vínculo confirmado. O arquivo original foi preservado.":"Sugestão descartada e registrada.");
    }catch(e){setError("Falha ao registrar decisão: "+String(e instanceof Error?e.message:e));}
    finally{setUpdating("");}
  }

  async function download(file:FileRow) {
    setError("");
    try {
      const sourceRequest=requests.find(r=>r.id===file.request_id);
      const bucket=sourceRequest?.repository_section==="recredenciamento_2017"?"vertice-recredenciamento-2017":"vertice-repositorios";
      const {data,error}=await supabase.storage.from(bucket).download(file.storage_path);
      if(error || !data)throw error??new Error("Arquivo indisponível");
      const url=URL.createObjectURL(data);
      const a=document.createElement("a");a.href=url;a.download=file.file_name;a.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(e){setError("Arquivo não acessível com o perfil atual: "+String(e instanceof Error?e.message:e));}
  }

  const fileById=useMemo(()=>new Map(files.map(f=>[f.id,f])),[files]);
  const reqById=useMemo(()=>new Map(requests.filter(r=>!String(r.repository_section??"").startsWith("novo_instrumento_2026")).map(r=>[r.id,r])),[requests]);
  const institutionFileIds=useMemo(()=>new Set(files.filter(f=>reqById.has(f.request_id)).map(f=>f.id)),[files,reqById]);
  const visible=links.filter(x=>institutionFileIds.has(x.source_file_id)&&(showDiscarded||x.suggestion_status!=="descartado"));
  const suggested=visible.filter(x=>x.suggestion_status==="sugerido").length;
  const confirmed=visible.filter(x=>x.suggestion_status==="confirmado").length;
  const confirmedDocuments = useMemo(() => links.filter(x=>x.suggestion_status==="confirmado" && institutionFileIds.has(x.source_file_id)).map(x=>({object_code:x.target_object_code,source_file_id:x.source_file_id,file_name:fileById.get(x.source_file_id)?.file_name??"Arquivo não localizado"})), [links,institutionFileIds,fileById]);
  useEffect(() => { onLinksUpdated?.(confirmedDocuments); }, [confirmedDocuments,onLinksUpdated]);

  return <section className="area-panel ni-crosswalk" aria-label="Inteligência de correspondência documental">
    <div className="area-panel-head">
      <div>
        <h3>Correspondência documental · Instrumento vigente → proposta 2026</h3>
        <p className="area-muted small">A IA sugere o reaproveitamento com base no título e na descrição cadastrados. Não examina automaticamente o conteúdo integral de PDF ou Word. Os arquivos continuam no repositório privado da instituição.</p>
      </div>
      {edit && <button type="button" className="corp-button small" disabled={busy} onClick={sync}>{busy?"Analisando documentos…":"Analisar e atualizar correspondências"}</button>}
    </div>
    <div className="area-stat-grid">
      <article><small>Correspondências a revisar</small><b>{suggested}</b></article>
      <article><small>Vínculos confirmados</small><b>{confirmed}</b></article>
      <article><small>Arquivos institucionais no recorte</small><b>{institutionFileIds.size}</b></article>
    </div>
    <p className="area-muted small">Nenhuma indicação de correspondência equivale à validação da evidência ou à atribuição de conceito no novo instrumento. A confirmação apenas registra um vínculo entre os instrumentos.</p>
    {error&&<p className="area-error" role="alert">{error}</p>}
    {message&&<p className="area-note" role="status">{message}</p>}
    <HelpLabel className="ni-crosswalk-toggle"><input type="checkbox" checked={showDiscarded} onChange={e=>setShowDiscarded(e.target.checked)}/> Mostrar vínculos descartados</HelpLabel>
    {!visible.length?<p className="area-muted">Nenhuma correspondência registrada. Use “Analisar e atualizar correspondências” para verificar os documentos institucionais já cadastrados.</p>:<div className="table-scroll"><table className="area-table ni-crosswalk-table">
      <thead><tr><th>Documento de origem</th><th>Objeto da proposta 2026</th><th>Análise e rastreabilidade</th><th>Situação</th><th>Ação<ContextHelp title="Ação" /></th></tr></thead>
      <tbody>{visible.map(link=>{
        const f=fileById.get(link.source_file_id);
        const req=f?reqById.get(f.request_id):null;
        return <tr key={link.id}>
          <td><strong>{f?.file_name??"Arquivo não localizado"}</strong><small className="area-block">{req?.title??"Exigência institucional"}</small>{f&&<button type="button" className="corp-login-text-button" onClick={()=>void download(f)}>Consultar arquivo original</button>}</td>
          <td><strong>{link.target_object_code}</strong><small className="area-block">{titleByCode.get(link.target_object_code)??"Objeto a conferir"}</small></td>
          <td><small>{link.rationale}</small><small className="area-block">Método: {link.method==="ai_metadata"?"IA · metadados":link.method==="heuristic_metadata"?"Correspondência textual":"Manual"} · Confiança informativa {Math.round(Number(link.confidence)*100)}%</small></td>
          <td><span className={link.suggestion_status==="confirmado"?"badge green":link.suggestion_status==="descartado"?"badge gray":"badge amber"}>{link.suggestion_status==="sugerido"?"A revisar":link.suggestion_status==="confirmado"?"Vínculo confirmado":"Descartado"}</span></td>
          <td>{link.suggestion_status==="sugerido"&&edit?<div className="ni-crosswalk-actions"><button type="button" disabled={!!updating} onClick={()=>void decide(link,"confirmado")}>Confirmar vínculo</button><button type="button" disabled={!!updating} onClick={()=>void decide(link,"descartado")}>Descartar</button></div>:<small>Registro preservado</small>}</td>
        </tr>;
      })}</tbody>
    </table></div>}
  </section>;
}
