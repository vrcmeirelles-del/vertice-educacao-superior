import {useEffect,useState,useRef,type FormEvent} from 'react';
import {supabase} from '@/lib/supabase';
type Evidence={source_table:string;source_id:string;course_id:string|null;title:string;category:string|null;indicators:string[];request_id:string|null;goal_id:string|null;text_status:string;source_sha256:string|null;excerpt:string;keyword_suggestions:string[];approved_links:unknown[]};
type QueueEntry=Pick<Evidence,'source_table'|'source_id'>;
export default function EvidenceSearch({institutionId,courseId=null}:{institutionId:string;courseId?:string|null}){
 const scopeVersion=useRef(0);
 const stopBatch=useRef(false);
 const [retryFailed,setRetryFailed]=useState(false),[batchActive,setBatchActive]=useState(false);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[include,setInclude]=useState(!courseId),[rows,setRows]=useState<Evidence[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[searched,setSearched]=useState(false),[progress,setProgress]=useState('');
 useEffect(()=>{scopeVersion.current++;stopBatch.current=true;setBatchActive(false);setBusy(false);setProgress('');setRows([]);setError('');setSearched(false);setInclude(!courseId);return()=>{scopeVersion.current++;stopBatch.current=true;};},[institutionId,courseId]);
 async function indexBacklog(){
  const version=scopeVersion.current;stopBatch.current=false;setBusy(true);setBatchActive(true);setError('');let completed=0,failed=0,cursor:string|null=null;
  try{
   const gate=await supabase.rpc('vertice_evidence_can_manage',{p_institution_id:institutionId});if(gate.error)throw gate.error;if(gate.data!==true)throw Error('A extração exige perfil de gestão autorizado e sessão MFA válida.');
   while(!stopBatch.current&&version===scopeVersion.current){
    const queue:{data:QueueEntry[]|null;error:{message:string}|null}=await supabase.rpc('vertice_evidence_index_queue',{p_institution_id:institutionId,p_course_id:courseId,p_after_id:cursor,p_limit:30,p_retry_failed:retryFailed});
    if(queue.error)throw Error(queue.error.message);const files:QueueEntry[]=queue.data??[];if(!files.length)break;
    for(let i=0;i<files.length;i+=3){
     if(stopBatch.current||version!==scopeVersion.current)break;
     await Promise.all(files.slice(i,i+3).map(async(f)=>{try{const r=await supabase.functions.invoke('vertice-doc-prevalidate',{body:{institution_id:institutionId,source_table:f.source_table,file_id:f.source_id,action:'index'}});if(r.error||r.data?.error)failed++;else completed++;}catch{failed++;}}));
     if(version===scopeVersion.current)setProgress(`Acervo: ${completed} extraído(s); ${failed} com falha. Até três arquivos em processamento, sem envio à IA.`);
    }
    cursor=files[files.length-1].source_id;
   }
   if(version===scopeVersion.current)setProgress(`${stopBatch.current?'Extração interrompida':'Varredura concluída'}: ${completed} arquivo(s) extraído(s); ${failed} com falha nesta execução. Arquivos já indexados foram preservados. Falhas e cobertura parcial exigem conferência; pesquise novamente para consultar os textos.`);
  }catch(e){if(version===scopeVersion.current)setError(e instanceof Error?e.message:'Falha ao consultar a fila de extração.');}
  finally{if(version===scopeVersion.current){setBusy(false);setBatchActive(false);}}
 }
 async function search(e:FormEvent){e.preventDefault();setBusy(true);setError('');setRows([]);setSearched(false);const version=scopeVersion.current;
  try{const gate=await supabase.rpc('vertice_evidence_can_manage',{p_institution_id:institutionId});if(gate.error)throw gate.error;if(gate.data!==true)throw Error('A busca exige perfil de gestão autorizado e sessão MFA válida.');
   const {data,error}=await supabase.rpc('vertice_evidence_search',{p_institution_id:institutionId,p_course_id:courseId,p_query:query,p_include_institution:include,p_limit:30});if(error)throw error;if(version!==scopeVersion.current)return;setRows(data??[]);setSearched(true);
  }catch(e){if(version===scopeVersion.current)setError(e instanceof Error?e.message:'Não foi possível consultar as evidências.');}finally{if(version===scopeVersion.current)setBusy(false);}
 }
 async function indexReturned(){
  setBusy(true);setError('');const version=scopeVersion.current;let completed=0,failed=0;
  const files=rows.filter(r=>r.source_table!=="vertice_inep_library"&&r.text_status!=="ready"&&r.text_status!=="partial");
  for(const f of files){if(version!==scopeVersion.current)break;setProgress(`Indexando ${completed+failed+1} de ${files.length}…`);try{const r=await supabase.functions.invoke("vertice-doc-prevalidate",{body:{institution_id:institutionId,source_table:f.source_table,file_id:f.source_id,action:"index"}});if(r.error||r.data?.error)failed++;else completed++;}catch{failed++;}}
  if(version!==scopeVersion.current)return;
  setProgress(`Extração concluída: ${completed} arquivo(s); ${failed} pendente(s) ou com falha. Pesquise novamente para atualizar os resultados.`);setBusy(false);
 }
 return <section aria-label="Evidências compartilhadas" className="enade360-panel"><button type="button" className="corp-button secondary small" aria-expanded={open} onClick={()=>setOpen(!open)}>Buscar evidências do repositório e da Biblioteca INEP</button>{open&&<>
 <p>Pesquisa por título, indicador e texto extraído. Classificações existentes são preservadas; palavras-chave extraídas são sugestões. Uma correspondência não comprova suficiência documental nem resultado oficial.</p>
 <p>Extração do acervo pendente: {courseId?'somente o curso selecionado':'repositório da instituição e seus cursos'}. A varredura percorre os arquivos por identificador e preserva os textos já indexados.</p>
 <label><input type="checkbox" checked={retryFailed} disabled={busy} onChange={e=>setRetryFailed(e.target.checked)}/> Incluir tentativas anteriores com falha</label>
 <button type="button" className="corp-button small" disabled={busy} onClick={()=>void indexBacklog()}>Extrair acervo pendente, sem enviar à IA</button>
 {batchActive&&<button type="button" className="corp-button secondary small" onClick={()=>{stopBatch.current=true;}}>Interromper após os arquivos em curso</button>}
 <form onSubmit={e=>void search(e)}><label>Palavra-chave, tema ou indicador<input value={query} maxLength={300} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: NDE, competências, 1.2" /></label>
 {courseId?<label><input type="checkbox" checked={include} onChange={e=>setInclude(e.target.checked)}/> Incluir documentos institucionais, identificados separadamente</label>:<p>Escopo: instituição e seus cursos, conforme as permissões atuais.</p>}
 <button className="corp-button small" disabled={busy}>{busy?'Consultando…':'Pesquisar evidências'}</button></form>
 {error&&<p role="alert">{error}</p>}{searched&&!rows.length&&<p role="status">Nenhuma correspondência retornada neste escopo. Isso não comprova ausência de documentação.</p>}
 {progress&&<p role="status">{progress}</p>}{rows.some(r=>r.source_table!=="vertice_inep_library"&&r.text_status!=="ready"&&r.text_status!=="partial")&&<button className="corp-button small" disabled={busy} type="button" onClick={()=>void indexReturned()}>Extrair textos dos resultados pendentes, sem enviar à IA</button>}{rows.length>0&&<><p>Até 30 resultados. Abra o arquivo no repositório para conferir o original.</p>{rows.map(r=><article key={r.source_table+':'+r.source_id} style={{borderTop:'1px solid #cbd5e1',padding:'12px 0'}}>
 <strong>{r.title}</strong><p>{r.course_id?'Vinculado ao curso cadastrado':'Âmbito institucional'} · {r.source_table} · {r.category||'Sem categoria'}</p>
 <p>Indicadores cadastrados: {r.indicators?.join(', ')||'não informados'} · Texto: {r.text_status==='ready'?'extraído':r.text_status==='partial'?'extração parcial':r.text_status==='failed'?'falha na extração':r.text_status==='catalog_only'?'somente catálogo':'extração pendente'}</p>
 <p>{r.excerpt}</p>{r.keyword_suggestions?.length>0&&<p>Palavras-chave sugeridas: {r.keyword_suggestions.join(', ')}</p>}
 <small>Arquivo: {r.source_id}{r.request_id&&<> · Solicitação: {r.request_id}</>}{r.goal_id&&<> · Meta vinculada: {r.goal_id}</>}{r.source_sha256&&<> · SHA-256: {r.source_sha256}</>}</small>
 {r.approved_links?.length>0&&<p>{r.approved_links.length} vínculo(s) revisado(s) para esta versão do arquivo.</p>}
 </article>)}</>}
 </>}</section>;
}
