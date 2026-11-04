import {storeActionDraft} from "@/lib/portal-integration";
import {institutionEnrollmentSummary} from "@/lib/enrollment-summary";
import {can} from "@/lib/area";
import {useEffect, useRef, useState, type FormEvent} from 'react';
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
import {isInstrumentRequest,latestInstrumentDocuments} from '@/lib/repository';
import GlobalRepository from '@/components/area/GlobalRepository';
import GreenHost from '@/components/acquisitions/GreenHost';
import DemoLeads from '@/components/DemoLeads';
import CaptacaoBI from '@/components/area/CaptacaoBI';

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
function readHash(){const p=new URLSearchParams(typeof window==='undefined'?'':window.location.hash.slice(1));return {inst:p.get('instituicao')??'',course:p.get('curso')??'',repositories:p.get('repositorios')==='1',bi:p.get('bi')==='1',captacao:p.get('captacao')==='1'};}
function writeHash(inst:string,course:string,repositories=false,library=false,reitor=false){const p=new URLSearchParams();if(inst)p.set('instituicao',inst);if(course)p.set('curso',course);if(repositories){if(inst)p.set('aba','repositorio');else p.set('repositorios','1');}if(library)p.set('aba','biblioteca');if(reitor)p.set('aba','reitor');const h=p.toString();window.history.pushState(null,'',h?`#${h}`:window.location.pathname);window.dispatchEvent(new HashChangeEvent('hashchange'));window.scrollTo({top:0});}

type BiItem = {label:string; group:string; value:number; href?:string};
type BiSource = {items:BiItem[]; error?:boolean};
const BI_NAMES=['Metas','Matrículas','Documentação','Repositório','Aquisições','Captação e permanência'];
const BI_COLORS=['#6554cf','#168878','#d76d34','#377acf','#c0447f','#82720b','#39714b'];
const biNumber=new Intl.NumberFormat('pt-BR');
const biMoney=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function PortalBI({institutions,courses,enrollments,session}:{institutions:Institution[];courses:Course[];enrollments:Enrollment[];session:Session}){
 const [id,setId]=useState(institutions[0]?.id??'');
 const [page,setPage]=useState(-1),[tv,setTv]=useState(false),[tick,setTick]=useState(0);
 const [sources,setSources]=useState<Record<number,BiSource>>({});
 const [detail,setDetail]=useState<{title:string;items:BiItem[]}|null>(null);
 const [manual,setManual]=useState(['','','','']);
 const panel=useRef<HTMLElement>(null), dialog=useRef<HTMLDialogElement>(null);
 const [snapshots,setSnapshots]=useState(enrollments);
 useEffect(()=>{if(!tick)return;let active=true;void fetchAllSnapshots().then(rows=>{if(active)setSnapshots(latestEnrollmentSnapshots(rows));}).catch(()=>{});return()=>{active=false;};},[tick]);
 const [semester,setSemester]=useState('');
 const own=courses.filter(c=>c.institution_id===id);
 const semesters=[...new Set(snapshots.filter(e=>own.some(c=>c.id===e.course_id)&&e.student_status==='MATRICULADO').map(e=>e.semester))].sort().reverse();
 const term=semesters.includes(semester)?semester:semesters[0];
 const link=(aba:string)=>'/master#'+new URLSearchParams({instituicao:id,aba});
 const enrollmentItems=own.flatMap(c=>{
  const rows=snapshots.filter(e=>e.course_id===c.id&&e.semester===term&&e.student_status==='MATRICULADO');
  return rows.length?[{label:c.name,group:c.name,value:courseTotals(rows).value,href:'/master#'+new URLSearchParams({instituicao:id,curso:c.id})}]:[];
 });
 useEffect(()=>{
  let active=true;
  const set=(key:number,source:BiSource)=>{if(active)setSources(previous=>({...previous,[key]:source}));};
  if(id){
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
  void fetch('https://qvetbbmviatxxatzzuzc.supabase.co/functions/v1/vertice-aquisicoes-green/rest/v1/dd_matters?select=*',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'}).then(async response=>{
   if(!response.ok)throw Error('Aquisições indisponível');
   const rows=await response.json() as Row[];
   set(4,{items:rows.filter(row=>row.scope_note!=='SEED-TESTE-FLUXO-COMPLETO-V1').map(row=>({label:String(row.title??row.code),group:({draft:'Em preparação',active:'Em análise',closing:'Fechamento',closed:'Encerrado',cancelled:'Cancelado'} as Record<string,string>)[String(row.status)]??String(row.status??'Sem situação'),value:1,href:'/master/aquisicoes#'+new URLSearchParams({mandato:row.id,aba:'summary'})}))});
  }).catch(()=>set(4,{items:[],error:true}));
  return()=>{active=false;};
 },[id,tick,session.access_token,courses]);
 useEffect(()=>{
  if(!tv||detail)return;
  const timer=window.setTimeout(()=>{setPage(previous=>(previous+1)%BI_NAMES.length);setTick(previous=>previous+1);},600000);
  return()=>window.clearTimeout(timer);
 },[tv,page,detail]);
 useEffect(()=>{if(detail&&!dialog.current?.open)dialog.current?.showModal();},[detail]);
 function toggleTv(){
  if(tv){setTv(false);if(document.fullscreenElement===panel.current)void document.exitFullscreen().catch(()=>{});return;}
  setTv(true);if(page<0)setPage(0);void panel.current?.requestFullscreen?.().catch(()=>{});
 }
 const captacaoLink=<article className="pbi-card" key="captacao-link" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'12px',cursor:'pointer'}} onClick={()=>{window.location.hash='captacao=1';window.dispatchEvent(new HashChangeEvent('hashchange'));}}>
   <h3 style={{margin:0,fontSize:'18px',color:'#328ea8'}}>📊 BI de Captação</h3>
   <p style={{margin:0,fontSize:'13px',color:'#757a80',textAlign:'center'}}>Dashboard completo de captação com funil, custos e conversão</p>
   <span style={{background:'#328ea8',color:'white',padding:'6px 16px',borderRadius:'8px',fontSize:'13px',fontWeight:600}}>Acessar</span>
  </article>;
 const cards:Record<number,BiSource>={...sources,1:{items:enrollmentItems}};
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
   <small>{index===1?'Matriculados · '+(term??'sem referência'):'Dados do portal · '+(index===4?'todos os mandatos autorizados':'instituição selecionada')}</small>
   <h3>{BI_NAMES[index]}</h3>
   {!source?<p role="status">Carregando…</p>:source.error?<p role="alert">Fonte temporariamente indisponível.</p>:!data.length?<p>Sem registros disponíveis neste recorte.</p>:<>
    {donut?<svg viewBox="0 0 180 180" className="pbi-donut" aria-label={BI_NAMES[index]}><circle cx="90" cy="90" r="63" fill="none" stroke="#edf0f7" strokeWidth="26"/>
     {data.map((entry,i)=>{const length=total?entry.value/total*100:0;const start=offset;offset+=length;return <circle key={entry.name} cx="90" cy="90" r="63" pathLength="100" fill="none" stroke={BI_COLORS[i%BI_COLORS.length]} strokeWidth="26" strokeDasharray={length+' '+(100-length)} strokeDashoffset={-start} transform="rotate(-90 90 90)" onClick={()=>open(entry)}><title>{entry.name+' · '+biNumber.format(entry.value)}</title></circle>;})}
     <text x="90" y="90" textAnchor="middle" dominantBaseline="middle" fontSize="27" fontWeight="700">{biNumber.format(total)}</text>
    </svg>:<div className="pbi-columns">{data.slice(0,12).map((entry,i)=><button key={entry.name} type="button" title={entry.name+' · '+biNumber.format(entry.value)} onClick={()=>open(entry)} style={{height:Math.max(5,entry.value/max*100)+'%',background:BI_COLORS[i%BI_COLORS.length]}}><span>{biNumber.format(entry.value)}</span></button>)}</div>}
    <div className="pbi-legend">{data.map((entry,i)=><button key={entry.name} type="button" onClick={()=>open(entry)}><i style={{background:BI_COLORS[i%BI_COLORS.length]}}/>{entry.name}<b>{biNumber.format(entry.value)}</b></button>)}</div>
   </>}
  </article>;
 }
 const ratio=(cost:string,count:string)=>cost!==''&&Number(cost)>=0&&Number.isInteger(Number(count))&&Number(count)>0?biMoney.format(Number(cost)/Number(count)):'—';
 const costs=<article className="pbi-card"><small>ENTRADA MANUAL · INTEGRAÇÃO PENDENTE</small><h3>Captação e permanência</h3><p>Preencha os totais do mesmo período. Os valores ficam disponíveis enquanto o BI estiver aberto.</p><div className="pbi-grid">
 {['Investimento em captação (R$)','Matrículas atribuídas à campanha','Despesas de permanência (R$)','Alunos acompanhados'].map((label,i)=><label key={label}>{label}<input type="number" min="0" step={i%2?'1':'0.01'} value={manual[i]} onChange={event=>{const value=event.target.value;setManual(previous=>previous.map((old,index)=>index===i?value:old));}}/></label>)}
 <p>Por matrícula confirmada <strong>{ratio(manual[0],manual[1])}</strong></p><p>Por aluno acompanhado <strong>{ratio(manual[2],manual[3])}</strong></p></div></article>;
 return <section ref={panel} className="portal-bi" aria-label="BI da Reitoria">
 <style>{'.portal-bi{background:#f5f6fb;color:#1b2440;padding:clamp(16px,3vw,42px);overflow:auto}.portal-bi h2{margin:0;font-size:clamp(26px,4vw,48px)}.pbi-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:18px 0}.portal-bi button,.portal-bi select,.portal-bi input{border:1px solid #d4d9ea;background:white;color:inherit;padding:9px;border-radius:8px}.portal-bi button[aria-pressed=true]{background:#5140ad;color:white}.pbi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:18px}.pbi-card{background:white;border:1px solid #e0e4f1;border-radius:16px;padding:20px;min-width:0}.pbi-card h3{margin:5px 0 18px;font-size:24px}.pbi-card small{color:#535b78}.pbi-donut{display:block;width:min(68%,220px);margin:auto}.pbi-donut circle[stroke-dasharray]{cursor:pointer}.pbi-columns{height:165px;display:flex;align-items:flex-end;gap:5px;padding:24px 0 0;margin:14px 0}.pbi-columns button{position:relative;flex:1;min-width:0;border:0;padding:0;border-radius:5px 5px 0 0}.pbi-columns span{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);font-size:11px}.pbi-legend{display:grid;gap:5px;max-height:260px;overflow:auto;margin-top:14px}.pbi-legend button{display:flex;gap:8px;align-items:center;text-align:left}.pbi-legend i{flex:none;width:11px;height:11px;border-radius:3px}.pbi-legend b{margin-left:auto}.pbi-card label{display:grid;gap:6px}.portal-bi dialog{max-width:min(720px,90vw);max-height:80vh;border:1px solid #d4d9ea;border-radius:16px;padding:24px;color:#1b2440}.portal-bi dialog::backdrop{background:#18142b99}.portal-bi:fullscreen .pbi-card{max-width:1400px;margin:auto}.portal-bi:fullscreen .pbi-donut{width:min(48vh,390px)}.portal-bi:fullscreen .pbi-columns{height:40vh}'}</style>
 <h2>BI da Reitoria</h2><p>Visão institucional. Selecione um gráfico para abrir os registros.</p>
 <div className="pbi-toolbar"><label>Instituição <select value={id} onChange={event=>{setSources({});setManual(['','','','']);setId(event.target.value);}}>{institutions.map(institution=><option key={institution.id} value={institution.id}>{institution.name}</option>)}</select></label>
 <label>Semestre de matrículas <select value={term??''} onChange={event=>setSemester(event.target.value)}>{!semesters.length&&<option value="">Sem referência</option>}{semesters.map(value=><option key={value}>{value}</option>)}</select></label>
 <button type="button" onClick={toggleTv}>{tv?'Pausar modo TV':'Modo TV · 10 min'}</button>
 <button type="button" onClick={()=>setTick(previous=>previous+1)}>Consultar fontes</button></div>
 <div className="pbi-toolbar"><button type="button" aria-pressed={page<0} onClick={()=>{setPage(-1);setTv(false);}}>Visão geral</button>{BI_NAMES.map((name,index)=><button type="button" key={name} aria-pressed={page===index} onClick={()=>setPage(index)}>{name}</button>)}</div>
 {page<0?<div className="pbi-grid">{BI_NAMES.slice(0,5).map((_,index)=>chart(index))}{captacaoLink}{costs}</div>:page===5?costs:chart(page)}
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
 const [creating,setCreating]=useState(false);
 const [commercial,setCommercial]=useState(false);
 const [mgmt,setMgmt]=useState<{goals:Row[];actions:Row[];diagnosis:Row[]}>({goals:[],actions:[],diagnosis:[]});
 const roleIn=(id:string):Role|null=>master?'master':((members.find(m=>m.institution_id===id&&m.user_id===session?.user.id)?.role as Role)??null);
 useEffect(()=>{const f=()=>setRoute(readHash());window.addEventListener('hashchange',f);window.addEventListener('popstate',f);return()=>{window.removeEventListener('hashchange',f);window.removeEventListener('popstate',f);};},[]);
 const instStats=(id:string)=>institutionEnrollmentSummary(id,courses,enrollments);
 const currentInst=institutions.find(i=>i.id===route.inst);
 const selectedCaptacaoInstitution=institutions.find(i=>i.id===captacaoInstitutionId);
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
    setFactor(data.totp[0]?.id??'');return;
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
   if(results.some(r=>r.error))throw new Error('data unavailable');
   const snapshots=await fetchAllSnapshots();
   setMaster(Boolean(results[0].data?.length));setInstitutions(results[1].data as Institution[]);setCourses(results[2].data as Course[]);setMembers(results[3].data as Membership[]);
   setEnrollments(latestEnrollmentSnapshots(snapshots));
   setReports(results[4].data as AcademicReport[]);
   const [g,a,d]=await Promise.all([
    fetchDashboardRows('vertice_goals','id',true,'id,institution_id,status'),
    fetchDashboardRows('vertice_actions','id',true,'id,institution_id,status,due_date'),
    fetchDashboardRows('vertice_diagnosis_items','id',true,'id,institution_id,status,priority')
   ]);
   setMgmt({goals:(g.data??[]) as Row[],actions:(a.data??[]) as Row[],diagnosis:(d.data??[]) as Row[]});
  }catch{setError('Não foi possível consultar os dados protegidos. Tente novamente.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{load(); const {data}=supabase.auth.onAuthStateChange((event,current)=>{if(event==='SIGNED_OUT'){setSession(current);setInstitutions([]);setCourses([]);setMembers([]);setEnrollments([]);setReports([]);setMaster(false);setCaptacaoInstitutionId('');}});return()=>data.subscription.unsubscribe();},[]);
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
 return <main className="corp-container corp-section"><h1>{window.location.pathname.startsWith('/reitor')?'Área reservada do reitor':master&&route.repositories?'Repositórios · visão master':master?'Painel Vértice':'Painel de gestão'}</h1>
 {loading?<p role="status">Verificando acesso…</p>:!session?<><p>Entre para acessar sua conta.</p><Link className="corp-button" href={window.location.pathname.startsWith('/reitor')?'/entrar?destino=reitor':'/entrar'}>Entrar</Link></>:<>
 <p>Conectado como <strong>{session.user.email}</strong>.</p>
 {aal!=='aal2'?<section className="corp-login-card"><h2>Proteja seu acesso</h2><p>O segundo fator é obrigatório para consultar os dados das instituições.</p>
 {!factor?<button className="corp-button" disabled={busy} onClick={enroll}>Configurar aplicativo autenticador</button>:<>
 {qr&&<><p>Leia o QR code no seu aplicativo autenticador. Não compartilhe esta imagem.</p><img alt="QR code para configurar seu autenticador" src={qr} width={200} height={200}/></>}
 <form className="access-form" onSubmit={verify}><label>Código do autenticador<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label><button className="corp-button" disabled={busy}>Validar segundo fator</button></form></>}
 </section>:<><p>{master?'Visão das instituições da empresa.':'Você vê somente as instituições vinculadas à sua conta.'}</p>
 <nav className="repo-global-nav" aria-label="Indicadores do portal"><a className="repo-secondary" href="/master#bi=1" onClick={()=>setCommercial(false)}>BI da Reitoria</a>
       <a className="repo-secondary" href="/master#captacao=1" onClick={()=>setCommercial(false)}>BI de Captação</a></nav>
 {master&&<nav className="repo-global-nav" aria-label="Visões do master"><a className="repo-secondary" href="/master/aquisicoes">Aquisições e incorporações</a><button className={`repo-secondary ${!commercial&&!route.bi&&!route.repositories&&!currentInst?'active':''}`} onClick={()=>{setCommercial(false);writeHash('','');}}>Gestão das instituições</button><button className={`repo-secondary ${!commercial&&route.repositories?'active':''}`} onClick={()=>{setCommercial(false);writeHash('','',true);}}>Repositórios de todas as IES</button><button className={`repo-secondary ${commercial?'active':''}`} onClick={()=>setCommercial(true)}>Demonstração · inteligência comercial</button></nav>}
 {master&&commercial?<DemoLeads/>:<>
 {!route.bi&&!route.captacao&&!currentInst&&!route.repositories&&<div className="stats-row"><div className="stat-card">Instituições<strong className="stat-value">{institutions.length}</strong></div><div className="stat-card">Cursos<strong className="stat-value">{courses.length}</strong></div><div className="stat-card">Vínculos<strong className="stat-value">{members.length}</strong></div></div>}
 {route.captacao?<section aria-label="BI de Captação institucional">
    <label htmlFor="captacao-instituicao" style={{display:'grid',gap:'8px',marginBottom:'16px',maxWidth:'560px'}}>
      <strong>Instituição para análise de captação</strong>
      <select id="captacao-instituicao" value={selectedCaptacaoInstitution?.id??''} onChange={e=>setCaptacaoInstitutionId(e.target.value)}>
        <option value="">Selecione uma instituição</option>
        {institutions.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </label>
    {selectedCaptacaoInstitution
      ? <CaptacaoBI key={selectedCaptacaoInstitution.id} institutionId={selectedCaptacaoInstitution.id} institutionName={selectedCaptacaoInstitution.name}/>
      : <p role="status">Selecione uma instituição autorizada para consultar somente seus indicadores reais de captação.</p>}
  </section>:route.bi?<PortalBI institutions={institutions} courses={courses} enrollments={enrollments} session={session}/>:currentInst&&currentCourse?<CourseView key={currentCourse.id} course={currentCourse} institution={currentInst} enrollments={enrollments.filter(row => courses.some(course => course.id === row.course_id && course.institution_id === currentInst.id))} reports={reports} onBack={()=>writeHash(currentInst.id,'')} onPlan={can.record(roleIn(currentInst.id)) ? draft => { storeActionDraft(currentInst.id,draft); window.location.hash = new URLSearchParams({instituicao:currentInst.id,aba:'plano'}).toString(); } : undefined}/>
 :currentInst?<Workspace key={currentInst.id} institution={currentInst as unknown as Row} role={roleIn(currentInst.id)} onBack={()=>writeHash('','')} onChanged={load}
   stats={instStats(currentInst.id)}
   overview={<InstitutionView institution={currentInst} courses={courses} enrollments={enrollments} embedded onOpenCourse={id=>writeHash(currentInst.id,id)} onBack={()=>writeHash('','')}/>}/>
 :master&&route.repositories?<GlobalRepository institutions={institutions as unknown as Row[]} courses={courses as unknown as Row[]} onOpen={id=>writeHash(id,'',true)}/>
 :<><div className="area-list-head"><h2>Instituições</h2>{master&&!creating&&<button className="corp-button small" onClick={()=>setCreating(true)}>Nova instituição</button>}</div>
 {creating&&<RecordForm title="Nova instituição" fields={INSTITUTION_FIELDS} initial={{status:'ativa'}} onCancel={()=>setCreating(false)} onSubmit={async v=>{const row=await saveRow(TABLES.institutions,v);setCreating(false);await load();writeHash(row.id,'');}}/>}
 {!institutions.length?<p>Nenhuma instituição disponível para esta conta. O vínculo deve ser autorizado pela administração.</p>:<div className="table-scroll"><table><thead><tr><th>Instituição</th><th>Seu perfil</th><th>Cursos cadastrados</th><th>Matriculados · última referência</th><th>Metas</th><th>Ações atrasadas</th><th>Achados abertos</th><th></th></tr></thead><tbody>{institutions.map(i=><tr key={i.id}><td>{i.name}{(i as unknown as Row).acronym?` · ${String((i as unknown as Row).acronym)}`:''}{(i as unknown as Row).status==='arquivada'&&' (arquivada)'}</td><td>{{master:'Master',gestor:'Gestor',equipe:'Equipe',leitor:'Leitura'}[roleIn(i.id)??'leitor']}</td><td>{courses.filter(c=>c.institution_id===i.id).length||'Nenhum curso cadastrado'}</td><td>{instStats(i.id)?<>{instStats(i.id)!.enrolled.toLocaleString('pt-BR')}<small className="area-block">{instStats(i.id)!.semester} · {instStats(i.id)!.covered}/{instStats(i.id)!.total} cursos com dados</small></>:'Sem dados'}</td><td>{mgmt.goals.filter(x=>x.institution_id===i.id&&x.status!=='cancelada').length}</td><td>{mgmt.actions.filter(x=>x.institution_id===i.id&&isLate(x.due_date,x.status)).length}</td><td>{mgmt.diagnosis.filter(x=>x.institution_id===i.id&&x.status!=='resolvido').length}</td><td><button className="corp-button" onClick={()=>writeHash(i.id,'')}>Abrir área</button> <button className="corp-login-text-button" onClick={()=>writeHash(i.id,'',true)}>Repositório →</button> <button className="corp-login-text-button" onClick={()=>writeHash(i.id,'',false,true)}>Biblioteca INEP →</button> {['master','gestor'].includes(roleIn(i.id)??'')&&<button className="corp-login-text-button" onClick={()=>writeHash(i.id,'',false,false,true)}>Calcular EBITDA →</button>}</td></tr>)}</tbody></table></div>}</>}
 <p>Os dados desta área vêm do banco. Os exemplos da demonstração permanecem separados.</p><button className="corp-login-text-button" onClick={load}>Atualizar dados</button></>}
 </>}
 <button className="corp-login-text-button" onClick={async()=>{const {error}=await supabase.auth.signOut();if(error)setError('Não foi possível encerrar a sessão.');}}>Sair da conta</button></>}
 {error&&<p role="alert">{error}</p>}<p><Link href="/privacidade.html">Privacidade</Link> · <Link href="/">Voltar ao site</Link></p></main>;
}
