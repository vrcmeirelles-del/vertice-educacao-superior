import {isEnrolledStatus} from '@/lib/enrollment-summary';
import {courseTotals} from "@/lib/enrollment-summary";
export {courseTotals} from "@/lib/enrollment-summary";
import "./academic-data.css";
import CourseIndicators, {type CourseIndicatorPayload} from "./CourseIndicators";
import {useMemo, useState} from 'react';
import AcademicReports, {type AcademicReport} from '@/components/AcademicReports';

export type Institution={id:string;name:string};
export type Course={id:string;institution_id:string;name:string;code:string|null;modality?:string|null};
export type Enrollment={id:string;course_id:string;semester:string;class_label:string;enrolled:number;capacity:number|null;available:number|null;source_report_at:string;reported_total:number|null;student_status:string};
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

/** A edição mais recente substitui o relatório inteiro do curso/semestre/status. */
export function latestEnrollmentSnapshots(rows: Enrollment[]) {
 const latest=new Map<string,number>();
 const key=(r:Enrollment)=>[r.course_id,r.semester,r.student_status].join("|");
 const at=(r:Enrollment)=>Date.parse(r.source_report_at)||0;
 for(const r of rows) latest.set(key(r),Math.max(latest.get(key(r))??-Infinity,at(r)));
 return rows.filter(r=>at(r)===latest.get(key(r)));
}

type StatusSeries={semester:string;capacity:number|null;counts:Record<string,number>};

function EnrollmentChart({title,items}:{title:string;items:{label:string;value:number|null}[]}){
 const max=Math.max(1,...items.map(item=>item.value??0));
 return <figure className="enrollment-chart"><figcaption>{title}</figcaption>{items.map(item=><div key={item.label}><span>{item.label}</span>{item.value!==null&&<progress aria-label={item.label} value={item.value} max={max}/>}<strong>{item.value===null?'Sem dados':fmt(item.value)}</strong></div>)}</figure>;
}

export function InstitutionView({institution,courses,enrollments,onOpenCourse,onBack,embedded}:{institution:Institution;courses:Course[];enrollments:Enrollment[];onOpenCourse:(id:string)=>void;onBack:()=>void;embedded?:boolean}){
 const own=courses.filter(c=>c.institution_id===institution.id);
 const ids=new Set(own.map(c=>c.id));
 const rows=enrollments.filter(r=>ids.has(r.course_id)&&isEnrolledStatus(r.student_status));
 const semesters=[...new Set(rows.map(r=>r.semester))].sort(sortSem);
 const [semester,setSemester]=useState(semesters[0]??'');
 const [tab,setTab]=useState<Modality|'todas'>('todas');
 const [query,setQuery]=useState('');
 const sem=semester||semesters[0]||'';
 const prev=semesters[semesters.indexOf(sem)+1];
 const byCourse=useMemo(()=>{const m=new Map<string,Map<string,Enrollment[]>>();for(const r of rows){if(!m.has(r.course_id))m.set(r.course_id,new Map());const s=m.get(r.course_id)!;if(!s.has(r.semester))s.set(r.semester,[]);s.get(r.semester)!.push(r);}return m;},[rows]);
 const value=(id:string,s?:string)=>s?courseTotals(byCourse.get(id)?.get(s)??[]).value:0;
 const list=own.filter(c=>(tab==='todas'||modalityOf(c)===tab)&&(`${c.code??''} ${c.name}`.toLowerCase().includes(query.toLowerCase())))
  .map(c=>({c,now:value(c.id,sem),before:value(c.id,prev),turmas:(byCourse.get(c.id)?.get(sem)??[]).filter(r=>r.enrolled>0&&r.class_label!=="__TOTAL_CURSO__").length,hasData:byCourse.has(c.id),hasCurrent:byCourse.get(c.id)?.has(sem)??false,hasPrevious:prev?byCourse.get(c.id)?.has(prev)??false:false}))
  .sort((a,b)=>b.now-a.now||a.c.name.localeCompare(b.c.name,'pt-BR'));
 const mods:Modality[]=['presencial','semipresencial','ead'];
 const modTotal=(m:Modality,s:string)=>own.filter(c=>modalityOf(c)===m).reduce((t,c)=>t+value(c.id,s),0);
 const total=mods.reduce((t,m)=>t+modTotal(m,sem),0);
 const presencial=total?modTotal('presencial',sem)/total*100:0;
 const semipresencial=presencial+(total?modTotal('semipresencial',sem)/total*100:0);
 const active=own.filter(c=>value(c.id,sem)>0).length;
 return <section className="academic-data" aria-labelledby={embedded?undefined:"inst-title"}>
  {!embedded&&<><p><button className="corp-login-text-button" onClick={onBack}>← Todas as instituições</button></p>
  <h2 id="inst-title">{institution.name}</h2></>}
  {!semesters.length?<p>Nenhum quantitativo importado para esta instituição.</p>:<>
  <label>Semestre <select value={sem} onChange={e=>setSemester(e.target.value)}>{semesters.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
  <div className="stats-row">
   <div className="stat-card">Matriculados em {sem}<strong className="stat-value">{fmt(total)}</strong></div>
   <div className="stat-card">Cursos com matriculados<strong className="stat-value">{active} de {own.length}</strong></div>
   {mods.map(m=><div key={m} className="stat-card">{LABEL[m]}<strong className="stat-value">{fmt(modTotal(m,sem))}</strong></div>)}
  </div>
  <div className="enrollment-comparison">
   <article><h3>Distribuição por modalidade</h3>{total>0&&<div className="enrollment-donut" aria-hidden="true" style={{background:`conic-gradient(#247951 0% ${presencial}%, #3279b0 ${presencial}% ${semipresencial}%, #a77421 ${semipresencial}% 100%)`}}/>}
   <ul>{mods.map(m=><li key={m}>{LABEL[m]} · {fmt(modTotal(m,sem))}{total>0?` (${Math.round(modTotal(m,sem)/total*100)}%)`:''}</li>)}</ul></article>
   <EnrollmentChart title="Evolução das matrículas na instituição" items={semesters.slice(0,6).reverse().map(label=>({label,value:mods.reduce((n,m)=>n+modTotal(m,label),0)}))}/>
  </div>
  <h3>Série histórica por modalidade (matriculados)</h3><p className="table-hint">Compare os semestres por modalidade. Role a tabela para ver todos os períodos.</p>
  <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de dados acadêmicos; role horizontalmente para ver todas as colunas"><table><thead><tr><th scope="col">Modalidade</th>{semesters.slice().reverse().map(s=><th scope="col" key={s} className={s===sem?"current-semester":undefined}>{s}</th>)}</tr></thead>
  <tbody>{mods.map(m=><tr key={m}><td>{LABEL[m]}</td>{semesters.slice().reverse().map(s=><td key={s} className={s===sem?"current-semester":undefined}>{fmt(modTotal(m,s))}</td>)}</tr>)}</tbody></table></div>
  <h3>Cursos</h3>
  <div className="modality-filters" role="group" aria-label="Filtrar cursos por modalidade">
   {(['todas',...mods] as const).map(t=><button key={t} aria-pressed={tab===t} className={tab===t?'corp-button':'corp-login-text-button'} onClick={()=>setTab(t)}>{t==='todas'?'Todas':LABEL[t]} ({t==='todas'?own.length:own.filter(c=>modalityOf(c)===t).length})</button>)}
  </div>
  <label>Buscar curso <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome ou código"/></label>
  <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de dados acadêmicos; role horizontalmente para ver todas as colunas"><table className="course-list"><thead><tr><th scope="col">Código</th><th scope="col">Curso</th><th scope="col">Modalidade</th><th scope="col">Matriculados {sem}</th><th scope="col">{prev?`Em ${prev}`:'Semestre anterior'}</th><th scope="col">Variação</th><th scope="col">Turmas com alunos</th><th scope="col"></th></tr></thead>
  <tbody>{list.map(({c,now,before,turmas,hasCurrent,hasPrevious})=><tr key={c.id}><td>{c.code??'—'}</td><td>{c.name}</td><td>{LABEL[modalityOf(c)]}</td><td>{hasCurrent?fmt(now):"Não informado"}</td><td>{prev&&hasPrevious?fmt(before):'—'}</td><td className={prev&&hasCurrent&&hasPrevious ? now < before ? "enrollment-down" : "enrollment-up" : undefined}>{prev&&hasCurrent&&hasPrevious&&before?`${now>=before?'+':''}${Math.round((now-before)/before*100)}%`:'—'}</td><td>{hasCurrent?turmas:"—"}</td><td><div className="enrollment-preview"><button className="corp-login-text-button" aria-describedby={`enrollment-preview-${c.id}`} onClick={()=>onOpenCourse(c.id)}>Abrir</button><div className="enrollment-popover" id={`enrollment-preview-${c.id}`}><EnrollmentChart title={c.name} items={[...(prev?[{label:prev,value:hasPrevious?before:null}]:[]),{label:sem,value:hasCurrent?now:null}]}/></div></div></td></tr>)}</tbody></table></div>
  <p>Fonte: relatório estatístico de alunos do e-ORBIT, status MATRICULADO. Modalidade pelo cadastro do curso no e-ORBIT, não pelo ato regulatório no e-MEC. Quantitativos não comprovam alunos únicos, retenção ou evasão. “Não informado” indica ausência de relatório localizado para o curso e semestre; não foi substituído por zero.</p>
  </>}
 </section>;
}

export function CourseView({course,institution,enrollments,reports,onBack,onPlan}:{course:Course;institution:Institution;enrollments:Enrollment[];reports:(AcademicReport&{course_id?:string})[];onBack:()=>void;onPlan?:(draft:{course_id:string;what:string;why:string;how:string})=>void}){
 const rows=enrollments.filter(r=>r.course_id===course.id&&isEnrolledStatus(r.student_status));
 const semesters=[...new Set(rows.map(r=>r.semester))].sort(sortSem);
 const [semester,setSemester]=useState(semesters[0]??'');
 const sem=semester||semesters[0]||'';
 const selected=rows.filter(r=>r.semester===sem);
 const {sum:rowTotal,reported:reportedTotal}=courseTotals(selected);
 const own=reports.filter(r=>r.course_id===course.id);
 const metrics=own.find(r=>r.kind==='course_indicators');
 const displayRows=selected.filter(r=>r.class_label!=="__TOTAL_CURSO__");
 const series=own.find(r=>(r.kind as string)==='status_series');
 const statusRows=((series?.payload.series??[]) as StatusSeries[]).slice().sort((a,b)=>a.semester.localeCompare(b.semester));
 const periods=[...new Set(enrollments.filter(r=>isEnrolledStatus(r.student_status)).map(r=>r.semester))].sort(sortSem);
 const previous=periods[periods.indexOf(sem)+1];
 const baseline=rows.filter(r=>r.semester===previous);
 const current=courseTotals(selected).value;
 const prior=baseline.length ? courseTotals(baseline).value : null;
 const delta=prior!==null&&selected.length ? current-prior : null;
 const change=delta===null ? 'Sem base comparável' : `${delta>0?'+':''}${fmt(delta)} matrículas${prior ? ` (${(delta/prior*100).toLocaleString('pt-BR',{maximumFractionDigits:1,signDisplay:'exceptZero'})}%)` : ''}`;
 const guidance=delta===null ? 'Completar os dados dos dois semestres antes de propor expansão.' : delta<0 ? 'Cruzar as rematrículas por aluno e identificar as causas da queda. Priorizar contato com quem ainda não renovou.' : 'Conferir ocupação, demanda e capacidade docente antes de ampliar vagas ou abrir turmas.';
 const comparison=[{period:previous,value:prior,classes:baseline},{period:sem,value:selected.length?current:null,classes:selected}];
 return <section className="academic-data" aria-labelledby="course-title">
  <p><button className="corp-login-text-button" onClick={onBack}>← {institution.name}</button></p>
  <h2 id="course-title">{course.name}{course.code?` · código ${course.code}`:''}</h2>
  <p>Modalidade: {LABEL[modalityOf(course)]}</p>
  <section className="enrollment-insight">
   <header><small>ACOMPANHAMENTO DO CURSO</small><h3>Matrículas em perspectiva</h3><strong>{change}</strong></header>
   <div className="enrollment-comparison">{comparison.map(({period,value,classes},i)=><article key={i}>
    <strong>{period||'Semestre anterior'}</strong><p>{value===null?'Não informado':`${fmt(value)} matriculados`}</p>
    {value!==null&&<progress aria-label={`Matrículas em ${period}`} value={value} max={Math.max(1,current,prior??0)}/>}
    <p>{classes.some(r=>r.class_label!=="__TOTAL_CURSO__")?`${classes.filter(r=>r.enrolled>0&&r.class_label!=="__TOTAL_CURSO__").length} turmas com alunos`:'Turmas sem detalhamento'}</p>
   </article>)}</div>
   {semesters.length>0&&<EnrollmentChart title="Histórico de matrículas do curso" items={periods.slice(0,8).reverse().map(label=>{const records=rows.filter(r=>r.semester===label);return {label,value:records.length?courseTotals(records).value:null};})}/>}
   <aside><h4>{delta!==null&&delta<0?'Atenção à continuidade':'Próxima decisão'}</h4><p>{guidance}</p><p>A variação compara totais. A evasão depende do acompanhamento individual.</p>
   {onPlan&&<button className="corp-button" onClick={()=>onPlan({course_id:course.id,what:delta===null?'Completar a base de matrículas':delta<0?'Investigar queda e acompanhar rematrículas':'Avaliar potencial de expansão do curso',why:`Matrículas em ${previous??'semestre anterior'} e ${sem}: ${change}.`,how:guidance})}>Preparar ação 5W2H</button>}</aside>
  </section>
  <h3>Matrículas por turma</h3>
  {!semesters.length?<p>Nenhum relatório importado para este curso.</p>:<>
  <label>Semestre <select value={sem} onChange={e=>setSemester(e.target.value)}>{semesters.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
  {selected[0]&&<p>Fonte: relatório estatístico do e-ORBIT, status MATRICULADO. Consulta em {new Date(selected[0].source_report_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}.</p>}
  <div className="stats-row"><div className="stat-card">Total informado no relatório<strong className="stat-value">{reportedTotal??'Não informado'}</strong></div><div className="stat-card">Soma das turmas<strong className="stat-value">{rowTotal}</strong></div><div className="stat-card">Turmas / linhas na origem<strong className="stat-value">{displayRows.length}</strong></div></div>
  {reportedTotal!==null&&reportedTotal!==rowTotal&&<p role="alert">Conferência pendente: o total informado ({reportedTotal}) difere da soma das turmas ({rowTotal}). Os valores da origem foram preservados.</p>}
  <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de dados acadêmicos; role horizontalmente para ver todas as colunas"><table><thead><tr><th scope="col">Série / turma na origem</th><th scope="col">Matrículas</th><th scope="col">Vagas</th><th scope="col">Disponíveis</th></tr></thead><tbody>{displayRows.slice().sort((a,b)=>a.class_label.localeCompare(b.class_label,'pt-BR',{numeric:true})).map(r=><tr key={r.id}><td>{r.class_label}</td><td>{r.enrolled}</td><td>{r.capacity??"Não informado"}</td><td>{r.available??"Não informado"}</td></tr>)}</tbody></table></div>
  {course.code==='027'&&sem==='2026/02'&&<p>Conferir na secretaria: DIR-5A2026/02 aparece como 6ª série no relatório.</p>}
  <p>Quantitativos por turma não comprovam alunos únicos, retenção, captação efetiva ou participação na AV1. Esses indicadores dependem do cruzamento individual.</p>
  </>}
  {metrics&&<CourseIndicators payload={metrics.payload as CourseIndicatorPayload} semester={sem}/> }
  {statusRows.length>0&&<><h3>Situação dos registros por semestre</h3><p className="table-hint">Role a tabela para consultar todos os status. Para comparar anos, use o total de registros.</p><p>{series?.source_label}</p>
  <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de dados acadêmicos; role horizontalmente para ver todas as colunas"><table className="status-series"><thead><tr><th scope="col">Semestre</th><th scope="col">Vagas</th>{STATUS.map(([k,l])=><th scope="col" key={k}>{l}</th>)}<th scope="col">Total de registros</th></tr></thead>
  <tbody>{statusRows.map(s=><tr key={s.semester}><td>{s.semester}</td><td>{s.capacity??'—'}</td>{STATUS.map(([k])=><td key={k}>{s.counts[k]??0}</td>)}<td>{STATUS.reduce((t,[k])=>t+(s.counts[k]??0),0)}</td></tr>)}</tbody></table></div>
  <p>O status é o registrado hoje para a matrícula daquele semestre. Semestres antigos tendem a aparecer como concluídos ou trancados porque o registro foi fechado depois; para comparar anos, use o total de registros.</p></>}
  {own.some(r=>['cohorts','enrollment_continuity'].includes(r.kind))&&<AcademicReports reports={own.filter(r=>['cohorts','enrollment_continuity'].includes(r.kind))}/>}
 </section>;
}
