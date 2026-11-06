import {useCallback,useEffect,useState,type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import "./source-upload.css";
import SourceCuration from "./SourceCuration";
import ApprovedSourcesBI from "./ApprovedSourcesBI";

type UploadRow={drive_url?:string|null;id:string;source_kind:string;source_name:string;source_url:string|null;reference_period:string|null;extracted_on:string|null;original_name:string;bytes:number;storage_path:string;upload_status:string;review_status:string;created_at:string;description:string|null};
const SOURCES:ReadonlyArray<readonly [string,string,string]>=[
 ["eorbit","e-ORBIT","Sistema acadêmico e-ORBIT"],
 ["emec","e-MEC","Cadastro e-MEC"],
 ["censo","Censo da Educação Superior","Censo da Educação Superior — INEP"],
 ["enade","ENADE / INEP","Indicadores ENADE — INEP"],
 ["secretaria","Secretaria / sistema acadêmico","Secretaria acadêmica"],
 ["site_institucional","Site institucional","Site oficial da instituição"],
 ["outro","Outro site ou sistema",""]
];
const MIME:Record<string,string>={
 pdf:"application/pdf",csv:"text/csv",json:"application/json",txt:"text/plain",
 xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 html:"text/html",htm:"text/html",xml:"application/xml"
};
const limit=25*1024*1024;
type SourceLink={id:string;source_name:string;drive_url:string;source_kind:string;reference_period:string|null;created_at:string};
function allowedDrive(value:string){
 try{const u=new URL(value);const h=u.hostname.toLowerCase();
 return u.protocol==="https:"&&!u.username&&!u.password&&(!u.port||u.port==="443")&&
  (["drive.google.com","docs.google.com","onedrive.live.com","1drv.ms"].includes(h)||
   h.endsWith(".sharepoint.com"))&&value.length<=1800;
 }catch{return false;}
}
export default function SourceUpload({institutionId,institutionName}:{institutionId:string;institutionName:string}){
 const [rows,setRows]=useState<UploadRow[]>([]);
 const [source,setSource]=useState("eorbit");
 const [sourceName,setSourceName]=useState("Sistema acadêmico e-ORBIT");
 const [url,setUrl]=useState("");
 const [period,setPeriod]=useState("");
 const [date,setDate]=useState("");
 const [description,setDescription]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [driveUrl,setDriveUrl]=useState("");
 const [linkRows,setLinkRows]=useState<SourceLink[]>([]);

 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  const {data,error}=await supabase.from("vertice_source_uploads").select("*").eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(100);
  if(error)throw error;setRows((data??[]) as UploadRow[]);
  const links=await supabase.from("vertice_source_links").select("*").eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(100);
  if(links.error)throw links.error;setLinkRows((links.data??[]) as SourceLink[]);
 },[institutionId]);
 useEffect(()=>{let active=true;setLoading(true);
  void load().catch(()=>{if(active)setError("Não foi possível consultar os envios. Confirme sua permissão.");}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[load]);
 function selectSource(k:string){
  setSource(k);setSourceName(SOURCES.find(row=>row[0]===k)?.[2]??"");
 }
 async function upload(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  if(!file&&!driveUrl.trim()){setError("Escolha um arquivo ou informe um link do Drive.");return;}
  if(driveUrl.trim()&&!allowedDrive(driveUrl.trim())){setError("Aceitamos links HTTPS de Google Drive ou OneDrive/SharePoint. Revise o endereço.");return;}
  if(!file){
   setBusy(true);setError("");setNotice("");
   try{
    const {error:linkError}=await supabase.from("vertice_source_links").insert({
      institution_id:institutionId,source_kind:source,source_name:sourceName.trim(),
      drive_url:driveUrl.trim(),reference_period:period.trim()||null,
      extracted_on:date||null,description:description.trim()||null
    });
    if(linkError)throw linkError;
    await load();setDriveUrl("");
    setNotice("Referência do Drive registrada para esta IES. O portal ainda não baixou nem leu o conteúdo do link; é preciso conceder acesso e realizar a importação.");
   }catch(e){setError((e as {message?:string})?.message??"Falha ao registrar a referência.");}
   finally{setBusy(false);}
   return;
  }
  setError("");setNotice("");
  const ext=file.name.split(".").pop()?.toLowerCase()??"";
  const mime=MIME[ext];
  if(!mime||file.size<=0||file.size>limit){setError("Selecione PDF, CSV, XLSX, JSON, TXT, HTML ou XML de até 25 MB.");return;}
  const name=file.name.split(/[\\/]/).pop()?.replace(/[\x00-\x1f]/g,"").trim();
  if(!name||name.length>250){setError("Nome de arquivo inválido.");return;}
  if(sourceName.trim().length<2){setError("Informe o nome da fonte de dados.");return;}
  if(url.trim()&&!/^https?:\/\//i.test(url.trim())){setError("A URL da fonte deve começar por https:// ou http://.");return;}
  const id=crypto.randomUUID();
  const path=institutionId+"/"+id+"/"+name;
  setBusy(true);
  try{
    const {error:insertError}=await supabase.from("vertice_source_uploads").insert({
      id,institution_id:institutionId,source_kind:source,source_name:sourceName.trim(),
      source_url:url.trim()||null,reference_period:period.trim()||null,
      extracted_on:date||null,original_name:name,mime_type:mime,bytes:file.size,
      storage_path:path,description:description.trim()||null,
      drive_url:driveUrl.trim()||null
    });
    if(insertError)throw insertError;
    const {error:storageError}=await supabase.storage.from("vertice-fontes-ies").upload(path,file,{contentType:mime,upsert:false});
    if(storageError){
      await supabase.from("vertice_source_uploads").update({upload_status:"falhou"}).eq("id",id);
      throw storageError;
    }
    const {data:confirmed,error:stateError}=await supabase.from("vertice_source_uploads").update({upload_status:"recebido"}).eq("id",id).select("id").single();
    if(stateError||!confirmed)throw stateError??new Error("Recebimento ainda não confirmado no banco");
    setNotice("Arquivo recebido na área de preparação da "+institutionName+". Aguardando conferência: nenhum dado foi enviado ao BI.");
    setFile(null);setDriveUrl("");const input=document.getElementById("vx-source-file") as HTMLInputElement|null;if(input)input.value="";
    await load();
  }catch(err){setError((err as {message?:string})?.message??"Falha ao enviar o arquivo.");void load().catch(()=>{});}
  finally{setBusy(false);}
 }
 async function download(row:UploadRow){
  setError("");try{
   const {data,error}=await supabase.storage.from("vertice-fontes-ies").download(row.storage_path);
   if(error||!data)throw error??new Error("Arquivo indisponível");
   const url=URL.createObjectURL(data),link=document.createElement("a");
   link.href=url;link.download=row.original_name;link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError((e as {message?:string})?.message??"Não foi possível baixar a fonte.");}
 }
 return <section className="vx-source-import" aria-label="Central de upload de dados externos">
  <header><span>VÉRTICE · FONTES E EXTRAÇÕES</span><h3>Central de importação — {institutionName}</h3>
   <p>Envie arquivos extraídos de sites e sistemas. Cada arquivo recebe origem, período, usuário e trilha de recebimento exclusivos desta IES.</p>
  </header>
  <div className="vx-source-warning"><strong>Etapa 2 · Receber arquivos e links.</strong>
   Os arquivos ficam armazenados em bucket privado. A importação para matrículas, BI ou indicadores só poderá ocorrer após mapeamento, conferência de dados e aprovação específica.</div>
  <form onSubmit={upload} className="vx-source-form">
   <label>Site ou sistema de origem
    <select value={source} onChange={e=>selectSource(e.target.value)}>{SOURCES.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
   </label>
   <label>Nome da fonte
    <input value={sourceName} maxLength={180} required minLength={2} onChange={e=>setSourceName(e.target.value)} placeholder="Nome do sistema ou site"/>
   </label>
   <label>Endereço da página de origem (opcional)
    <input type="url" value={url} maxLength={1000} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/>
   </label>
   <label>Competência / semestre (opcional)
    <input value={period} maxLength={35} onChange={e=>setPeriod(e.target.value)} placeholder="Ex.: 2026/02"/>
   </label>
   <label>Data efetiva da extração (opcional)
    <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
   </label>
   <label className="vx-source-wide">Arquivo da extração (opcional quando houver link)
    <input id="vx-source-file" type="file" accept=".pdf,.csv,.xlsx,.json,.txt,.html,.htm,.xml" onChange={e=>setFile(e.target.files?.[0]??null)}/>
    <small>PDF, CSV, XLSX, JSON, TXT, HTML ou XML — máximo 25 MB. Não envie credenciais, senhas nem dados pessoais desnecessários.</small>
   </label>
   <label className="vx-source-wide">Link de Google Drive ou OneDrive / SharePoint (opcional)
    <input type="url" maxLength={1800} value={driveUrl} onChange={e=>setDriveUrl(e.target.value)}
     placeholder="https://drive.google.com/... ou https://...sharepoint.com/..."/>
    <small>Você pode registrar somente o link ou anexar arquivo e link juntos. Não há leitura automática de pastas privadas. Autorize o acesso separadamente.</small>
   </label>
   <label className="vx-source-wide">Observações de origem (opcional)
    <textarea rows={2} value={description} maxLength={1500} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: Relatório 2 completo do sistema, todas as grades do semestre; conferir total de matrículas."/>
   </label>
   <button type="submit" disabled={busy||(!file&&!driveUrl.trim())}>{busy?"Registrando…":file?"Enviar arquivo para conferência":"Registrar referência do Drive"}</button>
  </form>
  {error&&<p role="alert" className="vx-source-error">{error}</p>}
  {notice&&<p role="status" className="vx-source-success">{notice}</p>}
  <div className="vx-source-list"><h4>Histórico de arquivos recebidos</h4>
   {loading?<p>Carregando histórico…</p>:rows.length===0?<p>Ainda não existem arquivos recebidos por esta área para a instituição.</p>:
   <div className="vx-source-scroll"><table><thead><tr><th>Arquivo</th><th>Fonte</th><th>Competência</th><th>Recebimento</th><th>Situação</th><th>Ação</th></tr></thead><tbody>
   {rows.map(row=><tr key={row.id}>
     <td><strong>{row.original_name}</strong><small>{(row.bytes/1024/1024).toLocaleString("pt-BR",{maximumFractionDigits:2})} MB</small></td>
     <td>{row.source_name}{row.source_url&&<small>URL registrada</small>}{row.drive_url&&<small><a href={row.drive_url} target="_blank" rel="noopener noreferrer">Referência no Drive ↗</a></small>}</td>
     <td>{row.reference_period||"A classificar"}</td>
     <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
     <td><span className={row.upload_status==="recebido"?"ok":"pending"}>{row.upload_status==="recebido"?"Recebido · aguarda curadoria":row.upload_status==="falhou"?"Falha no envio":"Recebimento incompleto"}</span></td>
     <td>{row.upload_status==="recebido"&&<button type="button" onClick={()=>void download(row)}>Baixar</button>}</td>
   </tr>)}</tbody></table></div>}
   <small>Consulta limitada aos últimos 100 registros. Nenhum arquivo é aplicado automaticamente aos indicadores.</small>
  </div>
  {linkRows.length>0&&<div className="vx-source-list">
   <h4>Referências do Drive pendentes de acesso e importação</h4>
   {linkRows.map(link=><p key={link.id}>
     <strong>{link.source_name}</strong> · {link.reference_period||"Sem competência"} ·
     <a target="_blank" rel="noopener noreferrer" href={link.drive_url}>Abrir referência no Drive ↗</a>
     <small> Link registrado — não representa arquivo recebido ou validado.</small>
    </p>)}
  </div>}
  <SourceCuration institutionId={institutionId} files={rows}/>
  <ApprovedSourcesBI institutionId={institutionId}/>
 </section>;
}
