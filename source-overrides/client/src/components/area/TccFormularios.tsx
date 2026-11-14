import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TEMPLATES, validateAnswers, sectionsFor, meanGrade, type Answers, type Template } from '@/lib/tcc-forms/schema';
import type { TccWork } from '@/lib/tcc';
import './extensao360.css';
import { sha256, type Attachment } from '@/lib/extension-forms/pdf';
interface FormRecord {
 id: string; institution_id: string; work_id: string; course_id: string; template: Template;
 answers: Answers; attachments: Attachment[]; revision: number; owner_id: string;
 status: 'rascunho'|'gerado'; document_id: string|null; repository_request_id?: string; completed_at: string|null;
}
const BUCKET='vertice-documents';
const KINDS=['Manuscrito / projeto','Documento assinado','Ficha de orientação','Ata / avaliação','Autorização','Comprovante de depósito','Outro'];
export default function TccFormularios({institutionId,role,courses,works,onChanged}: {
 institutionId: string; role: string; works: TccWork[]; courses: {id:string;name:string}[]; onChanged:()=>void;
}) {
 const [records,setRecords]=useState<FormRecord[]>([]);
 const [current,setCurrent]=useState<FormRecord|null>(null);
 const [userId,setUserId]=useState('');
 const [author,setAuthor]=useState('');
 const [institutionName,setInstitutionName]=useState('');
 const [section,setSection]=useState(0);
 const [kind,setKind]=useState(KINDS[0]);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [dirty,setDirty]=useState(false);
 const [message,setMessage]=useState('');
 const [errors,setErrors]=useState<string[]>([]);
 const SECTIONS=sectionsFor(current?.template || 'projeto');
 const manager=['master','gestor'].includes(role);
 const writer=manager||role==='equipe';
 const editable=!!current&&writer&&(manager||current.owner_id===userId)&&current.status==='rascunho';
 async function reload(){
  const r=await supabase.from('vertice_tcc_forms').select('*').eq('institution_id',institutionId).order('updated_at',{ascending:false});
  if(r.error)throw r.error;setRecords(r.data||[]);
 }
 useEffect(()=>{let active=true;
  (async()=>{
   try{
    const [r,u,i]=await Promise.all([
     supabase.from('vertice_tcc_forms').select('*').eq('institution_id',institutionId).order('updated_at',{ascending:false}),
     supabase.auth.getUser(),supabase.from('vertice_institutions').select('name').eq('id',institutionId).single()]);
    if(!active)return;if(r.error)throw r.error;if(i.error)throw i.error;if(u.error)throw u.error;
    setRecords(r.data||[]);setUserId(u.data.user?.id||'');setAuthor(u.data.user?.email||'');setInstitutionName(i.data.name);
   }catch(e){if(active)setErrors([(e as Error).message]);}finally{if(active)setLoading(false);}
  })();return()=>{active=false;};
 },[institutionId]);
 useEffect(()=>{if(!dirty)return;const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>window.removeEventListener('beforeunload',stop);},[dirty]);
 function open(f:FormRecord|null){if(dirty&&!confirm('Há alterações não salvas. Deseja descartá-las?'))return;setCurrent(f);setDirty(false);setSection(0);setErrors([]);setMessage('');}
 function start(){open({id:crypto.randomUUID(),institution_id:institutionId,work_id:'',course_id:'',template:'projeto',answers:{date:new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'})},attachments:[],revision:0,owner_id:userId,status:'rascunho',document_id:null,completed_at:null});}
 async function chooseWork(workId:string){
  const w=works.find(w=>w.id===workId);if(!current||!w)return;
  setBusy(true);setErrors([]);
  try{
   const r=await supabase.from('vertice_tcc_participants').select('person_name,enrollment_id,role').eq('work_id',w.id).eq('institution_id',institutionId).is('valid_until',null);if(r.error)throw r.error;
   const participants=r.data||[];
   setCurrent({...current,work_id:w.id,course_id:w.course_id,answers:{date:new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}),title:w.title,semester:w.academic_term,authors:participants.filter(p=>p.role==='author').map(p=>p.person_name+(p.enrollment_id?' — '+p.enrollment_id:'')).join('\n'),advisor:participants.find(p=>p.role==='advisor')?.person_name||'',coadvisor:participants.find(p=>p.role==='coadvisor')?.person_name||'',problem:w.problem_statement||'',justification:w.justification||'',general_objective:w.general_objective||'',specific_objectives:(w.specific_objectives||[]).join('\n'),methodology:w.methodology||'',abstract:w.abstract||'',keywords:(w.keywords||[]).join('; ')}});setDirty(true);
  }catch(e){setErrors([(e as Error).message]);}finally{setBusy(false);}
 }
 function answer(key:string,value:string){if(!current)return;setCurrent({...current,answers:{...current.answers,[key]:value}});setDirty(true);}
 async function save(f:FormRecord):Promise<FormRecord>{
  const problems=validateAnswers(f.answers,false,f.template);if(!f.work_id)problems.push('Selecione o trabalho de TCC.');
  if(problems.length)throw new Error(problems.join('\n'));
  const {data,error}=await supabase.rpc('vertice_tcc_form_save',{p_id:f.id,p_institution:institutionId,p_work:f.work_id,p_template:f.template,p_answers:f.answers,p_attachments:f.attachments,p_revision:f.revision});
  if(error)throw error;const record=(Array.isArray(data)?data[0]:data) as FormRecord;
  if(!record?.id)throw new Error('O banco não confirmou o salvamento do formulário.');
  setCurrent(record);setDirty(false);await reload();onChanged();return record;
 }
 async function saveDraft(){if(!current)return;setBusy(true);setErrors([]);setMessage('');try{await save(current);setMessage('Rascunho salvo. Você pode continuar depois.');}catch(e){setErrors([(e as Error).message]);}finally{setBusy(false);}}
 async function upload(file:File){
  if(!current)return;setBusy(true);setErrors([]);setMessage('');
  try{
   const ext=file.name.split('.').pop()?.toLowerCase();
   const mime=ext==='pdf'?'application/pdf':ext==='png'?'image/png':['jpg','jpeg'].includes(ext||'')?'image/jpeg':'';
   if(!mime||!file.size||file.size>5*1024*1024)throw new Error('Use PDF, PNG ou JPG, de até 5 MB por arquivo.');
   if(current.attachments.length>=20||current.attachments.reduce((s,a)=>s+a.size,0)+file.size>20*1024*1024)throw new Error('Limite: 20 anexos, somando até 20 MB.');
   const saved=dirty||current.revision===0?await save(current):current;
   const bytes=new Uint8Array(await file.arrayBuffer());
   const hash=await sha256(bytes);
   if(saved.attachments.some(a=>a.sha256===hash))throw new Error('Este arquivo já está anexado.');
   // Validate content before accepting it into a draft.
   const {PDFDocument}=await import('pdf-lib');
   if(mime==='application/pdf'){const p=await PDFDocument.load(bytes);if(!p.getPageCount())throw new Error('PDF sem páginas.');}
   else {const p=await PDFDocument.create();if(mime==='image/png')await p.embedPng(bytes);else await p.embedJpg(bytes);}
   const id=crypto.randomUUID(),name=file.name.replace(/[\x00-\x1f]/g,'');
   const path=`${institutionId}/tcc/${saved.id}/${id}.${ext}`;
   const {error}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:mime,upsert:false});if(error)throw error;
   // A failed registry save leaves a recoverable draft; never report upload success alone.
   const next={...saved,attachments:[...saved.attachments,{id,name,kind,path,size:file.size,mime,sha256:hash}]};
   setCurrent(next);setDirty(true);await save(next);setMessage('Comprovante anexado e salvo.');
  }catch(e){setErrors([(e as Error).message]);}finally{setBusy(false);}
 }
 async function viewDocument(f:FormRecord){
  setBusy(true);setErrors([]);
  try{
   const d=await supabase.from('vertice_documents').select('storage_path').eq('id',f.document_id!).eq('institution_id',institutionId).single();if(d.error)throw d.error;
   const r=await supabase.storage.from(BUCKET).createSignedUrl(d.data.storage_path,300);if(r.error)throw r.error;
   const a=document.createElement('a');a.href=r.data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';a.click();
  }catch(e){setErrors([(e as Error).message]);}finally{setBusy(false);}
 }
 async function complete(){
  if(!current)return;
  const problems=validateAnswers(current.answers,true,current.template);
  if(['final','dossie'].includes(current.template)&&!current.attachments.length)problems.push('Anexe o manuscrito ou documento original para este modelo.');
  if(problems.length){setErrors(problems);return;}
  if(!confirm('Emitir a minuta em PDF e arquivar na Mesa Digital? O documento gerado será preservado para consulta; assinatura e validação são etapas próprias.'))return;
  setBusy(true);setErrors([]);setMessage('Salvando e preparando o PDF com os anexos…');
  try{
   const saved=await save(current);
   const answersForPdf=saved.template==='ata'?{...saved.answers,calculated_mean:meanGrade(saved.answers)}:saved.answers;
   const {buildDossier}=await import('@/lib/extension-forms/pdf');
   const bytes=await buildDossier({id:saved.id,template:saved.template,answers:answersForPdf,courseName:courses.find(c=>c.id===saved.course_id)?.name||'',institutionName,revision:saved.revision,author,generatedAt:new Date().toISOString(),attachments:saved.attachments},async a=>{
    const r=await supabase.storage.from(BUCKET).download(a.path);if(r.error)throw new Error(`Não foi possível ler ${a.name}: ${r.error.message}`);return new Uint8Array(await r.data.arrayBuffer());
   },{brand:'VÉRTICE | TCC E PRODUÇÃO ACADÊMICA 360',heading:'MINUTA DOCUMENTAL DE TCC',templateLabel:TEMPLATES[saved.template].label,notice:'Documento gerado a partir de informações declaradas. Assinatura e validação institucional não verificadas. '+TEMPLATES[saved.template].note,sections:saved.template==='ata'?[...sectionsFor(saved.template),{title:'Conferência numérica',fields:[{key:'calculated_mean',label:'Média aritmética simples das notas preenchidas (sem lançamento acadêmico)'}]}]:sectionsFor(saved.template),subject:TEMPLATES[saved.template].label});
   if(bytes.length>30*1024*1024)throw new Error('O dossiê ultrapassa 30 MB. Reduza o tamanho dos anexos antes de emitir.');
   const path=`${institutionId}/tcc/${saved.id}/documento-${crypto.randomUUID()}.pdf`;
   const hash=await sha256(bytes);
   const u=await supabase.storage.from(BUCKET).upload(path,new Blob([new Uint8Array(bytes).buffer],{type:'application/pdf'}),{contentType:'application/pdf',upsert:false});if(u.error)throw u.error;
   const repositoryFileId=crypto.randomUUID();
   const repositoryPath=`${institutionId}/${saved.repository_request_id}/${repositoryFileId}.pdf`;
   const copy=await supabase.storage.from('vertice-repositorios').upload(repositoryPath,new Blob([new Uint8Array(bytes).buffer],{type:'application/pdf'}),{contentType:'application/pdf',upsert:false});if(copy.error)throw copy.error;
   const r=await supabase.rpc('vertice_tcc_form_save',{p_id:saved.id,p_institution:institutionId,p_work:saved.work_id,p_template:saved.template,p_answers:saved.answers,p_attachments:saved.attachments,p_revision:saved.revision,p_pdf:{path,repository_path:repositoryPath,repository_file_id:repositoryFileId,size:bytes.length,sha256:hash}});
   if(r.error)throw r.error;
   const completed=(Array.isArray(r.data)?r.data[0]:r.data) as FormRecord;
   if(completed?.status!=='gerado')throw new Error('O banco não confirmou a emissão.');
   setCurrent(completed);setDirty(false);await reload();onChanged();
   setMessage('Minuta em PDF e originais arquivados, vinculados ao TCC e ao curso. Assinatura e validação institucional pendentes.');
   // Submit all new documents to the existing pre-analysis pipeline; failure is explicit.
   const docs=await supabase.from('vertice_documents').select('id').eq('institution_id',institutionId).eq('linked_entity_id',saved.work_id).like('description','%Protocolo '+saved.id+'%').eq('ai_status','pending');
   if(docs.error)throw new Error('PDF arquivado. Não foi possível consultar a fila de pré-análise: '+docs.error.message);
   const results=await Promise.all((docs.data||[]).map(d=>supabase.functions.invoke('vertice-doc-analyze',{body:{document_id:d.id}})));
   if(results.some(r=>r.error))setMessage('PDF e originais arquivados. A pré-análise de IA apresentou pendência; consulte a Mesa Digital. A validação institucional continua pendente.');
  }catch(e){setErrors([(e as Error).message]);setMessage('Confira o estado do documento antes de repetir. A emissão só é confirmada após o registro na Mesa Digital.');}finally{setBusy(false);}
 }
 if(loading)return <p role="status">Carregando formulários…</p>;
 return <div className="ext-section">
  <h3>Modelos e documentos de TCC</h3>
  <p>Selecione um TCC cadastrado, preencha o modelo e emita a minuta em PDF no repositório do curso. Documentos gerados não alteram notas, etapas ou permissões de publicação do trabalho.</p>
  {message&&<p role="status" className="ext-info">{message}</p>}
  {errors.length>0&&<div role="alert" style={{color:'#991b1b',whiteSpace:'pre-wrap'}}><ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}
  {!current?<>
   {writer&&<button className="ext-btn-primary" disabled={busy} onClick={start}>Novo documento por modelo</button>}
   {!works.length&&<p>Cadastre o trabalho na Carteira / Projetos do TCC 360 antes de emitir documentos.</p>}
   {!records.length&&<p>Nenhum formulário cadastrado.</p>}
   <div style={{display:'grid',gap:12,marginTop:16}}>{records.map(f=><div key={f.id} className="ext-project-card">
    <h4>{TEMPLATES[f.template].label}</h4><p>{f.answers.title}</p><p>{TEMPLATES[f.template].label} · {f.status==='gerado'?'Minuta gerada · PDF arquivado':'Rascunho'} · Revisão {f.revision}</p>
    <button className="ext-btn-secondary" disabled={busy} onClick={()=>open(f)}>Abrir formulário</button>
    {writer&&f.status==='gerado'&&<button className="ext-btn-secondary" disabled={busy} onClick={()=>open({...f,id:crypto.randomUUID(),owner_id:userId,revision:0,status:'rascunho',document_id:null,repository_request_id:undefined,completed_at:null,attachments:[],answers:{...f.answers,previous_protocol:f.id}})}>Nova emissão / anexar versão assinada</button>}
    {f.document_id&&<button className="ext-btn-primary" disabled={busy} onClick={()=>viewDocument(f)}>Abrir PDF arquivado</button>}
   </div>)}</div>
  </>:<>
   <button className="ext-btn-cancel" disabled={busy} onClick={()=>open(null)}>Voltar à lista</button>
   <p><strong>{current.status==='gerado'?'Minuta gerada e preservada':'Rascunho'} · {current.revision===0?'Ainda não salvo':`Revisão ${current.revision}`}{dirty?' · Alterações não salvas':''}</strong></p>
   <fieldset disabled={busy||!editable} style={{border:0,padding:0}}>
    <div className="ext-form-grid">
     <label>Modelo<select value={current.template} onChange={e=>{setCurrent({...current,template:e.target.value as Template});setDirty(true);}}>{Object.entries(TEMPLATES).map(([k,t])=><option key={k} value={k}>{t.label}</option>)}</select></label>
     <label>Trabalho de referência<select disabled={current.revision>0} value={current.work_id} onChange={e=>void chooseWork(e.target.value)}><option value="">Selecione o TCC cadastrado</option>{works.map(w=><option key={w.id} value={w.id}>{w.title} · {courses.find(c=>c.id===w.course_id)?.name}</option>)}</select></label>
    </div>
   </fieldset>
   <p style={{fontSize:12,color:'#64748b'}}>{TEMPLATES[current.template].source}. {TEMPLATES[current.template].note} Campos obrigatórios conferidos ao emitir. A minuta gerada não equivale a documento assinado.</p>
   {current.template==='ata'&&meanGrade(current.answers)&&<p>Média aritmética simples das notas preenchidas: <strong>{meanGrade(current.answers)}</strong>. Aplicar o regulamento institucional; nenhuma nota é lançada automaticamente.</p>}
   <nav aria-label="Etapas do formulário" style={{display:'flex',gap:6,flexWrap:'wrap',margin:'16px 0'}}>{SECTIONS.map((s,i)=><button type="button" key={s.title} className={section===i?'ext-btn-primary':'ext-btn-secondary'} onClick={()=>setSection(i)}>{i+1}. {s.title}</button>)}<button className={section===SECTIONS.length?'ext-btn-primary':'ext-btn-secondary'} onClick={()=>setSection(SECTIONS.length)}>Anexos e emissão</button></nav>
   {section<SECTIONS.length?<fieldset className="ext-form" disabled={busy||!editable}>
    <legend>{SECTIONS[section].title}</legend>
    <div className="ext-form-grid">{SECTIONS[section].fields.map(f=><label key={f.key} style={f.type==='textarea'?{gridColumn:'1 / -1'}:{}}>{f.label}{f.required?' *':''}
     {f.type==='select'?<select value={current.answers[f.key]||''} onChange={e=>answer(f.key,e.target.value)}><option value="">Selecione</option>{f.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>:f.type==='textarea'?<textarea rows={4} value={current.answers[f.key]||''} onChange={e=>answer(f.key,e.target.value)}/>:<input readOnly={f.readonly} type={f.type||'text'} min={f.type==='number'?f.min:undefined} max={f.type==='number'?f.max:undefined} step={f.type==='number'?'any':undefined} value={current.answers[f.key]??''} onChange={e=>answer(f.key,e.target.value)}/>}
    </label>)}</div>
   </fieldset>:<div className="ext-form">
    <h4>Arquivos e assinatura</h4><p>PDF, JPG ou PNG. Até 5 MB por arquivo; no máximo 20 anexos e 20 MB no total. Anexe o manuscrito, documentos assinados e demais evidências aplicáveis. A assinatura dos originais deve ser conferida separadamente.</p>
    {editable&&<fieldset disabled={busy} style={{border:0}}><label>Tipo do comprovante<select value={kind} onChange={e=>setKind(e.target.value)}>{KINDS.map(k=><option key={k}>{k}</option>)}</select></label><label>Adicionar arquivo<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file);}}/></label></fieldset>}
    {current.attachments.map(a=><p key={a.id}>{a.kind}: {a.name} ({(a.size/1024).toFixed(0)} KB) {editable&&<button type="button" disabled={busy} onClick={()=>{setCurrent({...current,attachments:current.attachments.filter(x=>x.id!==a.id)});setDirty(true);}}>Remover do rascunho</button>}</p>)}
    <p>{TEMPLATES[current.template].fields.filter(f=>f.required&&current.answers[f.key]?.trim()).length}/{TEMPLATES[current.template].fields.filter(f=>f.required).length} campos obrigatórios preenchidos.</p>
    {editable&&<button className="ext-btn-primary" disabled={busy} onClick={complete}>{busy?'Processando…':'Emitir PDF na Mesa Digital'}</button>}
    {current.document_id&&<button className="ext-btn-primary" disabled={busy} onClick={()=>viewDocument(current)}>Abrir PDF arquivado</button>}
   </div>}
   <div className="ext-form-actions" style={{position:'sticky',bottom:0,background:'#fff',padding:12,borderTop:'1px solid #e2e8f0'}}>
    {editable&&<button className="ext-btn-save" disabled={busy} onClick={saveDraft}>{busy?'Salvando…':'Salvar rascunho'}</button>}
    <button className="ext-btn-secondary" disabled={section===0} onClick={()=>setSection(s=>s-1)}>Anterior</button>
    <button className="ext-btn-secondary" disabled={section===SECTIONS.length} onClick={()=>setSection(s=>s+1)}>Próxima etapa</button>
   </div>
  </>}
 </div>;
}
