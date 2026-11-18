import ExtensaoAlunosConvites from './ExtensaoAlunosConvites';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ALL_FIELDS, SECTIONS, TEMPLATES, validateAnswers, fieldsForTemplate, type Answers, type Template } from '@/lib/extension-forms/schema';
import { documentSuggestions, fillEmpty, ODS_NAMES, PLANNED_FIELD, projectAnswers, type ProjectSource } from '@/lib/extension-forms/project-data';
import { sha256, type Attachment } from '@/lib/extension-forms/pdf';
interface FormRecord {
 id: string; institution_id: string; project_id: string; course_id: string; template: Template;
 answers: Answers; attachments: Attachment[]; revision: number; owner_id: string;
 status: 'rascunho'|'concluido'; document_id: string|null; repository_request_id?: string; completed_at: string|null;
}
type SourceDocument={id:string;title:string;file_name:string|null;extracted_text:string|null;course_id?:string|null};
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const displayValue=(value:string|undefined,currency=false)=>value?.trim()?(currency&&Number.isFinite(Number(value))?money.format(Number(value)):value):'Em aberto';
const BUCKET='vertice-documents';
const KINDS=['Programação','Registro fotográfico','Lista de presença','Clipagem','Peça gráfica','Termo de parceria','Recibo de doação','Avaliação da comunidade','Outro'];
export default function ExtensaoFormularios({institutionId,role,courses,onChanged,projects=[],targetId,startWithInvites,evidenceRevision,onBack}: {
 institutionId: string; role: string; courses: {id:string;name:string}[]; onChanged:()=>void; projects?:ProjectSource[]; targetId?:string; startWithInvites?:boolean; evidenceRevision?:number; onBack?:()=>void;
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
 const [evidence,setEvidence]=useState<{id:string;title:string;uploaded_at:string;version:number}[]>([]);
 const [sources,setSources]=useState<SourceDocument[]>([]);
 const [ppcDocs,setPpcDocs]=useState<SourceDocument[]>([]);
 const [link,setLink]=useState({url:'',description:'',date:''});
 const [projectRecordReady,setProjectRecordReady]=useState(false);
 const [errors,setErrors]=useState<string[]>([]);
 const project=projects.find(p=>p.id===(current?.project_id||targetId));
 const origin=project?projectAnswers(project):{};
 const manager=['master','gestor'].includes(role);
 const writer=manager||role==='equipe';
 const editable=!!current&&writer&&(manager||current.owner_id===userId)&&current.status==='rascunho'&&!project?.deleted_at;
 async function reload(){
  const r=await supabase.from('vertice_extension_forms').select('*').eq('institution_id',institutionId).order('updated_at',{ascending:false});
  if(r.error)throw r.error;setRecords(r.data||[]);
 }
 useEffect(()=>{let active=true;
  (async()=>{
   try{
    const [r,u,i]=await Promise.all([
     supabase.from('vertice_extension_forms').select('*').eq('institution_id',institutionId).order('updated_at',{ascending:false}),
     supabase.auth.getUser(),supabase.from('vertice_institutions').select('name').eq('id',institutionId).single()]);
    if(!active)return;if(r.error)throw r.error;if(i.error)throw i.error;if(u.error)throw u.error;
    setRecords(r.data||[]);setUserId(u.data.user?.id||'');setAuthor(u.data.user?.email||'');setInstitutionName(i.data.name);
   }catch(e){if(active)setErrors([(e as Error).message]);}finally{if(active)setLoading(false);}
  })();return()=>{active=false;};
 },[institutionId]);
 useEffect(()=>{
  if(loading||!targetId||projectRecordReady||!project||errors.length)return;
  const saved=records.find(r=>r.project_id===targetId);
  setCurrent(saved||{id:targetId,institution_id:institutionId,project_id:targetId,
   course_id:project.course_ids?.[0]||'',template:'extensao',answers:projectAnswers(project),attachments:[],
   revision:0,owner_id:project.owner_id||userId,status:'rascunho',document_id:null,completed_at:null});
  setSection(startWithInvites&&(!saved||saved.status==='rascunho')?SECTIONS.length+1:3);
  setProjectRecordReady(true);
 },[loading,targetId,projectRecordReady,project,records,institutionId,userId,errors.length,startWithInvites]);
 const projectId=current?.project_id;
 useEffect(()=>{
  setEvidence([]);setSources([]);
  if(!projectId)return;
  let active=true;
  void (async()=>Promise.all([
   supabase.from('vertice_extension_project_evidence').select('id,title,uploaded_at,version').eq('institution_id',institutionId).eq('target_project_id',projectId),
   supabase.from('vertice_documents').select('id,title,file_name,extracted_text').eq('institution_id',institutionId).eq('linked_entity_id',projectId).limit(25),
  ]))().then(([ev,docs])=>{if(active){setEvidence(ev.data||[]);setSources(docs.data||[]);}}).catch(()=>{if(active){setEvidence([]);setSources([]);}});
  return()=>{active=false;};
 },[institutionId,projectId,evidenceRevision]);
 const ppcCourseIds=(project?.course_ids?.length ? project.course_ids : current?.course_id?[current.course_id]:[]).join(',');
 useEffect(()=>{
  setPpcDocs([]);
  if(section!==1||!ppcCourseIds)return;
  let active=true;
  void (async()=>{
   const result=await supabase.from('vertice_documents').select('id,title,file_name,extracted_text,course_id')
    .eq('institution_id',institutionId).in('course_id',ppcCourseIds.split(','))
    .or('title.ilike.%PPC%,title.ilike.%projeto pedagógico%,file_name.ilike.%PPC%').limit(30);
   if(active&&!result.error)setPpcDocs(result.data||[]);
  })().catch(()=>{if(active)setPpcDocs([]);});
  return()=>{active=false;};
 },[institutionId,ppcCourseIds,section]);
 useEffect(()=>{if(!dirty)return;const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>window.removeEventListener('beforeunload',stop);},[dirty]);
 function open(f:FormRecord|null){if(dirty&&!confirm('Há alterações não salvas. Deseja descartá-las?'))return;setCurrent(f);setDirty(false);setSection(0);setErrors([]);setMessage('');}
 function start(){open({id:crypto.randomUUID(),institution_id:institutionId,project_id:'',course_id:'',template:'extensao',answers:{email:author},attachments:[],revision:0,owner_id:userId,status:'rascunho',document_id:null,completed_at:null});}
 const showInvites=!!project&&editable;
 const lastSection=SECTIONS.length+(showInvites?1:0);
 const fields= current ? fieldsForTemplate(SECTIONS[Math.min(section,SECTIONS.length-1)].fields,current.template):[];
 const selectedEvidence=(current?.answers.evidence_ids||'').split(',').filter(Boolean);
 const evidenceLinks=(current?.answers.evidence_links||'').trim();
 function reuse(){
  if(!current)return;
  const next=fillEmpty(current.answers,origin,fields.map(f=>f.key));
  if(!next.added.length){setMessage('Nenhum campo vazio com dado equivalente nesta etapa.');return;}
  const provenance=Object.fromEntries(next.added.map(key=>[`source_${key}`,'Prevista · cadastro do projeto']));
  setCurrent({...current,answers:{...next.answers,...provenance}});setDirty(true);
  setMessage('Origem: cadastro do projeto. Revise os campos preenchidos antes de salvar.');
 }
 function useSource(key:string,value:string,source:string){
  if(!current)return;
  const previous=current.answers[key]?.trim();
  const label=ALL_FIELDS.find(f=>f.key===key)?.label||key;
  if(!confirm(`${label}\n\nAtual: ${previous||'Em branco'}\n\nProposto: ${value}\n\nOrigem: ${source}`))return;
  const prior=parseHistory(current.answers[`history_${key}`]);
  setCurrent({...current,answers:{...current.answers,[key]:value,[`source_${key}`]:source,
   [`reviewed_${key}`]:JSON.stringify([origin[key],value]),[`history_${key}`]:JSON.stringify([...new Set([...prior,previous].filter(Boolean))])}});setDirty(true);
 }
 function addEvidenceLink(){
  let url:URL;
  try{url=new URL(link.url);if(!['https:','http:'].includes(url.protocol))throw new Error();}catch{setErrors(['Informe um link HTTP ou HTTPS válido.']);return;}
  if(!link.description.trim()||!link.date){setErrors(['Informe a descrição e a data da evidência.']);return;}
  answer('evidence_links',[evidenceLinks,`${link.date} | ${link.description.replace(/[\r\n]/g,' ')} | ${url.href}`].filter(Boolean).join('\n'));
  setErrors([]);setLink({url:'',description:'',date:''});
 }
 function answer(key:string,value:string){if(!current)return;setCurrent({...current,answers:{...current.answers,[key]:value}});setDirty(true);}
 async function save(f:FormRecord):Promise<FormRecord>{
  const problems=validateAnswers(f.answers,false,f.template);if(!f.course_id)problems.push('Selecione o curso.');
  if(problems.length)throw new Error(problems.join('\n'));
  const merged={...f.answers};
  const historical=records.find(r=>r.id===f.id)?.answers||{};
  for(const [key,proposed] of Object.entries(origin)){
   const currentValue=merged[key];
   if(currentValue===undefined||currentValue.trim()===proposed.trim())continue;
   if(merged[`reviewed_${key}`]===JSON.stringify([proposed,currentValue]))continue;
   const label=ALL_FIELDS.find(field=>field.key===key)?.label||key;
   if(!confirm(`Confirmar alteração de ${label}?\n\nValor no cadastro: ${proposed}\n\nValor a salvar: ${currentValue||'Em branco'}`)) {
    throw new Error('Rascunho preservado. Revise as divergências antes de salvar.');
   }
   merged[`reviewed_${key}`]=JSON.stringify([proposed,currentValue]);
   const prior=parseHistory(merged[`history_${key}`]);
   merged[`history_${key}`]=JSON.stringify([...new Set([...prior,proposed,historical[key]].filter(Boolean))]);
  }
  const {data,error}=await supabase.rpc('vertice_extension_form_save',{p_id:f.id,p_institution:institutionId,p_course:f.course_id,p_template:f.template,p_answers:merged,p_attachments:f.attachments,p_revision:f.revision});
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
   const path=`${institutionId}/extensao/${saved.id}/${id}.${ext}`;
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
  if(!current.attachments.length&&!selectedEvidence.length&&!evidenceLinks)problems.push('Registre ao menos um comprovante da execução.');
  if(problems.length){setErrors(problems);return;}
  if(!confirm('Concluir o projeto e arquivar o PDF na Mesa Digital? O formulário encerrado será preservado para consulta.'))return;
  setBusy(true);setErrors([]);setMessage('Salvando e preparando o PDF com os anexos…');
  try{
   const saved=await save(current);
   const {buildDossier}=await import('@/lib/extension-forms/pdf');
   const bytes=await buildDossier({id:saved.id,template:saved.template,answers:saved.answers,courseName:courses.filter(c=>(project?.course_ids||[saved.course_id]).includes(c.id)).map(c=>c.name).join(', '),institutionName,revision:saved.revision,author,generatedAt:new Date().toISOString(),attachments:saved.attachments},async a=>{
    const r=await supabase.storage.from(BUCKET).download(a.path);if(r.error)throw new Error(`Não foi possível ler ${a.name}: ${r.error.message}`);return new Uint8Array(await r.data.arrayBuffer());
   },undefined,[
    ...selectedEvidence.map(id=>{const item=evidence.find(e=>e.id===id);return item?`${item.title} | versão ${item.version} | ${(item.uploaded_at?.slice(0,10)||'Data indisponível')} | protocolo ${id}`:`Protocolo ${id}`;}),
    ...evidenceLinks.split('\n').filter(Boolean),
   ]);
   if(bytes.length>30*1024*1024)throw new Error('O dossiê ultrapassa 30 MB. Reduza o tamanho dos anexos antes de concluir.');
   const path=`${institutionId}/extensao/${saved.id}/relatorio-${crypto.randomUUID()}.pdf`;
   const hash=await sha256(bytes);
   const u=await supabase.storage.from(BUCKET).upload(path,new Blob([new Uint8Array(bytes).buffer],{type:'application/pdf'}),{contentType:'application/pdf',upsert:false});if(u.error)throw u.error;
   const repositoryFileId=crypto.randomUUID();
   const repositoryPath=`${institutionId}/${saved.repository_request_id}/${repositoryFileId}.pdf`;
   const copy=await supabase.storage.from('vertice-repositorios').upload(repositoryPath,new Blob([new Uint8Array(bytes).buffer],{type:'application/pdf'}),{contentType:'application/pdf',upsert:false});if(copy.error)throw copy.error;
   const r=await supabase.rpc('vertice_extension_form_save',{p_id:saved.id,p_institution:institutionId,p_course:saved.course_id,p_template:saved.template,p_answers:saved.answers,p_attachments:saved.attachments,p_revision:saved.revision,p_pdf:{path,repository_path:repositoryPath,repository_file_id:repositoryFileId,size:bytes.length,sha256:hash}});
   if(r.error)throw r.error;
   const completed=(Array.isArray(r.data)?r.data[0]:r.data) as FormRecord;
   if(completed?.status!=='concluido')throw new Error('O banco não confirmou a conclusão.');
   setCurrent(completed);setDirty(false);await reload();onChanged();
   setMessage('Projeto concluído. PDF e originais registrados na Mesa Digital, vinculados ao curso e à Extensão. Validação institucional pendente.');
   // Submit all new documents to the existing pre-analysis pipeline; failure is explicit.
   const docs=await supabase.from('vertice_documents').select('id').eq('institution_id',institutionId).eq('linked_entity_id',saved.project_id).eq('ai_status','pending');
   if(docs.error)throw new Error('PDF arquivado. Não foi possível consultar a fila de pré-análise: '+docs.error.message);
   const results=await Promise.all((docs.data||[]).map(d=>supabase.functions.invoke('vertice-doc-analyze',{body:{document_id:d.id}})));
   if(results.some(r=>r.error))setMessage('PDF e originais arquivados. A pré-análise de IA apresentou pendência; consulte a Mesa Digital. A validação institucional continua pendente.');
  }catch(e){setErrors([(e as Error).message]);setMessage('Confira o estado do projeto antes de repetir. A conclusão só é confirmada após o registro na Mesa Digital.');}finally{setBusy(false);}
 }
 if(loading)return <p role="status">Carregando formulários…</p>;
 return <div className="ext-section ext-workspace">
  <header className="ext-workspace-hero">
   <div><p className="ext-workspace-kicker">Extensão 360° · {institutionName}</p>
   <h3>{current?.answers.title||'Formulários de projeto e relatório final'}</h3>
   <p>{current?'Proposta, execução e evidências do projeto':'Abra um formulário salvo ou inicie um projeto por modelo.'}</p></div>
   {onBack&&<button className="ext-btn-secondary" onClick={()=>{if(!dirty||confirm('Há alterações não salvas. Deseja voltar aos projetos?'))onBack();}}>Voltar aos projetos</button>}
  </header>
  {message&&<p role="status" className="ext-info">{message}</p>}
  {errors.length>0&&<div role="alert" style={{color:'#991b1b',whiteSpace:'pre-wrap'}}><ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}
  {!current&&!targetId?<>
   {writer&&<button className="ext-btn-primary" disabled={busy} onClick={start}>Novo projeto por modelo</button>}
   {!records.some(f=>!projects.find(p=>p.id===f.project_id)?.deleted_at)&&<p>Nenhum formulário cadastrado.</p>}
   <div style={{display:'grid',gap:12,marginTop:16}}>{records.filter(f=>!projects.find(p=>p.id===f.project_id)?.deleted_at).map(f=><div key={f.id} className="ext-project-card">
    <h4>{f.answers.title}</h4><p>{TEMPLATES[f.template].label} · {f.status==='concluido'?'Concluído · PDF arquivado':'Rascunho'} · Revisão {f.revision}</p>
    <button className="ext-btn-secondary" disabled={busy} onClick={()=>open(f)}>Abrir formulário</button>
    {f.document_id&&<button className="ext-btn-primary" disabled={busy} onClick={()=>viewDocument(f)}>Abrir PDF arquivado</button>}
   </div>)}</div>
  </>:current?<>
   {!targetId&&<button className="ext-btn-cancel" disabled={busy} onClick={()=>open(null)}>Voltar à lista</button>}
   <p><strong>{current.status==='concluido'?'Registro concluído e preservado':'Rascunho'} · {current.revision===0?'Ainda não salvo':`Revisão ${current.revision}`}{dirty?' · Alterações não salvas':''}</strong></p>
   <fieldset disabled={busy||!editable} style={{border:0,padding:0}}>
    <div className="ext-form-grid">
     <label>Modelo<select value={current.template} onChange={e=>{setCurrent({...current,template:e.target.value as Template});setDirty(true);}}>{Object.entries(TEMPLATES).map(([k,t])=><option key={k} value={k}>{t.label}</option>)}</select></label>
     <label>Curso<select value={current.course_id} onChange={e=>{setCurrent({...current,course_id:e.target.value});setDirty(true);}}><option value="">Selecione o curso</option>{courses.filter(c=>!project?.course_ids?.length||project.course_ids.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    </div>
   </fieldset>
   <p style={{fontSize:12,color:'#64748b'}}>{TEMPLATES[current.template].source}. Campos comuns adaptados à instituição. Salve o rascunho a qualquer momento; os campos obrigatórios são conferidos ao concluir.</p>
   <div className="ext-workspace-layout">
   <nav aria-label="Etapas do formulário" className="ext-stage-nav">
    {SECTIONS.map((s,i)=>{
     const pending=fieldsForTemplate(s.fields,current.template).filter(f=>f.required&&!current.answers[f.key]?.trim()).length;
     return <button type="button" key={s.title} aria-current={section===i?'step':undefined} onClick={()=>setSection(i)}>
      <span>{s.title}</span><small>{pending?`${pending} ${pending===1?'pendência':'pendências'}`:'Campos obrigatórios preenchidos'}</small>
     </button>;
    })}
    <button type="button" aria-current={section===SECTIONS.length?'step':undefined} onClick={()=>setSection(SECTIONS.length)}><span>Evidências e envio</span><small>Relatório Final</small></button>
    {showInvites&&<button type="button" aria-current={section===SECTIONS.length+1?'step':undefined} onClick={()=>setSection(SECTIONS.length+1)}><span>Alunos e convites</span><small>Acessos e revisão</small></button>}
   </nav>
   <div className="ext-stage-content">
   {section<SECTIONS.length?<fieldset className="ext-form" disabled={busy||!editable}>
    <legend>{section>=3?'Relatório Final · ':''}{SECTIONS[section].title}</legend>
    {section>0&&<dl className="ext-project-context">
     {([['Instituição',institutionName],['Cursos',courses.filter(c=>(project?.course_ids||[current.course_id]).includes(c.id)).map(c=>c.name).join(', ')],
      ...SECTIONS[0].fields.filter(f=>['responsible','audience','modality','thematic_area','location','start_date','end_date','hours'].includes(f.key)).map(f=>[f.label,(dirty?current.answers[f.key]||origin[f.key]:origin[f.key]||current.answers[f.key])])] as [string,string][]).filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>}
    <div className="ext-stage-actions">
     {project&&editable&&<button type="button" className="ext-btn-secondary" onClick={reuse}>Preencher com dados existentes</button>}
     {editable&&fields.some(f=>f.required&&!current.answers[f.key]?.trim())&&<button type="button" className="ext-btn-secondary" onClick={()=>document.getElementById(`ext-field-${current.id}-${fields.find(f=>f.required&&!current.answers[f.key]?.trim())?.key}`)?.focus()}>Complementar informações</button>}
    </div>
    {section===1&&<div className="ext-source-box">
     <strong>Objetivos de Desenvolvimento Sustentável</strong>
     {/Parque Cesamar/i.test(current.answers.title||'')&&<p>Sugestão para revisão: ODS 3, 11, 12 e 16.</p>}
     <div className="ext-ods-grid">{ODS_NAMES.map((name,i)=>{
      const id=String(i+1), ids=(current.answers.ods_ids||'').split(',').filter(Boolean);
      return <label key={id}><input type="checkbox" checked={ids.includes(id)} onChange={e=>answer('ods_ids',(e.target.checked?[...ids,id]:ids.filter(v=>v!==id)).join(','))}/> {id}. {name}</label>;
     })}</div>
     {!current.answers.ppc_source?.trim()&&<p>Vínculo com o PPC pendente de referência por curso.</p>}
    </div>}
    {section===1&&ppcDocs.length>0&&<details className="ext-source-box">
     <summary>Consultar PPCs vinculados aos cursos</summary>
     {ppcDocs.map(doc=><div key={doc.id}>
      <strong>{courses.find(course=>course.id===doc.course_id)?.name}</strong>
      {doc.extracted_text?<DocumentExcerpt doc={doc} fields={fields.filter(f=>['ppc_alignment','ppc_source'].includes(f.key))} onUse={useSource} stage={section}/>:<p>{doc.file_name||doc.title} · Sem texto disponível para consulta.</p>}
     </div>)}
    </details>}
    <div className="ext-form-grid">{fields.map(f=>{
     const value=current.answers[f.key]??'';
     const proposed=origin[f.key];
     const conflict=!!(proposed?.trim()&&value.trim()&&proposed.trim()!==value.trim());
     const planned=PLANNED_FIELD[f.key];
     const previous=parseHistory(current.answers[`history_${f.key}`]);
     const fieldId=`ext-field-${current.id}-${f.key}`;
     return <div className={f.type==='textarea'?'ext-workspace-wide':''} key={f.key}>
      <div className={planned?'ext-indicator-pair':undefined}>
       {planned&&<div className="ext-indicator-planned"><strong>Previsto</strong><span>{displayValue(current.answers[planned]||origin[planned],f.key==='investment_actual')}</span>
        {f.key==='investment_actual'&&<><strong>Aprovado</strong><span>{displayValue(current.answers.approved_budget,true)}</span></>}</div>}
       <div><label htmlFor={fieldId}>{f.label}{f.required?' *':''}</label>
        {f.type==='textarea'?<textarea id={fieldId} rows={4} value={value} onChange={e=>answer(f.key,e.target.value)}/>:<input id={fieldId} type={f.type||'text'} min={f.type==='number'?0:undefined} step={f.type==='number'?'any':undefined} value={value} onChange={e=>answer(f.key,e.target.value)}/>}
       </div>
      </div>
      {conflict&&<div className="ext-source-box"><strong>Valor divergente no cadastro do projeto</strong><p>{proposed}</p><button type="button" className="ext-btn-secondary" onClick={()=>useSource(f.key,proposed,'Cadastro do projeto')}>Revisar substituição</button></div>}
      {previous.length>0&&<details className="ext-source-box"><summary>Valores anteriores</summary>{previous.map(item=><p key={item}>{item}</p>)}</details>}
      {current.answers[`source_${f.key}`]&&<small className="ext-field-source">{current.answers[`source_${f.key}`]}</small>}
     </div>;
    })}</div>
    {(section===1||section===3)&&sources.some(s=>s.extracted_text)&&<details className="ext-source-box">
     <summary>Consultar trechos dos documentos vinculados</summary>
     {sources.filter(s=>s.extracted_text).map(doc=><DocumentExcerpt key={doc.id} doc={doc} fields={fields.filter(f=>f.type==='textarea')} onUse={useSource} stage={section}/>)}
    </details>}
   </fieldset>:section>SECTIONS.length&&project&&showInvites?<ExtensaoAlunosConvites projectId={project.id} onUse={useSource}/>:<div className="ext-form">
    <h4>Evidências do Relatório Final</h4>
    {evidence.length>0&&<fieldset disabled={busy||!editable} className="ext-source-box"><legend>Vincular evidências do portal</legend>
     {evidence.map(item=><label key={item.id}><input type="checkbox" checked={selectedEvidence.includes(item.id)} onChange={e=>answer('evidence_ids',(e.target.checked?[...selectedEvidence,item.id]:selectedEvidence.filter(id=>id!==item.id)).join(','))}/> {item.title} · versão {item.version}</label>)}
    </fieldset>}
    {evidenceLinks&&<p className="ext-evidence-links">{evidenceLinks}</p>}
    {editable&&<fieldset disabled={busy} className="ext-source-box"><legend>Registrar link de evidência</legend>
     <div className="ext-form-grid">
      <label>Endereço<input type="url" value={link.url} onChange={e=>setLink({...link,url:e.target.value})}/></label>
      <label>Descrição<input value={link.description} onChange={e=>setLink({...link,description:e.target.value})}/></label>
      <label>Data<input type="date" value={link.date} onChange={e=>setLink({...link,date:e.target.value})}/></label>
     </div><button type="button" className="ext-btn-secondary" onClick={addEvidenceLink}>Registrar link</button>
    </fieldset>}<p>PDF, JPG ou PNG. Até 5 MB por arquivo; no máximo 20 anexos e 20 MB no total. Inclua programação, presença, fotos e demais comprovantes aplicáveis.</p>
    {editable&&<fieldset disabled={busy} style={{border:0}}><label>Tipo do comprovante<select value={kind} onChange={e=>setKind(e.target.value)}>{KINDS.map(k=><option key={k}>{k}</option>)}</select></label><label>Adicionar arquivo<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file);}}/></label></fieldset>}
    {current.attachments.map(a=><p key={a.id}>{a.kind}: {a.name} ({(a.size/1024).toFixed(0)} KB) {editable&&<button type="button" disabled={busy} onClick={()=>{setCurrent({...current,attachments:current.attachments.filter(x=>x.id!==a.id)});setDirty(true);}}>Remover do rascunho</button>}</p>)}
    <p>{fieldsForTemplate(ALL_FIELDS,current.template).filter(f=>f.required&&current.answers[f.key]?.trim()).length}/{fieldsForTemplate(ALL_FIELDS,current.template).filter(f=>f.required).length} campos obrigatórios preenchidos.</p>
    {editable&&<button className="ext-btn-primary" disabled={busy} onClick={complete}>{busy?'Processando…':'Enviar Relatório Final e gerar PDF'}</button>}
    {current.document_id&&<button className="ext-btn-primary" disabled={busy} onClick={()=>viewDocument(current)}>Abrir PDF arquivado</button>}
   </div>}
   </div></div>
   <div className="ext-form-actions ext-workspace-footer">
    {editable&&<button className="ext-btn-save" disabled={busy} onClick={saveDraft}>{busy?'Salvando…':'Salvar rascunho'}</button>}
    <button className="ext-btn-secondary" disabled={section===0} onClick={()=>setSection(s=>s-1)}>Anterior</button>
    <button className="ext-btn-secondary" disabled={section>=lastSection} onClick={()=>setSection(s=>s+1)}>Próxima etapa</button>
   </div>
  </>:null}
 </div>;
}


function DocumentExcerpt({doc,fields,onUse,stage}:{
 doc:SourceDocument;
 fields:{key:string;label:string}[];
 onUse:(key:string,value:string,source:string)=>void;
 stage:number;
}){
 const [field,setField]=useState('');
 const [excerpt,setExcerpt]=useState('');
 const [classification,setClassification]=useState(stage===1?'Prevista':'Realizada');
 const suggestions=documentSuggestions(doc.extracted_text||'',fields.map(item=>item.key));
 return <details className="ext-source-box"><summary>{doc.file_name||doc.title}</summary>
  {suggestions.map(({key,excerpt},i)=><div key={`${key}:${i}`} className="ext-source-box">
   <strong>{fields.find(item=>item.key===key)?.label}</strong><blockquote>{excerpt}</blockquote>
   <button type="button" className="ext-btn-secondary" onClick={()=>{setField(key);setExcerpt(excerpt);}}>Selecionar sugestão</button>
  </div>)}
  {!suggestions.length&&<blockquote>{doc.extracted_text?.slice(0,2500)}</blockquote>}
  <label>Trecho de origem<textarea value={excerpt} onChange={e=>setExcerpt(e.target.value)} rows={3}/></label>
  <label>Campo<select value={field} onChange={e=>setField(e.target.value)}><option value="">Selecione</option>{fields.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
  <label>Classificação<select value={classification} onChange={e=>setClassification(e.target.value)}><option>Prevista</option><option>Realizada</option><option>Comprovada por evidência</option></select></label>
  <button type="button" className="ext-btn-secondary" disabled={!field||!excerpt.trim()||!doc.extracted_text?.includes(excerpt.trim())} onClick={()=>onUse(field,excerpt.trim(),`${classification} · ${doc.file_name||doc.title} · trecho: ${excerpt.trim()}`)}>Revisar preenchimento</button>
 </details>;
}

function parseHistory(value:string|undefined):string[]{
 if(!value)return [];
 try{
  const parsed:unknown=JSON.parse(value);
  return Array.isArray(parsed)?parsed.filter((item):item is string=>typeof item==='string'):[];
 }catch{return [];}
}
