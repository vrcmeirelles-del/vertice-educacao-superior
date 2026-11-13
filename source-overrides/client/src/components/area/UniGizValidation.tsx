import { HelpLabel } from '@/components/ContextHelp';
import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import {validateUniGizStructuralFiles,uniGizSha256,type UniGizCheckResult} from "@/lib/uni-giz-structural-validation";
import "./uni-giz-validation.css";

type CheckRow={
 id:string;backup_id:string;institution_id:string;found_tables:number;
 missing_tables:number;extra_tables:number;stage:string;review_state:string;
 created_at:string;received_at:string|null;manifest_sha256:string;
};
const BUCKET="vertice-validacoes-ies";
export default function UniGizValidation({institutionId,backupId}:{institutionId:string;backupId:string|null}){
 const [manifest,setManifest]=useState<File|null>(null);
 const [tables,setTables]=useState<File|null>(null);
 const [result,setResult]=useState<UniGizCheckResult|null>(null);
 const [rows,setRows]=useState<CheckRow[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState("");
 const refresh=useCallback(async()=>{
  const {data,error}=await supabase.from("vertice_backup_structure_checks")
   .select("id,backup_id,institution_id,found_tables,missing_tables,extra_tables,stage,review_state,created_at,received_at,manifest_sha256")
   .eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(20);
  if(error)throw error;setRows((data??[]) as CheckRow[]);
 },[institutionId]);
 useEffect(()=>{let active=true;setLoading(true);void refresh().catch(e=>{
   if(active)setError((e as Error).message??"Falha ao carregar conferências.");
  }).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[refresh]);
 async function preview(){
  if(!manifest||!tables)return;
  setBusy(true);setError("");setMessage("");setResult(null);
  try{
   const report=await validateUniGizStructuralFiles(manifest,tables);
   setResult(report);
   setMessage("O relatório passou nas verificações locais de formato, nomes e hash. Isso não equivale à homologação independente.");
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function uploadEvidence(path:string,file:File,hash:string,contentType:string){
  const {error}=await supabase.storage.from(BUCKET).upload(path,file,{upsert:false,contentType});
  if(!error)return;
  // Support safe retry after an interrupted transfer, without overwriting evidence.
  const {data, error:downloadError}=await supabase.storage.from(BUCKET).download(path);
  if(downloadError||!data)throw error;
  if(await uniGizSha256(data)!==hash)throw new Error("Um arquivo com o mesmo nome já existe mas possui hash diferente. O envio foi interrompido.");
 }
 async function record(){
  if(!result||!manifest||!tables||!backupId||busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const verification=await validateUniGizStructuralFiles(manifest,tables);
   const {data:existing,error:lookupError}=await supabase.from("vertice_backup_structure_checks")
     .select("id,stage").eq("institution_id",institutionId).eq("backup_id",backupId)
     .eq("manifest_sha256",verification.manifestSha).maybeSingle();
   if(lookupError)throw lookupError;
   if(existing?.stage==="evidencias_recebidas"){
    setMessage("Estas evidências já foram recebidas pela Vértice; continuam pendentes de revisão técnica.");
    await refresh();return;
   }
   let id=String(existing?.id??"");
   if(!id){
    id=crypto.randomUUID();
    const {error:insertError}=await supabase.from("vertice_backup_structure_checks").insert({
      id,institution_id:institutionId,backup_id:backupId,
      expected_tables:642,found_tables:verification.found,missing_tables:verification.missing,
      extra_tables:verification.extraDeclared,catalog_sha256:verification.catalogSha,
      query_sha256:verification.querySha,manifest_sha256:verification.manifestSha,
      tables_csv_sha256:verification.tablesSha,manifest_bytes:manifest.size,tables_csv_bytes:tables.size,
      origin_database:"UNI_GIZ_HOMOLOGACAO",origin_readonly:true
    });
    if(insertError)throw insertError;
   }
   const prefix=institutionId+"/"+id+"/";
   await uploadEvidence(prefix+"00_manifesto_conciliacao.json",manifest,verification.manifestSha,"application/json");
   await uploadEvidence(prefix+"02_642_tabelas.csv",tables,verification.tablesSha,"text/csv");
   const {data:confirmed,error:confirmError}=await supabase.functions.invoke("vertice-backup-validation-confirm",{
     body:{report_id:id,institution_id:institutionId}
   });
   if(confirmError){
     let code="";try{code=(await confirmError.context?.json())?.error??"";}catch{}
     throw new Error(code||"A confirmação de integridade no servidor não foi concluída.");
   }
   if(!confirmed?.confirmed)throw new Error("A confirmação de integridade no servidor não foi concluída.");
   setMessage("Evidências recebidas no cofre restrito da UNICALDAS. Pré-análise registrada; homologação acadêmica e BI permanecem bloqueados.");
   setResult(null);setManifest(null);setTables(null);
   const a=document.getElementById("vx-unigiz-manifest") as HTMLInputElement|null,b=document.getElementById("vx-unigiz-tables") as HTMLInputElement|null;
   if(a)a.value="";if(b)b.value="";
   await refresh();
  }catch(e){setError((e as Error).message??"Não foi possível registrar as evidências.");}
  finally{setBusy(false);}
 }
 return <section className="vx-unigiz-check" aria-label="Conferência pós-restauração UNI_GIZ">
  <header>
   <span>UNICALDAS · HOMOLOGAÇÃO TÉCNICA</span>
   <h4>Conferir relatórios das 642 tabelas</h4>
   <p>Etapa após restaurar o BAK no SQL Server isolado. Recebe apenas o manifesto e a lista técnica gerados pelo script de conciliação. Não recebe matrículas, CPFs nem outros dados pessoais.</p>
  </header>
  <div className="vx-unigiz-alert">
   <strong>Pré-requisito:</strong> a execução do SQL Server deve ter gerado os relatórios. O recebimento do BAK no cofre não produz automaticamente esses documentos. Não envie o BAK ou o RAR nesta seção.
  </div>
  {!backupId?<p role="status">Nenhum BAK recebido foi localizado para vincular a conferência.</p>:<div className="vx-unigiz-form">
   <HelpLabel>Manifesto de conciliação
    <input id="vx-unigiz-manifest" type="file" accept=".json,application/json"
     onChange={e=>{setManifest(e.target.files?.[0]??null);setResult(null)}}/>
    <small>00_manifesto_conciliacao.json</small>
   </HelpLabel>
   <HelpLabel>Relatório com as 642 tabelas
    <input id="vx-unigiz-tables" type="file" accept=".csv,text/csv"
     onChange={e=>{setTables(e.target.files?.[0]??null);setResult(null)}}/>
    <small>02_642_tabelas.csv</small>
   </HelpLabel>
   <button type="button" className="vx-unigiz-primary" onClick={()=>void preview()} disabled={busy||!manifest||!tables}>
    {busy?"Conferindo…":"Conferir relatórios sem publicar no BI"}
   </button>
  </div>}
  {result&&<div className="vx-unigiz-result">
   <strong>Pré-análise estrutural local concluída</strong>
   <div className="vx-unigiz-stats">
    <div><b>642</b><span>Esperadas</span></div>
    <div><b>{result.found}</b><span>Localizadas</span></div>
    <div><b>{result.missing}</b><span>Ausentes</span></div>
    <div><b>{result.extraDeclared}</b><span>Adicionais declaradas</span></div>
   </div>
   {result.priorityMissing.length>0&&<p className="vx-unigiz-risk">
    <strong>{result.priorityMissing.length} tabela(s) prioritária(s) ausente(s):</strong> {result.priorityMissing.slice(0,12).join(", ")}
   </p>}
   {result.missingNames.length>0&&<details><summary>Ver as {result.missingNames.length} tabelas ausentes</summary>
    <p>{result.missingNames.join(", ")}</p></details>}
   <p>{result.warning}</p>
   <button type="button" className="vx-unigiz-primary" onClick={()=>void record()} disabled={busy||!backupId}>
    Registrar pré-análise com evidências no cofre privado
   </button>
  </div>}
  {error&&<p role="alert" className="vx-unigiz-error">{error}</p>}
  {message&&<p role="status" className="vx-unigiz-notice">{message}</p>}
  <div className="vx-unigiz-history">
   <h5>Histórico de conferências estruturais</h5>
   {loading?<p>Carregando…</p>:rows.length===0?<p>Nenhuma conciliação recebida. O arquivo BAK permanece preservado.</p>:
    <div className="vx-unigiz-scroll"><table><thead><tr><th>Recebimento</th><th>Localizadas</th><th>Ausentes</th><th>Condição</th></tr></thead>
    <tbody>{rows.map(x=><tr key={x.id}>
     <td>{new Date(x.created_at).toLocaleString("pt-BR")}</td>
     <td>{x.found_tables}/642</td><td>{x.missing_tables}</td>
     <td>{x.stage==="evidencias_recebidas"?"Evidências recebidas · revisão técnica pendente":"Envio incompleto · pendente"}</td>
    </tr>)}</tbody></table></div>}
  </div>
  <small>Essas informações são declaradas pelo relatório do laboratório e conferidas localmente. Não representam validação independente do SQL Server nem autorização para publicação acadêmica.</small>
 </section>;
}
