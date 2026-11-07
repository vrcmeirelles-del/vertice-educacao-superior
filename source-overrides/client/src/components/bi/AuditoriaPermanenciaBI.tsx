import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import "./auditoria-permanencia-bi.css";
import ResultadoInstitucionalOfertas from "./ResultadoInstitucionalOfertas";
import PrimeiraMatriculaTodosCursos from "./PrimeiraMatriculaTodosCursos";

type Report={id:string;kind:string;course_id:string|null;payload:Record<string,any>;source_report_at:string|null};
type Course={id:string;name:string;code:string|null};
type Cohort={cohort:string;entrants?:number;no_next?:number;positive_av1?:number;no_next_no_positive_av1?:number};
type Reprobation={semester:string;RF?:number;RN?:number;RA?:number;failures?:number;discipline_enrollments?:number};
const fmt=(n:number|null|undefined)=>n==null?"—":new Intl.NumberFormat("pt-BR").format(n);
const norm=(s:unknown)=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const int=(n:unknown)=>Number.isFinite(Number(n))?Number(n):0;
const SOURCE_KINDS=["cohorts","quantitativo_alunos_historico","reprovacoes_professor","reprovacoes_disciplina","reprovacoes_semestre","course_indicators"] as const;

async function loadReports(institutionId:string):Promise<Report[]> {
  const rows:Report[]=[];
  for(const kind of SOURCE_KINDS){
    for(let page=0;;page++){
      const {data,error}=await supabase.from("vertice_academic_reports")
        .select("id,kind,course_id,payload,source_report_at")
        .eq("institution_id",institutionId).eq("kind",kind)
        .order("id").range(page*1000,page*1000+999);
      if(error)throw error;
      rows.push(...(data??[]) as Report[]);
      if(!data||data.length<1000)break;
    }
  }
  return rows;
}

export default function AuditoriaPermanenciaBI({institutionId,institutionName}:{
  institutionId:string; institutionName:string;
}){
  const [reports,setReports]=useState<Report[]>([]);
  const [courses,setCourses]=useState<Course[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [courseId,setCourseId]=useState("");
  const [semester,setSemester]=useState("");
  const [teacherSearch,setTeacherSearch]=useState("");
  const [subjectSearch,setSubjectSearch]=useState("");
  const [selectedTeacher,setSelectedTeacher]=useState<string|null>(null);
  const [selectedSubject,setSelectedSubject]=useState<string|null>(null);
  const [tab,setTab]=useState<"ofertas"|"coortes"|"cursos"|"professores"|"disciplinas">("ofertas");
  const [refresh,setRefresh]=useState(0);

  useEffect(()=>{
    let alive=true;
    setLoading(true);setError("");
    void Promise.all([
      loadReports(institutionId),
      supabase.from("vertice_courses").select("id,name,code")
        .eq("institution_id",institutionId).order("name").then(({data,error:e})=>{
          if(e)throw e;return (data??[]) as Course[];
        })
    ]).then(([r,c])=>{if(alive){setReports(r);setCourses(c);}})
      .catch(()=>{if(alive)setError("Não foi possível consultar os relatórios acadêmicos. Verifique o acesso institucional.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[institutionId,refresh]);

  const rawReprobation=useMemo(()=>reports.filter(r=>r.kind==="reprovacoes_semestre").map(r=>({
    semester:String(r.payload.s??""),
    failures:int(r.payload.reprovacoes),
    enrollmentEvents:int(r.payload.matriculas),
    reportedRate:String(r.payload.pct_reprovacao??"—")
  })).sort((a,b)=>b.semester.localeCompare(a.semester)),[reports]);
  const cohortReports=useMemo(()=>reports.filter(x=>x.kind==="cohorts"),[reports]);
  const cohorts=useMemo(()=>cohortReports.flatMap(r=>(Array.isArray(r.payload.cohorts)?r.payload.cohorts:[])
     .map((c:Cohort)=>({...c,course_id:r.course_id,reference:r.source_report_at,method:r.payload.method}))),[cohortReports]);
  const professors=useMemo(()=>reports.filter(r=>r.kind==="reprovacoes_professor")
    .map(r=>({...r.payload,id:r.id,rank:int(r.payload.r),total:int(r.payload.t),name:String(r.payload.n??"")}))
    .sort((a,b)=>a.rank-b.rank),[reports]);
  const subjects=useMemo(()=>reports.filter(r=>r.kind==="reprovacoes_disciplina")
    .map(r=>({...r.payload,id:r.id,rank:int(r.payload.r),total:int(r.payload.t),name:String(r.payload.d??"")}))
    .sort((a,b)=>a.rank-b.rank),[reports]);
  const courseIndicators=useMemo(()=>{
    const map=new Map<string,Report>();
    for(const r of reports){
      if(r.kind!=="course_indicators"||!r.course_id||!Array.isArray(r.payload.reprobation_series))continue;
      const prev=map.get(r.course_id);
      if(!prev||(r.source_report_at??"")>(prev.source_report_at??""))map.set(r.course_id,r);
    }
    return map;
  },[reports]);
  const listedCourses=courses.filter(c=>courseIndicators.has(c.id)||cohorts.some(x=>x.course_id===c.id))
    .sort((a,b)=>{
      const aC=cohorts.some(x=>x.course_id===a.id)?1:0,bC=cohorts.some(x=>x.course_id===b.id)?1:0;
      if(aC!==bC)return bC-aC;
      return a.name.localeCompare(b.name)||((courseIndicators.get(b.id)?.payload.reprobation_series??[]).length-
        (courseIndicators.get(a.id)?.payload.reprobation_series??[]).length);
    });
  const currentId=listedCourses.some(c=>c.id===courseId)?courseId:(listedCourses[0]?.id??"");
  const currentCourse=courses.find(c=>c.id===currentId);
  const currentReport=courseIndicators.get(currentId);
  const riskCount=currentReport?.payload?.risk_roster?.listed;
  const sources=Array.isArray(currentReport?.payload?.sources)?currentReport!.payload.sources:[];
  const rosterSource=sources.find((s:any)=>s.name==="Lista_Final_Alunos_Risco_UNITOP.xlsx"
    && /^https:\/\/vrcmeirelles-my[.]sharepoint[.]com\//.test(String(s.source_url??"")));
  const duplicateCodes=listedCourses.filter(c=>c.code&&listedCourses.filter(o=>o.code===c.code).length>1);

  const series=(courseIndicators.get(currentId)?.payload.reprobation_series??[]) as Reprobation[];
  const semesters=series.map(s=>s.semester);
  const chosenSemester=semester&&semesters.includes(semester)?semester:"";
  const visibleSeries=chosenSemester?series.filter(s=>s.semester===chosenSemester):series;
  const totalRF=visibleSeries.reduce((sum,s)=>sum+int(s.RF),0);
  const totalRN=visibleSeries.reduce((sum,s)=>sum+int(s.RN),0);
  const totalRA=visibleSeries.reduce((sum,s)=>sum+int(s.RA),0);
  const totalDiaries=visibleSeries.reduce((sum,s)=>sum+int(s.discipline_enrollments),0);
  const selectedCohorts=cohorts.filter(c=>c.course_id===currentId);
  const rankedProfessors=professors.filter(p=>norm(p.name).includes(norm(teacherSearch))).slice(0,80);
  const rankedSubjects=subjects.filter(p=>norm(p.name).includes(norm(subjectSearch))).slice(0,80);
  const selectedProfessor=professors.find(p=>p.id===selectedTeacher);
  const selectedDiscipline=subjects.find(p=>p.id===selectedSubject);
  return <section className="vxa" aria-labelledby="vxa-title">
    <header className="vxa-head">
      <div><small>VÉRTICE · AUDITORIA ACADÊMICA</small><h2 id="vxa-title">BI institucional · Reprovações e permanência</h2>
        <p>{institutionName} · relatório gerencial com proveniência e limites explícitos das fontes</p></div>
      <button type="button" onClick={()=>setRefresh(x=>x+1)} disabled={loading}>Atualizar leitura</button>
    </header>
    <details className="vxa-integrity"><summary><strong>Integridade e rastreabilidade:</strong> nenhum dado original é excluído. <span>Ver regra completa</span></summary><p>Dados de alunos jamais são apagados desta análise. A exclusão de matrículas da taxa gerencial ajustada só poderá ocorrer após verificação de primeiro vínculo, gratuidade e AV1/AV2 explicitamente não realizadas, com decisão auditada. O indicador acadêmico oficial permanece inalterado.</p></details>
    {error&&<p role="alert" className="vxa-error">{error}</p>}
    {loading?<p role="status">Consultando dados disponíveis…</p>:<>
      <nav className="vxa-tabs" aria-label="Análises de permanência">
        {([["ofertas","Todos os cursos · ofertas"],["coortes","Primeira matrícula · Todos os cursos"],["cursos","Séries consolidadas"],["disciplinas","Ranking geral disciplinas"],["professores","Ranking geral professores"]] as const).map(([id,label])=>
          <button type="button" key={id} className={tab===id?"vxa-selected":""} onClick={()=>setTab(id)} aria-current={tab===id?"page":undefined}>{label}</button>)}
      </nav>
      {tab==="ofertas"&&<ResultadoInstitucionalOfertas institutionId={institutionId}/>}
      {tab==="coortes"&&<PrimeiraMatriculaTodosCursos courses={courses} reports={reports}/>}
      {tab==="cursos"&&<div className="vxa-card">
        <h3>Reprovações por curso e semestre — recorte analítico</h3>
        <div className="vxa-filters">
          <label>Curso <select value={currentId} onChange={e=>{setCourseId(e.target.value);setSemester("");}}>
            {listedCourses.map(c=><option key={c.id} value={c.id}>{c.code?c.code+" · ":""}{c.name}{listedCourses.filter(x=>x.code===c.code&&c.code).length>1?" · "+String((courseIndicators.get(c.id)?.payload.reprobation_series??[]).length)+" períodos na fonte":""}</option>)}
          </select></label>
          <label>Semestre <select value={chosenSemester} onChange={e=>setSemester(e.target.value)}>
            <option value="">Todos os disponíveis</option>{semesters.map(s=><option key={s} value={s}>{s}</option>)}
          </select></label>
        </div>
        {currentCourse?<p><strong>{currentCourse.name}</strong> · código {currentCourse.code??"não informado"} · total de vínculos em disciplinas, não alunos únicos</p>:<p>Não há relatório por curso identificado.</p>}
        {duplicateCodes.some(c=>c.code===currentCourse?.code)&&<p className="vxa-alert"><strong>Atenção:</strong> existem cadastros distintos com o mesmo código de curso. Seus recortes não foram somados automaticamente; selecione o histórico adequado antes de interpretar o indicador.</p>}
        {riskCount!=null&&<div className="vxa-roster"><strong>{fmt(int(riskCount))} registros na lista de acompanhamento por reprovação</strong>
          <p>Fonte nominal histórica por curso, sem semestre da seleção, disciplina da reprovação nem informação de segunda chance. Não corresponde necessariamente aos reprovados do recorte acima.</p>
          {rosterSource&&<a href={rosterSource.source_url} target="_blank" rel="noopener noreferrer">Consultar lista nominal original no OneDrive</a>}
        </div>}
        <div className="vxa-submetrics">
          <article><small>Reprovação por falta (RF)</small><strong>{fmt(totalRF)}</strong></article>
          <article><small>Reprovação por nota (RN)</small><strong>{fmt(totalRN)}</strong></article>
          <article><small>Categoria RA na fonte</small><strong>{fmt(totalRA)}</strong></article>
          <article><small>Vínculos em disciplinas</small><strong>{fmt(totalDiaries)}</strong></article>
        </div>
        {visibleSeries.length>0?<div className="vxa-scroll"><table><thead><tr><th>Semestre</th><th>RF</th><th>RN</th><th>RA</th><th>Reprovações</th><th>Vínculos disciplina</th></tr></thead>
          <tbody>{visibleSeries.map((s,i)=><tr key={i}><td>{s.semester}</td><td>{fmt(s.RF)}</td><td>{fmt(s.RN)}</td><td>{fmt(s.RA)}</td><td>{fmt(s.failures)}</td><td>{fmt(s.discipline_enrollments)}</td></tr>)}</tbody></table></div>:<p>Série de reprovações não disponibilizada para este curso.</p>}
        {selectedCohorts.length>0&&<p className="vxa-source">Há {fmt(selectedCohorts.length)} coortes históricas de primeiro vínculo disponíveis para este curso.</p>}
        <p className="vxa-source">Fonte: vertice_academic_reports, tipo course_indicators (série de reprovações). RF/RN/RA seguem a codificação original. Não é possível descontar matrículas sem participação ou medir aprovação posterior sem o histórico individual.</p>
        <h3>Impacto nos indicadores — taxas brutas e ajustes pendentes</h3>
        <p>Estas taxas históricas abrangem vínculos em disciplinas da instituição e <strong>não são taxas de alunos únicos</strong>. O denominador ajustado só será calculado quando for possível verificar individualmente as condições de primeiro vínculo, gratuidade e ausência real nas duas avaliações.</p>
        <div className="vxa-scroll"><table><thead><tr><th>Semestre</th><th>Reprovações brutas</th><th>Vínculos em disciplinas</th><th>Taxa bruta</th><th>Taxa gerencial ajustada</th></tr></thead>
        <tbody>{rawReprobation.map((r,i)=><tr key={i}><td>{r.semester}</td><td>{fmt(r.failures)}</td><td>{fmt(r.enrollmentEvents)}</td><td>{r.reportedRate==="—"?"—":r.reportedRate+"%"}</td><td>Sem base individual verificada</td></tr>)}</tbody></table></div>
        <p className="vxa-source">Fonte: reprovacoes_semestre, relatório histórico institucional. Não substituir indicadores oficiais por taxas ajustadas sem regras aprovadas, validação e rastreabilidade das exclusões gerenciais.</p>
      </div>}
      {tab==="disciplinas"&&<div className="vxa-card">
        <h3>Disciplinas com reprovações — ranking institucional</h3>
        <p>Selecione uma disciplina, por exemplo, Anatomia. O ranking existente é institucional, sem chave confiável para distribuir a contagem entre curso, docente, semestre ou estudante.</p>
        <label>Pesquisar disciplina <input value={subjectSearch} onChange={e=>setSubjectSearch(e.target.value)} placeholder="Ex.: Anatomia" /></label>
        <div className="vxa-layout"><div className="vxa-results">{rankedSubjects.length?rankedSubjects.map(s=><button type="button" key={s.id} onClick={()=>setSelectedSubject(s.id)} aria-pressed={s.id===selectedSubject} className={s.id===selectedSubject?"vxa-active":""}>
          <span>{s.rank}º · {s.name}</span><strong>{fmt(s.total)}</strong></button>):<p>Nenhuma disciplina localizada neste filtro.</p>}</div>
        <aside className="vxa-detail"><h4>{selectedDiscipline?.name??"Selecione uma disciplina"}</h4>
          {selectedDiscipline?<><p><b>{fmt(selectedDiscipline.total)}</b> reprovações registradas no ranking histórico.</p><p>Lista nominal de reprovados: <strong>indisponível</strong>.</p>
            <p>AV1, AV2 e aprovação na segunda chance: <strong>não verificados na fonte</strong>.</p></>:<p>Selecione a disciplina para visualizar o dado disponível e as informações a complementar.</p>}
        </aside></div>
        <p className="vxa-source">Fonte: vertice_academic_reports, tipo reprovacoes_disciplina. Ranking agregado; não identifica alunos únicos nem oferece desagregação temporal por disciplina.</p>
      </div>}
      {tab==="professores"&&<div className="vxa-card">
        <h3>Professores e reprovações — ranking institucional</h3>
        <p>Reprovações associadas aos docentes na fonte histórica; não são medidas isoladas de qualidade docente. Compare com turma, perfil de ingresso e participação antes de qualquer conclusão.</p>
        <label>Pesquisar professor <input value={teacherSearch} onChange={e=>setTeacherSearch(e.target.value)} placeholder="Nome do docente" /></label>
        <div className="vxa-layout"><div className="vxa-results">{rankedProfessors.map(p=><button type="button" key={p.id} aria-pressed={p.id===selectedTeacher} onClick={()=>setSelectedTeacher(p.id)} className={p.id===selectedTeacher?"vxa-active":""}>
          <span>{p.rank}º · {p.name}</span><strong>{fmt(p.total)}</strong></button>)}</div>
          <aside className="vxa-detail"><h4>{selectedProfessor?.name??"Selecione um docente"}</h4>
            {selectedProfessor?<><p><b>{fmt(selectedProfessor.total)}</b> reprovações no recorte publicado.</p>
              <dl><dt>Por falta (RF)</dt><dd>{fmt(selectedProfessor.rf)}</dd>
              <dt>Por nota (RN)</dt><dd>{fmt(selectedProfessor.rn)}</dd>
              <dt>Categoria RA</dt><dd>{fmt(selectedProfessor.ra)}</dd>
              <dt>Disciplinas distintas</dt><dd>{fmt(selectedProfessor.di)}</dd>
              <dt>Ofertas informadas</dt><dd>{fmt(selectedProfessor.of)}</dd>
              <dt>Quantidade de semestres</dt><dd>{fmt(selectedProfessor.se)}</dd></dl>
              <p>Quais disciplinas, períodos e estudantes geraram essas reprovações: <strong>sem ligação individual verificada</strong>.</p>
            </>:<p>Selecione um professor para explorar o ranking e a decomposição que estiver disponível na fonte.</p>}
          </aside></div>
        <p className="vxa-source">Fonte: vertice_academic_reports, tipo reprovacoes_professor. Os campos ausentes são exibidos como indisponíveis. Um docente não deve ser avaliado pelo número bruto de reprovações.</p>
      </div>}
      <div className="vxa-pending">
        <h3>Dados que ainda precisamos para completar o diagnóstico</h3>
        <ol>
          <li>Valor e benefício da primeira matrícula, com indicação verificável de gratuidade.</li>
          <li>Identificador estável do aluno, primeiro vínculo, turma, curso e semestre.</li>
          <li>Resultado ou realização de AV1 e AV2 com distinção entre não realizada, não lançada e nota zero.</li>
          <li>Registros individuais de reprovação por falta e nota, por disciplina e professor.</li>
          <li>Segunda chance, recuperação e aprovação posterior, vinculadas à mesma matrícula e componente.</li>
          <li>Data e situação administrativa do vínculo e motivo de eventual cancelamento ou abandono.</li>
        </ol>
        <p><strong>Regra proposta:</strong> separar dos indicadores gerenciais ajustados apenas os primeiros vínculos que tenham gratuidade e não realização de AV1/AV2 confirmadas por registros completos e auditados. Manter os registros acadêmicos e os indicadores oficiais preservados.</p>
      </div>
    </>}
  </section>;
}
