import {useEffect, useState, type FormEvent} from 'react';
import {Link} from 'wouter';
import {supabase} from '@/lib/supabase';
import type {Session} from '@supabase/supabase-js';
import type {AcademicReport} from '@/components/AcademicReports';
import {CourseView, InstitutionView, courseTotals, type Course, type Enrollment, type Institution} from '@/components/InstitutionArea';
import Workspace, {INSTITUTION_FIELDS} from '@/components/area/Workspace';
import RecordForm from '@/components/area/RecordForm';
import {TABLES, isLate, saveRow, type Role, type Row} from '@/lib/area';
import GlobalRepository from '@/components/area/GlobalRepository';

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
async function fetchDashboardRows(table:string,order:string){
 const rows:Row[]=[];
 for(let from=0;;from+=1000){const {data,error}=await supabase.from(table).select('*').order(order).order('id').range(from,from+999);if(error)throw error;rows.push(...((data??[]) as Row[]));if(!data||data.length<1000)break;}
 return {data:rows,error:null};
}
function readHash(){const p=new URLSearchParams(typeof window==='undefined'?'':window.location.hash.slice(1));return {inst:p.get('instituicao')??'',course:p.get('curso')??'',repositories:p.get('repositorios')==='1'};}
function writeHash(inst:string,course:string,repositories=false){const p=new URLSearchParams();if(inst)p.set('instituicao',inst);if(course)p.set('curso',course);if(repositories){if(inst)p.set('aba','repositorio');else p.set('repositorios','1');}const h=p.toString();window.history.pushState(null,'',h?`#${h}`:window.location.pathname);window.dispatchEvent(new HashChangeEvent('hashchange'));window.scrollTo({top:0});}
export default function OwnerDashboard(){
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [aal,setAal]=useState(''),[master,setMaster]=useState(false);
 const [factor,setFactor]=useState(''),[qr,setQr]=useState(''),[code,setCode]=useState('');
 const [institutions,setInstitutions]=useState<Institution[]>([]),[courses,setCourses]=useState<Course[]>([]),[members,setMembers]=useState<Membership[]>([]);
 const [enrollments,setEnrollments]=useState<Enrollment[]>([]);
 const [reports,setReports]=useState<AcademicReport[]>([]);
 const [route,setRoute]=useState(readHash());
 const [creating,setCreating]=useState(false);
 const [mgmt,setMgmt]=useState<{goals:Row[];actions:Row[];diagnosis:Row[]}>({goals:[],actions:[],diagnosis:[]});
 const roleIn=(id:string):Role|null=>master?'master':((members.find(m=>m.institution_id===id&&m.user_id===session?.user.id)?.role as Role)??null);
 useEffect(()=>{const f=()=>setRoute(readHash());window.addEventListener('hashchange',f);window.addEventListener('popstate',f);return()=>{window.removeEventListener('hashchange',f);window.removeEventListener('popstate',f);};},[]);
 const latestSemester=[...new Set(enrollments.filter(r=>r.student_status==='MATRICULADO').map(r=>r.semester))].sort().reverse()[0];
 const instTotal=(id:string)=>{if(!latestSemester)return 0;const ids=new Set(courses.filter(c=>c.institution_id===id).map(c=>c.id));const per=new Map<string,Enrollment[]>();for(const r of enrollments)if(ids.has(r.course_id)&&r.semester===latestSemester&&r.student_status==='MATRICULADO'){if(!per.has(r.course_id))per.set(r.course_id,[]);per.get(r.course_id)!.push(r);}return [...per.values()].reduce((t,rows)=>t+courseTotals(rows).value,0);};
 const currentInst=institutions.find(i=>i.id===route.inst);
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
   await supabase.rpc('vertice_accept_invites').then(()=>undefined,()=>undefined);
   const results=await Promise.all([
    supabase.from('vertice_admins').select('user_id').eq('user_id',current.user.id),
    fetchDashboardRows('vertice_institutions','name'),
    fetchDashboardRows('vertice_courses','name'),
    supabase.from('vertice_memberships').select('user_id,institution_id,role'),
    supabase.from('vertice_academic_reports').select('id,course_id,kind,source_label,source_report_at,payload').order('source_report_at',{ascending:false})
   ]);
   if(results.some(r=>r.error))throw new Error('data unavailable');
   const snapshots=await fetchAllSnapshots();
   setMaster(Boolean(results[0].data?.length));setInstitutions(results[1].data as Institution[]);setCourses(results[2].data as Course[]);setMembers(results[3].data as Membership[]);
   const latest=new Map<string,Enrollment>();
   for(const row of snapshots){const key=[row.course_id,row.semester,row.student_status,row.class_label].join('|');if(!latest.has(key))latest.set(key,row);}
   setEnrollments([...latest.values()]);
   setReports(results[4].data as AcademicReport[]);
   const [g,a,d]=await Promise.all([
    supabase.from('vertice_goals').select('id,institution_id,status'),
    supabase.from('vertice_actions').select('id,institution_id,status,due_date'),
    supabase.from('vertice_diagnosis_items').select('id,institution_id,status,priority')
   ]);
   setMgmt({goals:(g.data??[]) as Row[],actions:(a.data??[]) as Row[],diagnosis:(d.data??[]) as Row[]});
  }catch{setError('Não foi possível consultar os dados protegidos. Tente novamente.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{load(); const {data}=supabase.auth.onAuthStateChange((event,current)=>{if(event==='SIGNED_OUT'){setSession(current);setInstitutions([]);setCourses([]);setMembers([]);setEnrollments([]);setReports([]);setMaster(false);}});return()=>data.subscription.unsubscribe();},[]);
 async function enroll(){setBusy(true);setError('');try{
  const {data:existing,error:listError}=await supabase.auth.mfa.listFactors();if(listError)throw listError;
  const pending=existing.all.find(f=>f.factor_type==='totp' && f.status==='unverified');
  if(pending){const {error}=await supabase.auth.mfa.unenroll({factorId:pending.id});if(error)throw error;}
  const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'Vértice'});if(error)throw error;setFactor(data.id);setQr(data.totp.qr_code);
 }catch{setError('Não foi possível iniciar o segundo fator. Tente novamente.');}finally{setBusy(false);}}
 async function verify(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
  const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:factor,code});if(error)throw error;setCode('');setQr('');await load();
 }catch{setError('Código não validado. Confira o autenticador e tente novamente.');}finally{setBusy(false);}}
 return <main className="corp-container corp-section"><h1>{master&&route.repositories?'Repositórios · visão master':master?'Painel Vértice':'Painel de gestão'}</h1>
 {loading?<p role="status">Verificando acesso…</p>:!session?<><p>Entre para acessar sua conta.</p><Link className="corp-button" href="/entrar">Entrar</Link></>:<>
 <p>Conectado como <strong>{session.user.email}</strong>.</p>
 {aal!=='aal2'?<section className="corp-login-card"><h2>Proteja seu acesso</h2><p>O segundo fator é obrigatório para consultar os dados das instituições.</p>
 {!factor?<button className="corp-button" disabled={busy} onClick={enroll}>Configurar aplicativo autenticador</button>:<>
 {qr&&<><p>Leia o QR code no seu aplicativo autenticador. Não compartilhe esta imagem.</p><img alt="QR code para configurar seu autenticador" src={qr} width={200} height={200}/></>}
 <form className="access-form" onSubmit={verify}><label>Código do autenticador<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label><button className="corp-button" disabled={busy}>Validar segundo fator</button></form></>}
 </section>:<><p>{master?'Visão das instituições da empresa.':'Você vê somente as instituições vinculadas à sua conta.'}</p>
 {master&&<nav className="repo-global-nav" aria-label="Visões do master"><button className={`repo-secondary ${!route.repositories&&!currentInst?'active':''}`} onClick={()=>writeHash('','')}>Gestão das instituições</button><button className={`repo-secondary ${route.repositories||new URLSearchParams(window.location.hash.slice(1)).get('aba')==='repositorio'?'active':''}`} onClick={()=>writeHash('','',true)}>Repositórios de todas as IES</button></nav>}
 {!currentInst&&!route.repositories&&<div className="stats-row"><div className="stat-card">Instituições<strong className="stat-value">{institutions.length}</strong></div><div className="stat-card">Cursos<strong className="stat-value">{courses.length}</strong></div><div className="stat-card">Vínculos<strong className="stat-value">{members.length}</strong></div></div>}
 {currentInst&&currentCourse?<CourseView key={currentCourse.id} course={currentCourse} institution={currentInst} enrollments={enrollments} reports={reports} onBack={()=>writeHash(currentInst.id,'')}/>
 :currentInst?<Workspace key={currentInst.id} institution={currentInst as unknown as Row} role={roleIn(currentInst.id)} onBack={()=>writeHash('','')} onChanged={load}
   stats={{enrolled:instTotal(currentInst.id),semester:latestSemester}}
   overview={<InstitutionView institution={currentInst} courses={courses} enrollments={enrollments} embedded onOpenCourse={id=>writeHash(currentInst.id,id)} onBack={()=>writeHash('','')}/>}/>
 :master&&route.repositories?<GlobalRepository institutions={institutions as unknown as Row[]} courses={courses as unknown as Row[]} onOpen={id=>writeHash(id,'',true)}/>
 :<><div className="area-list-head"><h2>Instituições</h2>{master&&!creating&&<button className="corp-button small" onClick={()=>setCreating(true)}>Nova instituição</button>}</div>
 {creating&&<RecordForm title="Nova instituição" fields={INSTITUTION_FIELDS} initial={{status:'ativa'}} onCancel={()=>setCreating(false)} onSubmit={async v=>{const row=await saveRow(TABLES.institutions,v);setCreating(false);await load();writeHash(row.id,'');}}/>}
 {!institutions.length?<p>Nenhuma instituição disponível para esta conta. O vínculo deve ser autorizado pela administração.</p>:<div className="table-scroll"><table><thead><tr><th>Instituição</th><th>Seu perfil</th><th>Cursos cadastrados</th><th>Matriculados{latestSemester?` em ${latestSemester}`:''}</th><th>Metas</th><th>Ações atrasadas</th><th>Achados abertos</th><th></th></tr></thead><tbody>{institutions.map(i=><tr key={i.id}><td>{i.name}{(i as unknown as Row).acronym?` · ${String((i as unknown as Row).acronym)}`:''}{(i as unknown as Row).status==='arquivada'&&' (arquivada)'}</td><td>{{master:'Master',gestor:'Gestor',equipe:'Equipe',leitor:'Leitura'}[roleIn(i.id)??'leitor']}</td><td>{courses.filter(c=>c.institution_id===i.id).length||'Nenhum curso cadastrado'}</td><td>{instTotal(i.id).toLocaleString('pt-BR')}</td><td>{mgmt.goals.filter(x=>x.institution_id===i.id&&x.status!=='cancelada').length}</td><td>{mgmt.actions.filter(x=>x.institution_id===i.id&&isLate(x.due_date,x.status)).length}</td><td>{mgmt.diagnosis.filter(x=>x.institution_id===i.id&&x.status!=='resolvido').length}</td><td><button className="corp-button" onClick={()=>writeHash(i.id,'')}>Abrir área</button> <button className="corp-login-text-button" onClick={()=>writeHash(i.id,'',true)}>Repositório →</button></td></tr>)}</tbody></table></div>}</>}
 <p>Os dados desta área vêm do banco. Os exemplos da demonstração permanecem separados.</p><button className="corp-login-text-button" onClick={load}>Atualizar dados</button></>}
 <button className="corp-login-text-button" onClick={async()=>{const {error}=await supabase.auth.signOut();if(error)setError('Não foi possível encerrar a sessão.');}}>Sair da conta</button></>}
 {error&&<p role="alert">{error}</p>}<p><Link href="/privacidade.html">Privacidade</Link> · <Link href="/">Voltar ao site</Link></p></main>;
}
