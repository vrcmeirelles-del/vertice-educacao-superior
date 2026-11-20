import {useCallback,useEffect,useRef,useState} from 'react';
import {QuestionImageField} from './QuestionImageField';
import type {QuestionDraft} from './question-draft';
import {saveAssessmentDraft,loadAssessmentDraft,type DraftReceipt,type StoredAssessmentDraft} from './draft-api';
import {uploadQuestionImage,type UploadedImageReceipt} from './private-image-upload';
import {receiptScopeKey,reusableReceipt,type ScopedImageReceipt} from './receipt-cache';
import type {Difficulty,Purpose} from './longitudinal-engine';

export interface Avalia360StudioProps {
 institutionId:string;
 courses:Array<{id:string;name:string}>;
}
const blue='#164B92',light='#EFF5FC',line='#DCE7F4';
const labelStyle={display:'grid',gap:5,fontWeight:600,fontSize:13} as const;
const inputStyle={padding:'10px 12px',border:'1px solid '+line,borderRadius:8,minWidth:0,width:'100%',background:'#fff'} as const;
const cardStyle={background:'#fff',border:'1px solid '+line,borderRadius:14,padding:18,marginBottom:16} as const;
const initial=(disciplineId:string):QuestionDraft=>({
 id:crypto.randomUUID(),disciplineId,kind:'objetiva',statement:'',
 options:['A','B','C','D','E'].map(id=>({id,text:''})),correctOptionId:'',
 rubric:'',topicIds:[],competencyIds:[],purpose:['formativa'],
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
  }else if(!q.rubric.trim())errors.push(ref+'informe a rubrica da discursiva.');
  q.images.forEach((m,j)=>{
   if(!m.altText.trim())errors.push(ref+'a imagem '+(j+1)+' exige descrição acessível.');
   if(m.rightsStatus==='nao_informado')errors.push(ref+'declare o direito de uso da imagem '+(j+1)+'.');
   if(m.placement==='alternativa'&&!q.options.some(o=>o.id===m.alternativeId))
    errors.push(ref+'imagem vinculada a alternativa inexistente.');
  });
 });
 return errors;
}
function SavedPreview({value}: {value:StoredAssessmentDraft}){
 return <section style={cardStyle} aria-label="Rascunho recuperado do servidor">
  <h3 style={{marginTop:0}}>Caderno recuperado do servidor</h3>
  <p>Versão {value.revision} · {value.snapshot.curriculumStatus==='linked'?'Matriz associada':'Aguardando vinculação ao PPC'}</p>
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
export default function Avalia360Studio({institutionId,courses}:Avalia360StudioProps){
 const [courseId,setCourseId]=useState('');
 const [disciplineId,setDisciplineId]=useState('');
 const [title,setTitle]=useState('');
 const [period,setPeriod]=useState('2027/1');
 const [purpose,setPurpose]=useState<Purpose>('formativa');
 const [questions,setQuestions]=useState<QuestionDraft[]>([]);
 const [activeIndex,setActiveIndex]=useState(0);
 const [preview,setPreview]=useState(false);
 const [receipt,setReceipt]=useState<DraftReceipt|null>(null);
 const [loaded,setLoaded]=useState<StoredAssessmentDraft|null>(null);
 const [errors,setErrors]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const uploads=useRef(new Map<string,ScopedImageReceipt>());
 useEffect(()=>{setReceipt(null);setLoaded(null);setQuestions([]);setPreview(false);uploads.current.clear();setStatus('');},[institutionId,courseId]);
 const update=useCallback((change:Partial<QuestionDraft>)=>{
  setQuestions(all=>all.map((q,i)=>i===activeIndex?{...q,...change}:q));
  setLoaded(null);
 },[activeIndex]);
 const add=()=>{
  if(!disciplineId.trim()){setErrors(['Informe a disciplina antes de adicionar questões.']);return;}
  const q=initial(disciplineId.trim());
  setQuestions(all=>[...all,q]);setActiveIndex(questions.length);setErrors([]);setPreview(false);
 };
 const remove=(index:number)=>{
  setQuestions(all=>all.filter((_,i)=>i!==index));
  setActiveIndex(0);setErrors([]);setLoaded(null);
 };
 const setDiscipline=(value:string)=>{
  setDisciplineId(value);
  if(questions.length) setQuestions(all=>all.map(q=>({...q,disciplineId:value})));
 };
 const q=questions[activeIndex];
 const total=questions.reduce((s,x)=>s+x.points,0);
 const save=async()=>{
  if(!courseId){setErrors(['Selecione o curso.']);return;}
  if(!disciplineId.trim()){setErrors(['Informe a disciplina.']);return;}
  const issues=checkDraft(questions);
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
   setStatus('Salvando versão no Supabase…');
   const out=await saveAssessmentDraft({institutionId,courseId,disciplineId,
     ...(receipt?{draftId:receipt.id,expectedRevision:receipt.revision}:{}),
     questions,uploadedImages:grouped,assessmentMeta:{title:title.trim(),semester:period.trim(),purpose}});
   if(!out.ok){setStatus('Falha no salvamento.');setErrors([out.error.message]);return;}
   setReceipt(out.receipt);setStatus('Rascunho salvo na versão '+out.receipt.revision+'.');
   setLoaded(null);
  }catch(e){setStatus('Salvamento não concluído.');setErrors([e instanceof Error?e.message:'Falha ao conectar ao armazenamento privado.']);}
  finally{setBusy(false);}
 };
 const reopen=async()=>{
  if(!receipt)return;
  setBusy(true);setErrors([]);setStatus('Reabrindo rascunho autorizado…');
  const found=await loadAssessmentDraft({institutionId,courseId,disciplineId,draftId:receipt.id});
  if(found.ok){setLoaded(found.draft);setStatus('Rascunho recuperado do Supabase.');}
  else{setStatus('Não foi possível reabrir.');setErrors([found.error.message]);}
  setBusy(false);
 };
 const btn=(primary:boolean)=>({padding:'10px 16px',borderRadius:9,border:'1px solid '+blue,
  background:primary?blue:'#fff',color:primary?'#fff':blue,fontWeight:700,cursor:'pointer'} as const);
 return <section aria-label="Estúdio de Avaliações 360" style={{background:'#F6F9FD',padding:'18px',borderRadius:16,color:'#1B334F'}}>
  <header style={{marginBottom:18}}>
   <p style={{margin:'0 0 6px',fontSize:12,fontWeight:800,color:blue,letterSpacing:1}}>VÉRTICE · ENSINO SUPERIOR</p>
   <h2 style={{margin:'0 0 8px',fontSize:27}}>Avalia 360° — Estúdio de Avaliações</h2>
   <p style={{margin:'0 0 10px',maxWidth:800}}>Construa avaliações, associe questões, inclua imagens e revise o caderno antes de salvar. O parecer curricular será habilitado somente quando o PPC e as competências estiverem validados.</p>
   <div role="note" style={{padding:'10px 14px',borderRadius:10,background:'#FFF7E8',color:'#814B08',fontSize:13}}>
    Ambiente em desenvolvimento — o salvamento depende das RPCs autorizadas, MFA e Storage no Supabase. Nenhuma avaliação é publicada aos alunos por esta tela.
   </div>
  </header>
  <div style={cardStyle}>
   <h3 style={{margin:'0 0 14px'}}>1 · Identificação da avaliação</h3>
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
   <p style={{fontSize:12,color:'#64748b',marginBottom:0}}>Título, semestre e finalidade são versionados com o rascunho. O vínculo a competências depende de catálogo institucional validado.</p>
  </div>
  <div style={cardStyle}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
    <h3 style={{margin:0}}>2 · Questões da prova</h3>
    <strong style={{color:blue}}>{questions.length} questão(ões) · {total.toLocaleString('pt-BR')} pontos</strong>
   </div>
   <p style={{fontSize:13,color:'#64748b'}}>Questões sem mapeamento curricular podem ser salvas como rascunho. Não recebem parecer de aderência ao PPC até que temas e competências institucionais estejam disponíveis.</p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
    {questions.map((item,i)=><button key={item.id} type="button" onClick={()=>{setActiveIndex(i);setPreview(false);}}
     style={{...btn(i===activeIndex),padding:'8px 12px'}} aria-pressed={i===activeIndex}>
       Questão {i+1} · {item.kind==='objetiva'?'Objetiva':'Discursiva'}
     </button>)}
    <button type="button" style={btn(false)} onClick={add}>+ Adicionar questão</button>
   </div>
   {!q?<p>Adicione a primeira questão para começar.</p>:
    <div style={{display:'grid',gap:12}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
      <strong>Questão {activeIndex+1}</strong>
      <button type="button" style={{...btn(false),borderColor:'#B84A4A',color:'#9B3434'}} onClick={()=>remove(activeIndex)}>Excluir questão</button>
     </div>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>
      <label style={labelStyle}>Tipo
       <select style={inputStyle} value={q.kind} onChange={e=>update({kind:e.target.value as QuestionDraft['kind']})}>
        <option value="objetiva">Objetiva</option><option value="discursiva">Discursiva</option>
       </select>
      </label>
      <label style={labelStyle}>Dificuldade estimada (1 a 5)
       <select style={inputStyle} value={q.estimatedDifficulty} onChange={e=>update({estimatedDifficulty:Number(e.target.value) as Difficulty})}>
        {[1,2,3,4,5].map(n=><option key={n} value={n}>Nível {n}</option>)}
       </select>
      </label>
      <label style={labelStyle}>Pontos
       <input style={inputStyle} type="number" min=".01" step=".25" value={q.points} onChange={e=>update({points:Number(e.target.value)})}/>
      </label>
      <label style={labelStyle}>Finalidade da questão
       <select style={inputStyle} value={q.purpose[0]||'formativa'} onChange={e=>update({purpose:[e.target.value as Purpose]})}>
        <option value="diagnostica">Diagnóstica</option><option value="formativa">Formativa</option><option value="somativa">Somativa</option>
       </select>
      </label>
     </div>
     <label style={labelStyle}>Enunciado
      <textarea style={{...inputStyle,minHeight:105}} value={q.statement} onChange={e=>update({statement:e.target.value})} placeholder="Escreva o enunciado ou cole o texto da questão"/>
     </label>
     {q.kind==='objetiva'?<fieldset style={{border:'1px solid '+line,borderRadius:10}}>
      <legend style={{fontWeight:700}}>Alternativas e gabarito</legend>
      {q.options.map(o=><div key={o.id} style={{display:'grid',gridTemplateColumns:'50px 1fr 90px',gap:8,alignItems:'center',marginBottom:8}}>
       <strong>{o.id}</strong>
       <input style={inputStyle} value={o.text} onChange={e=>update({options:q.options.map(a=>a.id===o.id?{...a,text:e.target.value}:a)})} aria-label={'Alternativa '+o.id}/>
       <label style={{fontSize:12}}><input type="radio" name={'correct-'+q.id} checked={q.correctOptionId===o.id} onChange={()=>update({correctOptionId:o.id})}/> Correta</label>
      </div>)}
     </fieldset>:<label style={labelStyle}>Rubrica de correção
      <textarea style={{...inputStyle,minHeight:110}} value={q.rubric} onChange={e=>update({rubric:e.target.value})} placeholder="Critérios, fundamentação e distribuição de pontos"/>
     </label>}
     <QuestionImageField questionId={q.id} value={q.images} onChange={images=>update({images})}/>
     <div style={{background:light,padding:12,borderRadius:10,fontSize:13}}>Vínculo com o PPC: <strong>pendente</strong>. As competências e os temas serão selecionados do catálogo institucional validado; não serão criados automaticamente a partir do enunciado.</div>
    </div>}
  </div>
  <div style={cardStyle}>
   <h3 style={{marginTop:0}}>3 · Revisar e salvar</h3>
   <div style={{display:'flex',gap:9,flexWrap:'wrap',marginBottom:12}}>
    <button type="button" style={btn(false)} onClick={()=>{setPreview(!preview);setErrors([]);}}>{preview?'Ocultar prévia':'Pré-visualizar caderno'}</button>
    <button type="button" style={btn(true)} disabled={busy} onClick={save}>{busy?'Processando…':receipt?'Salvar nova versão':'Salvar rascunho no Supabase'}</button>
    {receipt&&<button type="button" style={btn(false)} disabled={busy} onClick={reopen}>Reabrir do servidor</button>}
   </div>
   {errors.length>0&&<div role="alert" style={{background:'#FFF0F0',padding:12,borderRadius:9,color:'#982F2F'}}>
    <strong>Corrija antes de salvar:</strong><ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul>
   </div>}
   {status&&<p role="status" aria-live="polite">{status}</p>}
   {receipt&&<p style={{color:blue,fontWeight:600}}>Identificador do rascunho: {receipt.id} · revisão {receipt.revision}</p>}
   {preview&&<section style={{background:light,padding:16,borderRadius:11}}>
    <h3 style={{textAlign:'center',margin:'0 0 4px'}}>{title||'Avaliação sem título'}</h3>
    <p style={{textAlign:'center',fontSize:13}}>{courses.find(c=>c.id===courseId)?.name||'Curso não selecionado'} · {disciplineId||'Disciplina'} · {period} · {purpose}</p>
    {questions.map((item,i)=><div key={item.id} style={{padding:'12px 0',borderTop:'1px solid '+line}}>
     <strong>{i+1}. {item.statement||'[Enunciado ainda não preenchido]'}</strong>
     <p style={{fontSize:12}}>{item.points} ponto(s) · dificuldade {item.estimatedDifficulty}</p>
     {item.options&&item.kind==='objetiva'&&item.options.map(o=><div key={o.id} style={{padding:'3px 8px'}}>{o.id}) {o.text||'—'}</div>)}
     {item.kind==='discursiva'&&<div style={{height:50,borderBottom:'1px solid #97ABC7'}}/>}
     {item.images.map((img,k)=><p key={img.localId} style={{fontSize:13}}>Imagem {k+1}: {img.caption||img.altText||img.file.name} · posição: {img.placement}</p>)}
    </div>)}
    <p style={{fontSize:12,color:'#64748b'}}>Prévia editorial — não equivale a PDF diagramado, folha QR ou prova publicada.</p>
   </section>}
   {loaded&&<SavedPreview value={loaded}/>}
  </div>
 </section>;
}
