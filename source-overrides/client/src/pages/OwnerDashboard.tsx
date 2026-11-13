import { HelpLabel } from '@/components/ContextHelp';
import {isEnrolledStatus} from '@/lib/enrollment-summary';
import {applyInstitutionTheme, resetToVerticeTheme} from '@/lib/theme-provider';
import ShowcaseClientsAdmin from '@/components/ShowcaseClients';
import {MasterDirectory, MasterInvitationGate} from '@/components/area/MasterAccess';
import {storeActionDraft} from "@/lib/portal-integration";
import {institutionEnrollmentSummary} from "@/lib/enrollment-summary";
import {can, ROLE_LABEL} from "@/lib/area";
import {lazy, Suspense, useEffect, useRef, useState, type FormEvent} from 'react';
import {Link} from 'wouter';
import {supabase} from '@/lib/supabase';
import type {Session} from '@supabase/supabase-js';
import type {AcademicReport} from '@/components/AcademicReports';
import {CourseView, InstitutionView, courseTotals, latestEnrollmentSnapshots, type Course, type Enrollment, type Institution} from '@/components/InstitutionArea';
import Workspace, {INSTITUTION_FIELDS} from '@/components/area/Workspace';
import RecordForm from '@/components/area/RecordForm';
import {TABLES, isLate, saveRow, type Role, type Row} from '@/lib/area';
import {listByInstitution} from '@/lib/area';
import {listRepository} from '@/lib/repository-data';
import GovernancaBI from '@/components/bi/GovernancaBI';
import ExecutiveOverview from '@/components/bi/ExecutiveOverview';
import '@/components/bi/governanca-bi.css';
import {isInstrumentRequest,latestInstrumentDocuments} from '@/lib/repository';
import GlobalRepository from '@/components/area/GlobalRepository';
import GreenHost from '@/components/acquisitions/GreenHost';
import DemoLeads from '@/components/DemoLeads';
import CaptacaoBI from '@/components/area/CaptacaoBI';
import './owner-dashboard-redesign.css';
import AcademicoBI from '@/components/bi/AcademicoBI';
import EgressosBI from '@/components/bi/EgressosBI';
import AcademicModulesBI from '@/components/bi/AcademicModulesBI';
import InstitutionalDashboard360 from '@/components/bi/InstitutionalDashboard360';
import EvasionRiskPanel from '@/components/bi/EvasionRiskPanel';
import PainelBI from '@/components/bi/PainelBI';
import BIFrame from '@/components/bi/BIFrame';
import ProfileSimulator from '@/components/area/ProfileSimulator';
import ExperienceAdmin from './ExperienceAdmin';
import MasterHub from '@/components/area/MasterHub';
import VerticeBI from '@/components/area/VerticeBI';
import BillingPanel from '@/components/area/BillingPanel';
const Extensao360 = lazy(() => import('@/components/area/Extensao360'));

type Membership={user_id:string;institution_id:string;role:string};
const SNAPSHOT_COLUMNS='id,course_id,semester,class_label,enrolled,capacity,available,source_report_at,reported_total,student_status';
async function fetchAllSnapshots(){
 const page=1000;const all:Enrollment[]=[];
 for(let from=0;;from+=page){
  const {data,error}=await supabase.from('vertice_enrollment_snapshots').select(SNAPSHOT_COLUMNS).order('source_report_at',{ascending:false}).order('id').range(from,from+page-1);
  if(error)throw error;all.push(...(data as Enrollment[]));if(!data||data.length<page)break;
 }
 return all;
}
async function fetchDashboardRows(table:string,order:string,ascending=true,columns='*'){
 const rows:Row[]=[];
 for(let from=0;;from+=1000){const {data,error}=await supabase.from(table).select(columns).order(order,{ascending}).order('id').range(from,from+999);if(error)throw error;rows.push(...((data??[]) as unknown as Row[]));if(!data||data.length<1000)break;}
 return {data:rows,error:null};
}
function readHash(){const p=new URLSearchParams(typeof window==='undefined'?'':window.location.hash.slice(1));return {inst:p.get('instituicao')??'',course:p.get('curso')??'',repositories:p.get('repositorios')==='1',bi:p.get('bi')==='1',captacao:p.get('captacao')==='1',academico:p.get('academico')==='1',painelBi:p.get('painel-bi')==='1',perfis:p.get('perfis')==='1',masters:p.get('masters')==='1',demonstrativos:p.get('demonstrativos')==='1',clientes:p.get('clientes')==='1',governanca:p.get('governanca')==='1',hub:!p.toString(),biVertice:p.get('bi-vertice')==='1',tierFilter:p.get('tier')??'',financeiro:p.get('financeiro')==='1'};}
function writeHash(inst:string,course:string,repositories=false,library=false,reitor=false,masters=false){const p=new URLSearchParams();if(masters)p.set('masters','1');if(inst)p.set('instituicao',inst);if(course)p.set('curso',course);if(repositories){if(inst)p.set('aba','repositorio');else p.set('repositorios','1');}if(library)p.set('aba','biblioteca');if(reitor)p.set('aba','reitor');const h=p.toString();window.history.pushState(null,'',h?`#${h}`:window.location.pathname);window.dispatchEvent(new HashChangeEvent('hashchange'));window.scrollTo({top:0});}

type BiItem = {label:string; group:string; value:number; href?:string};
type BiSource = {items:BiItem[]; error?:boolean};
const BI_NAMES=['Metas','Matrículas','Documentação','Reconhecimento de Curso','Aquisições','Captação e permanência','Egressos','TCC e Pesquisa','Ativ. Complementares','Estágio','360° Integrado','Risco de Evasão'];
const BI_COLORS=['#0b9185','#daa94e','#e5765e','#368aa6','#6bbf9f','#b58b3b','#116d78'];
const biNumber=new Intl.NumberFormat('pt-BR');
const biMoney=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
export function PortalBI({institutions,courses,enrollments,session}:{institutions:Institution[];courses:Course[];enrollments:Enrollment[];session:Session}){
 const [selectedId,setId]=useState('');
 const id=institutions.some(i=>i.id===selectedId)?selectedId:'';
 const [page,setPage]=useState(-1),[tv,setTv]=useState(false),[tick,setTick]=useState(0);
 const [tvPaused,setTvPaused]=useState(false),[tvSpeed,setTvSpeed]=useState(15000);
 const [sources,setSources]=useState<Record<number,BiSource>>({});
 const [actionRows,setActionRows]=useState<Row[]>([]);
 const [detail,setDetail]=useState<{title:string;items:BiItem[]}|null>(null);
 const [manual,setManual]=useState(['','','','']);
 const panel=useRef<HTMLElement>(null), dialog=useRef<HTMLDialogElement>(null);
 const [snapshots,setSnapshots]=useState(enrollments);
 useEffect(()=>{if(!tick)return;let active=true;void fetchAllSnapshots().then(rows=>{if(active)setSnapshots(latestEnrollmentSnapshots(rows));}).catch(()=>{});return()=>{active=false;};},[tick]);
 const [semester,setSemester]=useState('');
 const own=courses.filter(c=>c.institution_id===id);
 const semesters=[...new Set(snapshots.filter(e=>own.some(c=>c.id===e.course_id)&&isEnrolledStatus(e.student_status)).map(e=>e.semester))].sort().reverse();
 const term=semesters.includes(semester)?semester:semesters[0];
 const termPart=(v:string)=>v.match(/(?:^|[-/])0?([12])$/)?.[1]??'';
 const yearPart=(v:string)=>v.match(/^(\d{4})/)?.[1]??'';
 const previousTerm=term?semesters.find(v=>v!==term&&termPart(v)===termPart(term)&&Number(yearPart(v))<Number(yearPart(term))):undefined;
 const countTerm=(v:string|undefined)=>{
  if(!v)return null;
  const available=own.map(c=>snapshots.filter(e=>e.course_id===c.id&&e.semester===v&&isEnrolledStatus(e.student_status))).filter(rows=>rows.length>0);
  return available.length?available.reduce((sum,rows)=>sum+courseTotals(rows).value,0):null;
 };
 const currentCount=countTerm(term), priorCount=countTerm(previousTerm);
 const annualVariation=currentCount!==null&&priorCount!==null&&priorCount>0?(currentCount-priorCount)/priorCount*100:null;

 const link=(aba:string)=>'/master#'+new URLSearchParams({instituicao:id,aba});
 const enrollmentItems=own.flatMap(c=>{
  const rows=snapshots.filter(e=>e.course_id===c.id&&e.semester===term&&isEnrolledStatus(e.student_status));
  return rows.length?[{label:c.name,group:c.name,value:courseTotals(rows).value,href:'/master#'+new URLSearchParams({instituicao:id,curso:c.id})}]:[];
 });
 useEffect(()=>{
  let active=true;
  const set=(key:number,source:BiSource)=>{if(active)setSources(previous=>({...previous,[key]:source}));};
  if(id){
   void listByInstitution(TABLES.actions,id).then(rows=>{if(active)setActionRows(rows);set(6,{items:rows.filter(r=>r.status!=='cancelada').map(r=>({label:String(r.what??'Ação registrada'),group:String(r.status??'Sem situação'),value:1,href:link('plano')}))});}).catch(()=>{if(active)setActionRows([]);set(6,{items:[],error:true});});
   void listByInstitution(TABLES.goals,id).then(rows=>set(0,{items:rows.map(row=>({label:String(row.title??row.name??'Meta'),group:({ativa:'Ativa',planejada:'Planejada',concluida:'Concluída',cancelada:'Cancelada'} as Record<string,string>)[String(row.status)]??String(row.status??'Sem situação'),value:1,href:link('metas')}))})).catch(()=>set(0,{items:[],error:true}));
   void Promise.all([listRepository('vertice_repository_requests',id),listRepository('vertice_repository_files',id)]).then(([requests,files])=>{
    const latest=latestInstrumentDocuments(files);
    set(2,{items:requests.filter(row=>row.active!==false&&isInstrumentRequest(row)).map(row=>{
     const status=row.not_applicable===true?'Não se aplica':latest.get(row.id)?.status;
     return {label:String(row.title??row.name??row.code??'Exigência documental'),group:({validado:'Validado',enviado:'Em análise',devolvido:'Devolvido'} as Record<string,string>)[String(status)]??(status?'Não se aplica':'Pendente'),value:1,href:link('repositorio')};
    })});
    const names=new Map(requests.map(row=>[row.id,row]));
    set(3,{items:files.map(file=>{
     const request=names.get(String(file.request_id));
     const course=courses.find(c=>c.id===(file.course_id??request?.course_id));
     return {label:String(file.original_name??file.file_name??file.name??'Arquivo do repositório'),group:course?.name??'Acervo institucional',value:1,href:link('repositorio')};
    })});
   }).catch(()=>{set(2,{items:[],error:true});set(3,{items:[],error:true});});
  }
  if(!id)return()=>{active=false;};
  // The legacy acquisitions gateway returns a global authorized list and strips institution_id.
  // Do not attribute those records to the selected IES without a scoped contract.
  set(4,{items:[],error:true});
  return()=>{active=false;};
 },[id,tick,session.access_token,courses]);
 useEffect(()=>{
  if(!tv||tvPaused||detail)return;
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='visible')setPage(previous=>(previous+1)%BI_NAMES.length);
  },tvSpeed);
  return()=>window.clearInterval(timer);
 },[tv,tvPaused,tvSpeed,detail]);
 useEffect(()=>{
  const hidden=()=>{if(document.hidden)setTvPaused(true);};
  const exit=()=>{if(!document.fullscreenElement&&tv){setTv(false);setTvPaused(false);}};
  document.addEventListener('visibilitychange',hidden);
  document.addEventListener('fullscreenchange',exit);
  return()=>{document.removeEventListener('visibilitychange',hidden);document.removeEventListener('fullscreenchange',exit);};
 },[tv]);
 useEffect(()=>{if(detail&&!dialog.current?.open)dialog.current?.showModal();},[detail]);
 function toggleTv(){
  if(tv){setTv(false);setTvPaused(false);if(document.fullscreenElement===panel.current)void document.exitFullscreen().catch(()=>{});return;}
  setTv(true);setTvPaused(false);if(page<0)setPage(0);void panel.current?.requestFullscreen?.().catch(()=>{});
 }
 function tvMove(direction:number){
  setPage(current=>(current<0?0:(current+direction+BI_NAMES.length)%BI_NAMES.length));
 }
 const cards:Record<number,BiSource>={...sources,1:{items:enrollmentItems}};
 const totalOf=(index:number)=>cards[index]?.error?null:cards[index]?.items?.reduce((sum,item)=>sum+item.value,0)??null;
 const executivePeriods=semesters.slice().reverse().slice(-7).map(v=>({term:v,enrolled:countTerm(v)})).filter((v):v is {term:string;enrolled:number}=>v.enrolled!==null);
 const executiveCourses=own.map(c=>{
  const a=snapshots.filter(e=>e.course_id===c.id&&e.semester===term&&isEnrolledStatus(e.student_status));
  const b=snapshots.filter(e=>e.course_id===c.id&&e.semester===previousTerm&&isEnrolledStatus(e.student_status));
  const current=a.length?courseTotals(a).value:null;
  const previous=b.length?courseTotals(b).value:null;
  return current===null?null:{name:c.name,current,previous,growth:previous!==null&&previous>0?(current-previous)/previous*100:null,href:'/master#'+new URLSearchParams({instituicao:id,curso:c.id})};
 }).filter((v):v is NonNullable<typeof v>=>v!==null);
 const executiveDocs=(()=>{
  const list=cards[2]?.items??[];
  return ['Validado','Em análise','Devolvido','Pendente','Não se aplica'].map(status=>({status:status==='Não se aplica'?'NSA':status,count:list.filter(x=>x.group===status).length}));
 })();
 const executiveActions=actionRows.filter(r=>r.status!=='cancelada').slice().sort((a,b)=>String(a.due_date??'9999').localeCompare(String(b.due_date??'9999'))).slice(0,8).map(row=>({name:String(row.what??'Ação cadastrada'),status:String(row.status??'Sem situação'),due:row.due_date?String(row.due_date).split('-').reverse().join('/'): 'Sem prazo',owner:String(row.who??'Não informado')}));
 const executiveErrors=[0,2,3,6].filter(i=>sources[i]?.error).map(i=>({0:'Metas',2:'Documentação',3:'Arquivos',6:'Plano de ação'} as Record<number,string>)[i]);
 const navigateExecutive=(what:string)=>{
  if(what==='Matrículas')setPage(1);
  else if(what==='Documentação')setPage(2);
  else if(what==='Planos de ação')window.location.hash=new URLSearchParams({instituicao:id,aba:'plano'}).toString();
  else setPage(0);
 };
 const executiveMetrics=[
  {label:'Matrículas ativas no recorte',value:currentCount,note:term?'Semestre '+term:'Sem recorte',tone:'mint' as const,target:'Matrículas'},
  {label:'Metas acompanhadas',value:totalOf(0),note:'Metas cadastradas na instituição',tone:'gold' as const,target:'Metas'},
  {label:'Documentos validados',value:cards[2]&&!cards[2].error?executiveDocs.find(x=>x.status==='Validado')?.count??0:null,note:'Evidências com validação registrada',tone:'cyan' as const,target:'Documentação'},
  {label:'Pendências documentais',value:!cards[2]||cards[2].error?null:executiveDocs.filter(x=>!['Validado','NSA'].includes(x.status)).reduce((a,b)=>a+b.count,0),note:'Não validadas no repositório',tone:'rose' as const,target:'Documentação'}
 ];
 const executiveIndicators=[
  {name:'Matrículas no recorte',value:currentCount,caption:term?'Semestre '+term:'Sem recorte',tone:'blue',index:1},
  {name:'Metas cadastradas',value:totalOf(0),caption:'Instituição selecionada',tone:'violet',index:0},
  {name:'Exigências documentais',value:totalOf(2),caption:'Solicitações ativas',tone:'amber',index:2},
  {name:'Arquivos no repositório',value:totalOf(3),caption:'Arquivos registrados',tone:'green',index:3}
 ];

 function chart(index:number){
  const source=cards[index];
  const groups=new Map<string,BiItem[]>();
  for(const item of source?.items??[]){const current=groups.get(item.group);if(current)current.push(item);else groups.set(item.group,[item]);}
  const data=[...groups].map(([name,items])=>({name,items,value:items.reduce((sum,item)=>sum+item.value,0)})).sort((a,b)=>b.value-a.value);
  const total=data.reduce((sum,entry)=>sum+entry.value,0);
  const max=Math.max(1,...data.map(entry=>entry.value));
  const donut=[0,2,4].includes(index);
  let offset=0;
  const open=(entry:typeof data[number])=>setDetail({title:BI_NAMES[index]+' · '+entry.name,items:entry.items});
  return <article className="pbi-card" key={index}>
   <small>{index===1?'Matriculados · '+(term??'sem referência'):'Dados do portal · '+('instituição selecionada')}</small>
   <h3>{BI_NAMES[index]}</h3>
   {!source?<p role="status">Carregando…</p>:source.error?<p role="alert">{index===4?'Integração institucional de Aquisições não disponível neste painel. Consulte os mandatos autorizados no módulo Aquisições; eles não são atribuídos automaticamente à IES selecionada.':'Fonte temporariamente indisponível.'}</p>:!data.length?<p>Sem registros disponíveis neste recorte.</p>:<>
    {donut?<svg viewBox="0 0 180 180" className="pbi-donut" aria-label={BI_NAMES[index]}><circle cx="90" cy="90" r="63" fill="none" stroke="#edf0f7" strokeWidth="26"/>
     {data.map((entry,i)=>{const length=total?entry.value/total*100:0;const start=offset;offset+=length;return <circle key={entry.name} cx="90" cy="90" r="63" pathLength="100" fill="none" stroke={BI_COLORS[i%BI_COLORS.length]} strokeWidth="26" strokeDasharray={length+' '+(100-length)} strokeDashoffset={-start} transform="rotate(-90 90 90)" onClick={()=>open(entry)}><title>{entry.name+' · '+biNumber.format(entry.value)}</title></circle>;})}
     <text x="90" y="90" textAnchor="middle" dominantBaseline="middle" fontSize="27" fontWeight="700">{biNumber.format(total)}</text>
    </svg>:<div className="pbi-columns">{data.slice(0,12).map((entry,i)=><button key={entry.name} type="button" title={entry.name+' · '+biNumber.format(entry.value)} onClick={()=>open(entry)} style={{height:Math.max(5,entry.value/max*100)+'%',background:BI_COLORS[i%BI_COLORS.length]}}><span>{biNumber.format(entry.value)}</span></button>)}</div>}
    <div className="pbi-legend">{data.map((entry,i)=><button key={entry.name} type="button" onClick={()=>open(entry)}><i style={{background:BI_COLORS[i%BI_COLORS.length]}}/>{entry.name}<b>{biNumber.format(entry.value)}</b></button>)}</div>
   </>}
  </article>;
 }
 const selectInstitution=(value:string)=>{setSources({});setActionRows([]);setManual(['','','','']);setDetail(null);setSemester('');setPage(-1);setTv(false);setId(value);};
 if(!id)return <section className="portal-bi" aria-label="BI da Reitoria"><h2>Visão Executiva da Direção</h2><HelpLabel>Instituição <select value="" onChange={event=>selectInstitution(event.target.value)}><option value="">Selecione uma instituição autorizada</option>{institutions.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></HelpLabel><p role="status">Selecione uma instituição autorizada. Nenhum indicador é carregado por padrão.</p></section>;
 const ratio=(cost:string,count:string)=>cost!==''&&Number(cost)>=0&&Number.isInteger(Number(count))&&Number(count)>0?biMoney.format(Number(cost)/Number(count)):'—';
 const costs=<article className="pbi-card"><small>SIMULAÇÃO MANUAL · NÃO COMPÕE OS INDICADORES</small><h3>Captação e permanência</h3><p>Preencha os totais do mesmo período. Os valores ficam disponíveis enquanto o BI estiver aberto e não alteram nem são somados aos registros de captação.</p><div className="pbi-grid">
 {['Investimento em captação (R$)','Matrículas atribuídas à campanha','Despesas de permanência (R$)','Alunos acompanhados'].map((label,i)=><HelpLabel key={label}>{label}<input type="number" min="0" step={i%2?'1':'0.01'} value={manual[i]} onChange={event=>{const value=event.target.value;setManual(previous=>previous.map((old,index)=>index===i?value:old));}}/></HelpLabel>)}
 <p>Por matrícula confirmada <strong>{ratio(manual[0],manual[1])}</strong></p><p>Por aluno acompanhado <strong>{ratio(manual[2],manual[3])}</strong></p></div></article>;
 return <section ref={panel} className="portal-bi" aria-label="BI da Reitoria">
 <style>{'.portal-bi{background:#f1f8f7;color:#163e48;padding:clamp(16px,3vw,42px);overflow:auto}.portal-bi h2{margin:0;font-size:clamp(26px,4vw,48px)}.pbi-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:18px 0}.portal-bi button,.portal-bi select,.portal-bi input{border:1px solid #d4d9ea;background:white;color:inherit;padding:9px;border-radius:8px}.portal-bi button[aria-pressed=true]{background:#0b857c;color:white}.pbi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:18px}.pbi-card{background:white;border:1px solid #e0e4f1;border-radius:16px;padding:20px;min-width:0}.pbi-card h3{margin:5px 0 18px;font-size:24px}.pbi-card small{color:#535b78}.pbi-donut{display:block;width:min(68%,220px);margin:auto}.pbi-donut circle[stroke-dasharray]{cursor:pointer}.pbi-columns{height:165px;display:flex;align-items:flex-end;gap:5px;padding:24px 0 0;margin:14px 0}.pbi-columns button{position:relative;flex:1;min-width:0;border:0;padding:0;border-radius:5px 5px 0 0}.pbi-columns span{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);font-size:11px}.pbi-legend{display:grid;gap:5px;max-height:260px;overflow:auto;margin-top:14px}.pbi-legend button{display:flex;gap:8px;align-items:center;text-align:left}.pbi-legend i{flex:none;width:11px;height:11px;border-radius:3px}.pbi-legend b{margin-left:auto}.pbi-card label{display:grid;gap:6px}.portal-bi dialog{max-width:min(720px,90vw);max-height:80vh;border:1px solid #d4d9ea;border-radius:16px;padding:24px;color:#1b2440}.portal-bi dialog::backdrop{background:#18142b99}.portal-bi:fullscreen .pbi-card{max-width:1400px;margin:auto}.portal-bi:fullscreen .pbi-donut{width:min(48vh,390px)}.portal-bi:fullscreen .pbi-columns{height:40vh}'}</style>
 <div className="exe-screen-layout">
 <aside className="exe-sidebar" aria-label="Navegação do BI Executivo">
  <div className="exe-sidebar-brand"><b>V</b><span><strong>Vértice</strong><small>Educação Superior</small></span></div>
  <nav>{([
    [-1,'Visão geral','⌂'],[1,'Matrículas','▥'],[0,'Metas e indicadores','◎'],
    [2,'Regulação (MEC / INEP)','◇'],[3,'Reconhecimento de Curso','▤'],
    [4,'Aquisições','◫'],[5,'Captação','↗'],[6,'Egressos','🎓']
  ] as [number,string,string][]).map(([key,name,icon])=><button type="button" key={key} aria-current={page===key?'page':undefined} onClick={()=>setPage(key)}><span>{icon}</span>{name}</button>)}</nav>
  <div className="exe-sidebar-bottom">BI estratégico para <strong>Direção e Gestores</strong><small>Dados cadastrados · confira a instituição e a origem</small></div>
 </aside>
 <div className="exe-screen-main">
 <header className="vx-bi-heading"><div><p className="vx-eyebrow">VÉRTICE · INTELIGÊNCIA INSTITUCIONAL</p><h2>Visão Executiva da Direção</h2><p>Indicadores institucionais com acesso aos registros originais.</p></div><span className="vx-scope">Registros do portal · simulações identificadas separadamente</span></header>
 <div className="pbi-toolbar"><HelpLabel>Instituição <select value={id} onChange={event=>{selectInstitution(event.target.value);}}><option value="">Selecione uma instituição autorizada</option>{institutions.map(institution=><option key={institution.id} value={institution.id}>{institution.name}</option>)}</select></HelpLabel>
 <HelpLabel>Semestre de matrículas <select value={term??''} onChange={event=>setSemester(event.target.value)}>{!semesters.length&&<option value="">Sem referência</option>}{semesters.map(value=><option key={value}>{value}</option>)}</select></HelpLabel>
 <button type="button" onClick={toggleTv}>{tv?'Sair do modo TV':'Modo TV • automático'}</button>
 {tv&&<><button type="button" onClick={()=>setTvPaused(old=>!old)} aria-pressed={tvPaused}>{tvPaused?'Retomar':'Pausar'}</button>
 <button type="button" onClick={()=>tvMove(-1)}>Anterior</button><button type="button" onClick={()=>tvMove(1)}>Próxima</button>
 <HelpLabel>Trocar a cada <select value={tvSpeed} onChange={e=>setTvSpeed(Number(e.target.value))}>
  <option value={10000}>10 segundos</option><option value={15000}>15 segundos</option>
  <option value={20000}>20 segundos</option><option value={30000}>30 segundos</option>
 </select></HelpLabel></>}
 <button type="button" onClick={()=>setTick(previous=>previous+1)}>Consultar fontes</button></div>
 {page<0&&<ExecutiveOverview
   institutionName={String(institutions.find(x=>x.id===id)?.name??'Instituição selecionada')}
   term={term??''}
   comparison={previousTerm??null}
   metrics={executiveMetrics}
   periods={executivePeriods}
   courses={executiveCourses}
   documentStatuses={executiveDocs}
   actions={executiveActions}
   diagnosticAvailable={false}
   errors={executiveErrors}
   onNavigate={navigateExecutive}
 />}
 <div className="pbi-toolbar vx-bi-tabs"><button type="button" aria-pressed={page<0} onClick={()=>{setPage(-1);setTv(false);}}>Visão geral</button>{BI_NAMES.map((name,index)=><button type="button" key={name} aria-pressed={page===index} onClick={()=>setPage(index)}>{name}</button>)}</div>
 {page<0?null:page===5?<><section aria-label="Captação cadastrada da instituição"><p role="note">Fonte: registros de captação da instituição selecionada. Recorte: todo o histórico cadastrado; o seletor de semestre de matrículas acadêmicas não filtra esta seção. Etapas informadas não comprovam matrícula acadêmica.</p><CaptacaoBI key={id} institutionId={id} institutionName={institutions.find(i=>i.id===id)?.name??''}/></section><details><summary>Simulação manual separada dos registros</summary><div className="pbi-grid">{costs}</div></details></>:page===6?<EgressosBI key={id} institutionId={id}/>:page===7?<AcademicModulesBI key={id+'-tcc'} institutionId={id} module="tcc"/>:page===8?<AcademicModulesBI key={id+'-ac'} institutionId={id} module="ac"/>:page===9?<AcademicModulesBI key={id+'-est'} institutionId={id} module="estagio"/>:page===10?<InstitutionalDashboard360 key={id+'-360'} institutionId={id}/>:page===11?<EvasionRiskPanel key={id+'-risk'} institutionId={id} courses={courses.filter(c=>c.institution_id===id).map(c=>({id:c.id,name:c.name}))}/>:chart(page)}
 </div></div>
 <dialog ref={dialog} onClose={()=>setDetail(null)}>{detail&&<><h3>{detail.title}</h3><p>{biNumber.format(detail.items.length)} registros</p><ul>{detail.items.map((item,index)=><li key={index}>{item.href?<a href={item.href} onClick={()=>dialog.current?.close()}>{item.label}</a>:item.label}{item.value!==1?' · '+biNumber.format(item.value):''}</li>)}</ul></>}<form method="dialog"><button>Fechar detalhes</button></form></dialog>
 </section>;
}

export default function OwnerDashboard(){
 const acquisitionsRoute=/^\/master\/aquisicoes(?:\/|\.html)?$/.test(window.location.pathname);
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [aal,setAal]=useState(''),[master,setMaster]=useState(false);
 const [factor,setFactor]=useState(''),[qr,setQr]=useState(''),[code,setCode]=useState('');
 const [institutions,setInstitutions]=useState<Institution[]>([]),[courses,setCourses]=useState<Course[]>([]),[members,setMembers]=useState<Membership[]>([]);
 const [enrollments,setEnrollments]=useState<Enrollment[]>([]);
 const [reports,setReports]=useState<AcademicReport[]>([]);
 const [route,setRoute]=useState(readHash());
 const [captacaoInstitutionId,setCaptacaoInstitutionId]=useState('');
 const [academicoInstitutionId,setAcademicoInstitutionId]=useState('');
 const [governancaInstitutionId,setGovernancaInstitutionId]=useState('');
 const [creating,setCreating]=useState(false);
 const [institutionSearch,setInstitutionSearch]=useState('');
 const [institutionSort,setInstitutionSort]=useState<'name'|'courses'|'pending'>('name');
 const [commercial,setCommercial]=useState(false);
 const [mgmt,setMgmt]=useState<{goals:Row[];actions:Row[];diagnosis:Row[]}>({goals:[],actions:[],diagnosis:[]});
 const roleIn=(id:string):Role|null=>master?'master':((members.find(m=>m.institution_id===id&&m.user_id===session?.user.id)?.role as Role)??null);
 useEffect(()=>{const f=()=>setRoute(readHash());window.addEventListener('hashchange',f);window.addEventListener('popstate',f);return()=>{window.removeEventListener('hashchange',f);window.removeEventListener('popstate',f);};},[]);
 const instStats=(id:string)=>institutionEnrollmentSummary(id,courses,enrollments);
 const currentInst=institutions.find(i=>i.id===route.inst);
 const selectedCaptacaoInstitution=institutions.find(i=>i.id===captacaoInstitutionId);
 const selectedAcademicoInstitution=institutions.find(i=>i.id===academicoInstitutionId);
 const selectedGovernancaInstitution=institutions.find(i=>i.id===(governancaInstitutionId||route.inst));
 const currentCourse=courses.find(c=>c.id===route.course&&c.institution_id===route.inst);
 async function load(){
  setLoading(true);setError('');
  try{
   const {data:{session:current}}=await supabase.auth.getSession();setSession(current);
   if(!current)return;
   const {data:assurance,error:aError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(aError)throw aError;
   setAal(assurance.currentLevel??'aal1');
   if(assurance.currentLevel!=='aal2'){
    const {data,error:fError}=await supabase.auth.mfa.listFactors();if(fError)throw fError;
    setFactor(data.totp[0]?.id??'');
    // Verificar se é admin (master) — se for, exigir MFA
    const {data:adminCheck}=await supabase.from('vertice_admins').select('user_id').eq('user_id',current.user.id);
    if(adminCheck?.length){return;} // Master precisa de MFA
    // Equipe/gestor pode continuar sem MFA
   }
   // Aquisições depende apenas da sessão e do MFA; seu backend aplica as permissões.
   if(acquisitionsRoute)return;
   await supabase.rpc('vertice_accept_invites').then(()=>undefined,()=>undefined);
   const results=await Promise.all([
    supabase.from('vertice_admins').select('user_id').eq('user_id',current.user.id),
    fetchDashboardRows('vertice_institutions','name'),
    fetchDashboardRows('vertice_courses','name'),
    supabase.from('vertice_memberships').select('user_id,institution_id,role'),
    fetchDashboardRows('vertice_academic_reports','source_report_at',false)
   ]);
   const failedQuery=results.find(r=>r.error);
   if(failedQuery)throw new Error('data unavailable: '+(failedQuery.error as any)?.message);
   const snapshots=await fetchAllSnapshots();
   setMaster(Boolean(results[0].data?.length));setInstitutions(results[1].data as Institution[]);setCourses(Array.from(new Map((results[2].data as Course[]).map(c=>[c.id,c])).values()));setMembers(results[3].data as Membership[]);
   setEnrollments(latestEnrollmentSnapshots(snapshots));
   setReports(results[4].data as AcademicReport[]);
   const [g,a,d]=await Promise.all([
    fetchDashboardRows('vertice_goals','id',true,'id,institution_id,status'),
    fetchDashboardRows('vertice_actions','id',true,'id,institution_id,status,due_date'),
    fetchDashboardRows('vertice_diagnosis_items','id',true,'id,institution_id,status,priority')
   ]);
   setMgmt({goals:(g.data??[]) as Row[],actions:(a.data??[]) as Row[],diagnosis:(d.data??[]) as Row[]});
  }catch(loadErr){setError('Não foi possível consultar os dados protegidos. ' + ((loadErr as Error)?.message || 'Tente novamente.'));}
  finally{setLoading(false);}
 }
 useEffect(()=>{load(); const {data}=supabase.auth.onAuthStateChange((event,current)=>{if(event==='SIGNED_OUT'){setSession(current);setInstitutions([]);setCourses([]);setMembers([]);setEnrollments([]);setReports([]);setMaster(false);setCaptacaoInstitutionId('');resetToVerticeTheme();}});return()=>data.subscription.unsubscribe();},[]);
 // White-label: aplicar tema da IES para não-master
 useEffect(()=>{
  if(master||!institutions.length||!session)return;
  const myMembership=members.find(m=>m.user_id===session.user.id);
  const instId=route.inst||myMembership?.institution_id||institutions[0]?.id;
  if(instId)applyInstitutionTheme(instId);
  else resetToVerticeTheme();
  return()=>resetToVerticeTheme();
 },[master,institutions,members,session,route.inst]);
 async function enroll(){setBusy(true);setError('');try{
  const {data:existing,error:listError}=await supabase.auth.mfa.listFactors();if(listError)throw listError;
  const pending=existing.all.find(f=>f.factor_type==='totp' && f.status==='unverified');
  if(pending){const {error}=await supabase.auth.mfa.unenroll({factorId:pending.id});if(error)throw error;}
  const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'Vértice'});if(error)throw error;setFactor(data.id);setQr(data.totp.qr_code);
 }catch{setError('Não foi possível iniciar o segundo fator. Tente novamente.');}finally{setBusy(false);}}
 async function verify(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
  const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:factor,code});if(error)throw error;setCode('');setQr('');await load();
 }catch{setError('Código não validado. Confira o autenticador e tente novamente.');}finally{setBusy(false);}}
 if(acquisitionsRoute&&!loading&&session&&aal==='aal2')return <GreenHost/>;
 // Usuário equipe sem MFA: mostrar só a extensão da instituição vinculada
 const isEquipeOnly = !master && aal !== 'aal2' && session && !loading && members.length > 0;
 const equipeInstitution = isEquipeOnly ? institutions.find(i => members.some(m => m.user_id === session?.user.id && m.institution_id === i.id)) : null;
 if (isEquipeOnly && equipeInstitution) {
   const equipeRole = members.find(m => m.user_id === session.user.id && m.institution_id === equipeInstitution.id)?.role as Role || 'equipe';
   const equipeCourses = courses.filter(c => c.institution_id === equipeInstitution.id);
   return <main style={{maxWidth:1100,margin:'0 auto',padding:'20px'}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:12}}>
       <div><strong style={{fontSize:18}}>{String(equipeInstitution.name)}</strong><br/><span style={{fontSize:12,color:'#64748b'}}>Conectado como {session.user.email} · {ROLE_LABEL[equipeRole]}</span></div>
       <button style={{background:'none',border:'1px solid #e2e8f0',borderRadius:6,padding:'6px 12px',fontSize:12,cursor:'pointer',color:'#64748b'}} onClick={async()=>{await supabase.auth.signOut();}}>Sair</button>
     </div>
     <Suspense fallback={<p>Carregando Extensão 360°…</p>}>
       <Extensao360 institutionId={equipeInstitution.id} role={equipeRole} courses={equipeCourses.map(c=>({id:c.id,name:c.name}))} />
     </Suspense>
   </main>;
 }
 return <main className="corp-container corp-section"><h1>{window.location.pathname.startsWith('/reitor')?'Área reservada da Direção':master&&route.repositories?'Repositórios · visão master':master&&route.demonstrativos?'Convites demonstrativos · Master':master&&route.tierFilter==='superior'?'🏛️ Universidades':master&&route.tierFilter==='escolas'?'🏫 Escolas':master&&route.financeiro?'💰 Financeiro':master?'Painel Vértice':'Painel de gestão'}</h1>
 {master&&(route.tierFilter||route.financeiro)&&!route.inst&&<button onClick={()=>{window.location.hash='';window.dispatchEvent(new HashChangeEvent('hashchange'));}} style={{background:'none',border:'none',color:'#2563eb',cursor:'pointer',fontSize:13,marginBottom:12,padding:0}}>← Voltar ao hub</button>}
 {loading?<p role="status">Verificando acesso…</p>:!session?<><p>Entre para acessar sua conta.</p><Link className="corp-button" href={window.location.pathname.startsWith('/reitor')?'/entrar?destino=reitor':'/entrar'}>Entrar</Link></>:<>
 <p>Conectado como <strong>{session.user.email}</strong>.</p>
 {aal!=='aal2'&&master?<section className="corp-login-card"><h2>Proteja seu acesso</h2><p>O segundo fator é obrigatório para consultar os dados das instituições como administrador.</p>
 {!factor?<button className="corp-button" disabled={busy} onClick={enroll}>Configurar aplicativo autenticador</button>:<>
 {qr&&<><p>Leia o QR code no seu aplicativo autenticador. Não compartilhe esta imagem.</p><img alt="QR code para configurar seu autenticador" src={qr} width={200} height={200}/></>}
 <form className="access-form" onSubmit={verify}><HelpLabel>Código do autenticador<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></HelpLabel><button className="corp-button" disabled={busy}>Validar segundo fator</button></form></>}
 </section>:<><MasterInvitationGate onAccepted={load}/>
 {route.biVertice&&master?<VerticeBI onBack={()=>{window.location.hash='';window.dispatchEvent(new HashChangeEvent('hashchange'));}}/>:route.financeiro&&master?<><button onClick={()=>{window.location.hash='';window.dispatchEvent(new HashChangeEvent('hashchange'));}} style={{background:'none',border:'none',color:'#2563eb',cursor:'pointer',fontSize:13,padding:0,marginBottom:12}}>← Voltar ao hub</button><BillingPanel/></>:route.hub&&master?<MasterHub onNavigate={(dest,instId)=>{
  if(dest==='bi-vertice'){window.location.hash='bi-vertice=1';}
  else if(dest==='universidades'){window.location.hash='tier=superior';}
  else if(dest==='escolas'){window.location.hash='tier=escolas';}
  else if(dest==='financeiro'){window.location.hash='financeiro=1';}
  else if(dest==='configuracoes'){window.location.hash='masters=1';}
  else if(dest==='institution'&&instId){window.location.hash=`instituicao=${instId}`;}
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}}/>:route.clientes&&master?<ShowcaseClientsAdmin/>:route.perfis&&master?<ProfileSimulator/>:master&&route.demonstrativos?<ExperienceAdmin embedded/>:master&&commercial?<DemoLeads/>:<>
 {!route.bi&&!route.captacao&&!route.academico&&!route.painelBi&&!currentInst&&!route.repositories&&!route.masters&&!route.demonstrativos&&<div className="vx-module-grid vx-kpi-row">
  <div className="vx-module-card" style={{borderLeft:'3px solid #0073ea'}}><small style={{color:'#676e7a'}}>Instituições</small><strong style={{fontSize:28}}>{institutions.length}</strong></div>
  <div className="vx-module-card" style={{borderLeft:'3px solid #7c3aed'}}><small style={{color:'#676e7a'}}>Cursos</small><strong style={{fontSize:28}}>{courses.length}</strong></div>
  <div className="vx-module-card" style={{borderLeft:'3px solid #00a86b'}}><small style={{color:'#676e7a'}}>Vínculos</small><strong style={{fontSize:28}}>{members.length}</strong></div>
  <div className="vx-module-card" style={{borderLeft:'3px solid '+(mgmt.goals.filter(x=>x.status!=='cancelada').length>0?'#b45309':'#00a86b')}}><small style={{color:'#676e7a'}}>Metas ativas</small><strong style={{fontSize:28}}>{mgmt.goals.filter(x=>x.status!=='cancelada').length}</strong></div>
  <div className="vx-module-card" style={{borderLeft:'3px solid '+(mgmt.actions.filter(x=>isLate(x.due_date,x.status)).length>0?'#d83a52':'#00a86b')}}><small style={{color:'#676e7a'}}>Ações atrasadas</small><strong style={{fontSize:28,color:mgmt.actions.filter(x=>isLate(x.due_date,x.status)).length>0?'#d83a52':'#00a86b'}}>{mgmt.actions.filter(x=>isLate(x.due_date,x.status)).length}</strong></div>
 </div>}
 {route.governanca?<section aria-label="Governança 360 da instituição"><HelpLabel htmlFor="governanca-ies" style={{display:'grid',gap:8,maxWidth:560,margin:'15px 0'}}><strong>Instituição para análise de governança</strong><select id="governanca-ies" value={selectedGovernancaInstitution?.id??''} onChange={e=>setGovernancaInstitutionId(e.target.value)}><option value="">Selecione uma instituição autorizada</option>{institutions.map(inst=><option key={inst.id} value={inst.id}>{inst.name}</option>)}</select></HelpLabel>{selectedGovernancaInstitution&&can.manageGoals(roleIn(selectedGovernancaInstitution.id))?<GovernancaBI key={selectedGovernancaInstitution.id} institutionId={selectedGovernancaInstitution.id} institutionName={String(selectedGovernancaInstitution.name)} courses={courses.filter(c=>c.institution_id===selectedGovernancaInstitution.id)}/>:<p role="status">{selectedGovernancaInstitution?"A Governança 360 é restrita à alta gestão autorizada desta IES.":"Selecione uma IES para realizar a auditoria. Nenhum indicador de outra instituição é carregado por padrão."}</p>}</section>:route.painelBi?<BIFrame view="executivo" source="Supabase · matrículas, indicadores de curso e relatórios acadêmicos"><PainelBI institutions={institutions} courses={courses} enrollments={enrollments} session={session} reports={reports}/></BIFrame>:route.academico?<BIFrame view="academico" institutionName={selectedAcademicoInstitution?.name} source="e-ORBIT e relatórios acadêmicos importados · cobertura sujeita à conciliação"><section aria-label="Instituição do BI Acadêmico"><HelpLabel htmlFor="academico-instituicao" style={{display:"grid",gap:8,margin:"12px 0",maxWidth:520}}><strong>Instituição para análise acadêmica</strong><select id="academico-instituicao" value={selectedAcademicoInstitution?.id??""} onChange={e=>setAcademicoInstitutionId(e.target.value)}><option value="">Selecione uma instituição</option>{institutions.map(inst=><option key={inst.id} value={inst.id}>{inst.name}</option>)}</select></HelpLabel>{selectedAcademicoInstitution?<AcademicoBI key={selectedAcademicoInstitution.id} institutionId={selectedAcademicoInstitution.id} institutionName={selectedAcademicoInstitution.name}/>:<p role="status">Selecione uma instituição autorizada. Nenhum dado acadêmico é exibido antes de definir o escopo.</p>}</section></BIFrame>:route.captacao?<BIFrame view="captacao" institutionName={selectedCaptacaoInstitution?.name} source="Leads, custos de captação e snapshots · Supabase"><section aria-label="BI de Captação institucional">
    <HelpLabel htmlFor="captacao-instituicao" style={{display:'grid',gap:'8px',marginBottom:'16px',maxWidth:'560px'}}>
      <strong>Instituição para análise de captação</strong>
      <select id="captacao-instituicao" value={selectedCaptacaoInstitution?.id??''} onChange={e=>setCaptacaoInstitutionId(e.target.value)}>
        <option value="">Selecione uma instituição</option>
        {institutions.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </HelpLabel>
    {selectedCaptacaoInstitution
      ? <CaptacaoBI key={selectedCaptacaoInstitution.id} institutionId={selectedCaptacaoInstitution.id} institutionName={selectedCaptacaoInstitution.name}/>
      : <p role="status">Selecione uma instituição autorizada para consultar somente seus indicadores cadastrados de captação.</p>}
  </section></BIFrame>:route.bi?<PortalBI institutions={institutions} courses={courses} enrollments={enrollments} session={session}/>:master&&route.masters?<MasterDirectory/>:currentInst&&currentCourse?<CourseView key={currentCourse.id} course={currentCourse} institution={currentInst} enrollments={enrollments.filter(row => courses.some(course => course.id === row.course_id && course.institution_id === currentInst.id))} reports={reports} onBack={()=>writeHash(currentInst.id,'')} onPlan={can.record(roleIn(currentInst.id)) ? draft => { storeActionDraft(currentInst.id,draft); window.location.hash = new URLSearchParams({instituicao:currentInst.id,aba:'plano'}).toString(); } : undefined}/>
 :currentInst?<Workspace key={currentInst.id} institution={currentInst as unknown as Row} role={roleIn(currentInst.id)} onBack={()=>writeHash('','')} onChanged={load}
   stats={instStats(currentInst.id)}
   overview={<InstitutionView institution={currentInst} courses={courses} enrollments={enrollments} embedded onOpenCourse={id=>writeHash(currentInst.id,id)} onBack={()=>writeHash('','')}/>}/>
 :master&&route.repositories?<GlobalRepository institutions={institutions as unknown as Row[]} courses={courses as unknown as Row[]} onOpen={id=>writeHash(id,'',true)}/>
 :<><section className="vx-inst-hub" aria-label="Instituições sob gestão">
  <div className="vx-inst-hub-head">
   <div><p className="vx-inst-eyebrow">GESTÃO DAS IES · BASE AUTENTICADA</p><h2>Instituições</h2><p>Visão consolidada por instituição, com cobertura das fontes e acesso rápido às áreas de trabalho.</p></div>
   {master&&!creating&&<button className="vx-inst-create" type="button" onClick={()=>setCreating(true)}>＋ Nova instituição</button>}
  </div>
  {creating&&<RecordForm title="Nova instituição" fields={INSTITUTION_FIELDS} initial={{status:'ativa'}} onCancel={()=>setCreating(false)} onSubmit={async v=>{const row=await saveRow(TABLES.institutions,v);setCreating(false);await load();writeHash(row.id,'');}}/>}
  <div className="vx-inst-controls">
   <HelpLabel>Buscar instituição<input type="search" placeholder="Nome, sigla ou CNPJ..." value={institutionSearch} onChange={e=>setInstitutionSearch(e.target.value)} /></HelpLabel>
   <HelpLabel>Organizar por<select value={institutionSort} onChange={e=>setInstitutionSort(e.target.value as 'name'|'courses'|'pending')}><option value="name">Nome</option><option value="courses">Cursos cadastrados</option><option value="pending">Ações atrasadas</option></select></HelpLabel>
   <span>{institutions.length} instituição(ões) autorizada(s)</span>
  </div>
  {!institutions.length?<p className="vx-inst-empty">Nenhuma instituição disponível para esta conta. O vínculo deve ser autorizado pela administração.</p>:
   <div className="vx-inst-grid">{institutions
    .filter(i=>!route.tierFilter||(i as any).tier===route.tierFilter)
    .filter(i=>[i.name,(i as unknown as Row).acronym,(i as unknown as Row).cnpj].some(value=>String(value??'').toLocaleLowerCase('pt-BR').includes(institutionSearch.trim().toLocaleLowerCase('pt-BR'))))
    .sort((a,b)=>institutionSort==='courses'?courses.filter(c=>c.institution_id===b.id).length-courses.filter(c=>c.institution_id===a.id).length:institutionSort==='pending'?mgmt.actions.filter(x=>x.institution_id===b.id&&isLate(x.due_date,x.status)).length-mgmt.actions.filter(x=>x.institution_id===a.id&&isLate(x.due_date,x.status)).length:String(a.name).localeCompare(String(b.name),'pt-BR'))
    .map(i=>{
      const ownCourses=courses.filter(c=>c.institution_id===i.id).length;
      const ownGoals=mgmt.goals.filter(x=>x.institution_id===i.id&&x.status!=='cancelada').length;
      const overdue=mgmt.actions.filter(x=>x.institution_id===i.id&&isLate(x.due_date,x.status)).length;
      const findings=mgmt.diagnosis.filter(x=>x.institution_id===i.id&&x.status!=='resolvido').length;
      const stats=instStats(i.id);
      const coverage=stats&&stats.total>0?stats.covered/stats.total:null;
      const incomplete=coverage!==null&&coverage<1;
      const openInstrument=()=>{const p=new URLSearchParams({instituicao:i.id,aba:'novo_instrumento'});window.history.pushState(null,'','#'+p.toString());window.dispatchEvent(new HashChangeEvent('hashchange'));window.scrollTo({top:0});};
      return <article className="vx-inst-card" key={i.id}>
       <div className="vx-inst-card-heading">
        <span className="vx-inst-building" aria-hidden="true">{(i as any).tier==='escolas'?'🏫':'🏛️'}</span>
        <div className="vx-inst-identity"><h3>{i.name}</h3><p>{String((i as unknown as Row).acronym??((i as any).tier==='escolas'?'Escola':'Instituição de ensino superior'))} · <span style={{padding:'1px 6px',borderRadius:8,fontSize:10,fontWeight:700,background:(i as any).tier==='escolas'?'#ede9fe':'#dbeafe',color:(i as any).tier==='escolas'?'#7c3aed':'#2563eb'}}>{(i as any).tier==='escolas'?'Escola':'IES'}</span> · {ROLE_LABEL[roleIn(i.id)??'leitor']}</p></div>
        {((i as unknown as Row).status==='arquivada')&&<span className="vx-inst-archived">Arquivada</span>}
       </div>
       <div className="vx-inst-indicators">
        <div><small>Cursos cadastrados</small><strong>{ownCourses.toLocaleString('pt-BR')}</strong></div>
        <div><small>Metas registradas</small><strong>{ownGoals.toLocaleString('pt-BR')}</strong></div>
        <div className={overdue?'vx-inst-attention':''}><small>Ações atrasadas</small><strong>{overdue.toLocaleString('pt-BR')}</strong></div>
        <div className={findings?'vx-inst-attention':''}><small>Achados abertos</small><strong>{findings.toLocaleString('pt-BR')}</strong></div>
       </div>
       <section className="vx-inst-enrollment" aria-label={"Cobertura das matrículas de "+i.name}>
        <div className="vx-inst-enrollment-top"><div><small>Matrículas no recorte consultado</small><strong>{stats?stats.enrolled.toLocaleString('pt-BR'):'Sem dados'}</strong></div><span className={incomplete?'vx-inst-source-partial':'vx-inst-source-neutral'}>{!stats?'Sem fonte':incomplete?'Cobertura parcial':'Cobertura disponível'}</span></div>
        {stats?<><p>{stats.semester} · {stats.covered} de {stats.total} cursos com dados no recorte</p>
         <div className="vx-inst-coverage" role="progressbar" aria-label="Cobertura de cursos com matrícula" aria-valuenow={stats.covered} aria-valuemin={0} aria-valuemax={Math.max(1,stats.total)}><span style={{width:(coverage===null?0:Math.min(100,coverage*100))+'%'}}/></div>
         {incomplete&&<p className="vx-inst-caution">Atenção: total parcial da base; não representa necessariamente o total oficial de estudantes da IES. Reconciliar com a extração de origem.</p>}</>:<p>Nenhum registro de matrícula disponibilizado para esta instituição.</p>}
       </section>
       <div className="vx-inst-card-actions">
        <button type="button" className="vx-inst-primary" onClick={()=>writeHash(i.id,'')}>Abrir gestão da instituição <span aria-hidden="true">↗</span></button>
        <div className="vx-inst-shortcuts">
         <button type="button" onClick={()=>writeHash(i.id,'',true)}>Repositório</button>
         <button type="button" onClick={()=>writeHash(i.id,'',false,true)}>Biblioteca INEP</button>
         {['master','gestor'].includes(roleIn(i.id)??'')&&<button type="button" onClick={()=>writeHash(i.id,'',false,false,true)}>EBITDA</button>}
         <button type="button" onClick={openInstrument}>Novo Instrumento</button>
        </div>
       </div>
      </article>;
    })}</div>}
   {!!institutions.length&&!institutions.some(i=>[i.name,(i as unknown as Row).acronym,(i as unknown as Row).cnpj].some(value=>String(value??'').toLocaleLowerCase('pt-BR').includes(institutionSearch.trim().toLocaleLowerCase('pt-BR'))))&&<p className="vx-inst-empty">Nenhuma instituição corresponde à pesquisa.</p>}
 </section></>}
 <p>Os dados desta área vêm do banco. Os exemplos da demonstração permanecem separados.</p><button className="corp-login-text-button" onClick={load}>Atualizar dados</button></>}
 </>}
 <button className="corp-login-text-button" onClick={async()=>{const {error}=await supabase.auth.signOut();if(error)setError('Não foi possível encerrar a sessão.');}}>Sair da conta</button></>}
 {error&&<p role="alert">{error}</p>}<p><Link href="/privacidade.html">Privacidade</Link> · <Link href="/">Voltar ao site</Link></p></main>;
}
