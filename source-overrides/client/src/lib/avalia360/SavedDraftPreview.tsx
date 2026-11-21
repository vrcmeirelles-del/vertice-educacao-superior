import type {StoredAssessmentDraft} from './draft-api';
const line='#DCE7F4';
const cardStyle={background:'#fff',border:'1px solid '+line,borderRadius:14,padding:18,marginBottom:16} as const;
/** Prévia somente leitura de um caderno salvo (autor ou colegiado). */
const text=(v:unknown)=>typeof v==='string'?v:'';
export default function SavedPreview({value,showAnswerKey=false}: {value:StoredAssessmentDraft;showAnswerKey?:boolean}){
 return <section style={cardStyle} aria-label="Rascunho recuperado do servidor">
  <h3 style={{marginTop:0}}>Caderno recuperado do servidor</h3>
  <p><strong>{value.snapshot.meta?.title||'Avaliação'}</strong> · {value.snapshot.meta?.semester||'sem semestre informado'} · {value.snapshot.meta?.purpose||'sem finalidade informada'}</p>
  <p>Versão {value.revision} · {value.snapshot.curriculumStatus==='linked'?'Matriz associada':'Aguardando vinculação ao PPC'}</p>
  {value.snapshot.meta?.teacherName&&<p>Professor: {value.snapshot.meta.teacherName}</p>}
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
   {showAnswerKey&&<div style={{background:'#F5F9FF',border:'1px dashed #9DB7DA',borderRadius:8,padding:'8px 12px',fontSize:13,marginTop:6}}>
    <strong>Uso exclusivo do colegiado</strong> · {String(q.kind||'')} · {String(q.points??'')} ponto(s) · dificuldade declarada {String(q.estimatedDifficulty??'')}
    {q.kind==='objetiva'?<>
     <p style={{margin:'5px 0'}}>Gabarito: <strong>{text(q.correctOptionId)||'não definido'}</strong></p>
     <p style={{margin:'5px 0',whiteSpace:'pre-wrap'}}>Justificativa: {text(q.answerJustification)||'—'}</p>
    </>:<>
     <p style={{margin:'5px 0',whiteSpace:'pre-wrap'}}>Rubrica: {text(q.rubric)||'—'}</p>
     <p style={{margin:'5px 0',whiteSpace:'pre-wrap'}}>Padrão de resposta: {text(q.expectedAnswer)||'—'}</p>
    </>}
    {Array.isArray(q.examTags)&&q.examTags.length>0&&<p style={{margin:'5px 0'}}>Exames: {(q.examTags as string[]).join(', ')}</p>}
   </div>}
  </div>)}
  <p style={{fontSize:12,color:'#64748b'}}>O acesso visual às imagens armazenadas requer URL autenticada temporária. A presença do vínculo não comprova acesso ao binário.</p>
 </section>;
}
