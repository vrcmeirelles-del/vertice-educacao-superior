import {useState} from 'react';
import {composeTeacherQuestion,type TeachingStructure} from './question-construction';
type Props={onApply:(statement:string)=>void};
export default function TeacherQuestionComposer({onApply}:Props){
 const [open,setOpen]=useState(false);
 const [structure,setStructure]=useState<TeachingStructure>('caso');
 const [context,setContext]=useState('');
 const [task,setTask]=useState('');
 const [comparisonObject,setComparisonObject]=useState('');
 const [errors,setErrors]=useState<string[]>([]);
 const assemble=()=>{
  const result=composeTeacherQuestion({structure,context,task,comparisonObject});
  if(!result.ok){setErrors(result.issues);return;}
  onApply(result.statement);setErrors([]);setOpen(false);
 };
 return <section style={{padding:'11px 14px',border:'1px solid #d6e2f1',borderRadius:10,background:'#f8fbff'}}>
   <button type="button" onClick={()=>setOpen(x=>!x)}
     aria-expanded={open} style={{fontWeight:700}}>
    {open?'Fechar estrutura orientada':'Montar enunciado com estrutura orientada (sem IA)'}
   </button>
   {open&&<div style={{display:'grid',gap:11,marginTop:12}}>
    <p style={{fontSize:12,margin:0,color:'#475569'}}>O professor fornece os fatos e o comando. O sistema apenas organiza o texto; nenhuma legislação, conceito ou resposta é gerada automaticamente.</p>
    <label>Estrutura pedagógica
     <select value={structure} onChange={e=>setStructure(e.target.value as TeachingStructure)}
       style={{display:'block',width:'100%',padding:9}}>
      <option value="caso">Estudo de caso</option>
      <option value="problema">Situação-problema</option>
      <option value="comparacao">Análise comparativa</option>
     </select>
    </label>
    <label>Contexto ou situação elaborada pelo professor
     <textarea value={context} onChange={e=>setContext(e.target.value)}
       placeholder="Descreva fatos e dados relevantes, sem informações pessoais reais." rows={4}
       style={{display:'block',width:'100%',padding:9}}/>
    </label>
    {structure==='comparacao'&&<label>Objeto da comparação
     <input value={comparisonObject} onChange={e=>setComparisonObject(e.target.value)}
       placeholder="Ex.: instituto A e instituto B" style={{display:'block',width:'100%',padding:9}}/>
    </label>}
    <label>Comando de avaliação elaborado pelo professor
     <textarea value={task} onChange={e=>setTask(e.target.value)}
       placeholder="Ex.: identifique as consequências jurídicas e justifique sua resposta." rows={3}
       style={{display:'block',width:'100%',padding:9}}/>
    </label>
    {errors.length>0&&<div role="alert"><ul>{errors.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
    <button type="button" onClick={assemble}
     style={{background:'#164b92',color:'#fff',padding:'10px 14px',border:0,borderRadius:8,fontWeight:700}}>
     Montar e inserir no enunciado para revisão
    </button>
    <p style={{fontSize:12,color:'#64748b',margin:0}}>A montagem substitui o enunciado editável da questão selecionada. Revise antes de salvar.</p>
   </div>}
 </section>;
}
