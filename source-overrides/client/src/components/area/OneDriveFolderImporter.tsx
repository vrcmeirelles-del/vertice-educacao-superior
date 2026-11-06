import {useState} from "react";
import {supabase} from "@/lib/supabase";
import "./source-curation.css";
type Item={id:string;name:string;size:number;modified:string};
type Props={institutionId:string;onImported:()=>Promise<void>};
const INSTS=new Set(["1f5fd5b4-93c6-4626-834d-136884915587","4224e2fc-6a96-4761-820f-6f8e809ca1c1"]);
export default function OneDriveFolderImporter({institutionId,onImported}:Props){
 const [files,setFiles]=useState<Item[]>([]);
 const [folder,setFolder]=useState("");
 const [loading,setLoading]=useState(false);
 const [importing,setImporting]=useState("");
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [period,setPeriod]=useState("");
 const [kind,setKind]=useState("eorbit");
 async function invoke(body:Record<string,unknown>){
  const {data,error}=await supabase.functions.invoke("vertice-source-onedrive",{body});
  if(error){let detail="";try{detail=(await error.context?.json())?.error??"";}catch{}
   throw new Error(detail||"Não foi possível acessar a pasta Microsoft. Confira a autorização do aplicativo e o caminho da pasta.");}
  if(data?.error)throw new Error(data.error);
  return data;
 }
 async function list(){
  setLoading(true);setError("");setMessage("");
  try{const response=await invoke({action:"list",institution_id:institutionId});
    setFiles(response.files??[]);setFolder(response.folder??"Migração");
    setMessage(response.files?.length?"Selecione o arquivo que deseja copiar para a área de preparação.":"Nenhum arquivo compatível encontrado na pasta autorizada.");
  }catch(e){setFiles([]);setError((e as Error).message);}
  finally{setLoading(false);}
 }
 async function importFile(item:Item){
  setImporting(item.id);setError("");setMessage("");
  try{
   const out=await invoke({action:"import",institution_id:institutionId,item_id:item.id,reference_period:period,source_kind:kind});
   if(!out.imported)throw new Error("Não foi possível confirmar a cópia.");
   await onImported();
   setMessage("Arquivo "+item.name+" copiado para a área privada de preparação da IES. Agora use a Curadoria (passo 3).");
  }catch(e){setError((e as Error).message);}
  finally{setImporting("");}
 }
 if(!INSTS.has(institutionId))return <section className="vx-source-warning"><strong>Integração Microsoft:</strong> para esta IES ainda não foi configurada uma pasta autorizada. Use o upload ou registre o link até a vinculação da pasta.</section>;
 return <section className="vx-curation" aria-label="Importar da pasta Microsoft autorizada">
  <div className="vx-curation-heading"><div><span>ETAPA 2 · PASTA AUTORIZADA</span><h3>OneDrive / SharePoint — Migração</h3>
   <p>Leitura restrita à pasta CLIENTES / {institutionId==="1f5fd5b4-93c6-4626-834d-136884915587"?"UNITOP":"UNICALDAS"} / Migração. Não acessa outros clientes nem segue links arbitrários.</p>
  </div></div>
  <button type="button" disabled={loading||!!importing} onClick={()=>void list()}>{loading?"Consultando pasta…":"Consultar arquivos do OneDrive"}</button>
  {folder&&<p>Diretório: {folder}</p>}
  {files.length>0&&<div className="vx-curation-detail">
   <div className="vx-curation-mapping">
    <label>Competência da carga<input type="text" placeholder="Ex.: 2026/02" value={period} maxLength={35} onChange={e=>setPeriod(e.target.value)}/></label>
    <label>Tipo da fonte<select value={kind} onChange={e=>setKind(e.target.value)}>
     <option value="eorbit">e-ORBIT</option><option value="emec">e-MEC</option><option value="censo">Censo</option><option value="enade">ENADE</option><option value="secretaria">Secretaria</option><option value="outro">Outro</option>
    </select></label>
   </div>
   <div className="vx-curation-scroll"><table><thead><tr><th>Arquivo</th><th>Tamanho</th><th>Ação</th></tr></thead><tbody>
    {files.map(file=><tr key={file.id}><td>{file.name}</td><td>{(file.size/1024/1024).toLocaleString("pt-BR",{maximumFractionDigits:2})} MB</td>
      <td><button type="button" disabled={!!importing} onClick={()=>void importFile(file)}>{importing===file.id?"Importando…":"Importar para curadoria"}</button></td></tr>)}
   </tbody></table></div>
  </div>}
  {message&&<p role="status" className="vx-curation-success">{message}</p>}
  {error&&<p role="alert" className="vx-curation-error">{error}</p>}
  <small>Acesso Microsoft sujeito à autorização efetiva. A listagem não publica dados; a importação cria um novo arquivo no bucket privado da IES.</small>
 </section>;
}
