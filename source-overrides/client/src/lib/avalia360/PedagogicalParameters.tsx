import type {Dispatch,SetStateAction} from 'react';
import type {Difficulty,Relation} from './longitudinal-engine';
import type {PedagogicalDraft} from './declared-analysis';
import type {QuestionDraft} from './question-draft';

type Props={
 value:PedagogicalDraft;
 onChange:Dispatch<SetStateAction<PedagogicalDraft>>;
 questions:QuestionDraft[];
 activeIndex:number;
 imported?:boolean;
 updateQuestion:(change:Partial<QuestionDraft>)=>void;
};
const field={display:'grid',gap:6,fontSize:13,fontWeight:650} as const;
const input={border:'1px solid #cbd5e1',borderRadius:8,padding:'9px 11px',width:'100%',color:'#1b334f',background:'#fff'} as const;
const card={border:'1px solid #dce7f4',borderRadius:12,padding:14,marginTop:12} as const;
const relations:{id:Relation;label:string}[]=[
 {id:'prerequisito',label:'Pré-requisito'},
 {id:'aprofundamento',label:'Aprofundamento'},
 {id:'interdisciplinar',label:'Interdisciplinar'}
];
export default function PedagogicalParameters({value,onChange,questions,activeIndex,updateQuestion,imported=false}:Props){
 const selected=questions[activeIndex];
 const change=(patch:Partial<PedagogicalDraft>)=>onChange(c=>({...c,...patch}));
 const addCompetency=()=>change({competencies:[...value.competencies,{
  id:crypto.randomUUID(),code:'',title:'',period:value.currentPeriod}]});
 const addTopic=()=>change({topics:[...value.topics,{
  id:crypto.randomUUID(),title:'',period:value.currentPeriod}]});
 const toggle=(ids:string[],id:string,checked:boolean)=>checked?
  Array.from(new Set([...ids,id])):ids.filter(x=>x!==id);
 const check=(f:'competencyIds'|'topicIds',id:string,checked:boolean)=>{
  if(!selected)return;
  updateQuestion({[f]:toggle(selected[f],id,checked)});
 };
 const competencyName=(id:string)=>value.competencies.find(c=>c.id===id)?.title||'Competência sem título';
 return <section aria-label="Parâmetros pedagógicos do algoritmo">
  <div style={{background:'#eef5fc',borderLeft:'4px solid #164b92',borderRadius:8,padding:12,fontSize:13}}>
   <strong>{imported?'Competências originadas da Construção Curricular.':'Metadados declarados pelo docente.'}</strong> O motor recebe os vínculos estruturados. A importação não comprova, por si só, validação do PPC ou correção semântica das questões.
  </div>
  <div style={{...card,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>
   <label style={field}>Período do curso avaliado (1–12)
    <input style={input} type="number" min={1} max={12} value={value.currentPeriod}
      onChange={e=>change({currentPeriod:Number(e.target.value)})}/>
   </label>
   <label style={field}>Dificuldade-alvo da avaliação
    <select style={input} value={value.targetDifficulty} onChange={e=>change({targetDifficulty:Number(e.target.value) as Difficulty})}>
     {[1,2,3,4,5].map(n=><option key={n} value={n}>Nível {n}</option>)}
    </select>
   </label>
   <label style={field}>Foco externo (opcional)
    <select style={input} value={value.examFocus} onChange={e=>change({examFocus:e.target.value})}>
     <option value="">Sem exame específico</option>
     {['oab','enade','enam','enamed','residencia','enem','cfc','carreiras'].map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}
    </select>
   </label>
  </div>
  <div style={card}>
   <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',flexWrap:'wrap'}}>
    <h4 style={{margin:0}}>Competências esperadas e períodos de origem</h4>
    {!imported&&<button type="button" onClick={addCompetency}>+ Cadastrar competência declarada</button>}
   </div>
   <p style={{fontSize:12}}>{imported?'Competências importadas da Construção Curricular: edição de código, texto e período deve ocorrer no módulo de origem.':'Cadastre competências provisórias para a demonstração. A fonte definitiva é Construção Curricular.'} A cobertura será calculada pelos vínculos nas questões.</p>
   {value.competencies.map((c,i)=><div key={c.id} style={{display:'grid',gridTemplateColumns:'minmax(70px,100px) 1fr 80px auto',gap:7,alignItems:'center',margin:'9px 0'}}>
    <input aria-label={'Código da competência '+(i+1)} style={input} readOnly={imported} value={c.code} placeholder="C1"
     onChange={e=>change({competencies:value.competencies.map(x=>x.id===c.id?{...x,code:e.target.value}:x)})}/>
    <input aria-label={'Descrição da competência '+(i+1)} style={input} readOnly={imported} value={c.title} placeholder="Ex.: Interpretar normas e justificar soluções"
     onChange={e=>change({competencies:value.competencies.map(x=>x.id===c.id?{...x,title:e.target.value}:x)})}/>
    <input aria-label={'Período de origem da competência '+(i+1)} style={input} readOnly={imported} type="number" min={1} max={12} value={c.period}
     onChange={e=>change({competencies:value.competencies.map(x=>x.id===c.id?{...x,period:Number(e.target.value)}:x)})}/>
    {!imported&&<button type="button" onClick={()=>{
      change({competencies:value.competencies.filter(x=>x.id!==c.id),
        requiredCompetencyIds:value.requiredCompetencyIds.filter(id=>id!==c.id),
        relations:value.relations.filter(x=>x.sourceCompetencyId!==c.id&&x.targetCompetencyId!==c.id)});
    }}>Remover</button>}
   </div>)}
   <strong style={{fontSize:13}}>Competências que a avaliação deve contemplar</strong>
   <div style={{display:'flex',flexWrap:'wrap',gap:14,marginTop:9}}>
    {value.competencies.map(c=><label key={c.id} style={{fontSize:13}}>
      <input type="checkbox" checked={value.requiredCompetencyIds.includes(c.id)}
       onChange={e=>change({requiredCompetencyIds:toggle(value.requiredCompetencyIds,c.id,e.target.checked)})}/>
      {c.code||'Sem código'} · {c.title||'Sem título'}
    </label>)}
   </div>
  </div>
  <div style={card}>
   <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',flexWrap:'wrap'}}>
    <h4 style={{margin:0}}>Temas e subtemas a cobrir</h4>
    <button type="button" onClick={addTopic}>+ Cadastrar tema declarado</button>
   </div>
   {value.topics.map((t,i)=><div key={t.id} style={{display:'flex',gap:8,alignItems:'center',margin:'8px 0'}}>
    <input aria-label={'Nome do tema '+(i+1)} style={input} value={t.title} placeholder="Ex.: Responsabilidade civil"
     onChange={e=>change({topics:value.topics.map(x=>x.id===t.id?{...x,title:e.target.value}:x)})}/>
    <label style={{fontSize:12}}>Período
     <input aria-label={'Período do tema '+(i+1)} style={{...input,width:75}} type="number" min={1} max={12} value={t.period}
      onChange={e=>change({topics:value.topics.map(x=>x.id===t.id?{...x,period:Number(e.target.value)}:x)})}/>
    </label>
    <button type="button" onClick={()=>change({topics:value.topics.filter(x=>x.id!==t.id),
      requiredTopicIds:value.requiredTopicIds.filter(id=>id!==t.id)})}>Remover</button>
   </div>)}
   <strong style={{fontSize:13}}>Temas obrigatórios nesta avaliação</strong>
   <div style={{display:'flex',flexWrap:'wrap',gap:14,marginTop:9}}>
    {value.topics.map(t=><label key={t.id} style={{fontSize:13}}>
     <input type="checkbox" checked={value.requiredTopicIds.includes(t.id)}
      onChange={e=>change({requiredTopicIds:toggle(value.requiredTopicIds,t.id,e.target.checked)})}/>
     {t.title||'Tema sem nome'}
    </label>)}
   </div>
  </div>
  <div style={card}>
   <h4 style={{margin:'0 0 9px'}}>Relações longitudinais (declaradas)</h4>
   <p style={{fontSize:12}}>Registre relações explícitas entre competências. Sem vínculo validado, o motor somente apontará lacunas de progressão.</p>
   {value.relations.map((r,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:7,marginBottom:8}}>
    <select aria-label={'Competência de origem da relação '+(i+1)} style={input} value={r.sourceCompetencyId} onChange={e=>change({relations:value.relations.map((x,j)=>j===i?{...x,sourceCompetencyId:e.target.value}:x)})}>
     {value.competencies.map(c=><option key={c.id} value={c.id}>{c.code} {c.title}</option>)}
    </select>
    <select aria-label={'Tipo de relação '+(i+1)} style={input} value={r.kind} onChange={e=>change({relations:value.relations.map((x,j)=>j===i?{...x,kind:e.target.value as Relation}:x)})}>
     {relations.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
    <select aria-label={'Competência de destino da relação '+(i+1)} style={input} value={r.targetCompetencyId} onChange={e=>change({relations:value.relations.map((x,j)=>j===i?{...x,targetCompetencyId:e.target.value}:x)})}>
     {value.competencies.map(c=><option key={c.id} value={c.id}>{c.code} {c.title}</option>)}
    </select>
    <button type="button" onClick={()=>change({relations:value.relations.filter((_,j)=>j!==i)})}>Remover</button>
   </div>)}
   <button type="button" disabled={value.competencies.length<2}
     onClick={()=>change({relations:[...value.relations,{sourceCompetencyId:value.competencies[0].id,targetCompetencyId:value.competencies[1].id,kind:'aprofundamento'}]})}>
    + Adicionar relação entre competências
   </button>
  </div>
  <div style={{...card,background:'#f0f6ff'}}>
   <h4 style={{margin:'0 0 7px'}}>Vínculos da questão selecionada</h4>
   {!selected?<p>Adicione uma questão primeiro.</p>:<>
    <p style={{fontSize:12}}>Indique quais temas e competências esta questão pretende avaliar. Isso não valida automaticamente seu conteúdo.</p>
    <strong style={{fontSize:13}}>Competências da questão</strong>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,margin:'8px 0 14px'}}>
     {value.competencies.map(c=><label key={c.id} style={{fontSize:13}}>
      <input type="checkbox" checked={selected.competencyIds.includes(c.id)} onChange={e=>check('competencyIds',c.id,e.target.checked)}/>
      {c.code||'—'} · {c.title||'Sem título'}
     </label>)}
    </div>
    <strong style={{fontSize:13}}>Temas da questão</strong>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,margin:'8px 0 14px'}}>
     {value.topics.map(t=><label key={t.id} style={{fontSize:13}}>
      <input type="checkbox" checked={selected.topicIds.includes(t.id)} onChange={e=>check('topicIds',t.id,e.target.checked)}/>
      {t.title||'Sem título'}
     </label>)}
    </div>
    <label style={field}>Exames relacionados à questão (separados por vírgula)
     <input style={input} value={selected.examTags.join(', ')}
      onChange={e=>updateQuestion({examTags:e.target.value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)})}
      placeholder="Ex.: oab, enade"/>
    </label>
   </>}
   <p style={{fontSize:12,color:'#475569',marginBottom:0}}>Competências atualmente declaradas: {value.competencies.length}. Nenhuma é marcada como validada pelo PPC nesta demonstração.</p>
  </div>
 </section>;
}
