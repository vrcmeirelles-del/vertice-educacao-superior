import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { courseTotals } from "@/lib/enrollment-summary";
import { latestEnrollmentSnapshots, modalityOf, type Course, type Enrollment, type Institution } from "@/components/InstitutionArea";
import "./vertice-mobile.css";
import DocumentosMobileBI from "./DocumentosMobileBI";
import AcademicoFontesMobileBI from "./AcademicoFontesMobileBI";
import VerticeMobilePublicPreview from "./VerticeMobilePublicPreview";
import UnitopEorbitOfficial, { type UnitopOfficialSummary } from "./UnitopEorbitOfficial";

type Access = "loading" | "signed_out" | "mfa" | "ready" | "error";
type View = "visao" | "cursos" | "documentos" | "academico" | "alertas";
type Goal = { id: string; institution_id: string; course_id: string | null; status: string; due_date: string | null };
type CourseLine = { course: Course; current: number | null; previous: number | null };
type MobileInstitution = Institution & { acronym?: string | null };
type Data = { institutions: MobileInstitution[]; courses: Course[]; enrollments: Enrollment[]; goals: Goal[] };
// Bloqueio temporário de fonte: revisão documental de 06/11/2026 constatou 1.987 na tabela de snapshots vs. 6.846 na extração e-ORBIT.
const QUARANTINED_SOURCE = { institutionAcronym: "UNITOP", semester: "2026/02" } as const;
const EMPTY: Data = { institutions: [], courses: [], enrollments: [], goals: [] };
const fmt = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const SNAPSHOT_COLUMNS = "id,course_id,semester,class_label,enrolled,capacity,available,source_report_at,reported_total,student_status";
const MAX_FETCH_PAGES = 100; // não tratar consultas truncadas como dados completos

async function fetchAllEnrollments(): Promise<Enrollment[]> {
  const rows: Enrollment[] = [];
  for (let page = 0; page < MAX_FETCH_PAGES; page++) {
    const from = page * 1000;
    const { data, error } = await supabase.from("vertice_enrollment_snapshots")
      .select(SNAPSHOT_COLUMNS).order("source_report_at", { ascending: false }).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as Enrollment[]));
    if (!data || data.length < 1000) return latestEnrollmentSnapshots(rows);
  }
  throw new Error("O volume de matrículas excedeu o limite seguro da consulta.");
}

async function fetchAllGoals(): Promise<Goal[]> {
  const rows: Goal[] = [];
  for (let page = 0; page < MAX_FETCH_PAGES; page++) {
    const from = page * 1000;
    const { data, error } = await supabase.from("vertice_goals")
      .select("id,institution_id,course_id,status,due_date").order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as Goal[]));
    if (!data || data.length < 1000) return rows;
  }
  throw new Error("O volume de metas excedeu o limite seguro da consulta.");
}

function yearBefore(term: string): string {
  const match = /^(\d{4})\/(0[12])$/.exec(term);
  return match ? String(Number(match[1]) - 1) + "/" + match[2] : "";
}

function percentChange(now: number | null, before: number | null): string {
  if (now === null || before === null || before === 0) return "Sem base comparável";
  const v = (now - before) / before * 100;
  return (v > 0 ? "+" : "") + pct.format(v) + "%";
}

function Indicator({ title, value, note, tone }: { title: string; value: string; note: string; tone: "blue" | "teal" | "amber" | "violet" }) {
  return <article className={"vm-indicator vm-" + tone}>
    <span>{title}</span><strong>{value}</strong><small>{note}</small>
  </article>;
}

function Bars({ lines }: { lines: CourseLine[] }) {
  const valid = lines.filter(row => row.current !== null).slice(0, 8);
  const maximum = Math.max(1, ...valid.map(row => row.current ?? 0));
  if (!valid.length) return <p className="vm-empty">Não há matrículas confirmadas no recorte selecionado.</p>;
  return <div className="vm-bars" role="list" aria-label="Cursos com maior volume de matrículas">
    {valid.map(({ course, current }) => <div role="listitem" className="vm-bar" key={course.id}>
      <div><span title={course.name}>{course.name}</span><strong>{fmt.format(current ?? 0)}</strong></div>
      <div className="vm-track" role="meter" aria-label={course.name} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={current ?? 0}>
        <span style={{ width: String(((current ?? 0) / maximum) * 100) + "%" }} />
      </div>
    </div>)}
  </div>;
}

export default function VerticeMobileBI() {
  const [access, setAccess] = useState<Access>("loading");
  const [data, setData] = useState<Data>(EMPTY);
  const [failure, setFailure] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [view, setView] = useState<View>("visao");
  const [query, setQuery] = useState("");
  const [reloading, setReloading] = useState(false);
  const [officialUnitop, setOfficialUnitop] = useState<UnitopOfficialSummary | null>(null);
  const [lastRead, setLastRead] = useState<Date | null>(null);

  async function reload() {
    setReloading(true);
    setFailure("");
    try {
      const { data: auth, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!auth.session) { setAccess("signed_out"); setData(EMPTY); return; }
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance.currentLevel !== "aal2") { setAccess("mfa"); setData(EMPTY); return; }
      const [institutionsResult, coursesResult, enrollments, goals] = await Promise.all([
        supabase.from("vertice_institutions").select("id,name,acronym").order("name"),
        supabase.from("vertice_courses").select("id,institution_id,name,code,modality").order("name"),
        fetchAllEnrollments(),
        fetchAllGoals()
      ]);
      if (institutionsResult.error) throw institutionsResult.error;
      if (coursesResult.error) throw coursesResult.error;
      // Cada SELECT está sujeito às políticas RLS da instituição.
      setData({
        institutions: (institutionsResult.data ?? []) as MobileInstitution[],
        courses: (coursesResult.data ?? []) as Course[],
        enrollments,
        goals
      });
      setLastRead(new Date());
      setAccess("ready");
    } catch {
      setFailure("Não foi possível consultar o banco autorizado. Nenhum indicador foi estimado.");
      setAccess("error");
    } finally {
      setReloading(false);
    }
  }

  useEffect(() => {
    document.title = "Vértice Mobile | Inteligência executiva";
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.appendChild(robots); }
    robots.content = "noindex,nofollow";
    void reload();
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { setAccess("signed_out"); setData(EMPTY); }
    });
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/mobile-sw.js", { scope: "/mobile" }).catch(() => undefined);
    }
    return () => authListener.subscription.unsubscribe();
  }, []);

  const institution = data.institutions.find(item => item.id === institutionId) ?? data.institutions[0];
  const id = institution?.id ?? "";
  const courses = useMemo(() => data.courses.filter(course => course.institution_id === id), [data.courses, id]);
  const courseIds = useMemo(() => new Set(courses.map(course => course.id)), [courses]);
  const rows = useMemo(() => data.enrollments.filter(row => courseIds.has(row.course_id) && row.student_status === "MATRICULADO"), [data.enrollments, courseIds]);
  const semesters = useMemo(() => [...new Set(rows.map(row => row.semester))].sort().reverse(), [rows]);
  const semester = semesters.includes(selectedSemester) ? selectedSemester : (semesters[0] ?? "");
  const previousYearSemester = yearBefore(semester);
  const sourceQuarantined = institution?.acronym?.toUpperCase() === QUARANTINED_SOURCE.institutionAcronym && semester === QUARANTINED_SOURCE.semester;
  const currentRows = rows.filter(row => row.semester === semester);
  const previousRows = rows.filter(row => row.semester === previousYearSemester);

  function amountFor(courseId: string, input: Enrollment[]): number | null {
    const own = input.filter(row => row.course_id === courseId);
    return own.length ? courseTotals(own).value : null;
  }
  const lines = courses.map(course => ({ course, current: sourceQuarantined ? null : amountFor(course.id, currentRows), previous: amountFor(course.id, previousRows) }))
    .sort((a, b) => (b.current ?? -1) - (a.current ?? -1) || a.course.name.localeCompare(b.course.name, "pt-BR"));
  const coverage = lines.filter(line => line.current !== null).length;
  const currentTotal = sourceQuarantined ? (officialUnitop?.matriculas ?? null) : (coverage ? lines.reduce((n, line) => n + (line.current ?? 0), 0) : null);
  const comparable = lines.filter(line => line.current !== null && line.previous !== null);
  const priorComparable = comparable.reduce((n, line) => n + (line.previous ?? 0), 0);
  const nowComparable = comparable.reduce((n, line) => n + (line.current ?? 0), 0);
  const yoy = comparable.length && priorComparable > 0 ? percentChange(nowComparable, priorComparable) : "Sem base comparável";
  const goals = data.goals.filter(goal => goal.institution_id === id && goal.status !== "cancelada");
  const activeGoals = goals.filter(goal => goal.status === "ativa" || goal.status === "planejada");
  const overdue = activeGoals.filter(goal => goal.due_date && new Date(goal.due_date + "T23:59:59") < new Date());
  const declining = lines.filter(line => line.current !== null && line.previous !== null && line.current < line.previous);
  const missing = sourceQuarantined ? [] : lines.filter(line => line.current === null);
  const flagged = declining.length + missing.length + overdue.length + (sourceQuarantined ? 1 : 0);
  const filtered = lines.filter(line => (line.course.name + " " + (line.course.code ?? "")).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  const chosen = lines.find(line => line.course.id === selectedCourse);

  // Fora de sessão autenticada com AAL2, exibe apenas demonstração estática sem SELECT institucional.
  if (access !== "ready" && access !== "loading") return <VerticeMobilePublicPreview />;

  return <main className="vm-app">
    <div className="vm-container">
      <header className="vm-head">
        <div><span className="vm-brandmark">V</span><div><strong>Vértice <em>Mobile</em></strong><small>Inteligência para a gestão superior</small></div></div>
        <a href="/master" aria-label="Abrir o portal completo" className="vm-head-link">Portal</a>
      </header>
      {access !== "ready" ? <section className="vm-gate">
        <h1>{access === "loading" ? "Verificando acesso…" : access === "signed_out" ? "Entre na sua conta" : access === "mfa" ? "Segundo fator necessário" : "Dados indisponíveis"}</h1>
        <p>{access === "loading" ? "Consultando a sessão protegida." : access === "signed_out" ? "Utilize a mesma conta e permissões do portal Vértice." : access === "mfa" ? "Valide o código de autenticação no portal antes de abrir os indicadores." : failure}</p>
        {access !== "loading" && <a className="vm-primary" href={access === "signed_out" ? "/entrar?destino=mobile" : "/master"}>{access === "signed_out" ? "Entrar" : "Abrir acesso protegido"}</a>}
      </section> : <>
        <section className="vm-intro">
          <div><small>PAINEL EXECUTIVO</small><h1>Indicadores do banco</h1><p>Indicadores disponíveis para sua conta, sem dados fictícios.</p></div>
          <button className="vm-refresh" onClick={() => void reload()} disabled={reloading} aria-label="Atualizar indicadores">{reloading ? "Atualizando…" : "Atualizar"}</button>
        </section>
        {data.institutions.length === 0 ? <section className="vm-panel"><h2>Sem instituições autorizadas</h2><p>Esta conta não possui instituições visíveis pelas políticas do banco.</p></section> : <>
          <div className="vm-filters">
            <label>Instituição<select value={id} onChange={event => { setInstitutionId(event.target.value); setSelectedSemester(""); setSelectedCourse(""); }}>
              {data.institutions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <label>Semestre<select value={semester} onChange={event => { setSelectedSemester(event.target.value); setSelectedCourse(""); }} disabled={!semesters.length}>
              {semesters.length === 0 ? <option value="">Sem dados</option> : semesters.map(term => <option key={term} value={term}>{term}</option>)}
            </select></label>
          </div>
          {sourceQuarantined && <section className="vm-quarantine" role="alert"><strong>Tabela resumida sob conciliação</strong><p>A fonte antiga de 2026/02 soma apenas 1.987 matrículas e não será utilizada. O painel consulta, abaixo, o relatório 2 completo do e-ORBIT para apresentar os quantitativos por curso e grade sem reescrever a base histórica.</p></section>}
          {sourceQuarantined && <UnitopEorbitOfficial onVerified={setOfficialUnitop} showCourses={view === "cursos"} />}
          {view === "visao" && <>
            <section aria-label="Indicadores principais" className="vm-indicators">
              <Indicator title="Matrículas no recorte" value={currentTotal === null ? "—" : fmt.format(currentTotal)} note={sourceQuarantined ? (officialUnitop ? officialUnitop.cursos + " cursos · " + officialUnitop.grades + " grades · e-ORBIT" : "Conferência da fonte e-ORBIT") : coverage + "/" + courses.length + " cursos com dados"} tone="blue" />
              <Indicator title="Variação anual comparável" value={yoy} note={previousYearSemester ? previousYearSemester + " × " + semester + " · " + comparable.length + " cursos" : "Período indisponível"} tone="teal" />
              <Indicator title="Metas ativas ou planejadas" value={fmt.format(activeGoals.length)} note="Sem incluir metas canceladas ou concluídas" tone="violet" />
              <Indicator title="Prazos vencidos" value={fmt.format(overdue.length)} note="Metas ativas ou planejadas" tone="amber" />
            </section>
            <section className="vm-panel">
              <div className="vm-section-top"><div><small>DESEMPENHO</small><h2>Maiores cursos em matrículas</h2></div><button onClick={() => setView("cursos")}>Ver todos</button></div>
              {sourceQuarantined ? <p className="vm-muted">O detalhamento completo dos 43 cursos está disponível na aba Cursos, com os totais por grade extraídos do e-ORBIT.</p> : <Bars lines={lines} />}
            </section>
            <section className="vm-panel">
              <div className="vm-section-top"><div><small>ATENÇÃO GERENCIAL</small><h2>Pontos para verificar</h2></div><button onClick={() => setView("alertas")}>Detalhar</button></div>
              <div className="vm-alert-summary">
                <span><b>{declining.length}</b> cursos com queda anual comparável</span>
                <span><b>{missing.length}</b> cursos sem dado no semestre</span>
                <span><b>{overdue.length}</b> metas com prazo vencido</span>
              </div>
            </section>
          </>}
          {view === "cursos" && <section className="vm-panel">
            <div className="vm-section-top"><div><small>GESTÃO POR CURSO</small><h2>Comparativo de matrículas</h2></div></div>
            {sourceQuarantined && <p className="vm-muted">Consulte acima os cursos do relatório 2 e-ORBIT. Não foram misturados ao cadastro anterior enquanto as chaves de curso não estiverem reconciliadas.</p>}
            {!sourceQuarantined && <>
            <label className="vm-search">Buscar curso<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome ou código do curso" /></label>
            <p className="vm-muted">{semester || "Sem semestre"} versus {previousYearSemester || "período anterior indisponível"} · Mesma metade do ano</p>
            <div className="vm-course-list">
              {filtered.map(line => <button key={line.course.id} className={"vm-course " + (selectedCourse === line.course.id ? "vm-selected" : "")} onClick={() => setSelectedCourse(line.course.id === selectedCourse ? "" : line.course.id)} aria-expanded={selectedCourse === line.course.id}>
                <span><strong>{line.course.name}</strong><small>{modalityOf(line.course)} · {line.course.code || "sem código"}</small></span>
                <span><b>{line.current === null ? "—" : fmt.format(line.current)}</b><small>{percentChange(line.current, line.previous)}</small></span>
              </button>)}
            </div>
            {chosen && <aside className="vm-drilldown">
              <h3>{chosen.course.name}</h3>
              <p>{previousYearSemester || "Ano anterior"}: {chosen.previous === null ? "Sem dados" : fmt.format(chosen.previous)}</p>
              <p>{semester || "Período atual"}: {chosen.current === null ? "Sem dados" : fmt.format(chosen.current)}</p>
              <p>Variação: {percentChange(chosen.current, chosen.previous)}</p>
              <a className="vm-primary" href={"/master#" + new URLSearchParams({ instituicao: id, curso: chosen.course.id }).toString()}>Abrir análise completa</a>
            </aside>}
            </>}
          </section>}
          {view === "documentos" && <DocumentosMobileBI key={id} institutionId={id} courses={courses} />}
          {view === "academico" && <AcademicoFontesMobileBI key={id} institutionId={id} />}
          {view === "alertas" && <section className="vm-panel">
            <div className="vm-section-top"><div><small>PRIORIZAÇÃO</small><h2>Alertas verificáveis</h2></div><span className="vm-count">{flagged}</span></div>
            {!flagged && <p className="vm-empty">Sem alertas calculáveis neste recorte. Isso não equivale à ausência de riscos.</p>}
            {sourceQuarantined && <article className="vm-alert"><strong>Conciliação obrigatória · 2026/02</strong><p>Corrigir a fonte resumida no sincronizador UNITOP e validar contra o relatório e-ORBIT antes de liberar os indicadores.</p></article>}
            {declining.slice(0, 30).map(line => <article className="vm-alert" key={line.course.id}><strong>Queda anual · {line.course.name}</strong><p>{fmt.format(line.previous ?? 0)} em {previousYearSemester} para {fmt.format(line.current ?? 0)} em {semester}. Verificar rematrículas e outras causas.</p></article>)}
            {missing.slice(0, 30).map(line => <article className="vm-alert" key={line.course.id}><strong>Sem dados · {line.course.name}</strong><p>Não substituir ausência de relatório por zero.</p></article>)}
            {overdue.slice(0, 30).map(goal => <article className="vm-alert" key={goal.id}><strong>Meta com prazo vencido</strong><p>Vencimento registrado: {goal.due_date}. Consulte a meta no portal para identificar o responsável.</p></article>)}
            <a href={"/master#" + new URLSearchParams({ instituicao: id, aba: "plano" }).toString()} className="vm-primary">Abrir plano de ação 5W2H</a>
          </section>}
          <section className="vm-disclosure">
            <strong>Qualidade e interpretação dos dados</strong>
            <p>Fonte: registros autorizados do Supabase, com origem nos relatórios do e-ORBIT quando disponíveis. A atualização depende do sincronizador. O comparativo anual usa apenas cursos com informação nos dois períodos; não é índice de evasão e não representa necessariamente alunos únicos. Reprovação por nota/falta e matrícula gratuita sem avaliações requerem dados individuais homologados e não são estimadas aqui.</p>
            {lastRead && <small>Última leitura nesta sessão: {lastRead.toLocaleString("pt-BR")}</small>}
          </section>
        </>}
        <nav className="vm-bottom" aria-label="Navegação do aplicativo">
          <button className={view === "visao" ? "active" : ""} aria-current={view === "visao" ? "page" : undefined} onClick={() => { setView("visao"); setSelectedCourse(""); }}>Visão</button>
          <button className={view === "cursos" ? "active" : ""} aria-current={view === "cursos" ? "page" : undefined} onClick={() => setView("cursos")}>Cursos</button>
          <button className={view === "documentos" ? "active" : ""} aria-current={view === "documentos" ? "page" : undefined} onClick={() => setView("documentos")}>Documentos</button>
          <button className={view === "academico" ? "active" : ""} aria-current={view === "academico" ? "page" : undefined} onClick={() => setView("academico")}>Acadêmico</button>
          <button className={view === "alertas" ? "active" : ""} aria-current={view === "alertas" ? "page" : undefined} onClick={() => setView("alertas")}>Alertas</button>
        </nav>
      </>}
      <footer className="vm-footer">Vértice Educação Superior · Acesso institucional protegido</footer>
    </div>
  </main>;
}
