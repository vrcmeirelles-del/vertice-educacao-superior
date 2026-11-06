import {useCallback,useEffect,useState,type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import OneDriveBackupPicker from "./OneDriveBackupPicker";
import "./academic-backups.css";

type Kind="rar"|"zip"|"bak";
type Signature="RAR4"|"RAR5"|"ZIP"|"BAK_NAO_VERIFICADO";
type BackupRecord={
 id:string;institution_id:string;source_system:string;backup_kind:Kind;
 signature_label:Signature;original_name:string;bytes:number;file_sha256:string;
 storage_path:string;source_url:string|null;reference_period:string|null;
 description:string|null;stage:string;created_at:string;received_at:string|null;
};
type RestoreRequest={id:string;backup_id:string;state:string;requested_at:string};
const bucket="vertice-backups-ies";
const MAX_SIZE=50*1024*1024;
const formatLabels:Record<Signature,string>={
 RAR4:"Arquivo RAR 4 — assinatura reconhecida",
 RAR5:"Arquivo RAR 5 — assinatura reconhecida",
 ZIP:"Arquivo ZIP — assinatura reconhecida",
 BAK_NAO_VERIFICADO:"Arquivo BAK — formato interno ainda não comprovado"
};
const mime:Record<Kind,string>={
 rar:"application/vnd.rar",zip:"application/zip",bak:"application/octet-stream"
};
const fmtSize=(v:number)=>(v/1024/1024).toLocaleString("pt-BR",{maximumFractionDigits:2})+" MiB";
function kindOf(file:File):Kind{
 const ext=file.name.split(".").pop()?.toLowerCase();
 if(ext!=="rar"&&ext!=="zip"&&ext!=="bak")throw new Error("Formato não permitido. Escolha um arquivo .rar, .zip ou .bak.");
 return ext;
}
async function detectSignature(file:File,kind:Kind):Promise<Signature>{
 const b=new Uint8Array(await file.slice(0,16).arrayBuffer());
 if(kind==="rar"){
   if(b.length>=7&&b[0]===0x52&&b[1]===0x61&&b[2]===0x72&&
      b[3]===0x21&&b[4]===0x1a&&b[5]===0x07){
     if(b[6]===0x00)return "RAR4";
     if(b[6]===0x01&&b.length>=8&&b[7]===0x00)return "RAR5";
   }
   throw new Error("O arquivo tem extensão RAR, mas a assinatura binária não é de RAR 4/5.");
 }
 if(kind==="zip"){
   if(b.length>=4&&b[0]===0x50&&b[1]===0x4b&&b[2]===0x03&&b[3]===0x04)return "ZIP";
   throw new Error("O arquivo tem extensão ZIP, mas não começa com cabeçalho ZIP válido.");
 }
 // SQL Server .bak is not certified by an extension or universal magic string.
 if(b.length<16)throw new Error("BAK pequeno demais para armazenamento como backup.");
 return "BAK_NAO_VERIFICADO";
}
async function fingerprint(file:Blob):Promise<string>{
 const bytes=await file.arrayBuffer();
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function safeName(name:string){
 const clean=name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f]/g,"").trim()??"";
 if(!clean||clean.length>250||clean==="."||clean==="..")throw new Error("Nome de arquivo inválido.");
 return clean;
}
function optionalSourceUrl(value:string){
 if(!value.trim())return null;
 const u=new URL(value.trim());
 const host=u.hostname.toLowerCase();
 if(u.protocol!=="https:"||u.username||u.password||u.port&&u.port!=="443"||
   !["drive.google.com","docs.google.com","onedrive.live.com","1drv.ms"].includes(host)&&
     !host.endsWith(".sharepoint.com"))throw new Error("Use um link HTTPS do Google Drive ou OneDrive/SharePoint.");
 return value.trim();
}

export default function AcademicBackups({institutionId,institutionName}:{institutionId:string;institutionName:string}){
 const [records,setRecords]=useState<BackupRecord[]>([]);
 const [requests,setRequests]=useState<RestoreRequest[]>([]);
 const [file,setFile]=useState<File|null>(null);
 const [sourceSystem,setSourceSystem]=useState(institutionName.toUpperCase().includes("CALDAS")?"UNI_GIZ":"Sistema acadêmico");
 const [sourceUrl,setSourceUrl]=useState("");
 const [referencePeriod,setReferencePeriod]=useState("");
 const [description,setDescription]=useState("");
 const [stage,setStage]=useState("Nenhum backup sendo enviado");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [confirmRestore,setConfirmRestore]=useState<string|null>(null);
 const [checking,setChecking]=useState<string|null>(null);
 const [verified,setVerified]=useState<Record<string,string>>({});

 const refresh=useCallback(async()=>{
  const [a,b]=await Promise.all([
    supabase.from("vertice_academic_backups").select("*").eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(100),
    supabase.from("vertice_backup_restore_requests").select("id,backup_id,state,requested_at").eq("institution_id",institutionId).order("requested_at",{ascending:false}).limit(100)
  ]);
  if(a.error)throw a.error;if(b.error)throw b.error;
  setRecords((a.data??[]) as BackupRecord[]);setRequests((b.data??[]) as RestoreRequest[]);
 },[institutionId]);
 useEffect(()=>{let active=true;setLoading(true);void refresh()
   .catch(()=>{if(active)setError("A área de backups está indisponível para esta conta ou instituição.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[refresh]);
 useEffect(()=>{setFile(null);setStage("Nenhum backup sendo enviado");setVerified({});},[institutionId]);

 async function upload(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!file||busy)return;
  setError("");setNotice("");
  let id:string|undefined;
  setBusy(true);
  try{
   if(file.size<16||file.size>MAX_SIZE)throw new Error("Arquivo acima de 50 MiB ou abaixo de 16 bytes. O backup BAK da UNICALDAS (45,6 MB) cabe neste limite.");
   const kind=kindOf(file),name=safeName(file.name);
   if(name.toLowerCase().slice(-kind.length-1)!=="."+kind)throw new Error("Extensão do backup inválida.");
   if(sourceSystem.trim().length<2)throw new Error("Informe o sistema de origem.");
   const link=optionalSourceUrl(sourceUrl);
   setStage("1/4 · Conferindo cabeçalho e formato");
   const signature=await detectSignature(file,kind);
   setStage("2/4 · Calculando impressão digital SHA-256 no seu dispositivo");
   const sha=await fingerprint(file);
   const {data:dupes,error:dupError}=await supabase.from("vertice_academic_backups")
     .select("id,original_name,stage").eq("institution_id",institutionId).eq("file_sha256",sha).limit(1);
   if(dupError)throw dupError;
   if(dupes?.some(x=>x.stage==="recebido"))throw new Error("Este backup já consta como recebido nesta instituição. Não é necessário enviar a mesma cópia duas vezes.");
   id=crypto.randomUUID();
   const path=institutionId+"/"+id+"/"+name;
   setStage("3/4 · Registrando origem e enviando ao cofre privado");
   const {error:registerError}=await supabase.from("vertice_academic_backups").insert({
    id,institution_id:institutionId,source_system:sourceSystem.trim(),
    backup_kind:kind,signature_label:signature,original_name:name,bytes:file.size,
    file_sha256:sha,storage_path:path,source_url:link,
    reference_period:referencePeriod.trim()||null,
    description:description.trim()||null
   });
   if(registerError)throw registerError;
   const {error:uploadError}=await supabase.storage.from(bucket).upload(path,file,{contentType:mime[kind],upsert:false});
   if(uploadError){
    await supabase.from("vertice_academic_backups").update({stage:"falhou"}).eq("id",id);
    throw uploadError;
   }
   setStage("4/4 · Conferindo que o arquivo chegou ao cofre");
   const {data:confirmed,error:confirmationError}=await supabase.from("vertice_academic_backups")
     .update({stage:"recebido"}).eq("id",id).eq("institution_id",institutionId).select("id").single();
   if(confirmationError||!confirmed)throw confirmationError??new Error("O objeto foi enviado, mas a confirmação do registro falhou.");
   setNotice("Backup recebido no cofre privado de "+institutionName+". Arquivo preservado sem descompactação ou restauração. Use 'Conferir cópia' para comparar o hash com o original.");
   setStage("Backup recebido · aguardando restauração técnica isolada");
   setFile(null);const input=document.getElementById("vx-academic-backup-file") as HTMLInputElement|null;if(input)input.value="";
   await refresh();
  }catch(err){
   setError((err as {message?:string}).message??"Falha ao enviar o backup.");
   setStage("Envio interrompido · consulte o erro acima");
   void refresh().catch(()=>{});
  }finally{setBusy(false);}
 }
 async function verify(row:BackupRecord){
  setError("");setChecking(row.id);setStage("Baixando a cópia e comparando sua impressão digital…");
  try{
   const {data,error}=await supabase.storage.from(bucket).download(row.storage_path);
   if(error||!data)throw error??new Error("Arquivo privado indisponível.");
   if(data.size!==row.bytes)throw new Error("O tamanho armazenado não corresponde ao arquivo recebido.");
   const hash=await fingerprint(data);
   if(hash!==row.file_sha256)throw new Error("Hash divergente: este backup requer investigação, sem tentativa de restauração.");
   setVerified(old=>({...old,[row.id]:"SHA-256 da cópia confere com o hash registrado no upload"}));
   setNotice("Cópia verificada por hash. Isso confirma a correspondência dos bytes, não que o BAK possa ser restaurado.");
   setStage("Conferência criptográfica concluída");
  }catch(e){setVerified(old=>({...old,[row.id]:"Falha na conferência"}));setError((e as Error).message);}
  finally{setChecking(null);}
 }
 async function requestRestoration(row:BackupRecord){
  if(confirmRestore!==row.id||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const {data,error}=await supabase.from("vertice_backup_restore_requests").insert({
    backup_id:row.id,institution_id:institutionId,
    request_note:"Verificar formato, integridade, chaves e viabilidade de restauração isolada. Não atualizar a produção."
   }).select("id").single();
   if(error||!data)throw error??new Error("Não houve confirmação de registro da solicitação.");
   setNotice("Solicitação registrada. Não existe restauração automática nesta versão: um operador técnico precisará preparar ambiente isolado e confirmar a origem.");
   setConfirmRestore(null);await refresh();
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function download(row:BackupRecord){
  setError("");setStage("Preparando download privado…");
  try{
   const {data,error}=await supabase.storage.from(bucket).download(row.storage_path);
   if(error||!data)throw error??new Error("Não foi possível baixar a cópia.");
   const url=URL.createObjectURL(data);
   const link=document.createElement("a");link.href=url;link.download=row.original_name;link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   setStage("Download solicitado ao navegador");
  }catch(e){setError((e as Error).message);}
 }
 return <section className="vx-backup" aria-label="Ambiente de backups acadêmicos">
  <header>
   <span>VÉRTICE · GESTÃO DE FONTES</span>
   <h3>Backups Acadêmicos — {institutionName}</h3>
   <p>Ambiente isolado para guardar originais RAR, ZIP e BAK. O envio não executa comandos SQL, não extrai dados pessoais e não altera matrículas ou o BI.</p>
  </header>
  <section className="vx-backup-spotlight" aria-label="Conferência rápida de backup">
    <div className="vx-backup-spotlight-heading">
      <div><span className="vx-backup-eyebrow">PRÓXIMA ETAPA · BACKUP RECEBIDO</span>
      <h4>Conferir a cópia armazenada</h4>
      <p>O arquivo já foi recebido. Verifique sua impressão digital antes de solicitar uma restauração técnica.</p></div>
      <button type="button" className="vx-backup-reload" disabled={busy||!!checking} onClick={()=>void refresh().catch(e=>setError((e as Error).message))}>Atualizar situação</button>
    </div>
    {loading?<p role="status">Consultando backups da instituição…</p>:
    records.filter(row=>row.stage==="recebido").length===0?
      <p>Não foi encontrado backup com recebimento confirmado para esta instituição. Confira a lista e as mensagens de erro abaixo.</p>:
    (()=>{const row=records.find(row=>row.stage==="recebido"&&row.backup_kind==="bak")??records.find(row=>row.stage==="recebido")!;
      const restore=requests.find(x=>x.backup_id===row.id);
      return <div className="vx-backup-highlight-card">
        <div className="vx-backup-highlight-filename"><strong>{row.original_name}</strong>
          <small>{fmtSize(row.bytes)} · Recebido em {row.received_at?new Date(row.received_at).toLocaleString("pt-BR"):"data não informada"}</small>
        </div>
        <div className="vx-backup-highlight-meta">
          <span>Estado: <strong>Recebido · não restaurado</strong></span>
          <span>Integridade: <strong>{verified[row.id]??"Conferência do arquivo armazenado pendente"}</strong></span>
        </div>
        <div className="vx-backup-highlight-actions">
          <button className="vx-backup-primary" type="button" disabled={busy||!!checking}
            onClick={()=>void verify(row)}>{checking===row.id?"Conferindo cópia…":"Conferir cópia agora"}</button>
          {restore?<span className="vx-backup-requested">Solicitação técnica registrada · atendimento pendente</span>:
          <button className="vx-backup-secondary" type="button" disabled={busy}
            onClick={()=>setConfirmRestore(row.id)}>Solicitar restauração</button>}
        </div>
      </div>})()}
  </section>
  {confirmRestore&&<div className="vx-backup-confirm" role="alertdialog" aria-label="Confirmar solicitação de restauração">
    <strong>Registrar solicitação de restauração técnica?</strong>
    <p>Isso não iniciará um serviço em segundo plano. Será apenas uma solicitação para confirmar o formato do backup e preparar uma restauração isolada, sem alterar o banco de produção.</p>
    <div><button type="button" disabled={busy} onClick={()=>setConfirmRestore(null)}>Cancelar</button>
      <button type="button" disabled={busy} onClick={()=>{const row=records.find(x=>x.id===confirmRestore);if(row)void requestRestoration(row)}}>Confirmar solicitação</button></div>
  </div>}
  <div className="vx-backup-alert">
   <strong>Regra de segurança:</strong> um backup recebido é apenas um arquivo preservado. A assinatura RAR/ZIP e o hash identificam o arquivo; a validade de um BAK SQL Server somente pode ser confirmada em um processo técnico de restauração isolada.
  </div>
  <form className="vx-backup-form" onSubmit={upload}>
   <label>Sistema acadêmico de origem
     <input required minLength={2} maxLength={120} value={sourceSystem} onChange={e=>setSourceSystem(e.target.value)} placeholder="Ex.: UNI_GIZ"/>
   </label>
   <label>Competência ou data de referência (opcional)
     <input maxLength={35} value={referencePeriod} onChange={e=>setReferencePeriod(e.target.value)} placeholder="Ex.: 2026/02 ou 21/07/2026"/>
   </label>
   <label className="wide">Arquivo original do backup
     <input id="vx-academic-backup-file" type="file" accept=".rar,.zip,.bak"
       onChange={e=>setFile(e.target.files?.[0]??null)} required/>
     <small>RAR, ZIP ou BAK, máximo 50 MiB. O BAK da UNICALDAS pode ser selecionado nesta área; não é necessário transformá-lo em CSV para armazenar.</small>
   </label>
   {file&&<p className="wide vx-backup-selected">
     <strong>Selecionado:</strong> {file.name} · {fmtSize(file.size)} · sem envio até clicar em Receber backup
   </p>}
   <label className="wide">Link do OneDrive / SharePoint ou Google Drive (referência opcional)
     <input type="url" maxLength={1800} value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://...sharepoint.com/..."/>
     <small>O link documenta a origem. Não concede acesso automático nem substitui o anexo do arquivo.</small>
   </label>
   <label className="wide">Observações para a restauração (opcional)
     <textarea rows={3} maxLength={1500} value={description} onChange={e=>setDescription(e.target.value)}
       placeholder="Ex.: Backup UNI_GIZ de 21/07/2026. Confirmar versão SQL Server, consistência e quais tabelas fazem parte do escopo."/>
   </label>
   <button type="submit" disabled={busy||!file}>{busy?"Registrando e enviando backup…":"Receber backup em ambiente isolado"}</button>
  </form>
  <p role="status" className="vx-backup-stage"><strong>Andamento:</strong> {stage}</p>
  {error&&<p role="alert" className="vx-backup-error">{error}</p>}
  {notice&&<p role="status" className="vx-backup-success">{notice}</p>}
  <OneDriveBackupPicker institutionId={institutionId} onImported={refresh}/>
  <div className="vx-backup-history">
   <h4>Backups da instituição</h4>
   {loading?<p>Consultando cofre privado…</p>:records.length===0?<p>Não existem backups registrados nesta área.</p>:
   <div className="vx-backup-scroll"><table><thead><tr><th>Backup</th><th>Origem</th><th>Integridade</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
    {records.map(row=>{
      const restore=requests.find(x=>x.backup_id===row.id);
      return <tr key={row.id}>
       <td><strong>{row.original_name}</strong><small>{fmtSize(row.bytes)} · {new Date(row.created_at).toLocaleString("pt-BR")}</small></td>
       <td>{row.source_system}<small>{row.reference_period??"Período não informado"}</small></td>
       <td>{formatLabels[row.signature_label]}<small>{verified[row.id]??"Hash informado pelo navegador no recebimento; cópia ainda não conferida"}</small></td>
       <td>{row.stage==="recebido"?"Recebido · não restaurado":row.stage==="falhou"?"Falha no envio":"Registro pendente"}
        {restore&&<small>Solicitação de restauração registrada — atendimento técnico pendente</small>}</td>
       <td><div className="vx-backup-actions">
         {row.stage==="recebido"&&<button type="button" disabled={busy||!!checking}
           onClick={()=>void verify(row)}>{checking===row.id?"Conferindo…":"Conferir cópia"}</button>}
         {row.stage==="recebido"&&<button type="button" onClick={()=>void download(row)}>Baixar</button>}
         {row.stage==="recebido"&&!restore&&<button type="button" disabled={busy}
           onClick={()=>setConfirmRestore(row.id)}>Solicitar restauração</button>}
       </div></td>
      </tr>;
    })}</tbody></table></div>}
   <small>Mostrando até 100 registros. Originais são imutáveis nesta área; exclusão e restauração exigem processo administrativo e técnico específico.</small>
  </div>
 </section>;
}
