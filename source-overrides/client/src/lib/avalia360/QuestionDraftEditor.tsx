import { useState, type FormEvent } from 'react';
import type { Difficulty, Purpose } from './longitudinal-engine';
import { QuestionImageField, type PendingQuestionImage } from './QuestionImageField';
import { validateQuestionDraft, type QuestionDraft, type QuestionKind, type DraftIssue } from './question-draft';

export interface QuestionOption { id:string; title:string; }
export interface QuestionEditorProps {
  disciplineId: string;
  topics: QuestionOption[];
  competencies: QuestionOption[];
  onPrepare: (draft: QuestionDraft) => void;
  disabled?: boolean;
}
const ids = ['A','B','C','D','E','F','G','H'];
const createDraft = (disciplineId:string):QuestionDraft => ({
 id:crypto.randomUUID(),disciplineId,kind:'objetiva',statement:'',
 options:ids.slice(0,5).map(id=>({id,text:''})),correctOptionId:'',
 rubric:'',expectedAnswer:'',answerJustification:'',answerLines:8,topicIds:[],competencyIds:[],purpose:['formativa'],
 estimatedDifficulty:3,points:1,examTags:[],images:[]
});
/**
 * Formulário de elaboração/edição local, ainda não montado no portal.
 * NÃO salva automaticamente, NÃO publica questões e NÃO realiza upload.
 * O serviço receptor futuro precisa autenticar, validar escopo e persistir.
 */
export function QuestionDraftEditor({
 disciplineId,topics,competencies,onPrepare,disabled=false
}:QuestionEditorProps) {
 const [draft,setDraft]=useState<QuestionDraft>(()=>createDraft(disciplineId));
 const [issues,setIssues]=useState<DraftIssue[]>([]);
 const [examInput,setExamInput]=useState('');
 const patch=(part:Partial<QuestionDraft>)=>{
   setDraft(d=>({...d,...part}));
   setIssues([]);
 };
 const toggle=(field:'topicIds'|'competencyIds',id:string,checked:boolean)=>{
   patch({[field]:checked?[...draft[field],id]:draft[field].filter(x=>x!==id)});
 };
 const togglePurpose=(value:Purpose,checked:boolean)=>
   patch({purpose:checked?[...draft.purpose,value]:draft.purpose.filter(x=>x!==value)});
 const prepare=(event:FormEvent<HTMLFormElement>)=>{
   event.preventDefault();
   const current={...draft,examTags:examInput.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)};
   const found=validateQuestionDraft(current,topics.map(t=>t.id),competencies.map(c=>c.id));
   setIssues(found);
   if (found.length===0) onPrepare(current);
 };
 return <form onSubmit={prepare} aria-label="Elaboração de questão — Avalia 360°">
  <h3>Elaborar questão</h3>
  <p>Rascunho local — revisão docente obrigatória antes de integrar ao banco de questões.</p>
  <fieldset disabled={disabled}>
    <label>Tipo de questão
      <select value={draft.kind} onChange={e=>patch({kind:e.target.value as QuestionKind})}>
        <option value="objetiva">Objetiva</option>
        <option value="discursiva">Discursiva</option>
      </select>
    </label>
    <label style={{display:'block',marginTop:10}}>Enunciado
      <textarea value={draft.statement} rows={6} onChange={e=>patch({statement:e.target.value})}
        placeholder="Cole ou escreva o enunciado. As figuras são adicionadas no campo abaixo."
        style={{display:'block',width:'100%'}}/>
    </label>
    {draft.kind==='objetiva' ?
      <fieldset><legend>Alternativas e gabarito</legend>
        {draft.options.map(option=><label key={option.id} style={{display:'block',margin:'8px 0'}}>
          {option.id}{' '}
          <input type="text" value={option.text} placeholder={`Texto da alternativa ${option.id}`}
            onChange={e=>patch({options:draft.options.map(x=>x.id===option.id?{...x,text:e.target.value}:x)})}/>
          <input type="radio" name={draft.id+'-gabarito'} checked={draft.correctOptionId===option.id}
            onChange={()=>patch({correctOptionId:option.id})}/> Correta
        </label>)}
        <button type="button" disabled={draft.options.length<=2}
          onClick={()=>{const options=draft.options.slice(0,-1);patch({options,
            correctOptionId:options.some(x=>x.id===draft.correctOptionId)?draft.correctOptionId:''});}}>
          Remover última alternativa
        </button>{' '}
        <button type="button" disabled={draft.options.length>=8}
          onClick={()=>patch({options:[...draft.options,{id:ids[draft.options.length],text:''}]})}>
          Adicionar alternativa
        </button>
      </fieldset> :
      <label style={{display:'block',marginTop:10}}>Rubrica de correção (critérios e pontuação)
        <textarea rows={5} value={draft.rubric} onChange={e=>patch({rubric:e.target.value})}
          placeholder="Ex.: identificação do problema — 2 pontos; fundamentação — 3 pontos..."
          style={{display:'block',width:'100%'}}/>
      </label>}
    {draft.kind==='discursiva'&&<label style={{display:'block',marginTop:10}}>Padrão de resposta esperado
      <textarea rows={6} value={draft.expectedAnswer||''} onChange={e=>patch({expectedAnswer:e.target.value})}
       placeholder="Resposta-modelo, argumentos e fundamentos esperados do estudante. Não substitui rubrica."
       style={{display:'block',width:'100%'}}/>
    </label>}
    <QuestionImageField questionId={draft.id} value={draft.images}
      onChange={(images:PendingQuestionImage[])=>patch({images})}/>
    <fieldset><legend>Temas e subtemas do catálogo curricular</legend>
      {topics.length===0?<p>Nenhum tema autorizado disponível. Solicite o cadastro.</p>:
        topics.map(t=><label key={t.id} style={{display:'block'}}>
          <input type="checkbox" checked={draft.topicIds.includes(t.id)}
            onChange={e=>toggle('topicIds',t.id,e.target.checked)}/>{t.title}
        </label>)}
    </fieldset>
    <fieldset><legend>Competências curriculares</legend>
      {competencies.length===0?<p>Não há competências liberadas para esta disciplina.</p>:
        competencies.map(c=><label key={c.id} style={{display:'block'}}>
          <input type="checkbox" checked={draft.competencyIds.includes(c.id)}
            onChange={e=>toggle('competencyIds',c.id,e.target.checked)}/>{c.title}
        </label>)}
    </fieldset>
    <fieldset><legend>Finalidade pedagógica</legend>
      {(['diagnostica','formativa','somativa'] as Purpose[]).map(p=><label key={p} style={{marginRight:12}}>
        <input type="checkbox" checked={draft.purpose.includes(p)}
          onChange={e=>togglePurpose(p,e.target.checked)}/>{p}
      </label>)}
    </fieldset>
    <label>Dificuldade estimada
      <select value={draft.estimatedDifficulty} onChange={e=>patch({estimatedDifficulty:Number(e.target.value) as Difficulty})}>
        {[1,2,3,4,5].map(level=><option key={level} value={level}>Nível {level}</option>)}
      </select>
    </label>{' '}
    <label>Pontuação
      <input type="number" min="0.01" step="0.01" value={draft.points}
        onChange={e=>patch({points:Number(e.target.value)})}/>
    </label>
    <label style={{display:'block'}}>Exames de referência (opcional, separados por vírgula)
      <input value={examInput} onChange={e=>setExamInput(e.target.value)}
        placeholder="enade, oab, cfc, enamed" style={{display:'block',width:'100%'}}/>
    </label>
    {issues.length>0&&<section role="alert" aria-label="Pendências da questão">
      <strong>Corrija antes de enviar para curadoria:</strong>
      <ul>{issues.map((issue,i)=><li key={issue.code+i}>{issue.message}</li>)}</ul>
    </section>}
    <button type="submit">Validar e preparar para curadoria</button>
  </fieldset>
 </form>;
}
