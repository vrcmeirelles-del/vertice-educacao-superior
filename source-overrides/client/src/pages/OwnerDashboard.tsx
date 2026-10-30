import {useEffect, useState, type FormEvent} from 'react';
import {Link} from 'wouter';
import {supabase} from '@/lib/supabase';
import type {Session} from '@supabase/supabase-js';
import type {AcademicReport} from '@/components/AcademicReports';
import {CourseView, InstitutionView, courseTotals, type Course, type Enrollment, type Institution} from '@/components/InstitutionArea';

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
function readHash(){const p=new URLSearchParams(typeof window==='undefined'?'':window.location.hash.slice(1));return {inst:p.get('instituicao')??'',course:p.get('curso')??''};}
function writeHash(inst:string,course:string){const p=new URLSearchParams();if(inst)p.set('instituicao',inst);if(course)p.set('curso',course);const h=p.toString();window.history.pushState(null,'',h?`#${h}`:window.location.pathname);window.dispatchEvent(new HashChangeEvent('hashchange'));window.scrollTo({top:0});}
export default function OwnerDashboard(){
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [aal,setAal]=useState(''),[master,setMaster]=useState(false);
 const [factor,setFactor]=useState(''),[qr,setQr]=useState(''),[code,setCode]=useState('');
 const [institutions,setInstitutions]=useState<Institution[]>([]),[courses,setCourses]=useState<Course[]>([]),[members,setMembers]=useState<Membership[]>([]);
 const [enrollments,setEnrollments]=useState<Enrollment[]>([]);
 const [reports,setReports]=useState<AcademicReport[]>([]);
 const [route,setRoute]=useState(readHash());
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
   const results=await Promise.all([
    supabase.from('vertice_admins').select('user_id').eq('user_id',current.user.id),
    supabase.from('vertice_institutions').select('id,name').order('name'),
    supabase.from('vertice_courses').select('*').order('name'),
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
 return <main className="corp-container corp-section"><h1>{master?'Painel do proprietário':'Minha área'}</h1>
 {loading?<p role="status">Verificando acesso…</p>:!session?<><p>Entre para acessar sua conta.</p><Link className="corp-button" href="/entrar">Entrar</Link></>:<>
 <p>Conectado como <strong>{session.user.email}</strong>.</p>
 {aal!=='aal2'?<section className="corp-login-card"><h2>Proteja seu acesso</h2><p>O segundo fator é obrigatório para consultar os dados das instituições.</p>
 {!factor?<button className="corp-button" disabled={busy} onClick={enroll}>Configurar aplicativo autenticador</button>:<>
 {qr&&<><p>Leia o QR code no seu aplicativo autenticador. Não compartilhe esta imagem.</p><img alt="QR code para configurar seu autenticador" src={qr} width={200} height={200}/></>}
 <form className="access-form" onSubmit={verify}><label>Código do autenticador<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label><button className="corp-button" disabled={busy}>Validar segundo fator</button></form></>}
 </section>:<><p>{master?'Visão das instituições da empresa.':'Você vê somente as instituições vinculadas à sua conta.'}</p>
 <div className="stats-row"><div className="stat-card">Instituições<strong className="stat-value">{institutions.length}</strong></div><div className="stat-card">Cursos<strong className="stat-value">{courses.length}</strong></div><div className="stat-card">Vínculos<strong className="stat-value">{members.length}</strong></div></div>
 {currentInst&&currentCourse?<CourseView key={currentCourse.id} course={currentCourse} institution={currentInst} enrollments={enrollments} reports={reports} onBack={()=>writeHash(currentInst.id,'')}/>
 :currentInst?<InstitutionView key={currentInst.id} institution={currentInst} courses={courses} enrollments={enrollments} onOpenCourse={id=>writeHash(currentInst.id,id)} onBack={()=>writeHash('','')}/>
 :<><h2>Instituições</h2>{!institutions.length?<p>Nenhuma instituição disponível para esta conta. O vínculo deve ser autorizado pela administração.</p>:<div className="table-scroll"><table><thead><tr><th>Instituição</th><th>Cursos cadastrados</th><th>Matriculados{latestSemester?` em ${latestSemester}`:''}</th><th></th></tr></thead><tbody>{institutions.map(i=><tr key={i.id}><td>{i.name}</td><td>{courses.filter(c=>c.institution_id===i.id).length||'Nenhum curso cadastrado'}</td><td>{instTotal(i.id).toLocaleString('pt-BR')}</td><td><button className="corp-button" onClick={()=>writeHash(i.id,'')}>Abrir área</button></td></tr>)}</tbody></table></div>}</>}
 <p>Os dados desta área vêm do banco. Os exemplos da demonstração permanecem separados.</p><button className="corp-login-text-button" onClick={load}>Atualizar dados</button></>}
 <button className="corp-login-text-button" onClick={async()=>{const {error}=await supabase.auth.signOut();if(error)setError('Não foi possível encerrar a sessão.');}}>Sair da conta</button></>}
 {error&&<p role="alert">{error}</p>}<p><Link href="/privacidade.html">Privacidade</Link> · <Link href="/">Voltar ao site</Link></p></main>;
}
