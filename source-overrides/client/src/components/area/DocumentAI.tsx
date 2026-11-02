import {useEffect, useMemo, useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Row} from '@/lib/area';
import {SourcePreview,DocumentReport} from './DocumentPresentation';
import './document-analysis.css';

type Chunk={id:string;file_id:string;file_name:string;text:string;sensitive_findings:string[]};
type Preview={preview_digest:string;chunks:Chunk[];unsupported:{file_id:string;message:string}[]};
type Policy={configured:boolean;enabled:boolean;model:string|null;actor_daily_limit:number;institution_daily_limit:number};
type Result={analysis_id:string;result:{summary:string;facts:{text:string;source_ids:string[];quotes:{source_id:string;excerpt:string}[]}[];gaps:{text:string}[];recommendations:{text:string}[];limitations:string[];disclaimer:string}};
const errors:Record<string,string>={invalid_output:'A resposta da IA não passou pela validação de integridade. Nenhum resultado foi apresentado. Prepare um recorte menor antes de uma nova análise.',authentication_required:'Entre novamente para continuar.',access_denied:'Acesso não autorizado. Confira sua sessão, segundo fator e vínculo com o curso.',quota_exceeded:'Limite diário atingido. Tente em outro dia.',analysis_not_configured:'A análise ainda não está habilitada para esta instituição.',preview_changed_or_unconfirmed:'O documento mudou. Prepare e revise os trechos novamente.',sensitive_input:'Há possíveis dados pessoais ou segredos. Reduza os trechos antes de continuar.',already_requested:'Esta solicitação já foi registrada. Não repita o envio.',provider_unavailable:'O provedor não concluiu a análise. Não repita o envio automaticamente.',timeout:'A análise excedeu o tempo limite. Não repita o envio automaticamente.'};
async function invoke(body:Record<string,unknown>){
  const {data,error}=await supabase.functions.invoke('vertice-ai-review',{body});
  if(error){let code='';try{code=(await error.context?.json())?.error??'';}catch{}throw new Error(errors[code]??'Não foi possível concluir a operação. Confira sua sessão e tente novamente mais tarde.');}
  if(data?.error)throw new Error(errors[data.error]??'A análise não foi concluída.');
  return data;
}
export default function DocumentAI({institutionId,courses,requests,files}:{institutionId:string;courses:Row[];requests:Row[];files:Row[]}){
  const [course,setCourse]=useState('');
  return <section className="area-panel doc-analysis" aria-label="Análise Documental">
    <header className="doc-hero"><span className="doc-eyebrow">Acompanhamento dos cursos · Alta gestão</span><h3>Análise Documental</h3><p>Transforme metas e evidências em uma leitura clara do andamento do curso, com prioridades para orientar as próximas decisões.</p><p>A IA apoia a análise. Você revisa as fontes, interpreta o relatório e decide os próximos passos.</p><ol className="doc-steps"><li><b>1</b>Escolha o curso</li><li><b>2</b>Revise as informações</li><li><b>3</b>Leia o relatório</li></ol></header>
    <label className="doc-course">Curso para análise <select value={course} onChange={e=>setCourse(e.target.value)}><option value="">Selecione um curso</option>{courses.map(c=><option key={c.id} value={c.id}>{String(c.display_name??c.name)}{c.code?` · ${c.code}`:''}</option>)}</select></label>
    {!course&&<div className="doc-empty"><strong>Comece pelo curso que deseja acompanhar</strong><p>Você poderá revisar metas, medições, prazos e evidências dos indicadores INEP/MEC antes de solicitar a análise.</p></div>}
    {course&&<Review key={`${institutionId}:${course}`} institutionId={institutionId} courseId={course} courseName={String(courses.find(c=>c.id===course)?.name??'Curso')} requests={requests} files={files}/>}
  </section>;
}
function Review({institutionId,courseId,courseName,requests,files}:{institutionId:string;courseId:string;courseName:string;requests:Row[];files:Row[]}){
  const [policy,setPolicy]=useState<Policy|null>(null),[selected,setSelected]=useState<string[]>([]),[preview,setPreview]=useState<Preview|null>(null),[texts,setTexts]=useState<Record<string,string>>({}),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null),[sent,setSent]=useState(false);
  const [completedAt,setCompletedAt]=useState('');
  const scope={institution_id:institutionId,course_id:courseId};
  const documents=useMemo(()=>{const ids=new Set(requests.filter(r=>r.institution_id===institutionId&&r.course_id===courseId).map(r=>r.id));return files.filter(f=>f.institution_id===institutionId&&ids.has(String(f.request_id)));},[requests,files,institutionId,courseId]);
  const compatible=documents.filter(f=>/\.(txt|csv)$/i.test(String(f.file_name)));
  useEffect(()=>{let active=true;invoke({action:'status',institution_id:institutionId,course_id:courseId}).then(p=>{if(active)setPolicy(p);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[institutionId,courseId]);
  const reset=()=>{setPreview(null);setTexts({});setConfirmed(false);setResult(null);setSent(false);setError('');};
  async function prepare(){setBusy(true);reset();try{setPreview(await invoke({...scope,action:'preview',file_ids:selected}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const selections=preview?.chunks.filter(c=>(texts[c.id]??'').trim().length>=10).map(c=>({id:c.id,text:texts[c.id]}))??[];
  const invalid=selections.length>12||selections.reduce((n,s)=>n+s.text.length,0)>24000||selections.some(s=>s.text.length>4000||!preview?.chunks.find(c=>c.id===s.id)?.text.includes(s.text));
  async function analyze(){if(!preview||!confirmed||!selections.length||invalid||sent)return;setBusy(true);setSent(true);setError('');try{setResult(await invoke({...scope,action:'analyze',file_ids:selected,preview_digest:preview.preview_digest,selections,privacy_confirmed:true}));setCompletedAt(new Date().toLocaleString('pt-BR'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div aria-busy={busy}>
    {error&&<p role="alert" className="area-error">{error}</p>}
    {!policy&&!error&&<p role="status">Verificando disponibilidade…</p>}
    {policy&&<p role="status" className="doc-availability">{policy.configured&&policy.enabled?'Análise disponível para este curso.':'Análise ainda não habilitada para esta instituição.'} {policy.enabled&&<>Limites: {policy.actor_daily_limit} análises por pessoa e {policy.institution_daily_limit} por instituição ao dia.</>}</p>}
    <div className="doc-support"><strong>Metas e evidências no mesmo contexto</strong><p>Os registros de gestão do curso já podem compor a análise, mesmo sem anexos.</p><details><summary>Documentos aceitos e cuidados com o envio</summary><p>É possível acrescentar até 3 arquivos TXT ou CSV em UTF-8, de até 5 MB cada. A leitura de PDF, Word e planilhas ainda não está disponível. Apenas as informações selecionadas e revisadas serão enviadas à OpenAI. A análise não atribui conceito oficial INEP/MEC.</p></details></div>
    {!compatible.length?<p className="doc-availability">A análise utilizará os registros de gestão disponíveis. Não há anexos TXT ou CSV neste curso.</p>:<fieldset disabled={busy||sent}><legend>1. Escolha os documentos</legend>{compatible.map(f=><label key={f.id} style={{display:'block',margin:'8px 0'}}><input type="checkbox" checked={selected.includes(f.id)} disabled={!selected.includes(f.id)&&selected.length>=3} onChange={e=>{reset();setSelected(s=>e.target.checked?[...s,f.id]:s.filter(id=>id!==f.id));}}/> {String(f.file_name)}</label>)}</fieldset>}
    <button className="area-btn" disabled={busy||!policy?.enabled||!policy?.configured} onClick={()=>void prepare()}>{busy&&!preview?'Preparando informações…':'Preparar informações do curso'}</button>
    {preview&&<section className="doc-review"><h4>Selecione as informações para análise</h4><p>Marque somente o necessário. Você pode reduzir cada trecho a uma passagem contínua do original. Remova da seleção os trechos com nomes, dados pessoais ou segredos. Esta prévia ainda não foi enviada à OpenAI.</p>
      {preview.unsupported.map(f=><p key={f.file_id} role="status">{f.message}</p>)}
      <div className="doc-source-grid">{preview.chunks.map(c=><fieldset className="doc-source-card" key={c.id} disabled={busy||sent}><legend>{c.file_name}</legend><label><input type="checkbox" checked={Object.hasOwn(texts,c.id)} disabled={!Object.hasOwn(texts,c.id)&&Object.keys(texts).length>=12} onChange={e=>{setConfirmed(false);setTexts(old=>{const next={...old};if(e.target.checked)next[c.id]=c.text;else delete next[c.id];return next;});}}/> Incluir na análise</label>{c.sensitive_findings.length>0&&<p role="alert" className="area-error">Revise possíveis dados pessoais ou segredos antes de incluir.</p>}<SourcePreview text={texts[c.id]??c.text} management={c.id.startsWith('gestao_')}/><details className="doc-edit"><summary>Conferir trecho original{Object.hasOwn(texts,c.id)?' ou reduzir o envio':''}</summary>{Object.hasOwn(texts,c.id)?<><p>Para enviar menos informações, mantenha apenas uma passagem contínua do texto original.</p><textarea aria-label={`Trecho de ${c.file_name}`} rows={7} value={texts[c.id]} onChange={e=>{setConfirmed(false);setTexts(t=>({...t,[c.id]:e.target.value}));}}/></>:<pre>{c.text}</pre>}</details></fieldset>)}</div>
      {invalid&&<p role="alert">Use até 12 trechos, 4.000 caracteres por trecho e 24.000 no total. O texto deve ser uma passagem contínua da fonte.</p>}
      <div className="doc-confirm"><p className="doc-selection-count" role="status">{selections.length} de 12 informações selecionadas</p><label style={{display:'block',margin:'16px 0'}}><input type="checkbox" disabled={busy||sent} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Revisei os registros de gestão e trechos, minimizei dados pessoais e autorizo o envio à OpenAI para esta análise. O uso pode gerar cobrança.</label>
      <button className="area-btn" disabled={busy||sent||!confirmed||!selections.length||invalid} onClick={()=>void analyze()}>{busy?'Analisando informações…':'Gerar relatório de análise'}</button></div>
      {sent&&!result&&!busy&&<p>A tentativa foi encerrada. Confira o erro antes de iniciar outra solicitação.</p>}
    </section>}
    {result&&<DocumentReport data={result.result} course={courseName} sources={preview?.chunks??[]} analysisId={result.analysis_id} date={completedAt}/>}
  </div>;
}
