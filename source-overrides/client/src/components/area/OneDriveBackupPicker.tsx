import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
import {useState} from "react";
import {supabase} from "@/lib/supabase";
type DriveBackup={id:string;name:string;size:number;modified:string};
const eligible=new Set(["1f5fd5b4-93c6-4626-834d-136884915587","4224e2fc-6a96-4761-820f-6f8e809ca1c1"]);
export default function OneDriveBackupPicker({institutionId,onImported}:{institutionId:string;onImported:()=>Promise<void>}){
 const [files,setFiles]=useState<DriveBackup[]>([]);
 const [stage,setStage]=useState("Consulta não iniciada");
 const [busy,setBusy]=useState(false);
 const [copying,setCopying]=useState<string|null>(null);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [referencePeriod,setReferencePeriod]=useState("");
 async function invoke(action:"backup-list"|"backup-import",other:Record<string,unknown>={}){
  const {data,error}=await supabase.functions.invoke("vertice-source-onedrive",{
   body:{action,institution_id:institutionId,...other}
  });
  if(error){let code="";try{code=(await error.context?.json())?.error??"";}catch{}
   throw new Error(code||"A operação no OneDrive não pôde ser confirmada. Verifique a autorização do aplicativo e a pasta da IES.");
  }
  if(data?.error)throw new Error(String(data.error));
  return data;
 }
 async function list(){
  setBusy(true);setError("");setMessage("");setStage("Autenticando e consultando a pasta de Migração da instituição…");
  try{
   const result=await invoke("backup-list");
   setFiles(result.files??[]);
   setStage("Consulta concluída · "+(result.files?.length??0)+" backup(s) compatível(is)");
   setMessage(result.notice??"Selecione um backup para copiar ao cofre privado.");
  }catch(e){setStage("Consulta indisponível");setFiles([]);setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function copy(file:DriveBackup){
  setCopying(file.id);setStage("Copiando "+file.name+" para o cofre privado — sem restauração…");
  setError("");setMessage("");
  try{
   const result=await invoke("backup-import",{item_id:file.id,source_kind:"outro",reference_period:referencePeriod});
   if(!result.imported&&!result.already_received)throw new Error("A cópia não foi confirmada.");
   await onImported();
   setStage(result.already_received?"Arquivo já estava recebido":"Cópia recebida · aguardando restauração técnica");
   setMessage(result.notice??"Arquivo registrado no cofre da IES.");
  }catch(e){setStage("Falha na cópia");setError((e as Error).message);}
  finally{setCopying(null);}
 }
 if(!eligible.has(institutionId))return <section className="vx-backup-alert">
  A integração Microsoft desta instituição ainda não tem uma pasta de Migração autorizada. Utilize o envio manual até que a pasta seja vinculada.
 </section>;
 return <section className="vx-backup-onedrive" aria-label="Importação de backup do OneDrive">
  <div><strong>Importar backup diretamente do OneDrive</strong>
   <p>Lista somente RAR, ZIP e BAK da pasta Migração autorizada. Na UNICALDAS, inclui o BAK do volume part001. Não pesquisa outras instituições.</p></div>
  <button type="button" disabled={busy||!!copying} onClick={()=>void list()}>
   {busy?"Consultando…":"Consultar backups no OneDrive"}
  </button>
  <p role="status" className="vx-backup-stage"><strong>Andamento:</strong> {stage}</p>
  {files.length>0&&<>
   <HelpLabel>Competência ou referência (opcional)
    <input maxLength={35} value={referencePeriod} onChange={e=>setReferencePeriod(e.target.value)} placeholder="Ex.: 2026/02"/>
   </HelpLabel>
   <div className="vx-backup-scroll"><table><thead><tr><th>Arquivo no OneDrive</th><th>Tamanho</th><th>Ação<ContextHelp title="Ação" /></th></tr></thead>
    <tbody>{files.map(file=><tr key={file.id}>
     <td>{file.name}</td><td>{(file.size/1024/1024).toLocaleString("pt-BR",{maximumFractionDigits:2})} MiB</td>
     <td><button type="button" disabled={!!copying} onClick={()=>void copy(file)}>
      {copying===file.id?"Importando…":"Copiar ao cofre"}</button></td></tr>)}</tbody>
   </table></div>
  </>}
  {error&&<p role="alert" className="vx-backup-error">{error}</p>}
  {message&&<p role="status" className="vx-backup-success">{message}</p>}
  <small>A cópia depende de acesso efetivo do aplicativo Microsoft. Nenhum backup é descompactado ou restaurado automaticamente.</small>
 </section>;
}
