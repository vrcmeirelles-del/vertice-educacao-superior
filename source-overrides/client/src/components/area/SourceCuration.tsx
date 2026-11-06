import {useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {guessMapping,normalizeInput,parseTabular,type InputRow,type Mapping,type Indicator} from "@/lib/source-curation";
import {XlsxArchive,xlsxSheets,readXlsxRows,type WorkbookSheet} from "@/lib/xlsx-preview";
import {inspectInstitutionalJson,getInstitutionalJsonDataset,jsonStructureSummary,type JsonStructure} from "@/lib/json-structure-preview";
import "./source-curation.css";

type Source={id:string;institution_id:string;original_name:string;storage_path:string;reference_period:string|null;source_name:string;upload_status:string};
type Review={id:string;upload_id:string;institution_id:string;candidate_rows:Indicator[];row_count:number;state:string;created_by:string;submitted_by:string|null;reviewed_by:string|null;review_note:string|null;analysis_note:string;file_sha256:string;created_at:string};
type Props={institutionId:string;files:Source[]};
const stateLabel:Record<string,string>={analisado:"Em curadoria",submetido:"Aguardando aprovação",aprovado:"Publicado no BI externo",devolvido:"Devolvido para revisão"};
function fmt(value:number){return value.toLocaleString("pt-BR",{maximumFractionDigits:3});}
export default function SourceCuration({institutionId,files}:Props){
 const [reviews,setReviews]=useState<Review[]>([]);
 const [selected,setSelected]=useState<Source|null>(null);
 const [rawRows,setRawRows]=useState<InputRow[]>([]);
 const [workbook,setWorkbook]=useState<XlsxArchive|null>(null);
 const [sheets,setSheets]=useState<WorkbookSheet[]>([]);
 const [activeSheet,setActiveSheet]=useState("");
 const [pdfText,setPdfText]=useState("");
 const [pdfPages,setPdfPages]=useState<number|null>(null);
 const [jsonValue,setJsonValue]=useState<unknown>(null);
 const [jsonStructure,setJsonStructure]=useState<JsonStructure|null>(null);
 const [jsonPath,setJsonPath]=useState("");
 const [readingStage,setReadingStage]=useState("");

 const [headers,setHeaders]=useState<string[]>([]);
 const [map,setMap]=useState<Mapping>({indicator:"",period:"",value:"",unit:""});
 const [unit,setUnit]=useState("quantidade");
 const [candidate,setCandidate]=useState<Indicator[]>([]);
 const [sha,setSha]=useState("");
 const [note,setNote]=useState("");
 const [reviewNote,setReviewNote]=useState("");
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [userId,setUserId]=useState<string|null>(null);
 const [conflicts,setConflicts]=useState<Array<{indicador:string;periodo:string;valor_proposto:number;valor_homologado:number}>>([]);
 const [legacy,setLegacy]=useState<Record<string,number>>({});
 const [legacyNote,setLegacyNote]=useState("");
 const [legacyWarnings,setLegacyWarnings]=useState<Array<{indicador:string;periodo:string;proposto:number;legado:number}>>([]);
 const load=useCallback(async()=>{
  const [{data,error:loadError},{data:user}]=await Promise.all([
   supabase.from("vertice_source_analyses").select("*").eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(100),
   supabase.auth.getUser()
  ]);
  if(loadError)throw loadError;
  setReviews((data??[]) as Review[]);setUserId(user.user?.id??null);
 },[institutionId]);
 useEffect(()=>{void load().catch(()=>setError("Curadoria indisponível para este perfil."));},[load]);
 useEffect(()=>{let active=true;
  void supabase.from("vertice_enrollment_snapshots")
   .select("semester,enrolled").eq("institution_id",institutionId)
   .eq("student_status","MATRICULADO").limit(5000).then(({data,error})=>{
    if(!active)return;
    if(error){setLegacy({});setLegacyNote("Não foi possível consultar a fonte de matrícula legada.");return;}
    const sums:Record<string,number>={};
    for(const row of data??[]){
     const p=String(row.semester??"");
     if(Number.isFinite(Number(row.enrolled)))sums[p]=(sums[p]??0)+Number(row.enrolled);
    }
    setLegacy(sums);
    setLegacyNote((data??[]).length===5000?"Comparação parcial: limite de linhas alcançado.":"Comparação preliminar por semestre na tabela de snapshots.");
   });
  return()=>{active=false;};
 },[institutionId]);
 const review=reviews.find(x=>x.upload_id===selected?.id)??null;
 const matchingReview=!!review&&candidate.length===review.candidate_rows.length
   &&sha===review.file_sha256&&note.trim()===review.analysis_note.trim()
   &&candidate.every((row,i)=>{
     const saved=review.candidate_rows[i];
     return saved&&row.indicador===saved.indicador&&row.periodo===saved.periodo
       &&row.valor===saved.valor&&row.unidade===saved.unidade;
   });
 const approved=useMemo(()=>reviews.filter(r=>r.state==="aprovado"),[reviews]);
 async function open(source:Source){
  setSelected(source);setRawRows([]);setHeaders([]);setCandidate([]);setSha("");setLegacyWarnings([]);setWorkbook(null);setSheets([]);setActiveSheet("");setPdfText("");setPdfPages(null);setJsonValue(null);setJsonStructure(null);setJsonPath("");setReadingStage("");
  setError("");setMessage("");setConflicts([]);setConsent(false);setReviewNote("");
  const existing=reviews.find(x=>x.upload_id===source.id);
  setNote(existing?.analysis_note??"");if(existing){setCandidate(existing.candidate_rows);}
  if(source.upload_status!=="recebido"){setError("Arquivo ainda não confirmado. Não é possível analisá-lo.");return;}
  const ext=source.original_name.split(".").pop()?.toLowerCase();
  if(ext==="pdf"){
    setBusy(true);try{
      const {data,error}=await supabase.functions.invoke("vertice-source-pdf-preview",{body:{upload_id:source.id}});
      if(error){let code="";try{code=(await error.context?.json())?.error??"";}catch{}
        throw new Error(code==="no_embedded_text"?"PDF digitalizado sem texto selecionável. OCR ainda requer autorização específica.":code||"Extração textual de PDF indisponível.");
      }
      if(!data?.text)throw new Error("O PDF não apresentou texto extraível.");
      setPdfText(data.text);setPdfPages(data.pages??null);
      setMessage("Prévia textual extraída no servidor. Confira cada número com o PDF original; não houve importação automática de indicadores.");
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}return;
  }
  if(!["csv","txt","json","xlsx"].includes(ext??"")){
   setError("Este formato permanece como evidência documental. A curadoria quantitativa aceita CSV, JSON e XLSX; PDFs estão na etapa de prévia textual.");return;
  }
  setBusy(true);setReadingStage("Transferindo a fonte privada para leitura local…");
  try{
   const {data,error:downloadError}=await supabase.storage.from("vertice-fontes-ies").download(source.storage_path);
   if(downloadError||!data)throw downloadError??new Error("Fonte indisponível.");
   const maxSize=(ext==="json"?12:ext==="xlsx"?5:2)*1024*1024;
   if(data.size>maxSize)throw new Error("Arquivo acima do limite de leitura local deste formato ("+Math.round(maxSize/1024/1024)+" MiB). É necessário processamento seguro em lotes, preservando a integridade da carga.");
   setReadingStage("Conferindo integridade do arquivo…");
   const bytes=await data.arrayBuffer();
   const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
   setSha([...hash].map(x=>x.toString(16).padStart(2,"0")).join(""));
   if(ext==="json"){
     setReadingStage("Identificando tabelas e estruturas do JSON…");
     const object=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown;
     const structure=inspectInstitutionalJson(object);
     setJsonValue(object);setJsonStructure(structure);
     if(structure.datasets.length===1&&structure.datasets[0].previewEligible){
       const chosen=structure.datasets[0];
       const parsed=getInstitutionalJsonDataset(object,chosen.path);
       const columns=Object.keys(parsed[0]);
       setJsonPath(chosen.path);setRawRows(parsed);setHeaders(columns);setMap(guessMapping(columns));
     }
     setMessage(jsonStructureSummary(structure)+(structure.datasets.length!==1?" Selecione abaixo o conjunto de dados para mapear.":""));
   }else if(ext==="xlsx"){
     const archive=new XlsxArchive(bytes), available=await xlsxSheets(archive);
     if(!available.length)throw new Error("Nenhuma planilha visível encontrada.");
     setWorkbook(archive);setSheets(available);setActiveSheet(available[0].path);
     const parsed=await readXlsxRows(archive,available[0]);
     const columns=Object.keys(parsed[0]);
     setRawRows(parsed);setHeaders(columns);setMap(guessMapping(columns));
     setMessage("XLSX analisado localmente: "+available.length+" aba(s). Selecione a aba correta e confira as colunas. Fórmulas nunca serão executadas.");
   }else{
     const parsed=parseTabular(new TextDecoder("utf-8",{fatal:true}).decode(bytes),ext!);
     const columns=Object.keys(parsed[0]);
     setRawRows(parsed);setHeaders(columns);setMap(guessMapping(columns));
     setMessage("Prévia local preparada: "+parsed.length+" linhas. Confira as colunas e os valores antes de gerar a análise.");
   }
  }catch(e){setError((e as {message?:string})?.message??"Não foi possível preparar a prévia.");}
  finally{setBusy(false);setReadingStage("");}
 }
 function selectJsonPath(path:string){
  setJsonPath(path);setError("");setCandidate([]);setRawRows([]);setHeaders([]);setMap({indicator:"",period:"",value:"",unit:""});
  if(!jsonStructure||!path||jsonValue===null)return;
  const dataset=jsonStructure.datasets.find(d=>d.path===path);
  if(!dataset)return;
  if(!dataset.previewEligible){
   setMessage("Este conjunto contém "+dataset.count+" registros. A estrutura foi identificada, mas a publicação exige uma carga completa, processada em lotes. Não serão descartados registros silenciosamente.");
   return;
  }
  try{
   const parsed=getInstitutionalJsonDataset(jsonValue,path);
   const columns=Object.keys(parsed[0]);
   setRawRows(parsed);setHeaders(columns);setMap(guessMapping(columns));
   setMessage("Conjunto "+path+" selecionado com "+parsed.length+" registros. Revise as colunas, indicador, competência, valor e unidade.");
  }catch(e){setError((e as Error).message);}
 }
 async function changeSheet(path:string){
  if(!workbook)return;setBusy(true);setError("");setMessage("");
  try{
   const sheet=sheets.find(s=>s.path===path);
   if(!sheet)throw new Error("Aba não encontrada.");
   const parsed=await readXlsxRows(workbook,sheet);
   const columns=Object.keys(parsed[0]);setActiveSheet(path);
   setRawRows(parsed);setHeaders(columns);setMap(guessMapping(columns));setCandidate([]);
   setMessage("Aba "+sheet.name+" carregada: "+parsed.length+" linha(s). Gere novamente a prévia antes de salvar.");
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 function validate(){
  setError("");setMessage("");
  try{
   const converted=normalizeInput(rawRows,map,unit);
   if(converted.length>500)throw new Error("Máximo de 500 registros por importação.");
   const known=new Map<string,number>();
   approved.forEach(a=>a.candidate_rows.forEach(r=>known.set(r.indicador.toLowerCase()+"|"+r.periodo,r.valor)));
   const collisions=converted.flatMap(r=>{
    const old=known.get(r.indicador.toLowerCase()+"|"+r.periodo);
    return old!==undefined&&old!==r.valor?[{indicador:r.indicador,periodo:r.periodo,valor_proposto:r.valor,valor_homologado:old}]:[];
   });
   const preliminary=converted.flatMap(r=>{
     if(!/matr[ií]culad|total de matr[ií]cula|total matr[ií]cula/i.test(r.indicador))return [];
     const current=legacy[r.periodo];
     return current!==undefined&&current!==r.valor?[{indicador:r.indicador,periodo:r.periodo,proposto:r.valor,legado:current}]:[];
   });
   setCandidate(converted);setConflicts(collisions);setLegacyWarnings(preliminary);
   setMessage("Análise preparada com "+converted.length+" indicadores. "+(collisions.length?collisions.length+" divergência(s) em relação às cargas homologadas.":"Sem divergência de valores frente às cargas homologadas acessíveis."));
  }catch(e){setCandidate([]);setError((e as Error).message);}
 }
 async function saveReview(){
  if(!selected||!candidate.length||!sha||busy)return;setBusy(true);setError("");setMessage("");
  try{
   const payload={upload_id:selected.id,institution_id:institutionId,file_sha256:sha,
    candidate_rows:candidate,row_count:candidate.length,analysis_note:note.trim()};
   const {error:err}=review?
     await supabase.from("vertice_source_analyses").update({...payload,state:"analisado"}).eq("id",review.id):
     await supabase.from("vertice_source_analyses").insert(payload);
   if(err)throw err;
   await load();setMessage("Análise salva em curadoria. Nenhum indicador foi publicado.");
  }catch(e){setError((e as {message?:string})?.message??"Não foi possível salvar a análise.");}
  finally{setBusy(false);}
 }
 async function move(decision:"submetido"|"aprovado"|"devolvido"){
  if(!review||busy)return;setBusy(true);setError("");setMessage("");
  try{
   const {data,error:err}=await supabase.from("vertice_source_analyses")
     .update({state:decision,...(decision==="submetido"?{}:{review_note:reviewNote.trim()})})
     .eq("id",review.id).eq("institution_id",institutionId).select("id").single();
   if(err||!data)throw err??new Error("Transição não confirmada.");
   await load();setMessage(decision==="aprovado"?"Indicadores publicados no BI de fontes homologadas. Os KPIs legados não foram substituídos.":decision==="devolvido"?"Análise devolvida para revisão.":"Enviado à instância superior para avaliação.");
   setConsent(false);
  }catch(e){setError((e as {message?:string})?.message??"Não foi possível alterar o estado.");}
  finally{setBusy(false);}
 }
 async function compare(){
  if(!review)return;
  const {data,error:err}=await supabase.rpc("vertice_source_conflicts",{p_analysis:review.id});
  if(err){setError("Não foi possível comparar o dataset.");return;}
  setConflicts((data??[]) as typeof conflicts);
 }
 return <section className="vx-curation" aria-label="Curadoria e homologação de fontes">
  <div className="vx-curation-heading"><div><span>ETAPA 3 — CONFERÊNCIA E MAPEAMENTO</span><h3>Analisar e cruzar dados</h3>
   <p>Leitura local de CSV, JSON e XLSX; inspeção de estruturas grandes, mapeamento explícito de indicadores e comparação de versões sem descartar registros.</p></div>
  </div>
  <div className="vx-curation-files">
   {files.filter(f=>f.upload_status==="recebido").map(file=><button type="button" key={file.id} onClick={()=>void open(file)} aria-pressed={selected?.id===file.id}>
    <strong>{file.original_name}</strong><small>{file.source_name} · {file.reference_period??"Sem competência"}</small>
    <em>{stateLabel[reviews.find(r=>r.upload_id===file.id)?.state??""]??"Aguardando análise"}</em>
   </button>)}
   {!files.some(f=>f.upload_status==="recebido")&&<p>Nenhum arquivo pronto para conferência. Faça primeiro o upload do passo 2.</p>}
  </div>
  {selected&&<div className="vx-curation-detail">
   <h4>{selected.original_name}</h4>
   {review&&<p><strong>Estado atual:</strong> {stateLabel[review.state]??review.state} · {review.row_count} linhas mapeadas.</p>}
   {pdfText&&<div className="vx-curation-preview">
     <h5>Prévia textual do PDF · {pdfPages??"?"} página(s) no arquivo</h5>
     <p>Somente texto incorporado ao PDF, sem OCR. Não convertemos tabelas automaticamente em registros: confira o original e envie CSV/XLSX para publicar indicadores.</p>
     <textarea readOnly rows={12} value={pdfText} aria-label="Texto extraído do PDF" style={{width:"100%",fontFamily:"monospace",fontSize:12}}/>
     <button type="button" onClick={()=>void navigator.clipboard.writeText(pdfText)}>Copiar prévia textual</button>
   </div>}
   {jsonStructure&&<div className="vx-curation-preview" aria-label="Estrutura do arquivo JSON">
     <h5>Estrutura do JSON — arquivo recebido integralmente</h5>
     <p>Tipo de raiz: <strong>{jsonStructure.rootType}</strong> · {jsonStructure.datasets.length} conjunto(s) tabular(es) identificado(s).</p>
     {jsonStructure.topLevelKeys.length>0&&<p><strong>Seções principais:</strong> {jsonStructure.topLevelKeys.join(" · ")}</p>}
     {jsonStructure.notes.map((item,i)=><p key={i} className="vx-curation-alert">{item}</p>)}
     <label>Conjunto de dados para análise
      <select value={jsonPath} onChange={e=>selectJsonPath(e.target.value)}>
       <option value="">Selecione a tabela interna do JSON</option>
       {jsonStructure.datasets.map(dataset=><option key={dataset.path} value={dataset.path}>
        {dataset.path} — {dataset.count.toLocaleString("pt-BR")} registros{dataset.previewEligible?"":" · requer lotes"}
       </option>)}
      </select>
     </label>
     {jsonPath&&jsonStructure.datasets.find(d=>d.path===jsonPath)&&<p>
      <strong>Campos identificados:</strong> {jsonStructure.datasets.find(d=>d.path===jsonPath)!.columns.join(" · ")}
     </p>}
     <small>Apenas nomes de campos são exibidos nesta visão estrutural. Dados pessoais não são enviados à IA. Bases acima de 500 linhas não podem ser aprovadas parcialmente.</small>
   </div>}
   {readingStage&&<p role="status" className="vx-source-stage">{readingStage}</p>}
   {sheets.length>1&&<label>Aba do arquivo Excel
    <select value={activeSheet} disabled={busy} onChange={e=>void changeSheet(e.target.value)}>
      {sheets.map(sheet=><option key={sheet.path} value={sheet.path}>{sheet.name}</option>)}
    </select>
   </label>}
   {rawRows.length>0&&<>
    <div className="vx-curation-mapping">
     {([
      ["indicator","Coluna de indicador"],
      ["period","Coluna de competência"],
      ["value","Coluna do valor"],
      ["unit","Coluna da unidade (opcional)"]
     ] as const).map(([key,label])=><label key={key}>{label}
      <select value={map[key]} onChange={e=>{setMap(old=>({...old,[key]:e.target.value}));setCandidate([]);}}>
       <option value="">Selecionar coluna</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}
      </select></label>)}
     <label>Unidade padrão<input value={unit} maxLength={30} onChange={e=>setUnit(e.target.value)}/></label>
    </div>
    <button type="button" onClick={validate} disabled={busy}>Preparar análise e comparar</button>
    <p>Linhas da fonte: {rawRows.length}. Os valores numéricos devem estar sem separador de milhar ambíguo. Não agregamos turmas automaticamente.</p>
   </>}
   {candidate.length>0&&<div className="vx-curation-preview"><h5>Prévia dos indicadores</h5>
    <div className="vx-curation-scroll"><table><thead><tr><th>Indicador</th><th>Período</th><th>Valor</th><th>Unidade</th></tr></thead><tbody>
     {candidate.slice(0,12).map((r,i)=><tr key={i}><td>{r.indicador}</td><td>{r.periodo}</td><td>{fmt(r.valor)}</td><td>{r.unidade}</td></tr>)}
    </tbody></table></div><small>Amostra de até 12 de {candidate.length} linhas; o total estará no registro de curadoria.</small>
   </div>}
   {legacyWarnings.length>0&&<div className="vx-curation-alert">
    <strong>{legacyWarnings.length} confronto(s) preliminar(es) com o BI legado de matrículas</strong>
    {legacyWarnings.slice(0,8).map((x,i)=><p key={i}>{x.indicador} · {x.periodo}: proposto {fmt(x.proposto)} / snapshots {fmt(x.legado)}</p>)}
    <small>{legacyNote} Fontes e grãos podem ser diferentes: não substitua o KPI oficial antes da reconciliação. O quantitativo e-ORBIT pode usar outro identificador institucional.</small>
   </div>}
   {conflicts.length>0&&<div className="vx-curation-alert"><b>{conflicts.length} divergência(s) detectada(s) em fonte aprovada anterior</b>
    {conflicts.slice(0,8).map((c,i)=><p key={i}>{c.indicador} · {c.periodo}: anterior {fmt(c.valor_homologado)} / proposta {fmt(c.valor_proposto)}</p>)}
    <small>A divergência não é corrigida automaticamente. A aprovação exige conferir os dados e justificar a decisão.</small>
   </div>}
   {rawRows.length>0&&(!review||["analisado","devolvido"].includes(review.state))&&<>
    <label>Conclusão preliminar / fonte<textarea rows={2} maxLength={2500} value={note} onChange={e=>setNote(e.target.value)} placeholder="Descreva a origem, a competência e os critérios usados na conferência."/></label>
    <button type="button" disabled={busy||!candidate.length||!sha} onClick={()=>void saveReview()}>Salvar análise em curadoria</button>
   </>}
   {review&&["analisado","devolvido"].includes(review.state)&&!matchingReview&&<p role="status">Salve primeiro a versão da análise exibida para poder submetê-la.</p>}
   {review&&["analisado","devolvido"].includes(review.state)&&<button type="button" disabled={busy||!consent||!matchingReview} onClick={()=>void move("submetido")}>Submeter à validação superior</button>}
   {review?.state==="submetido"&&<>
     <button type="button" onClick={()=>void compare()}>Comparar com versões aprovadas</button>
     {review.submitted_by!==userId&&<><label>Justificativa da decisão<textarea rows={2} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Fundamente a aprovação ou devolução; consulte a fonte e o mapeamento."/></label>
      <div className="vx-curation-actions"><button type="button" disabled={busy||reviewNote.trim().length<8||!consent} onClick={()=>void move("aprovado")}>Aprovar e incorporar ao BI externo</button>
      <button type="button" disabled={busy||reviewNote.trim().length<8} onClick={()=>void move("devolvido")}>Devolver para correções</button></div>
     </>}
     {review.submitted_by===userId&&<p>O autor do envio não pode aprovar a própria carga.</p>}
   </>}
   {review&&review.state!=="aprovado"&&<label className="vx-curation-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Confirmo a conferência das fontes, colunas, valores e divergências. Entendo que os dados aprovados integrarão somente o BI externo homologado, sem substituir métricas legadas.</label>}
   {review?.state==="aprovado"&&<p role="status">Dataset homologado por revisor diferente do autor. Disponível no painel de Indicadores externos homologados.</p>}
  </div>}
  {error&&<p role="alert" className="vx-curation-error">{error}</p>}
  {message&&<p role="status" className="vx-curation-success">{message}</p>}
 </section>;
}
