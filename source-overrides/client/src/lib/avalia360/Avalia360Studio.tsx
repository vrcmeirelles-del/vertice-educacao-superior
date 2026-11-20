import {useCallback,useEffect,useRef,useState} from 'react';
import './avalia-wizard.css';
import {QuestionImageField} from './QuestionImageField';
import ClassBatchPublisher from './ClassBatchPublisher';
import RuleCurationPanel from './RuleCurationPanel';
import type {CurationDecision} from './curation-decision';
import TeacherQuestionComposer from './TeacherQuestionComposer';
import QuestionBankPanel from './QuestionBankPanel';
import type {QuestionDraft} from './question-draft';
import {saveAssessmentDraft,loadAssessmentDraft,type DraftReceipt,type StoredAssessmentDraft} from './draft-api';
import {uploadQuestionImage,type UploadedImageReceipt} from './private-image-upload';
import {receiptScopeKey,reusableReceipt,type ScopedImageReceipt} from './receipt-cache';
import type {Difficulty,Purpose} from './longitudinal-engine';
import {analyzeDeclaredDraft,type PedagogicalDraft} from './declared-analysis';
import PedagogicalParameters from './PedagogicalParameters';
import {importOfficialCurriculum} from './curriculum-import-api';
import {mapCurriculumToAssessment,type CurriculumImport} from './curriculum-import';

export interface Avalia360StudioProps {
 institutionId:string;
 courses:Array<{id:string;name:string}>;
 /** No modo demonstração, o adaptador da prévia usa apenas dados locais. */
 previewMode?:boolean;
}
const blue='#164B92',light='#EFF5FC',line='#DCE7F4';
const labelStyle={display:'grid',gap:5,fontWeight:600,fontSize:13} as const;
const inputStyle={padding:'10px 12px',border:'1px solid '+line,borderRadius:8,minWidth:0,width:'100%',background:'#fff'} as const;
const cardStyle={background:'#fff',border:'1px solid '+line,borderRadius:14,padding:18,marginBottom:16} as const;
const initial=(disciplineId:string):QuestionDraft=>({
 id:crypto.randomUUID(),disciplineId,kind:'objetiva',statement:'',
 options:['A','B','C','D','E'].map(id=>({id,text:''})),correctOptionId:'',
 answerJustification:'',rubric:'',expectedAnswer:'',answerLines:8,topicIds:[],competencyIds:[],purpose:['formativa'],
 estimatedDifficulty:3,points:1,examTags:[],images:[]
});
function checkDraft(questions:QuestionDraft[]):string[]{
 const errors:string[]=[];
 if(!questions.length)errors.push('Inclua ao menos uma questão.');
 questions.forEach((q,i)=>{
  const ref='Questão '+(i+1)+': ';
  if(q.statement.trim().length<10)errors.push(ref+'o enunciado precisa de pelo menos 10 caracteres.');
  if(!Number.isFinite(q.points)||q.points<=0)errors.push(ref+'a pontuação deve ser positiva.');
  if(!q.purpose.length)errors.push(ref+'informe a finalidade pedagógica.');
  if(q.kind==='objetiva'){
   if(q.options.length<2||q.options.some(o=>!o.text.trim()))
    errors.push(ref+'preencha todas as alternativas.');
   if(!q.options.some(o=>o.id===q.correctOptionId))
    errors.push(ref+'defina uma alternativa correta.');
   if(!q.answerJustification?.trim())errors.push(ref+'justifique o gabarito da objetiva.');
  }else{
   if(!q.rubric.trim())errors.push(ref+'informe a rubrica da discursiva.');
   if(!Number.isInteger(q.answerLines??8)||(q.answerLines??8)<3||(q.answerLines??8)>60)errors.push(ref+'informe entre 3 e 60 linhas de resposta.');
   if(!q.expectedAnswer?.trim())errors.push(ref+'informe o padrão de resposta esperado.');
  }
  q.images.forEach((m,j)=>{
   if(!m.altText.trim())errors.push(ref+'a imagem '+(j+1)+' exige descrição acessível.');
   if(m.rightsStatus==='nao_informado')errors.push(ref+'declare o direito de uso da imagem '+(j+1)+'.');
   if(m.placement==='alternativa'&&!q.options.some(o=>o.id===m.alternativeId))
    errors.push(ref+'imagem vinculada a alternativa inexistente.');
  });
 });
 return errors;
}
function LocalFigure({file,alt,caption}:{file:File;alt:string;caption?:string}){
 const [src,setSrc]=useState('');
 useEffect(()=>{
  const url=URL.createObjectURL(file);
  setSrc(url);
  return ()=>URL.revokeObjectURL(url);
 },[file]);
 return <figure style={{margin:'12px 0',padding:10,background:'#fff',borderRadius:8}}>
  {src&&<img src={src} alt={alt||'Figura sem descrição'} style={{display:'block',width:'auto',maxWidth:'100%',maxHeight:340,objectFit:'contain'}}/>}
  <figcaption style={{fontSize:12,marginTop:5,color:'#41566F'}}>{caption||alt}</figcaption>
 </figure>;
}
function SavedPreview({value}: {value:StoredAssessmentDraft}){
 return <section style={cardStyle} aria-label="Rascunho recuperado do servidor">
  <h3 style={{marginTop:0}}>Caderno recuperado do servidor</h3>
  <p><strong>{value.snapshot.meta?.title||'Avaliação'}</strong> · {value.snapshot.meta?.semester||'sem semestre informado'} · {value.snapshot.meta?.purpose||'sem finalidade informada'}</p>
  <p>Versão {value.revision} · {value.snapshot.curriculumStatus==='linked'?'Matriz associada':'Aguardando vinculação ao PPC'}</p>
  {value.snapshot.meta?.instructions&&<div><strong>Instruções da avaliação</strong>
   <div style={{whiteSpace:'pre-wrap'}}>{value.snapshot.meta.instructions}</div></div>}
  <p style={{fontSize:13}}>Decisões docentes declaradas neste rascunho: {value.snapshot.meta?.curationHistory?.length||0}. Este histórico não equivale à auditoria autenticada do servidor.</p>
  {value.snapshot.meta?.curriculumSource&&<p style={{fontSize:13}}>Matriz importada: versão {value.snapshot.meta.curriculumSource.version} · {value.snapshot.meta.curriculumSource.ready?'períodos validados no cadastro':'períodos ainda não homologados'}</p>}
  {value.snapshot.meta?.declaredPedagogy&&<p style={{fontSize:13}}>Metadados pedagógicos declarados preservados: {value.snapshot.meta.declaredPedagogy.competencies.length} competências e {value.snapshot.meta.declaredPedagogy.topics.length} temas. Sem homologação curricular.</p>}
  {value.snapshot.questions.map((q,i)=><div key={String(q.id||i)} style={{padding:'12px 0',borderTop:'1px solid '+line}}>
   <strong>{i+1}. {String(q.statement||'Enunciado indisponível')}</strong>
   {Array.isArray(q.options)&&(q.options as Array<{id:string;text:string}>).map(o=>
    <p key={o.id} style={{margin:'5px 0',paddingLeft:14}}>{o.id}) {o.text}</p>)}
   {Array.isArray(q.images)&&(q.images as Array<{altText:string;caption?:string}>).map((m,k)=>
    <p key={k} style={{fontSize:13}}>Figura {k+1}: {m.caption||m.altText} (arquivo privado associado)</p>)}
  </div>)}
  <p style={{fontSize:12,color:'#64748b'}}>O acesso visual às imagens armazenadas requer URL autenticada temporária. A presença do vínculo não comprova acesso ao binário.</p>
 </section>;
}
export default function Avalia360Studio({institutionId,courses,previewMode=false}:Avalia360StudioProps){
 const [courseId,setCourseId]=useState('');
 const [disciplineId,setDisciplineId]=useState('');
 const [title,setTitle]=useState('');
 const [instructions,setInstructions]=useState('');
 const [period,setPeriod]=useState('2027/1');
 const [purpose,setPurpose]=useState<Purpose>('formativa');
 const [pedagogy,setPedagogy]=useState<PedagogicalDraft>({
  currentPeriod:1,targetDifficulty:3,purpose:'formativa',examFocus:'',
  requiredCompetencyIds:[],requiredTopicIds:[],competencies:[],topics:[],relations:[]
 });
 const [curriculumSource,setCurriculumSource]=useState<{buildId:string;version:number;ready:boolean}|null>(null);
 const [curriculumMessage,setCurriculumMessage]=useState('');
 const [curriculumBusy,setCurriculumBusy]=useState(false);
 const [analysisVisible,setAnalysisVisible]=useState(false);
 const [step,setStep]=useState<1|2|3>(1);
 const [questions,setQuestions]=useState<QuestionDraft[]>([]);
 const [curationHistory,setCurationHistory]=useState<CurationDecision[]>([]);
 const [activeIndex,setActiveIndex]=useState(0);
 const [preview,setPreview]=useState(false);
 const [receipt,setReceipt]=useState<DraftReceipt|null>(null);
 const [loaded,setLoaded]=useState<StoredAssessmentDraft|null>(null);
 const [lookupId,setLookupId]=useState('');
 const [errors,setErrors]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const uploads=useRef(new Map<string,ScopedImageReceipt>());
 useEffect(()=>{setReceipt(null);setLoaded(null);setQuestions([]);setInstructions('');setStep(1);setCurationHistory([]);setPreview(false);uploads.current.clear();setStatus('');setCurriculumSource(null);setCurriculumMessage('');setPedagogy(p=>({...p,competencies:[],topics:[],requiredCompetencyIds:[],requiredTopicIds:[],relations:[]}));},[institutionId,courseId]);
 const update=useCallback((change:Partial<QuestionDraft>)=>{
  setQuestions(all=>all.map((q,i)=>i===activeIndex?{...q,...change}:q));
  setLoaded(null);
 },[activeIndex]);
 const add=()=>{
  // É permitido começar um rascunho sem disciplina; o salvamento exige associação posterior.
  const newQuestion=initial(disciplineId.trim());
  setQuestions(all=>[...all,newQuestion]);
  setActiveIndex(questions.length);
  setErrors([]);
  setPreview(false);
 };
 const remove=(index:number)=>{
  setQuestions(all=>all.filter((_,i)=>i!==index));
  setActiveIndex(0);setErrors([]);setLoaded(null);
 };
 const setDiscipline=(value:string)=>{
  setDisciplineId(value);
  setCurriculumSource(null);
  setCurriculumMessage('');
  setPedagogy(p=>({...p,competencies:[],topics:[],requiredCompetencyIds:[],requiredTopicIds:[],relations:[]}));
  if(questions.length) setQuestions(all=>all.map(q=>({...q,disciplineId:value,competencyIds:[],topicIds:[]})));
 };
 const importCurriculum=async()=>{
  if(!courseId||!disciplineId.trim()){
   setCurriculumMessage('Selecione curso e disciplina antes de importar.');return;
  }
  setCurriculumBusy(true);setCurriculumMessage('');
  try{
   let result:CurriculumImport;
   if(previewMode){
    const buildId='demo-matriz-curricular';
    result=mapCurriculumToAssessment({
     institutionId,courseId,disciplineName:disciplineId,
     build:{id:buildId,institution_id:institutionId,course_id:courseId,version:1,status:'published'},
     competencies:[
      {id:'demo-competencia-1',build_id:buildId,code:'C1',title:'Interpretar e aplicar conhecimentos da disciplina',origin_period:1,period_status:'validated'},
      {id:'demo-competencia-2',build_id:buildId,code:'C2',title:'Analisar situações-problema e fundamentar decisões',origin_period:2,period_status:'proposed'}
     ],
     links:[
      {competency_id:'demo-competencia-1',discipline_name:disciplineId},
      {competency_id:'demo-competencia-2',discipline_name:disciplineId}
     ]
    });
   }else result=await importOfficialCurriculum({institutionId,courseId,disciplineName:disciplineId});
   if(!result.competencies.length){
    setCurriculumMessage(result.warnings.join(' ')||'Nenhuma competência vinculada a esta disciplina.');return;
   }
   const ids=new Set(result.competencies.map(c=>c.id));
   setPedagogy(p=>({...p,competencies:result.competencies,
    requiredCompetencyIds:result.competencies.map(c=>c.id),
    relations:p.relations.filter(r=>ids.has(r.sourceCompetencyId)&&ids.has(r.targetCompetencyId))
   }));
   setQuestions(all=>all.map(q=>({...q,competencyIds:q.competencyIds.filter(id=>ids.has(id))})));
   setCurriculumSource({buildId:result.buildId,version:result.buildVersion,ready:result.ready});
   setAnalysisVisible(false);
   setCurriculumMessage(
    (previewMode?'Exemplo fictício, sem consulta à base da Vértice. ':'')+
    result.competencies.length+' competência(s) importada(s), matriz versão '+result.buildVersion+'. '+
    (result.ready?'Períodos de origem marcados como validados no catálogo.':'Importação provisória; não equivale à homologação do PPC. ')+
    result.warnings.join(' ')
   );
  }catch(e){setCurriculumMessage(e instanceof Error?e.message:'Não foi possível importar a matriz.');}
  finally{setCurriculumBusy(false);}
 };
 const q=questions[activeIndex];
 const previewAnalysis=analysisVisible?analyzeDeclaredDraft({
  institutionId,courseId,disciplineId,questions,
  config:{...pedagogy,purpose}
 }):null;
 const invalidCatalog=pedagogy.competencies.some(c=>!c.code.trim()||!c.title.trim()||!Number.isInteger(c.period)||c.period<1)
  ||pedagogy.topics.some(t=>!t.title.trim()||!Number.isInteger(t.period)||t.period<1);
 const total=questions.reduce((s,x)=>s+x.points,0);
 const save=async()=>{
  if(!courseId){setErrors(['Selecione o curso.']);return;}
  if(!disciplineId.trim()){setErrors(['Informe a disciplina.']);return;}
  const issues=checkDraft(questions);
  if(invalidCatalog)issues.push('Complete os códigos, títulos e períodos dos dados pedagógicos declarados.');
  if(title.trim().length<3)issues.unshift('Informe um título com pelo menos 3 caracteres.');
  if(period.trim().length<3)issues.unshift('Informe o semestre letivo.');
  if(issues.length){setErrors(issues);setPreview(false);return;}
  setBusy(true);setErrors([]);setStatus('Preparando rascunho…');
  try {
   const grouped:Record<string,Array<{localId:string;receipt:UploadedImageReceipt}>>={};
   for(const question of questions){
    grouped[question.id]=[];
    for(const image of question.images){
     const context={institutionId,courseId,disciplineId,questionId:question.id};
     const cached=reusableReceipt(uploads.current.get(image.localId),image.file,context);
     setStatus('Verificando anexo de '+question.id.slice(0,8)+'…');
     const actual=cached||await uploadQuestionImage(image.file,context);
     if(!cached)uploads.current.set(image.localId,{file:image.file,receipt:actual,scopeKey:receiptScopeKey(context)});
     grouped[question.id].push({localId:image.localId,receipt:actual});
    }
   }
   setStatus(previewMode?'Guardando demonstração neste navegador…':'Salvando versão no Supabase…');
   const out=await saveAssessmentDraft({institutionId,courseId,disciplineId,
     ...(receipt?{draftId:receipt.id,expectedRevision:receipt.revision}:{}),
     questions,uploadedImages:grouped,
     ...(curriculumSource&&!previewMode?{buildId:curriculumSource.buildId}:{}),
     assessmentMeta:{title:title.trim(),instructions:instructions.trim(),semester:period.trim(),purpose,
      declaredPedagogy:{...pedagogy,purpose},curationHistory:curationHistory.slice(-150),
      ...(curriculumSource?{curriculumSource}: {})}});
   if(!out.ok){setStatus('Falha no salvamento.');setErrors([out.error.message]);return;}
   setReceipt(out.receipt);setStatus((previewMode?'Demonstração local salva':'Rascunho salvo')+' na versão '+out.receipt.revision+'.');
   setLoaded(null);
  }catch(e){setStatus('Salvamento não concluído.');setErrors([e instanceof Error?e.message:'Falha ao conectar ao armazenamento privado.']);}
  finally{setBusy(false);}
 };
 const reopen=async(draftId?:string)=>{
  const id=(draftId||receipt?.id||'').trim();
  if(!id){setErrors(['Informe o identificador do rascunho.']);return;}
  if(!courseId||!disciplineId){setErrors(['Selecione curso e disciplina do rascunho.']);return;}
  setBusy(true);setErrors([]);setStatus(previewMode?'Consultando rascunho local…':'Reabrindo rascunho autorizado…');
  const found=await loadAssessmentDraft({institutionId,courseId,disciplineId,draftId:id});
  if(found.ok){
   setLoaded(found.draft);
   setStatus(previewMode?'Rascunho local recuperado em modo de consulta.':'Rascunho recuperado do Supabase em modo de consulta.');
  }else{setStatus('Não foi possível reabrir.');setErrors([found.error.message]);}
  setBusy(false);
 };
 const btn=(primary:boolean)=>({padding:'10px 16px',borderRadius:9,border:'1px solid '+blue,
  background:primary?blue:'#fff',color:primary?'#fff':blue,fontWeight:700,cursor:'pointer'} as const);
 return <section aria-label="Estúdio de Avaliações 360" className="avalia-wizard">
  <header className="avalia-hero">
    <div className="avalia-eyebrow">Vértice · Ensino Superior · Módulos Acadêmicos</div>
    <h2>Crie sua avaliação com simplicidade</h2>
    <p>Elabore questões com clareza e acompanhe o progresso. As configurações pedagógicas ficam à disposição quando você precisar.</p>
   </header>
   <nav className="avalia-steps" aria-label="Etapas da avaliação">
    {([{n:1,label:'Preparar avaliação'},{n:2,label:'Elaborar questões'},{n:3,label:'Revisar e finalizar'}] as const).map(x=>
     <button key={x.n} type="button" className={'avalia-step'+(step===x.n?' active':step>x.n?' done':'')}
      aria-current={step===x.n?'step':undefined} onClick={()=>setStep(x.n)}>
      <span className="avalia-step-index">{step>x.n?'✓':x.n}</span><span>{x.label}</span>
     </button>)}
   </nav>
   <p className="avalia-warning" role="note">{previewMode?
     'Demonstração pública: dados somente neste navegador. Não use nomes reais de alunos nem materiais confidenciais.':
     'Rascunhos e imagens exigem serviços institucionais autorizados. Esta tela não publica provas aos alunos.'}</p>

  {step===1&&<>
      <div style={cardStyle}>
   <h3 style={{margin:'0 0 14px'}}>Preparar avaliação</h3>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12}}>
    <label style={labelStyle}>Curso
     <select style={inputStyle} value={courseId} onChange={e=>setCourseId(e.target.value)}>
      <option value="">Selecione o curso</option>
      {courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
     </select>
    </label>
    <label style={labelStyle}>Disciplina
     <input style={inputStyle} value={disciplineId} onChange={e=>setDiscipline(e.target.value)} placeholder="Ex.: Direito Civil"/>
    </label>
    <label style={labelStyle}>Semestre
     <input style={inputStyle} value={period} onChange={e=>setPeriod(e.target.value)} placeholder="2027/1"/>
    </label>
    <label style={labelStyle}>Finalidade predominante
     <select style={inputStyle} value={purpose} onChange={e=>setPurpose(e.target.value as Purpose)}>
      <option value="diagnostica">Diagnóstica</option><option value="formativa">Formativa</option><option value="somativa">Somativa</option>
     </select>
    </label>
   </div>
   <label style={{...labelStyle,marginTop:12}}>Título da avaliação
    <input style={inputStyle} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Avaliação de Direito Civil — AV1"/>
   </label>
   <label style={{...labelStyle,marginTop:12}}>Instruções da avaliação
    <textarea style={inputStyle} rows={4} value={instructions} onChange={e=>setInstructions(e.target.value)}
     placeholder="Ex.: Preencha o cartão de respostas com caneta azul ou preta."/>
   </label>
   <p style={{fontSize:12,color:'#64748b',marginBottom:0}}>Título, instruções, semestre e finalidade são versionados com o rascunho. O vínculo a competências depende de catálogo institucional validado.</p>
  </div>

    <div className="avalia-actions">
     <button type="button" className="avalia-action-primary" onClick={()=>{if(!questions.length)add();setStep(2)}}>Começar a elaborar questões →</button>
    </div>
   </>}
   {step===2&&<>
       <div className="avalia-summary" aria-label="Identificação da avaliação">
    <div><small>Curso</small><strong>{courses.find(c=>c.id===courseId)?.name||'Não selecionado'}</strong></div>
    <div><small>Disciplina</small><strong>{disciplineId||'Não informada'}</strong></div>
    <div><small>Finalidade</small><strong>{purpose==='diagnostica'?'Diagnóstica':purpose==='somativa'?'Somativa':'Formativa'}</strong></div>
    <div><small>Semestre</small><strong>{period||'Não informado'}</strong></div>
   </div>
    <div className="avalia-columns">
     <main style={{minWidth:0}}>
        <div style={cardStyle}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
    <h3 className="avalia-review-header">Elaborar questões</h3>
    <strong style={{color:blue}}>{questions.length} questão(ões) · {total.toLocaleString('pt-BR')} pontos</strong>
   </div>
   <p style={{fontSize:13,color:'#64748b'}}>Concentre-se em uma questão por vez. Os recursos pedagógicos avançados ficam disponíveis abaixo.</p>
   <div className="avalia-question-counter">
    {questions.map((item,i)=><button key={item.id} type="button" onClick={()=>{setActiveIndex(i);setPreview(false);}}
     style={{...btn(i===activeIndex),padding:'8px 12px'}} aria-pressed={i===activeIndex}>
       Questão {i+1} · {item.kind==='objetiva'?'Objetiva':'Discursiva'}
     </button>)}
    <button type="button" onClick={add}>＋ Adicionar questão</button>
    {!disciplineId.trim()&&<span role="note" style={{alignSelf:'center',fontSize:12,color:'#6D4B14'}}>
     Você pode criar questões agora. Informe a disciplina antes de salvar a avaliação.
    </span>}
   </div>
   {!q?<p>Adicione a primeira questão para começar.</p>:
    <div style={{display:'grid',gap:12}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><strong style={{color:'#0a3775',fontSize:19}}>Questão {activeIndex+1}</strong><span className="avalia-pill">{q.kind==='discursiva'?'Discursiva':'Objetiva'}</span><span className="avalia-pill">{q.points} ponto(s)</span></div>
      <button type="button" style={{...btn(false),borderColor:'#B84A4A',color:'#9B3434'}} onClick={()=>remove(activeIndex)}>Excluir questão</button>
     </div>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}>
      <label style={labelStyle}>Tipo da questão
       <select style={inputStyle} value={q.kind} onChange={e=>update({kind:e.target.value as QuestionDraft['kind']})}>
        <option value="objetiva">Objetiva</option><option value="discursiva">Discursiva</option>
       </select>
      </label>
      <label style={labelStyle}>Pontos
       <input style={inputStyle} type="number" min=".01" step=".25" value={q.points} onChange={e=>update({points:Number(e.target.value)})}/>
      </label>
     </div>
     <label style={labelStyle}>Enunciado da questão
      <textarea style={{...inputStyle,minHeight:138}} value={q.statement} onChange={e=>update({statement:e.target.value})}
       placeholder="Apresente o caso e formule claramente o que o estudante deve responder."/>
      <small className="avalia-help">{q.statement.length} caracteres · Seja específico sobre a tarefa a ser realizada.</small>
     </label>
     <details className="avalia-deep-options">
      <summary>Precisa de ajuda para estruturar o enunciado?</summary>
      <div style={{marginTop:12}}><TeacherQuestionComposer key={q.id} onApply={statement=>update({statement})}/></div>
     </details>
     <details className="avalia-deep-options">
      <summary>Adicionar imagem ou material de apoio {q.images.length?'· '+q.images.length+' anexo(s)':'(opcional)'}</summary>
      <div style={{marginTop:12}}><QuestionImageField questionId={q.id} value={q.images} onChange={images=>update({images})}/></div>
     </details>
     {q.kind==='objetiva'?<> <fieldset style={{border:'1px solid '+line,borderRadius:10}}>
      <legend style={{fontWeight:700}}>Alternativas e gabarito</legend>
      {q.options.map(o=><div key={o.id} style={{display:'grid',gridTemplateColumns:'50px 1fr 90px',gap:8,alignItems:'center',marginBottom:8}}>
       <strong>{o.id}</strong>
       <input style={inputStyle} value={o.text} onChange={e=>update({options:q.options.map(a=>a.id===o.id?{...a,text:e.target.value}:a)})} aria-label={'Alternativa '+o.id}/>
       <label style={{fontSize:12}}><input type="radio" name={'correct-'+q.id} checked={q.correctOptionId===o.id} onChange={()=>update({correctOptionId:o.id})}/> Correta</label>
      </div>)}
     </fieldset> 
     {q.kind==='objetiva'&&<label style={labelStyle}>Justificativa da alternativa correta
      <span className="avalia-help">Explique por que o gabarito está correto. Este texto integra a curadoria algorítmica e não será mostrado aos alunos.</span>
      <textarea className="avalia-answer-area" style={inputStyle} value={q.answerJustification||''}
       onChange={e=>update({answerJustification:e.target.value})}
       placeholder="Indique os fundamentos, conceitos ou critérios que sustentam a alternativa correta."/>
     </label>}</>: <div style={{display:'grid',gap:15}}>
      <label style={labelStyle}>Padrão de resposta esperado
       <span className="avalia-help">Referência privada do professor. Não aparecerá no PDF dos estudantes.</span>
       <textarea className="avalia-answer-area" style={inputStyle} value={q.expectedAnswer||''}
        onChange={e=>update({expectedAnswer:e.target.value})}
        placeholder="Quais conceitos, argumentos, fundamentos e elementos são esperados?"/>
      </label>
      <label style={labelStyle}>Linhas disponíveis para a resposta
       <span className="avalia-help">O PDF terá pautas espaçadas em 1,5 (18 pontos entre linhas). Cada questão pode ter quantidade diferente.</span>
       <input style={{...inputStyle,maxWidth:160}} type="number" min="3" max="60" step="1"
        value={q.answerLines??8} onChange={e=>update({answerLines:e.target.value?Number(e.target.value):0})}/>
      </label>
      <label style={labelStyle}>Critérios de correção
       <span className="avalia-help">Informe os critérios e a distribuição dos pontos.</span>
       <textarea className="avalia-answer-area" style={inputStyle} value={q.rubric}
        onChange={e=>update({rubric:e.target.value})}
        placeholder="Ex.: identificação do instituto (0,3), fundamentação (0,4), conclusão (0,3)."/>
      </label>
     </div>}
     <div className="avalia-panel" style={{background:'#f8fbff',padding:14,boxShadow:'none'}}>
      <div style={{display:'flex',gap:18,flexWrap:'wrap',alignItems:'end'}}>
       <label style={labelStyle}>Dificuldade
        <span className="avalia-levels">{([1,2,3,4,5] as Difficulty[]).map(n=><button key={n} type="button"
         aria-pressed={q.estimatedDifficulty===n} onClick={()=>update({estimatedDifficulty:n})}>{n}</button>)}</span>
       </label>
       <label style={{...labelStyle,flex:'1 1 170px'}}>Finalidade
        <select style={inputStyle} value={q.purpose[0]||'formativa'} onChange={e=>update({purpose:[e.target.value as Purpose]})}>
         <option value="diagnostica">Diagnóstica</option><option value="formativa">Formativa</option><option value="somativa">Somativa</option>
        </select>
       </label>
      </div>
      <div style={{marginTop:12}}>
       <strong style={{fontSize:13}}>Competências associadas</strong>
       <p className="avalia-help">Selecione competências cadastradas ou importadas da Construção Curricular.</p>
       {pedagogy.competencies.length?
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
         {pedagogy.competencies.map(c=><label key={c.id} style={{fontSize:13}}>
          <input type="checkbox" checked={q.competencyIds.includes(c.id)} onChange={e=>update({
           competencyIds:e.target.checked?[...new Set([...q.competencyIds,c.id])]:q.competencyIds.filter(id=>id!==c.id)
          })}/>
          {' '+c.code+' · '+c.title}
         </label>)}
        </div>:
        <p className="avalia-help">Nenhuma competência carregada. Abra as opções pedagógicas para importar ou declarar competências.</p>}
      </div>
     </div>
     <details className="avalia-deep-options">
      <summary>Curadoria pedagógica detalhada</summary>
      <div style={{marginTop:12}}>
     <RuleCurationPanel key={q.id} question={q} pedagogy={{...pedagogy,purpose}}
      onApply={statement=>update({statement})}
      onDecision={decision=>setCurationHistory(history=>[...history,decision].slice(-150))}/>
      </div>
     </details>
     <p className="avalia-help">Vínculos curriculares declarados, ainda sem homologação do PPC.</p>
    </div>}
    <QuestionBankPanel previewMode={previewMode}
     institutionId={institutionId} courseId={courseId} discipline={disciplineId}
     currentQuestion={q}
     indexLabels={[
      ...pedagogy.topics.filter(t=>q?.topicIds.includes(t.id)).map(t=>t.title),
      ...pedagogy.competencies.filter(c=>q?.competencyIds.includes(c.id)).flatMap(c=>[c.code,c.title])
     ]}
     onReuse={item=>{
      setQuestions(all=>[...all,item]);setActiveIndex(questions.length);
      setPreview(false);setLoaded(null);setErrors([]);
     }}/>
  </div>

      <details className="avalia-deep-options">
       <summary>Opções pedagógicas e análise longitudinal</summary>
       <div style={{marginTop:12}}>  <div style={cardStyle}>
   <h3 id="avalia360-parametros" style={{margin:'0 0 12px',scrollMarginTop:20}}>Opções pedagógicas e análise longitudinal</h3>
   <div style={{border:'1px solid #c9d9ee',background:'#f3f8ff',borderRadius:11,padding:14,margin:'12px 0'}}>
    <strong>Competências: fonte Construção Curricular</strong>
    <p style={{fontSize:13,margin:'6px 0 11px'}}>O cadastro definitivo de competências e de seus períodos fica no módulo Construção Curricular. Importe os vínculos deste curso e disciplina, em vez de recadastrá-los na prova.</p>
    <button type="button" onClick={importCurriculum} disabled={curriculumBusy||!courseId||!disciplineId.trim()}
     style={btn(true)}>{curriculumBusy?'Importando…':previewMode?'Importar exemplo da Construção Curricular':'Importar competências da Construção Curricular'}</button>
    {!disciplineId.trim()&&<p style={{fontSize:12,marginTop:8}}>Informe a disciplina na seção 1 para habilitar a importação.</p>}
    {curriculumSource&&<p style={{fontSize:12}}>Fonte: matriz {curriculumSource.buildId} · versão {curriculumSource.version} · {curriculumSource.ready?'períodos validados no catálogo':'períodos pendentes de validação'}</p>}
    {curriculumMessage&&<p role="status" style={{fontSize:13,marginBottom:0}}>{curriculumMessage}</p>}
   </div>
   <p style={{fontSize:13,color:'#475569'}}>Informe as competências, os temas, seus períodos de origem e as relações curriculares. Relacione-os às questões no quadro final. Estes dados são declarados e não substituem um PPC homologado.</p>
   <PedagogicalParameters value={{...pedagogy,purpose}} onChange={setPedagogy}
    questions={questions} activeIndex={activeIndex} updateQuestion={update}
    imported={!!curriculumSource}/>
   <div style={{marginTop:16,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
    <button type="button" style={btn(true)} onClick={()=>{
       const pending:string[]=[];
       if(!questions.length)pending.push('Adicione pelo menos uma questão na seção 2.');
       if(invalidCatalog)pending.push('Complete código, nome e período de todas as competências e temas cadastrados.');
       if(!courseId)pending.push('Selecione o curso na seção 1.');
       if(!disciplineId.trim())pending.push('Informe a disciplina na seção 1.');
       if(pending.length){setErrors(pending);setAnalysisVisible(false);return;}
       setErrors([]);setAnalysisVisible(true);
      }}>Analisar metadados declarados</button>
    <span style={{fontSize:12,color:'#64748b'}}>Cálculo determinístico, sem IA e sem julgamento semântico.</span>
   </div>
   <div id="avalia360-analise" style={{scrollMarginTop:20}}>
    <p style={{fontSize:12,color:'#64748b',margin:'10px 0'}}>O botão fica disponível mesmo antes do preenchimento. Se faltar alguma informação, a tela informa o que cadastrar.</p>
    {errors.length>0&&<div role="alert" style={{background:'#FFF0F0',padding:12,borderRadius:9,color:'#982F2F'}}>
      <strong>Informações necessárias:</strong>
      <ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul>
    </div>}
   {previewAnalysis&&<section aria-label="Devolutiva preliminar do algoritmo" style={{background:'#f1f7fe',padding:16,borderRadius:10,marginTop:16}}>
     <h4 style={{margin:'0 0 8px'}}>Resultado preliminar — não homologado</h4>
     <p style={{fontSize:13}}>{previewAnalysis.notice}</p>
     <div style={{display:'flex',gap:16,flexWrap:'wrap',fontWeight:650}}>
       <span>{previewAnalysis.analysis.totals.items} questões</span>
       <span>{previewAnalysis.analysis.totals.points} pontos</span>
       <span>Dificuldade média estimada: {previewAnalysis.analysis.totals.meanEstimatedDifficulty??'—'}</span>
     </div>
     <h5 style={{marginBottom:6}}>Cobertura declarada</h5>
     {previewAnalysis.analysis.coverage.competencies.length===0&&<p>Nenhuma competência obrigatória definida.</p>}
     {previewAnalysis.analysis.coverage.competencies.map(c=><p key={c.id} style={{margin:'4px 0'}}>
       {pedagogy.competencies.find(x=>x.id===c.id)?.title||c.id}: {c.items} questão(ões) · 0 vínculos verificados por PPC
     </p>)}
     {previewAnalysis.analysis.coverage.topics.map(t=><p key={t.id} style={{margin:'4px 0'}}>
       Tema {pedagogy.topics.find(x=>x.id===t.id)?.title||t.id}: {t.items} questão(ões)
     </p>)}
     <h5 style={{marginBottom:6}}>Alertas pedagógicos do motor</h5>
     {previewAnalysis.analysis.findings.length===0?<p>Sem alertas estruturais para os metadados informados.</p>:
       <ul>{previewAnalysis.analysis.findings.map((f,i)=><li key={i}>
         <strong>{f.level==='blocked'?'Bloqueio':f.level==='attention'?'Atenção':'Informação'}:</strong> {f.message}
       </li>)}</ul>}
   </section>}
   </div>
  </div>
</div>
      </details>
     </main>
        <aside className="avalia-sidebar" aria-label="Orientação e verificações">
    <div className="avalia-side-panel">
     <h4>Orientação pedagógica</h4>
     <p>Uma questão de qualidade começa com um enunciado claro.</p>
     <ul><li>Contextualize o caso e explicite o comando.</li>
      <li>Na discursiva, informe a resposta esperada e os critérios de correção.</li>
      <li>Associe as competências quando disponíveis.</li></ul>
    </div>
    <div className="avalia-side-panel">
     <h4>Verificação automática</h4>
     {q?([
      {label:'Enunciado preenchido',ok:q.statement.trim().length>=10},
      {label:'Pontuação válida',ok:Number.isFinite(q.points)&&q.points>0},
      ...(q.kind==='discursiva'?
       [{label:'Padrão esperado informado',ok:!!q.expectedAnswer?.trim()},
        {label:'Rubrica preenchida',ok:!!q.rubric.trim()},
        {label:'Linhas de resposta configuradas',ok:Number.isInteger(q.answerLines??8)&&(q.answerLines??8)>=3&&(q.answerLines??8)<=60}]:
       [{label:'Alternativas preenchidas',ok:q.options.length>=2&&q.options.every(o=>o.text.trim().length>0)},
        {label:'Gabarito selecionado',ok:q.options.some(o=>o.id===q.correctOptionId)},
        {label:'Justificativa do gabarito',ok:!!q.answerJustification?.trim()}]),
      {label:'Competência associada',ok:q.competencyIds.length>0},
      {label:'Imagens com descrição e direitos',ok:q.images.every(i=>!!i.altText.trim()&&i.rightsStatus!=='nao_informado')}
     ].map(item=><div key={item.label} className="avalia-checkrow">
      <span className={item.ok?'avalia-ok':'avalia-pending'} aria-hidden="true">{item.ok?'✓':'!'}</span>{item.label}
     </div>)):<p>Adicione uma questão para iniciar.</p>}
     <p className="avalia-help">Verificações estruturais, sem análise jurídica semântica.</p>
    </div>
    <div className="avalia-side-panel">
     <h4>Seu progresso</h4>
     <p>{questions.length} questão(ões) · {total.toLocaleString('pt-BR')} ponto(s)</p>
     <p>{receipt?'Rascunho salvo · versão '+receipt.revision:'Ainda não salvo. Salve na etapa final.'}</p>
    </div>
   </aside>
    </div>
    <div className="avalia-actions">
     <button className="avalia-action-secondary" type="button" onClick={()=>setStep(1)}>← Preparar avaliação</button>
     <button className="avalia-action-primary" type="button" onClick={()=>{setPreview(true);setStep(3)}}>Avançar para revisão →</button>
    </div>
   </>}
   {step===3&&<>
      <div style={cardStyle}>
   <h3 style={{marginTop:0}}>Revisar e finalizar</h3>
   <div style={{display:'flex',gap:9,flexWrap:'wrap',marginBottom:12}}>
    <button type="button" style={btn(false)} onClick={()=>{setPreview(!preview);setErrors([]);}}>{preview?'Ocultar prévia':'Pré-visualizar caderno'}</button>
    <button type="button" style={btn(true)} disabled={busy} onClick={save}>{busy?'Processando…':previewMode?(receipt?'Atualizar demonstração local':'Guardar demonstração local'):(receipt?'Salvar nova versão':'Salvar rascunho no Supabase')}</button>
    {receipt&&<button type="button" style={btn(false)} disabled={busy} onClick={()=>reopen()}>Reabrir do servidor</button>}
   </div>
   <div style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap',margin:'12px 0'}}>
     <label style={{...labelStyle,flex:'1 1 230px'}}>Consultar rascunho existente por ID
       <input value={lookupId} onChange={e=>setLookupId(e.target.value)} style={inputStyle}
         placeholder="Cole o identificador do rascunho salvo"/>
     </label>
     <button type="button" style={btn(false)} disabled={busy||!lookupId.trim()}
       onClick={()=>reopen(lookupId)}>Consultar versão salva</button>
   </div>
   {errors.length>0&&<div role="alert" style={{background:'#FFF0F0',padding:12,borderRadius:9,color:'#982F2F'}}>
    <strong>Corrija antes de salvar:</strong><ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul>
   </div>}
   {status&&<p role="status" aria-live="polite">{status}</p>}
   {receipt&&<p style={{color:blue,fontWeight:600}}>Identificador {previewMode?'local':''} do rascunho: {receipt.id} · revisão {receipt.revision}</p>}
   {preview&&<section style={{background:light,padding:16,borderRadius:11}}>
    <h3 style={{textAlign:'center',margin:'0 0 4px'}}>{title||'Avaliação sem título'}</h3>
    <p style={{textAlign:'center',fontSize:13}}>{courses.find(c=>c.id===courseId)?.name||'Curso não selecionado'} · {disciplineId||'Disciplina'} · {period} · {purpose}</p>
    {instructions.trim()&&<div style={{marginBottom:14}}><strong>Instruções da avaliação</strong>
     <div style={{whiteSpace:'pre-wrap'}}>{instructions.trim()}</div></div>}
    {questions.map((item,i)=><div key={item.id} style={{padding:'12px 0',borderTop:'1px solid '+line}}>
     <strong>{i+1}. {item.statement||'[Enunciado ainda não preenchido]'}</strong>
     <p style={{fontSize:12}}>{item.points} ponto(s) · dificuldade {item.estimatedDifficulty}</p>
     {item.images.filter(img=>img.placement==='enunciado').map(img=>
       <LocalFigure key={img.localId} file={img.file} alt={img.altText} caption={img.caption}/>)}
     {item.options&&item.kind==='objetiva'&&item.options.map(o=>
       <div key={o.id} style={{padding:'3px 8px'}}>
        {o.id}) {o.text||'—'}
        {item.images.filter(img=>img.placement==='alternativa'&&img.alternativeId===o.id).map(img=>
          <LocalFigure key={img.localId} file={img.file} alt={img.altText} caption={img.caption}/>)}
       </div>)}
     {item.kind==='discursiva'&&<div style={{height:50,borderBottom:'1px solid #97ABC7'}}/>}
     {item.images.filter(img=>img.placement==='apoio').map(img=>
       <LocalFigure key={img.localId} file={img.file} alt={img.altText} caption={img.caption}/>)}
    </div>)}
    <p style={{fontSize:12,color:'#64748b'}}>Prévia editorial — não equivale a PDF diagramado, folha QR ou prova publicada.</p>
   </section>}
   {loaded&&<SavedPreview value={loaded}/>}
  </div>

      <ClassBatchPublisher previewMode={previewMode} institutionId={institutionId} courseId={courseId} courseName={courses.find(c=>c.id===courseId)?.name||''}
    discipline={disciplineId} title={title} instructions={instructions} semester={period} questions={questions}/>

    <div className="avalia-actions">
     <button className="avalia-action-secondary" type="button" onClick={()=>setStep(2)}>← Editar questões</button>
     <button className="avalia-action-secondary" type="button" onClick={()=>setStep(1)}>Editar identificação</button>
    </div>
   </>}
 </section>;
}
