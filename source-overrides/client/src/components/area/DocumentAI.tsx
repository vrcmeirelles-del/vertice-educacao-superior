import {useEffect, useMemo, useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Row} from '@/lib/area';

type Chunk={id:string;file_id:string;file_name:string;text:string;sensitive_findings:string[]};
type Preview={preview_digest:string;chunks:Chunk[];unsupported:{file_id:string;message:string}[]};
type Policy={configured:boolean;enabled:boolean;model:string|null;actor_daily_limit:number;institution_daily_limit:number};
type Result={analysis_id:string;result:{summary:string;facts:{text:string;source_ids:string[];quotes:{source_id:string;excerpt:string}[]}[];gaps:{text:string}[];recommendations:{text:string}[];limitations:string[];disclaimer:string}};
const errors:Record<string,string>={authentication_required:'Entre novamente para continuar.',access_denied:'Acesso não autorizado. Confira sua sessão, segundo fator e vínculo com o curso.',quota_exceeded:'Limite diário atingido. Tente em outro dia.',analysis_not_configured:'A análise ainda não está habilitada para esta instituição.',preview_changed_or_unconfirmed:'O documento mudou. Prepare e revise os trechos novamente.',sensitive_input:'Há possíveis dados pessoais ou segredos. Reduza os trechos antes de continuar.',already_requested:'Esta solicitação já foi registrada. Não repita o envio.',provider_unavailable:'O provedor não concluiu a análise. Não repita o envio automaticamente.',timeout:'A análise excedeu o tempo limite. Não repita o envio automaticamente.'};
async function invoke(body:Record<string,unknown>){
  const {data,error}=await supabase.functions.invoke('vertice-ai-review',{body});
  if(error){let code='';try{code=(await error.context?.json())?.error??'';}catch{}throw new Error(errors[code]??'Não foi possível concluir a operação. Confira sua sessão e tente novamente mais tarde.');}
  if(data?.error)throw new Error(errors[data.error]??'A análise não foi concluída.');
  return data;
}
export default function DocumentAI({institutionId,courses,requests,files}:{institutionId:string;courses:Row[];requests:Row[];files:Row[]}){
  const [course,setCourse]=useState('');
  return <section className="area-panel" aria-label="Análise documental com IA">
    <h3>Andamento do curso · metas e indicadores INEP/MEC</h3>
    <p>Apoio à alta gestão com metas, medições, prazos, ações e situação das evidências por indicador e semestre. Revise os registros antes de enviar à OpenAI. A análise aponta avanços, lacunas e prioridades; não valida documentos nem atribui conceito INEP/MEC.</p>
    <label>Curso para análise <select value={course} onChange={e=>setCourse(e.target.value)}><option value="">Selecione um curso</option>{courses.map(c=><option key={c.id} value={c.id}>{String(c.name)}{c.code?` · ${c.code}`:''}</option>)}</select></label>
    {course&&<Review key={`${institutionId}:${course}`} institutionId={institutionId} courseId={course} requests={requests} files={files}/>}
  </section>;
}
function Review({institutionId,courseId,requests,files}:{institutionId:string;courseId:string;requests:Row[];files:Row[]}){
  const [policy,setPolicy]=useState<Policy|null>(null),[selected,setSelected]=useState<string[]>([]),[preview,setPreview]=useState<Preview|null>(null),[texts,setTexts]=useState<Record<string,string>>({}),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null),[sent,setSent]=useState(false);
  const scope={institution_id:institutionId,course_id:courseId};
  const documents=useMemo(()=>{const ids=new Set(requests.filter(r=>r.institution_id===institutionId&&r.course_id===courseId).map(r=>r.id));return files.filter(f=>f.institution_id===institutionId&&ids.has(String(f.request_id)));},[requests,files,institutionId,courseId]);
  const compatible=documents.filter(f=>/\.(txt|csv)$/i.test(String(f.file_name)));
  useEffect(()=>{let active=true;invoke({action:'status',institution_id:institutionId,course_id:courseId}).then(p=>{if(active)setPolicy(p);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[institutionId,courseId]);
  const reset=()=>{setPreview(null);setTexts({});setConfirmed(false);setResult(null);setSent(false);setError('');};
  async function prepare(){setBusy(true);reset();try{setPreview(await invoke({...scope,action:'preview',file_ids:selected}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const selections=preview?.chunks.filter(c=>(texts[c.id]??'').trim().length>=10).map(c=>({id:c.id,text:texts[c.id]}))??[];
  const invalid=selections.length>12||selections.reduce((n,s)=>n+s.text.length,0)>24000||selections.some(s=>s.text.length>4000||!preview?.chunks.find(c=>c.id===s.id)?.text.includes(s.text));
  async function analyze(){if(!preview||!confirmed||!selections.length||invalid||sent)return;setBusy(true);setSent(true);setError('');try{setResult(await invoke({...scope,action:'analyze',file_ids:selected,preview_digest:preview.preview_digest,selections,privacy_confirmed:true}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div aria-busy={busy}>
    {error&&<p role="alert" className="area-error">{error}</p>}
    {!policy&&!error&&<p role="status">Verificando disponibilidade…</p>}
    {policy&&<p role="status">{policy.configured&&policy.enabled?'IA disponível para este curso.':'IA ainda não habilitada para esta instituição.'} {policy.enabled&&<>Limites: {policy.actor_daily_limit} análises por pessoa e {policy.institution_daily_limit} por instituição ao dia.</>}</p>}
    <p>As metas, medições e situações documentais cadastradas no curso podem ser analisadas sem anexar arquivos. Para acrescentar conteúdo documental: TXT e CSV em UTF-8, até 3 arquivos de 5 MB. PDF, Word e planilhas precisam de extração de texto ainda não disponível. Os arquivos permanecem no repositório; somente os trechos que você revisar serão enviados à OpenAI.</p>
    {!compatible.length?<p>Nenhum TXT ou CSV neste curso. Você pode preparar a análise dos registros de gestão abaixo, mesmo sem arquivos compatíveis.</p>:<fieldset disabled={busy||sent}><legend>1. Escolha os documentos</legend>{compatible.map(f=><label key={f.id} style={{display:'block',margin:'8px 0'}}><input type="checkbox" checked={selected.includes(f.id)} disabled={!selected.includes(f.id)&&selected.length>=3} onChange={e=>{reset();setSelected(s=>e.target.checked?[...s,f.id]:s.filter(id=>id!==f.id));}}/> {String(f.file_name)}</label>)}</fieldset>}
    <button className="area-btn" disabled={busy||!policy?.enabled||!policy?.configured} onClick={()=>void prepare()}>Preparar metas e evidências para análise</button>
    {preview&&<section><h4>2. Revise metas, indicadores e trechos</h4><p>Marque somente o necessário. Você pode reduzir cada trecho a uma passagem contínua do original. Remova da seleção os trechos com nomes, dados pessoais ou segredos. Esta prévia ainda não foi enviada à OpenAI.</p>
      {preview.unsupported.map(f=><p key={f.file_id} role="status">{f.message}</p>)}
      {preview.chunks.map(c=><fieldset key={c.id} disabled={busy||sent}><legend>{c.file_name}</legend><label><input type="checkbox" checked={Object.hasOwn(texts,c.id)} onChange={e=>{setConfirmed(false);setTexts(old=>{const next={...old};if(e.target.checked)next[c.id]=c.text;else delete next[c.id];return next;});}}/> Incluir este trecho</label>{c.sensitive_findings.length>0&&<p role="alert">Possíveis dados pessoais ou segredos detectados. Revise antes de incluir.</p>}{Object.hasOwn(texts,c.id)?<textarea aria-label={`Trecho de ${c.file_name}`} rows={7} style={{width:'100%'}} value={texts[c.id]} onChange={e=>{setConfirmed(false);setTexts(t=>({...t,[c.id]:e.target.value}));}}/>:<pre style={{whiteSpace:'pre-wrap',maxHeight:220,overflow:'auto'}}>{c.text}</pre>}</fieldset>)}
      {invalid&&<p role="alert">Use até 12 trechos, 4.000 caracteres por trecho e 24.000 no total. O texto deve ser uma passagem contínua da fonte.</p>}
      <label style={{display:'block',margin:'16px 0'}}><input type="checkbox" disabled={busy||sent} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Revisei os registros de gestão e trechos, minimizei dados pessoais e autorizo o envio à OpenAI para esta análise. O uso pode gerar cobrança.</label>
      <button className="area-btn" disabled={busy||sent||!confirmed||!selections.length||invalid} onClick={()=>void analyze()}>{busy?'Processando…':'Enviar trechos e analisar'}</button>
      {sent&&!result&&!busy&&<p>A tentativa foi encerrada. Confira o erro antes de iniciar outra solicitação.</p>}
    </section>}
    {result&&<section aria-label="Resultado da análise por IA"><h4>3. Devolutiva para revisão humana</h4><p>{result.result.summary}</p><h5>Andamento registrado e fontes</h5>{result.result.facts.map((f,i)=><div key={i}><p>{f.text}</p>{f.quotes.map((q,j)=><blockquote key={j}>{q.excerpt}<small style={{display:'block'}}>Fonte: {preview?.chunks.find(c=>c.id===q.source_id)?.file_name??q.source_id}</small></blockquote>)}</div>)}<h5>Lacunas nos trechos</h5><ul>{result.result.gaps.map((g,i)=><li key={i}>{g.text}</li>)}</ul><h5>Prioridades e próximos passos da alta gestão</h5><ul>{result.result.recommendations.map((g,i)=><li key={i}>{g.text}</li>)}</ul><h5>Limitações</h5><ul>{result.result.limitations.map((l,i)=><li key={i}>{l}</li>)}</ul><p>{result.result.disclaimer}</p><p>Registro de auditoria: {result.analysis_id}. Nenhuma meta ou validação documental foi alterada.</p></section>}
  </div>;
}
