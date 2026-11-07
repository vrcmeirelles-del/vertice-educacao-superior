import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import "./resultado-institucional-ofertas.css";

type Offering={
 id:number; source_row:number; semester:string; course_code:string; discipline:string;
 class_label:string; academic_period:string; teachers:string; rf:number; rn:number; ra:number;
 source_failures:number; discipline_enrollments:number; passed_direct:number; passed_final:number;
 avg_final:number|null; other_status:string;
};
type Course={code:string|null;name:string};
type Measures={label:string;rf:number;rn:number;ra:number;fails:number;enrollments:number;direct:number;final:number;rows:number};
const integer=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
const percent=(numerator:number,denominator:number)=>denominator>0?(100*numerator/denominator).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%":"—";
const searchKey=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function summarize(items:Offering[]):Measures{
 return items.reduce<Measures>((a,r)=>({
   label:"",rf:a.rf+r.rf,rn:a.rn+r.rn,ra:a.ra+r.ra,
   fails:a.fails+r.source_failures,enrollments:a.enrollments+r.discipline_enrollments,
   direct:a.direct+r.passed_direct,final:a.final+r.passed_final,rows:a.rows+1
 }),{label:"",rf:0,rn:0,ra:0,fails:0,enrollments:0,direct:0,final:0,rows:0});
}
function summarizeBy(items:Offering[],field:(r:Offering)=>string){
 const map=new Map<string,Measures>();
 for(const r of items){
   const key=field(r),a=map.get(key)??{label:key,rf:0,rn:0,ra:0,fails:0,enrollments:0,direct:0,final:0,rows:0};
   a.rf+=r.rf;a.rn+=r.rn;a.ra+=r.ra;a.fails+=r.source_failures;
   a.enrollments+=r.discipline_enrollments;a.direct+=r.passed_direct;a.final+=r.passed_final;a.rows++;
   map.set(key,a);
 }
 return [...map.values()].sort((a,b)=>b.fails-a.fails||a.label.localeCompare(b.label,"pt-BR"));
}
const COLS="id,source_row,semester,course_code,discipline,class_label,academic_period,teachers,rf,rn,ra,source_failures,discipline_enrollments,passed_direct,passed_final,avg_final,other_status";
export default function ResultadoInstitucionalOfertas({institutionId}:{institutionId:string}){
 const [offerings,setOfferings]=useState<Offering[]>([]);
 const [courses,setCourses]=useState<Course[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [version,setVersion]=useState(0);
 const [perspective,setPerspective]=useState<"curso"|"docente">("curso");
 const [semester,setSemester]=useState("");
 const [course,setCourse]=useState("");
 const [discipline,setDiscipline]=useState("");
 const [teacher,setTeacher]=useState("");
 const [search,setSearch]=useState("");
 useEffect(()=>{
   let current=true;setLoading(true);setError("");
   const load=async()=>{
     const all:Offering[]=[];
     for(let start=0;;start+=1000){
       const {data,error:failure}=await supabase.from("vertice_offering_outcomes").select(COLS)
         .eq("institution_id",institutionId).order("source_row").range(start,start+999);
       if(failure)throw failure;
       all.push(...(data??[]) as Offering[]);
       if(!data||data.length<1000)break;
     }
     const {data:courseRows,error:courseFailure}=await supabase.from("vertice_courses")
       .select("code,name").eq("institution_id",institutionId).not("code","is",null).limit(250);
     if(courseFailure)throw courseFailure;
     if(current){setOfferings(all);setCourses((courseRows??[]) as Course[]);}
   };
   void load().catch(()=>{if(current)setError("Não foi possível ler os registros de ofertas com o perfil de alta gestão. Confira o acesso e o MFA.");})
     .finally(()=>{if(current)setLoading(false);});
   return()=>{current=false};
 },[institutionId,version]);
 const codes=useMemo(()=>new Map(courses.filter(x=>x.code).map(x=>[String(x.code).padStart(3,"0"),x.name])),[courses]);
 const courseName=(code:string)=>codes.get(code)??"Curso "+code;
 const semesters=useMemo(()=>[...new Set(offerings.map(r=>r.semester))].sort().reverse(),[offerings]);
 const semesterRows=useMemo(()=>offerings.filter(r=>!semester||r.semester===semester),[offerings,semester]);
 const total=summarize(semesterRows);
 const coursesSummary=useMemo(()=>summarizeBy(semesterRows,r=>r.course_code),[semesterRows]);
 const selectedCourseRows=useMemo(()=>semesterRows.filter(r=>!course||r.course_code===course),[semesterRows,course]);
 const courseSubjects=useMemo(()=>summarizeBy(selectedCourseRows,r=>r.discipline),[selectedCourseRows]);
 const selectedDisciplineRows=useMemo(()=>selectedCourseRows.filter(r=>!discipline||r.discipline===discipline),[selectedCourseRows,discipline]);
 const courseTeachers=useMemo(()=>summarizeBy(selectedDisciplineRows,r=>r.teachers),[selectedDisciplineRows]);
 const teachersAll=useMemo(()=>summarizeBy(semesterRows,r=>r.teachers),[semesterRows]);
 const selectedTeacherRows=useMemo(()=>semesterRows.filter(r=>r.teachers===teacher),[semesterRows,teacher]);
 const teacherCourses=useMemo(()=>summarizeBy(selectedTeacherRows,r=>r.course_code),[selectedTeacherRows]);
 const teacherDisciplines=useMemo(()=>summarizeBy(selectedTeacherRows.filter(r=>!course||r.course_code===course),r=>r.discipline),[selectedTeacherRows,course]);
 const drillRows=useMemo(()=>{
   if(perspective==="docente")return selectedTeacherRows.filter(r=>(!course||r.course_code===course)&&(!discipline||r.discipline===discipline));
   return selectedDisciplineRows.filter(r=>!teacher||r.teachers===teacher);
 },[perspective,selectedTeacherRows,selectedDisciplineRows,course,discipline,teacher]);
 const filtered=(items:Measures[])=>items.filter(x=>searchKey(x.label).includes(searchKey(search.trim())));
 const reset=()=>{setCourse("");setDiscipline("");setTeacher("");setSearch("");};
 const chooseCourse=(s:string)=>{setCourse(s);setDiscipline("");setTeacher("");setSearch("");};
 const chooseDiscipline=(s:string)=>{setDiscipline(s);setTeacher("");setSearch("");};
 const maxBar=Math.max(1,...coursesSummary.map(c=>c.fails));
 return <section className="vxo" aria-label="Auditoria institucional por curso, disciplina e professor">
  <header className="vxo-header">
   <div><small>REITORIA · DADOS ACADÊMICOS COMPROVADOS</small>
    <h3>Reprovação por curso, disciplina, docente e período</h3>
    <p>Base institucional de ofertas (2022/1–2026/2). Todos os cursos disponíveis no arquivo, sem limitar a análise ao Direito.</p></div>
   <button type="button" onClick={()=>setVersion(x=>x+1)} disabled={loading}>Atualizar dados</button>
  </header>
  {error&&<p role="alert" className="vxo-error">{error}</p>}
  {loading?<p role="status">Consultando ofertas no Supabase da Vértice…</p>:offerings.length===0?
    <p role="status">Ainda não há ofertas homologadas nesta instituição.</p>:<>
   <div className="vxo-kpis">
    <article><small>Ofertas no recorte</small><strong>{integer(total.rows)}</strong></article>
    <article><small>Vínculos em disciplinas</small><strong>{integer(total.enrollments)}</strong></article>
    <article><small>Reprovações registradas</small><strong>{integer(total.fails)}</strong><span>{percent(total.fails,total.enrollments)} das matrículas em disciplinas</span></article>
    <article><small>Aprovados após avaliação final</small><strong>{integer(total.final)}</strong><span>Não confundir com segunda chamada ou repetência posterior</span></article>
   </div>
   <div className="vxo-types" aria-label="Tipos de reprovação">
     <div><span>RF · Falta</span><strong>{integer(total.rf)}</strong></div>
     <div><span>RN · Nota</span><strong>{integer(total.rn)}</strong></div>
     <div><span>RA · Após avaliação final</span><strong>{integer(total.ra)}</strong></div>
   </div>
   <div className="vxo-tools">
    <label>Semestre
     <select value={semester} onChange={e=>{setSemester(e.target.value);reset();}}>
       <option value="">Todo o histórico</option>{semesters.map(s=><option key={s} value={s}>{s}</option>)}
     </select>
    </label>
    <label>Perspectiva
     <select value={perspective} onChange={e=>{setPerspective(e.target.value as "curso"|"docente");reset();}}>
       <option value="curso">Curso → disciplina → professor</option>
       <option value="docente">Professor → curso → disciplina</option>
     </select>
    </label>
    <label>Localizar na lista
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={perspective==="curso"?"Buscar curso ou disciplina":"Buscar docente"} />
    </label>
   </div>
   <p className="vxo-context">{course?<><button type="button" onClick={()=>{setCourse("");setDiscipline("");setTeacher("");}}>Todos os cursos</button> / <strong>{courseName(course)} ({course})</strong></>:<strong>Todos os cursos</strong>}
      {discipline&&<> / <button type="button" onClick={()=>{setDiscipline("");setTeacher("");}}>{discipline}</button></>}
      {teacher&&<> / <button type="button" onClick={()=>setTeacher("")}>{teacher}</button></>}</p>
   {perspective==="curso"?<>
    {!course&&<div className="vxo-card">
     <h4>Escolha o curso — {integer(coursesSummary.length)} códigos no recorte</h4>
     <div className="vxo-scroll"><table><thead><tr><th>Curso</th><th>RF</th><th>RN</th><th>RA</th><th>Reprovações</th><th>Vínculos disciplina</th><th>Incidência</th></tr></thead>
     <tbody>{coursesSummary.filter(x=>searchKey(courseName(x.label)+" "+x.label).includes(searchKey(search.trim()))).map(x=>
      <tr key={x.label}><td><button type="button" className="vxo-link" onClick={()=>chooseCourse(x.label)}>{x.label} · {courseName(x.label)}</button><div className="vxo-bar"><span style={{width:(100*x.fails/maxBar)+"%"}}/></div></td>
      <td>{integer(x.rf)}</td><td>{integer(x.rn)}</td><td>{integer(x.ra)}</td><td><b>{integer(x.fails)}</b></td><td>{integer(x.enrollments)}</td><td>{percent(x.fails,x.enrollments)}</td></tr>)}</tbody></table></div>
    </div>}
    {course&&!discipline&&<div className="vxo-card"><h4>Disciplinas de {courseName(course)}</h4>
      <div className="vxo-scroll"><table><thead><tr><th>Disciplina</th><th>RF</th><th>RN</th><th>RA</th><th>Reprovações</th><th>Vínculos</th><th>Incidência</th></tr></thead>
      <tbody>{filtered(courseSubjects).map(x=><tr key={x.label}>
        <td><button type="button" className="vxo-link" onClick={()=>chooseDiscipline(x.label)}>{x.label}</button></td>
        <td>{integer(x.rf)}</td><td>{integer(x.rn)}</td><td>{integer(x.ra)}</td><td><b>{integer(x.fails)}</b></td><td>{integer(x.enrollments)}</td><td>{percent(x.fails,x.enrollments)}</td></tr>)}</tbody></table></div></div>}
    {course&&discipline&&!teacher&&<div className="vxo-card"><h4>Professores e ofertas — {discipline}</h4>
     <div className="vxo-scroll"><table><thead><tr><th>Professor(es)</th><th>RF</th><th>RN</th><th>RA</th><th>Reprovações</th><th>Turmas/ofertas</th></tr></thead>
     <tbody>{filtered(courseTeachers).map(x=><tr key={x.label}>
       <td><button className="vxo-link" type="button" onClick={()=>{setTeacher(x.label);setSearch("");}}>{x.label}</button></td>
       <td>{integer(x.rf)}</td><td>{integer(x.rn)}</td><td>{integer(x.ra)}</td><td>{integer(x.fails)}</td><td>{integer(x.rows)}</td></tr>)}</tbody></table></div></div>}
    {course&&discipline&&teacher&&<OfferingsTable rows={drillRows} courseName={courseName}/>}
   </>:<>
     {!teacher&&<div className="vxo-card"><h4>Ranking de professores — {integer(teachersAll.length)} identificações</h4>
       <div className="vxo-scroll"><table><thead><tr><th>Professor(es)</th><th>RF</th><th>RN</th><th>RA</th><th>Reprovações</th><th>Vínculos disciplina</th><th>Incidência</th></tr></thead>
       <tbody>{filtered(teachersAll).map(x=><tr key={x.label}><td><button className="vxo-link" type="button" onClick={()=>{setTeacher(x.label);setSearch("");}}>{x.label}</button></td>
         <td>{integer(x.rf)}</td><td>{integer(x.rn)}</td><td>{integer(x.ra)}</td><td><b>{integer(x.fails)}</b></td><td>{integer(x.enrollments)}</td><td>{percent(x.fails,x.enrollments)}</td></tr>)}</tbody></table></div>
     </div>}
     {teacher&&!course&&<div className="vxo-card"><h4>Em quais cursos {teacher} lecionou</h4>
       <div className="vxo-scroll"><table><thead><tr><th>Curso</th><th>RF</th><th>RN</th><th>RA</th><th>Reprovações</th><th>Ofertas</th></tr></thead><tbody>{teacherCourses.map(x=>
        <tr key={x.label}><td><button className="vxo-link" type="button" onClick={()=>{setCourse(x.label);setDiscipline("");}}>{x.label} · {courseName(x.label)}</button></td>
          <td>{integer(x.rf)}</td><td>{integer(x.rn)}</td><td>{integer(x.ra)}</td><td>{integer(x.fails)}</td><td>{integer(x.rows)}</td></tr>)}</tbody></table></div>
     </div>}
     {teacher&&course&&!discipline&&<div className="vxo-card"><h4>Disciplinas do professor em {courseName(course)}</h4>
       <div className="vxo-scroll"><table><thead><tr><th>Disciplina</th><th>RF</th><th>RN</th><th>RA</th><th>Reprovações</th><th>Ofertas</th></tr></thead><tbody>{teacherDisciplines.map(x=>
       <tr key={x.label}><td><button className="vxo-link" type="button" onClick={()=>setDiscipline(x.label)}>{x.label}</button></td>
         <td>{integer(x.rf)}</td><td>{integer(x.rn)}</td><td>{integer(x.ra)}</td><td>{integer(x.fails)}</td><td>{integer(x.rows)}</td></tr>)}</tbody></table></div>
     </div>}
     {teacher&&course&&discipline&&<OfferingsTable rows={drillRows} courseName={courseName}/>}
   </>}
   <div className="vxo-notice">
     <b>Leitura responsável:</b> as contagens RF/RN/RA pertencem a ofertas de disciplinas, não identificam estudantes únicos nem são uma avaliação isolada do desempenho do professor. Quando uma oferta registra mais de um docente, a fonte apresenta um grupo: não atribuímos todas as reprovações individualmente a cada membro. <b>Aprovados após final</b> não demonstra aprovação em uma segunda chance posterior. Para identificar nominalmente os alunos reprovados em determinada disciplina, precisamos do relatório individual daquela oferta.
   </div>
   <p className="vxo-source">Fonte: UNITOP_Gestao_Completa_Reitor (1).xlsx, OneDrive/CLIENTES/UNITOP/Migração, atualização informada em 04/11/2026. {integer(offerings.length)} ofertas importadas para a Vértice; intervalo 2022/1–2026/2. Indicadores originais não foram alterados.</p>
  </>}
 </section>;
}
function OfferingsTable({rows,courseName}:{rows:Offering[];courseName:(code:string)=>string}){
 const sum=summarize(rows);
 return <div className="vxo-card">
   <h4>Detalhamento por semestre e turma · {integer(rows.length)} ofertas</h4>
   <p className="vxo-summary">{integer(sum.fails)} reprovações ({integer(sum.rf)} falta · {integer(sum.rn)} nota · {integer(sum.ra)} após final) em {integer(sum.enrollments)} vínculos em disciplinas.</p>
   <div className="vxo-scroll"><table><thead><tr><th>Semestre</th><th>Curso</th><th>Disciplina</th><th>Turma</th><th>Período</th><th>Docentes</th><th>RF</th><th>RN</th><th>RA</th><th>Total</th><th>Após final aprovados</th><th>Vínculos</th></tr></thead>
     <tbody>{rows.map(r=><tr key={r.id}><td>{r.semester}</td><td>{courseName(r.course_code)}</td>
      <td>{r.discipline}</td><td>{r.class_label||"—"}</td><td>{r.academic_period||"—"}</td><td>{r.teachers}</td>
      <td>{integer(r.rf)}</td><td>{integer(r.rn)}</td><td>{integer(r.ra)}</td><td><b>{integer(r.source_failures)}</b></td>
      <td>{integer(r.passed_final)}</td><td>{integer(r.discipline_enrollments)}</td></tr>)}</tbody>
   </table></div>
 </div>;
}
