import {useMemo, useState} from 'react';
import AcademicReports, {type AcademicReport} from '@/components/AcademicReports';

export type Institution={id:string;name:string};
export type Course={id:string;institution_id:string;name:string;code:string|null;modality?:string|null};
export type Enrollment={id:string;course_id:string;semester:string;class_label:string;enrolled:number;capacity:number;available:number;source_report_at:string;reported_total:number|null;student_status:string};
export type Modality='presencial'|'semipresencial'|'ead';

const LABEL:Record<Modality,string>={presencial:'Presencial',semipresencial:'Semipresencial',ead:'EAD'};
const STATUS:[string,string][]=[['MATRICULADO','Matriculado'],['PRE-MATRICULADO','Pré-matriculado'],['TRANCADO','Trancado'],['ABANDONO','Abandono'],['CONCLUIDO','Concluído'],['CANCELADO','Cancelado'],['TRANSFERIDO','Transferido'],['TROCA DE CURSO','Troca de curso'],['GRADUADO','Graduado']];

export function modalityOf(c:Course):Modality{
 const m=(c.modality??'').toLowerCase();
 if(m==='presencial'||m==='semipresencial'||m==='ead')return m;
 const n=c.name.toUpperCase();
 if(n.includes('EAD'))return 'ead';
 if(n.includes('SEMIPRESENCIAL'))return 'semipresencial';
 return 'presencial';
}
const sortSem=(a:string,b:string)=>b.localeCompare(a);
const fmt=(n:number)=>n.toLocaleString('pt-BR');

/** Matriculados de um curso num semestre: soma das turmas e total informado na origem. */
export function courseTotals(rows:Enrollment[]){
 const sum=rows.reduce((s,r)=>s+r.enrolled,0);
 const reported=rows.find(r=>r.reported_total!==null&&r.reported_total!==undefined)?.reported_total??null;
 return {sum,reported,value:reported??sum};
}

type StatusSeries={semester:string;capacity:number|null;counts:Record<string,number>};

export function InstitutionView({institution,courses,enrollments,onOpenCourse,onBack,embedded}:{institution:Institution;courses:Course[];enrollments:Enrollment[];onOpenCourse:(id:string)=>void;onBack:()=>void;embedded?:boolean}){
 const own=courses.filter(c=>c.institution_id===institution.id);
 const ids=new Set(own.map(c=>c.id));
 const rows=enrollments.filter(r=>ids.has(r.course_id)&&r.student_status==='MATRICULADO');
 const semesters=[...new Set(rows.map(r=>r.semester))].sort(sortSem);
 const [semester,setSemester]=useState(semesters[0]??'');
 const [tab,setTab]=useState<Modality|'todas'>('todas');
 const [query,setQuery]=useState('');
 const sem=semester||semesters[0]||'';
 const prev=semesters[semesters.indexOf(sem)+1];
 const byCourse=useMemo(()=>{const m=new Map<string,Map<string,Enrollment[]>>();for(const r of rows){if(!m.has(r.course_id))m.set(r.course_id,new Map());const s=m.get(r.course_id)!;if(!s.has(r.semester))s.set(r.semester,[]);s.get(r.semester)!.push(r);}return m;},[rows]);
 const value=(id:string,s?:string)=>s?courseTotals(byCourse.get(id)?.get(s)??[]).value:0;
 const list=own.filter(c=>(tab==='todas'||modalityOf(c)===tab)&&(`${c.code??''} ${c.name}`.toLowerCase().includes(query.toLowerCase())))
  .map(c=>({c,now:value(c.id,sem),before:value(c.id,prev),turmas:(byCourse.get(c.id)?.get(sem)??[]).filter(r=>r.enrolled>0).length,hasData:byCourse.has(c.id)}))
  .sort((a,b)=>b.now-a.now||a.c.name.localeCompare(b.c.name,'pt-BR'));
 const mods:Modality[]=['presencial','semipresencial','ead'];
 const modTotal=(m:Modality,s:string)=>own.filter(c=>modalityOf(c)===m).reduce((t,c)=>t+value(c.id,s),0);
 const total=mods.reduce((t,m)=>t+modTotal(m,sem),0);
 const active=own.filter(c=>value(c.id,sem)>0).length;
 return <section aria-labelledby={embedded?undefined:"inst-title"}>
  {!embedded&&<><p><button className="corp-login-text-button" onClick={onBack}>← Todas as instituições</button></p>
  <h2 id="inst-title">{institution.name}</h2></>}
  {!semesters.length?<p>Nenhum quantitativo importado para esta instituição.</p>:<>
  <label>Semestre <select value={sem} onChange={e=>setSemester(e.target.value)}>{semesters.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
  <div className="stats-row">
   <div className="stat-card">Matriculados em {sem}<strong className="stat-value">{fmt(total)}</strong></div>
   <div className="stat-card">Cursos com matriculados<strong className="stat-value">{active} de {own.length}</strong></div>
   {mods.map(m=><div key={m} className="stat-card">{LABEL[m]}<strong className="stat-value">{fmt(modTotal(m,sem))}</strong></div>)}
  </div>
  <h3>Série histórica por modalidade (matriculados)</h3>
  <div className="table-scroll"><table><thead><tr><th>Modalidade</th>{semesters.slice().reverse().map(s=><th key={s}>{s}</th>)}</tr></thead>
  <tbody>{mods.map(m=><tr key={m}><td>{LABEL[m]}</td>{semesters.slice().reverse().map(s=><td key={s}>{fmt(modTotal(m,s))}</td>)}</tr>)}</tbody></table></div>
  <h3>Cursos</h3>
  <div role="tablist" aria-label="Modalidade" style={{display:'flex',gap:'.5rem',flexWrap:'wrap',margin:'.5rem 0'}}>
   {(['todas',...mods] as const).map(t=><button key={t} role="tab" aria-selected={tab===t} className={tab===t?'corp-button':'corp-login-text-button'} onClick={()=>setTab(t)}>{t==='todas'?'Todas':LABEL[t]} ({t==='todas'?own.length:own.filter(c=>modalityOf(c)===t).length})</button>)}
  </div>
  <label>Buscar curso <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome ou código"/></label>
  <div className="table-scroll"><table><thead><tr><th>Código</th><th>Curso</th><th>Modalidade</th><th>Matriculados {sem}</th><th>{prev?`Em ${prev}`:'Semestre anterior'}</th><th>Variação</th><th>Turmas com alunos</th><th></th></tr></thead>
  <tbody>{list.map(({c,now,before,turmas,hasData})=><tr key={c.id}><td>{c.code??'—'}</td><td>{c.name}</td><td>{LABEL[modalityOf(c)]}</td><td>{fmt(now)}</td><td>{prev?fmt(before):'—'}</td><td>{prev&&before?`${now>=before?'+':''}${Math.round((now-before)/before*100)}%`:'—'}</td><td>{turmas}</td><td>{hasData?<button className="corp-login-text-button" onClick={()=>onOpenCourse(c.id)}>Abrir</button>:'Sem dados'}</td></tr>)}</tbody></table></div>
  <p>Fonte: relatório estatístico de alunos do e-ORBIT, status MATRICULADO. Modalidade pelo cadastro do curso no e-ORBIT, não pelo ato regulatório no e-MEC. Quantitativos não comprovam alunos únicos, retenção ou evasão.</p>
  </>}
 </section>;
}

export function CourseView({course,institution,enrollments,reports,onBack}:{course:Course;institution:Institution;enrollments:Enrollment[];reports:(AcademicReport&{course_id?:string})[];onBack:()=>void}){
 const rows=enrollments.filter(r=>r.course_id===course.id&&r.student_status==='MATRICULADO');
 const semesters=[...new Set(rows.map(r=>r.semester))].sort(sortSem);
 const [semester,setSemester]=useState(semesters[0]??'');
 const sem=semester||semesters[0]||'';
 const selected=rows.filter(r=>r.semester===sem);
 const {sum:rowTotal,reported:reportedTotal}=courseTotals(selected);
 const own=reports.filter(r=>r.course_id===course.id);
 const series=own.find(r=>(r.kind as string)==='status_series');
 const statusRows=((series?.payload.series??[]) as StatusSeries[]).slice().sort((a,b)=>a.semester.localeCompare(b.semester));
 return <section aria-labelledby="course-title">
  <p><button className="corp-login-text-button" onClick={onBack}>← {institution.name}</button></p>
  <h2 id="course-title">{course.name}{course.code?` · código ${course.code}`:''}</h2>
  <p>Modalidade: {LABEL[modalityOf(course)]}</p>
  <h3>Matrículas por turma</h3>
  {!semesters.length?<p>Nenhum relatório importado para este curso.</p>:<>
  <label>Semestre <select value={sem} onChange={e=>setSemester(e.target.value)}>{semesters.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
  {selected[0]&&<p>Fonte: relatório estatístico do e-ORBIT, status MATRICULADO. Consulta em {new Date(selected[0].source_report_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}.</p>}
  <div className="stats-row"><div className="stat-card">Total informado no relatório<strong className="stat-value">{reportedTotal??'Não informado'}</strong></div><div className="stat-card">Soma das turmas<strong className="stat-value">{rowTotal}</strong></div><div className="stat-card">Turmas<strong className="stat-value">{selected.length}</strong></div></div>
  {reportedTotal!==null&&reportedTotal!==rowTotal&&<p role="alert">Conferência pendente: o total informado ({reportedTotal}) difere da soma das turmas ({rowTotal}). Os valores da origem foram preservados.</p>}
  <div className="table-scroll"><table><thead><tr><th>Série / turma na origem</th><th>Matrículas</th><th>Vagas</th><th>Disponíveis</th></tr></thead><tbody>{selected.slice().sort((a,b)=>a.class_label.localeCompare(b.class_label,'pt-BR',{numeric:true})).map(r=><tr key={r.id}><td>{r.class_label}</td><td>{r.enrolled}</td><td>{r.capacity}</td><td>{r.available}</td></tr>)}</tbody></table></div>
  {course.code==='027'&&sem==='2026/02'&&<p>Conferir na secretaria: DIR-5A2026/02 aparece como 6ª série no relatório.</p>}
  <p>Quantitativos por turma não comprovam alunos únicos, retenção, captação efetiva ou participação na AV1. Esses indicadores dependem do cruzamento individual.</p>
  </>}
  {statusRows.length>0&&<><h3>Situação dos registros por semestre</h3><p>{series?.source_label}</p>
  <div className="table-scroll"><table><thead><tr><th>Semestre</th><th>Vagas</th>{STATUS.map(([k,l])=><th key={k}>{l}</th>)}<th>Total de registros</th></tr></thead>
  <tbody>{statusRows.map(s=><tr key={s.semester}><td>{s.semester}</td><td>{s.capacity??'—'}</td>{STATUS.map(([k])=><td key={k}>{s.counts[k]??0}</td>)}<td>{STATUS.reduce((t,[k])=>t+(s.counts[k]??0),0)}</td></tr>)}</tbody></table></div>
  <p>O status é o registrado hoje para a matrícula daquele semestre. Semestres antigos tendem a aparecer como concluídos ou trancados porque o registro foi fechado depois; para comparar anos, use o total de registros.</p></>}
  {own.some(r=>(r.kind as string)!=='status_series')&&<AcademicReports reports={own.filter(r=>(r.kind as string)!=='status_series')}/>}
 </section>;
}
