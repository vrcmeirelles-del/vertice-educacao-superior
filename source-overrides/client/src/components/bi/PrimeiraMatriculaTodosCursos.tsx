import { useMemo, useState } from "react";
import "./primeira-matricula-todos-cursos.css";

type Report = { id: string; kind: string; course_id: string | null; payload: Record<string, any>; source_report_at: string | null };
type Course = { id: string; name: string; code: string | null };
type CohortRow = {
  id: string;
  courseId: string;
  term: string;
  entrants: number;
  noNext: number | null;
  noNextNoAV1: number | null;
  reference: string | null;
};
const format = (n: number | null) => n == null ? "—" : new Intl.NumberFormat("pt-BR").format(n);
const percentage = (a: number, b: number) => b > 0 ? (100 * a / b).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "—";
const numeric = (n: unknown): number | null => {
  if (n === "" || n === null || n === undefined) return null;
  const parsed = Number(n);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const comparableSemester = (s: string) => {
  const m = /^(\d{4})\/(0?[12])$/.exec(s);
  return m ? m[1] + "/" + m[2].padStart(2, "0") : "";
};
const clean = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export default function PrimeiraMatriculaTodosCursos({ reports, courses }: { reports: Report[]; courses: Course[] }) {
  const [courseId, setCourseId] = useState("");
  const [semester, setSemester] = useState("");
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  const cohortRows = useMemo(() => {
    const latest = new Map<string, Report>();
    for (const report of reports) {
      if (report.kind !== "cohorts" || !report.course_id || !Array.isArray(report.payload?.cohorts)) continue;
      const prev = latest.get(report.course_id);
      if (!prev || (prev.source_report_at ?? "") < (report.source_report_at ?? "")) latest.set(report.course_id, report);
    }
    const rows: CohortRow[] = [];
    for (const [id, report] of latest) {
      for (const [index, item] of report.payload.cohorts.entries()) {
        const term = comparableSemester(String(item?.cohort ?? ""));
        const entrants = numeric(item?.entrants);
        if (!term || entrants === null) continue;
        rows.push({
          id: report.id + ":" + index,
          courseId: id,
          term,
          entrants,
          noNext: numeric(item?.no_next),
          noNextNoAV1: numeric(item?.no_next_no_positive_av1),
          reference: report.source_report_at
        });
      }
    }
    return rows.sort((a, b) => b.term.localeCompare(a.term));
  }, [reports]);
  const verifiedCourseIds = useMemo(() => new Set(cohortRows.map(r => r.courseId)), [cohortRows]);

  const history = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const report of reports) {
      if (report.kind !== "quantitativo_alunos_historico" || !report.course_id) continue;
      const semester = comparableSemester(String(report.payload?.semestre ?? ""));
      if (!semester) continue;
      if (!map.has(report.course_id)) map.set(report.course_id, new Set());
      map.get(report.course_id)!.add(semester);
    }
    return map;
  }, [reports]);

  const courseList = useMemo(() => courses.slice().sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR") || (a.code ?? "").localeCompare(b.code ?? "") || a.id.localeCompare(b.id)), [courses]);
  const knownCourseIds = useMemo(() => new Set(courseList.map(c => c.id)), [courseList]);
  const validScope = courseList.some(c => c.id === courseId) ? courseId : "";
  const semesters = useMemo(() => [...new Set(cohortRows.filter(r => !validScope || r.courseId === validScope).map(r => r.term))].sort().reverse(), [cohortRows, validScope]);
  const validSemester = semesters.includes(semester) ? semester : "";
  const visibleRows = cohortRows.filter(r =>
    knownCourseIds.has(r.courseId) && (!validScope || r.courseId === validScope) && (!validSemester || r.term === validSemester));
  const completed = visibleRows.filter(r => r.noNext !== null && r.noNextNoAV1 !== null);
  const entrants = completed.length ? completed.reduce((sum, r) => sum + r.entrants, 0) : null;
  const noNext = completed.length ? completed.reduce((sum, r) => sum + (r.noNext ?? 0), 0) : null;
  const needsReview = completed.length ? completed.reduce((sum, r) => sum + (r.noNextNoAV1 ?? 0), 0) : null;
  const scoped = validScope ? courseList.filter(c => c.id === validScope) : courseList;
  const withCohort = scoped.filter(c => verifiedCourseIds.has(c.id)).length;
  const withHistory = scoped.filter(c => (history.get(c.id)?.size ?? 0) > 0).length;
  const pending = scoped.length - withCohort;

  const filteredCourses = scoped.filter(c => (!onlyPending || !verifiedCourseIds.has(c.id)) &&
    clean(c.name + " " + (c.code ?? "")).includes(clean(search.trim())));
  const selectedCourse = courseList.find(c => c.id === validScope);
  const latestSource = cohortRows.reduce((max, row) => row.reference && row.reference > max ? row.reference : max, "");

  return <section className="vxa-first" aria-labelledby="vxa-first-title">
    <div className="vxa-first-head">
      <div><small>VÉRTICE · LEITURA POR CURSO E INSTITUCIONAL</small><h3 id="vxa-first-title">Primeira matrícula e permanência — todos os cursos</h3>
        <p>Escolha qualquer curso do cadastro. O sistema separa coortes identificadas de históricos de matrícula que ainda não demonstram primeiro vínculo.</p></div>
      <span className="vxa-first-counter">{format(scoped.length)} cursos no recorte</span>
    </div>
    <div className="vxa-first-filters">
      <label>Curso
        <select value={validScope} onChange={e => { setCourseId(e.target.value); setSemester(""); setSearch(""); }}>
          <option value="">Todos os cursos · visão institucional</option>
          {courseList.map(c => <option key={c.id} value={c.id}>{c.code ? c.code + " · " : ""}{c.name}</option>)}
        </select>
      </label>
      <label>Coorte
        <select value={validSemester} onChange={e => setSemester(e.target.value)}>
          <option value="">Todos os semestres disponíveis</option>
          {semesters.map(s => <option value={s} key={s}>{s.replace("/0", "/")}</option>)}
        </select>
      </label>
    </div>
    <div className="vxa-first-metrics">
      <article><small>Cursos no recorte</small><strong>{format(scoped.length)}</strong><span>Catálogo institucional, não coortes</span></article>
      <article><small>Coorte de primeiro vínculo</small><strong>{format(withCohort)}</strong><span>Cursos com fonte nominal já agregada</span></article>
      <article><small>Histórico quantitativo</small><strong>{format(withHistory)}</strong><span>Matrículas por semestre; não são ingressantes</span></article>
      <article className="vxa-first-warning"><small>Coorte ainda indisponível</small><strong>{format(pending)}</strong><span>Cursos pendentes de cruzamento individual</span></article>
    </div>
    <div className="vxa-first-card">
      <h4>Primeiros vínculos efetivamente identificados</h4>
      <p className="vxa-first-description">Indicadores calculados <strong>somente sobre as coortes com base verificada</strong>. Quando um curso não possui relatório de primeiro vínculo, o resultado permanece indisponível — não é zero.</p>
      <div className="vxa-first-metrics three">
        <article><small>Ingressantes observados</small><strong>{format(entrants)}</strong><span>Coortes com semestre seguinte pesquisado</span></article>
        <article><small>Sem vínculo seguinte</small><strong>{format(noNext)}</strong><span>Não caracteriza evasão automaticamente</span></article>
        <article className="vxa-first-warning"><small>Sem vínculo e sem AV1 positiva</small><strong>{format(needsReview)}</strong><span>{entrants !== null && needsReview !== null ? percentage(needsReview, entrants) : "Sem base"} dos ingressantes analisáveis; exige investigação</span></article>
      </div>
      {visibleRows.length ? <div className="vxa-scroll"><table className="vxa-first-table">
        <thead><tr><th>Curso</th><th>Coorte</th><th>Ingressantes</th><th>Sem vínculo seguinte</th><th>Sem vínculo e sem AV1 positiva</th><th>% em investigação</th></tr></thead>
        <tbody>{visibleRows.map(row => <tr key={row.id}>
          <td>{courseList.find(c => c.id === row.courseId)?.name ?? "Curso sem cadastro"}</td>
          <td>{row.term.replace("/0", "/")}</td><td>{format(row.entrants)}</td><td>{format(row.noNext)}</td>
          <td>{format(row.noNextNoAV1)}</td><td>{row.noNextNoAV1 !== null ? percentage(row.noNextNoAV1, row.entrants) : "—"}</td>
        </tr>)}</tbody></table></div> : <p className="vxa-first-empty">Não há uma coorte nominal verificada para {selectedCourse ? selectedCourse.name : "este recorte"}. Aguardando conciliação de identificador estável, primeiro vínculo e matrícula por semestre.</p>}
      <p className="vxa-source">Fonte de primeiro vínculo: relatórios de tipo <code>cohorts</code> do banco Vértice, com data de extração {latestSource ? new Date(latestSource).toLocaleDateString("pt-BR") : "indisponível"}. AV1 positiva significa nota maior que zero localizada; não comprova presença nas duas avaliações. Sem identificador individual validado não é possível calcular evasão ou ausência em AV1/AV2 para os demais cursos.</p>
    </div>
    <div className="vxa-first-card">
      <div className="vxa-first-head compact"><div><small>COBERTURA E PENDÊNCIAS</small><h4>Mapa de disponibilidade — curso por curso</h4><p>Permite acompanhar todos os cursos, sem restringir a análise ao Direito.</p></div>
        <label className="vxa-first-checkbox"><input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)}/> Somente pendentes</label>
      </div>
      <label className="vxa-first-search">Localizar curso <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar nome ou código…" /></label>
      <div className="vxa-first-course-list">
        {!filteredCourses.length ? <p>Nenhum curso encontrado neste filtro.</p> :
        filteredCourses.map(course => {
          const hasCohort = verifiedCourseIds.has(course.id);
          const hist = history.get(course.id);
          const last = hist?.size ? [...hist].sort().at(-1) : null;
          return <div className="vxa-first-course" key={course.id}>
            <div><strong>{course.name}</strong><small>{course.code ? "Código " + course.code + " · " : ""}{hist?.size ? hist.size + " semestres de matrícula disponíveis" : "Sem histórico quantitativo vinculado"}</small></div>
            <div className="vxa-first-course-right">
              <span className={hasCohort ? "vxa-first-verified" : "vxa-first-pending"}>{hasCohort ? "Coorte identificada" : "Primeiro vínculo pendente"}</span>
              <small>{last ? "Último quantitativo: " + last.replace("/0", "/") : "Sem semestre de referência"}</small>
            </div>
          </div>;
        })}
      </div>
      <p className="vxa-source">Histórico auxiliar: <code>vertice_academic_reports</code>, tipo <code>quantitativo_alunos_historico</code>. Os registros de matrícula e seus históricos podem ser usados para tendência, mas não foram convertidos em contagens de primeira matrícula. Onde não existe origem nominal, o painel preserva a lacuna e aguarda extração auditada.</p>
    </div>
  </section>;
}
