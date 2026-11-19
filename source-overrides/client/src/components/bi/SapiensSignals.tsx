import {useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import './reading-indicators.css';

type Status='ativo'|'em_queda'|'sem_atividade'|'nunca_iniciou';
type Diagnosis={code:string;label:string;family:string|null;competency:{kcId:string;discipline:string|null;theme:string|null}|null;since:string;sampleSize:number};
type Prescription={rule:string;label:string;diagnosticCode:string;since:string;deadline:string|null};
type Student={enrollmentRef:string;courseId:string;courseName:string;
 engagement:{status:Status;lastActivityAt:string|null;answersLast7Days:number;answersPrevious7Days:number;activeDaysLast14:number;pausesAcceptedLast14Days:number};
 diagnostics:Diagnosis[];prescriptions:Prescription[]};
type Snapshot={ok:true;institutionId:string;educationTier:'superior'|'escolas';scope:'institution';retrievedAt:string;
 summary:Record<Status|'comDiagnostico'|'comPrescricao',number>;students:Student[];unmatched:number};

// Mesmo recorte de papéis da ponte (alta gestão autorizada); nenhuma permissão nova.
const ROLES=new Set(['master','reitor','gestor','diretor_geral','diretor_pedagogico','procurador']);
const STATUS:Record<Status,{label:string;hint:string}>={
 sem_atividade:{label:'Sem atividade',hint:'7 dias ou mais sem responder, depois de ter estudado'},
 em_queda:{label:'Em queda',hint:'menos da metade das respostas da semana anterior (mínimo de 10)'},
 nunca_iniciou:{label:'Nunca iniciou',hint:'vinculado, sem nenhuma resposta'},
 ativo:{label:'Ativo',hint:'estudando com regularidade'},
};
const ORDER:Status[]=['sem_atividade','em_queda','nunca_iniciou','ativo'];
const fmt=new Intl.NumberFormat('pt-BR');
const day=(v:string|null)=>v?new Date(v).toLocaleDateString('pt-BR'):'—';

function valid(data:any,institutionId:string,expectedTier?:string):data is Snapshot{
 if(data?.ok!==true||data.institutionId!==institutionId||data.scope!=='institution'||
   !['superior','escolas'].includes(data.educationTier)||(expectedTier&&data.educationTier!==expectedTier)||
   !Array.isArray(data.students)||data.students.length>20000||!Number.isFinite(Date.parse(data.retrievedAt))||
   !data.summary||typeof data.summary!=='object')return false;
 return data.students.every((s:any)=>s&&typeof s.enrollmentRef==='string'&&typeof s.courseName==='string'&&
  Object.hasOwn(STATUS,s.engagement?.status)&&Array.isArray(s.diagnostics)&&Array.isArray(s.prescriptions));
}

export default function SapiensSignals({institutionId,role,expectedTier}:{institutionId:string;role:string|null;expectedTier?:'superior'|'escolas'}){
 const [refresh,setRefresh]=useState(0);
 const [filter,setFilter]=useState<Status|'todos'|'diagnostico'>('todos');
 const [state,setState]=useState<{scope:string;data?:Snapshot;error?:string;loading:boolean}>({scope:'',loading:true});
 const sequence=useRef(0);
 const scope=[institutionId,role,expectedTier].join(':');
 const allowed=Boolean(institutionId&&role&&ROLES.has(role));
 useEffect(()=>{
  const current=++sequence.current;
  if(!allowed)return;
  setState({scope,loading:true});
  void (async()=>{
   try{
    const {data,error}=await supabase.functions.invoke('vertice-learning-bridge',{body:{operation:'sapiens_signals',institutionId}});
    if(error||data?.error)throw new Error('Sinais do Sapiens indisponíveis. Verifique a sessão com MFA, a autorização institucional e a conexão com o Fato & Ordem.');
    if(!valid(data,institutionId,expectedTier))throw new Error('Resposta incompatível com a instituição selecionada. Atualize a consulta.');
    if(current===sequence.current)setState({scope,loading:false,data});
   }catch(error){if(current===sequence.current)setState({scope,loading:false,error:error instanceof Error?error.message:'Sinais do Sapiens indisponíveis.'});}
  })();
  return()=>{sequence.current++;};
 },[institutionId,role,expectedTier,refresh,allowed,scope]);
 const current=state.scope===scope?state:undefined;
 const snapshot=current?.data;
 const rows=useMemo(()=>!snapshot?[]:snapshot.students.filter(s=>filter==='todos'?true:filter==='diagnostico'?s.diagnostics.length>0:s.engagement.status===filter),[snapshot,filter]);
 const weakest=useMemo(()=>{
  const map=new Map<string,{label:string;n:number}>();
  for(const s of snapshot?.students||[])for(const d of s.diagnostics){
   const key=d.competency?[d.competency.discipline,d.competency.theme].filter(Boolean).join(' · ')||d.competency.kcId:'Sem competência específica';
   const entry=map.get(key+'|'+d.label)||{label:key+' — '+d.label,n:0};entry.n++;map.set(key+'|'+d.label,entry);
  }
  return [...map.values()].sort((a,b)=>b.n-a.n).slice(0,8);
 },[snapshot]);
 if(!allowed)return <section className="reading-indicators"><h3>Sinais dos alunos (Sapiens)</h3><p>Sinais por aluno restritos à alta gestão autorizada.</p></section>;
 return <section className="reading-indicators" aria-label="Sinais dos alunos — Sapiens">
  <header><div><small>FATO & ORDEM · SAPIENS</small><h3>Sinais dos alunos</h3></div>
   <button type="button" className="corp-button small" disabled={!current||current.loading} onClick={()=>setRefresh(n=>n+1)}>Atualizar sinais</button></header>
  <p role="note"><strong>Sinais para ação, não nota nem previsão.</strong> A situação de estudo segue regra fixa. Padrões de erro só aparecem depois de liberados ao próprio aluno pela revisão docente.</p>
  {(!current||current.loading)&&<p role="status">Consultando sinais autorizados…</p>}
  {current?.error&&<p role="alert">{current.error} Nenhum dado anterior é apresentado como atualizado.</p>}
  {snapshot&&<>
   <p className="reading-provenance">Fonte: Fato & Ordem · consultado em <time dateTime={snapshot.retrievedAt}>{new Date(snapshot.retrievedAt).toLocaleString('pt-BR')}</time>. Alunos com vínculo verificado, identificados pela matrícula da Vértice.{snapshot.unmatched>0&&<> {fmt.format(snapshot.unmatched)} vínculo(s) da origem sem matrícula ativa na Vértice não aparecem.</>}</p>
   <div className="reading-scroll"><table><caption>Situação de estudo</caption><thead><tr>{ORDER.map(s=><th key={s} scope="col" title={STATUS[s].hint}>{STATUS[s].label}</th>)}<th scope="col">Com padrão de erro</th><th scope="col">Com prescrição</th></tr></thead>
    <tbody><tr>{ORDER.map(s=><td key={s}>{fmt.format(snapshot.summary[s]??0)}</td>)}<td>{fmt.format(snapshot.summary.comDiagnostico??0)}</td><td>{fmt.format(snapshot.summary.comPrescricao??0)}</td></tr></tbody></table></div>
   {weakest.length>0&&<><h4>Padrões de erro mais frequentes</h4><ul>{weakest.map(w=><li key={w.label}>{w.label}: {fmt.format(w.n)} aluno(s)</li>)}</ul></>}
   <label>Mostrar <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>
    <option value="todos">Todos</option>{ORDER.map(s=><option key={s} value={s}>{STATUS[s].label}</option>)}<option value="diagnostico">Com padrão de erro</option></select></label>
   {!rows.length?<p role="status">Nenhum aluno neste recorte.</p>:<div className="reading-scroll"><table><caption>Alunos</caption><thead><tr>
    <th scope="col">Matrícula</th><th scope="col">Curso</th><th scope="col">Situação</th><th scope="col">Última resposta</th><th scope="col">Respostas 7 dias</th><th scope="col">Dias ativos (14)</th><th scope="col">Padrões de erro</th><th scope="col">Prescrições</th></tr></thead>
    <tbody>{rows.slice(0,500).map(s=><tr key={s.courseId+':'+s.enrollmentRef}>
     <th scope="row">{s.enrollmentRef}</th><td>{s.courseName}</td><td>{STATUS[s.engagement.status].label}</td><td>{day(s.engagement.lastActivityAt)}</td>
     <td>{fmt.format(s.engagement.answersLast7Days)}</td><td>{fmt.format(s.engagement.activeDaysLast14)}</td>
     <td>{s.diagnostics.map(d=>d.label+(d.competency?.theme?' ('+d.competency.theme+')':'')).join('; ')||'—'}</td>
     <td>{s.prescriptions.map(p=>p.label+(p.deadline?' até '+day(p.deadline):'')).join('; ')||'—'}</td></tr>)}</tbody></table>
    {rows.length>500&&<p>Exibindo 500 de {fmt.format(rows.length)}. Use o filtro para refinar.</p>}</div>}
  </>}
 </section>;
}
