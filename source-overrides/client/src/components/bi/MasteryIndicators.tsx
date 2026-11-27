import {useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import './reading-indicators.css';

type Group={courseId:string;courseName:string;discipline:string;theme:string;students:number;meanPKnow:number;studentsBelow:number;attempts:number;accuracy:number|null};
type Discipline={discipline:string;students:number;meanPKnow:number;studentsBelow:number};
type Snapshot={
 ok:true;institutionId:string;educationTier:'superior'|'escolas';scope:'institution';retrievedAt:string;
 rules:{version:string;minAttempts:number;belowThreshold:number;minGroup:number};
 groups:Group[];disciplines:Discipline[];
 coverage:{records:number;matchedStudents:number;unmatchedStudents:number;insufficientEvidence:number;suppressedGroups:number;truncatedGroups:number};
};
const ROLES=new Set(['master','reitor','gestor','diretor_geral','diretor_pedagogico','procurador']);
const fmt=new Intl.NumberFormat('pt-BR');
const pct=(n:number)=>Math.round(n*100)+'%';
const prob=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1;
const int=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;

function valid(data:any,institutionId:string,expectedTier?:string):data is Snapshot{
 if(data?.ok!==true||data.institutionId!==institutionId||data.scope!=='institution'||
   !['superior','escolas'].includes(data.educationTier)||(expectedTier&&data.educationTier!==expectedTier)||
   !Number.isFinite(Date.parse(data.retrievedAt))||!Array.isArray(data.groups)||data.groups.length>300||
   !Array.isArray(data.disciplines)||!data.rules||!int(data.rules.minGroup)||!prob(data.rules.belowThreshold)||!data.coverage)return false;
 for(const g of data.groups)if(!g||typeof g.courseName!=='string'||typeof g.discipline!=='string'||typeof g.theme!=='string'||
   !int(g.students)||g.students<data.rules.minGroup||!prob(g.meanPKnow)||!int(g.studentsBelow)||g.studentsBelow>g.students||
   !(g.accuracy===null||prob(g.accuracy)))return false;
 for(const d of data.disciplines)if(!d||typeof d.discipline!=='string'||!int(d.students)||!prob(d.meanPKnow)||!int(d.studentsBelow))return false;
 return ['records','matchedStudents','unmatchedStudents','insufficientEvidence','suppressedGroups','truncatedGroups'].every(k=>int(data.coverage[k]));
}

export default function MasteryIndicators({institutionId,role,expectedTier}:{institutionId:string;role:string|null;expectedTier?:'superior'|'escolas'}){
 const [refresh,setRefresh]=useState(0);
 const [course,setCourse]=useState('');
 const [state,setState]=useState<{scope:string;data?:Snapshot;error?:string;loading:boolean}>({scope:'',loading:true});
 const sequence=useRef(0);
 const scope=[institutionId,role,expectedTier].join(':');
 const allowed=Boolean(institutionId&&role&&ROLES.has(role));
 useEffect(()=>{
  const current=++sequence.current;
  if(!allowed)return;
  setState({scope,loading:true});setCourse('');
  void (async()=>{
   try{
    const {data,error}=await supabase.functions.invoke('vertice-learning-bridge',{body:{operation:'mastery_indicators',institutionId}});
    if(error||data?.error)throw new Error('Consulta de domínio indisponível. Verifique a sessão com MFA, a autorização institucional e a conexão com o Fato & Ordem.');
    if(!valid(data,institutionId,expectedTier))throw new Error('Resposta de domínio incompatível com a instituição selecionada.');
    if(current===sequence.current)setState({scope,loading:false,data});
   }catch(error){if(current===sequence.current)setState({scope,loading:false,error:error instanceof Error?error.message:'Consulta de domínio indisponível.'});}
  })();
  return()=>{sequence.current++;};
 },[institutionId,role,expectedTier,refresh,allowed,scope]);
 const current=state.scope===scope?state:undefined;
 const snapshot=current?.data;
 const courses=useMemo(()=>snapshot?[...new Map(snapshot.groups.map(g=>[g.courseId,g.courseName])).entries()].sort((a,b)=>a[1].localeCompare(b[1])):[],[snapshot]);
 const rows=snapshot?snapshot.groups.filter(g=>!course||g.courseId===course):[];
 if(!allowed)return <section className="reading-indicators"><h3>Domínio por competência</h3><p>Indicadores agregados de domínio restritos à alta gestão autorizada.</p></section>;
 return <section className="reading-indicators" aria-label="Domínio por competência">
  <header><div><small>FATO & ORDEM · MOTOR ADAPTATIVO</small><h3>Domínio por competência</h3></div>
   <button type="button" disabled={!current||current.loading} onClick={()=>setRefresh(n=>n+1)}>Atualizar domínio</button></header>
  <p role="note"><strong>Indicador descritivo, não é nota nem previsão.</strong> Probabilidade de domínio estimada pelo Fato & Ordem a partir das respostas dos alunos vinculados. Nenhum aluno é identificado nesta visão.</p>
  {(!current||current.loading)&&<p role="status">Consultando domínio por competência…</p>}
  {current?.error&&<p role="alert">{current.error} Nenhum valor anterior é apresentado como atualizado.</p>}
  {snapshot&&<>
   <p className="reading-provenance">Fonte: Fato & Ordem · consultado em <time dateTime={snapshot.retrievedAt}>{new Date(snapshot.retrievedAt).toLocaleString('pt-BR')}</time>. Regras v{snapshot.rules.version}: mínimo de {snapshot.rules.minAttempts} tentativas por tema; “abaixo” = domínio menor que {pct(snapshot.rules.belowThreshold)}; grupos com menos de {snapshot.rules.minGroup} alunos são suprimidos.</p>
   <p className="reading-provenance">Cobertura: {fmt.format(snapshot.coverage.matchedStudents)} vínculo(s) aluno-curso com matrícula ativa · {fmt.format(snapshot.coverage.unmatchedStudents)} sem matrícula ativa na Vértice (fora do cálculo) · {fmt.format(snapshot.coverage.insufficientEvidence)} registro(s) com evidência insuficiente · {fmt.format(snapshot.coverage.suppressedGroups)} grupo(s) suprimido(s){snapshot.coverage.truncatedGroups?` · ${fmt.format(snapshot.coverage.truncatedGroups)} grupo(s) além do limite de exibição`:''}.</p>
   {!snapshot.groups.length&&!snapshot.disciplines.length?<p role="status">Nenhum grupo com evidência suficiente no recorte autorizado. Isso não comprova ausência de estudo.</p>:<>
    {snapshot.disciplines.length>0&&<div className="reading-scroll"><table><caption>Síntese por disciplina (todos os cursos)</caption><thead><tr><th scope="col">Disciplina</th><th scope="col">Alunos avaliados</th><th scope="col">Domínio médio</th><th scope="col">Alunos com tema abaixo</th></tr></thead><tbody>
     {snapshot.disciplines.map(d=><tr key={d.discipline}><th scope="row">{d.discipline}</th><td>{fmt.format(d.students)}</td><td>{pct(d.meanPKnow)}</td><td>{fmt.format(d.studentsBelow)}</td></tr>)}
    </tbody></table></div>}
    {courses.length>1&&<label style={{display:'grid',gap:6,maxWidth:420,margin:'14px 0'}}><strong>Curso</strong><select value={course} onChange={e=>setCourse(e.target.value)}><option value="">Todos os cursos</option>{courses.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
    {rows.length>0&&<div className="reading-scroll"><table><caption>Temas em ordem crescente de domínio</caption><thead><tr><th scope="col">Curso</th><th scope="col">Disciplina · tema</th><th scope="col">Alunos</th><th scope="col">Domínio médio</th><th scope="col">Abaixo</th><th scope="col">Acerto</th></tr></thead><tbody>
     {rows.map(g=><tr key={g.courseId+g.discipline+g.theme}><td style={{textAlign:'left'}}>{g.courseName}</td><th scope="row">{g.theme?`${g.discipline} · ${g.theme}`:`${g.discipline} (tema geral)`}</th><td>{fmt.format(g.students)}</td><td>{pct(g.meanPKnow)}</td><td>{fmt.format(g.studentsBelow)}</td><td>{g.accuracy===null?'—':pct(g.accuracy)}</td></tr>)}
    </tbody></table></div>}
   </>}
  </>}
 </section>;
}
