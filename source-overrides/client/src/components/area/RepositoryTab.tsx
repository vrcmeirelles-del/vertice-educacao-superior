import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import {
  can,
  explain,
  fmtDate,
  label,
  DEGREE,
  MODALITY,
  type Row,
} from "@/lib/area";
import {
  catalogForProfile,
  documentFile,
  FILE_TYPES,
  latestDocuments,
  repositoryDimension,
  REPOSITORY_DIMENSIONS,
  repositorySemester,
  repositorySummary,
  requestsInSemester,
  REPOSITORY_BUCKET,
} from "@/lib/repository";
import {
  coverageCsv,
  evidenceSemesters,
  evidenceSeries,
} from "@/lib/repository-evidence";
import catalog from "@/lib/repository-catalog.json";
import RepositoryChecklist from "./RepositoryChecklist";
import RepositoryDocuments, {
  type RepositoryProps,
} from "./RepositoryDocuments";
import "./repository-evidence.css";

const indicatorList = (value: unknown): string[] =>
  Array.from(String(value ?? "").match(/[123]\.\d+/g) ?? []);
type View = "cobertura" | "arquivos" | "serie" | "catalogo";
const stateLabel: Record<string, string> = {
  pendente: "Sem arquivo",
  enviado: "Em análise",
  validado: "Validado",
  devolvido: "Devolvido",
  nao_configurado: "Não configurado",
};
const stateTone: Record<string, string> = {
  pendente: "falta",
  enviado: "em_analise",
  validado: "ok",
  devolvido: "devolvido",
  nao_configurado: "neutro",
};
function Pill({ state, children }: { state: string; children?: ReactNode }) {
  return (
    <span className={`er-pill ${stateTone[state] ?? state}`}>
      {children ?? stateLabel[state] ?? state}
    </span>
  );
}
function Kpi({
  title,
  value,
  detail,
  percent,
}: {
  title: string;
  value: ReactNode;
  detail: ReactNode;
  percent?: number;
}) {
  return (
    <article className="er-kpi">
      <div className="er-label">{title}</div>
      <div className="er-value">{value}</div>
      <div className="er-detail">{detail}</div>
      {percent !== undefined && (
        <div className="er-bar">
          <i style={{ width: `${percent}%` }} />
        </div>
      )}
    </article>
  );
}
function Card({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="er-card">
      <header className="er-card-head">
        <h3>{title}</h3>
        <div>{detail}</div>
      </header>
      {children}
    </section>
  );
}
function Modal({
  title,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="er-modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close.current();
      }}
    >
      <div className="er-modal-head">
        <h2>{title}</h2>
        <button
          type="button"
          aria-label="Fechar"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function RepositoryTab(props: RepositoryProps) {
  const {
    institutionId,
    role,
    requests,
    files,
    courses,
    goals,
    goalFilter,
    setGoalFilter,
    reload,
  } = props;
  const manager = can.manageGoals(role);
  const [userId, setUserId] = useState("");
  const [courseId, setCourseId] = useState<string | null>(() =>
    goalFilter
      ? String(
          goals.find((g) => g.id === goalFilter)?.course_id ?? "institucional",
        )
      : null,
  );
  const [semester, setSemester] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() < 6 ? 1 : 2}`;
  });
  const [view, setView] = useState<View>("cobertura");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [configuring, setConfiguring] = useState(false);
  const [managing, setManaging] = useState(false);
  const [upload, setUpload] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  useEffect(() => {
    void supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);
  useEffect(() => {
    if (goalFilter) {
      setCourseId(
        String(
          goals.find((g) => g.id === goalFilter)?.course_id ?? "institucional",
        ),
      );
      setView("cobertura");
    }
  }, [goalFilter]);
  const course = courses.find((c) => c.id === courseId) ?? null;
  const courseRequests = requests.filter(
    (r) =>
      (courseId === null ||
        (courseId === "institucional"
          ? !r.course_id
          : r.course_id === courseId)) &&
      (!goalFilter || r.goal_id === goalFilter),
  );
  const scoped = requestsInSemester(courseRequests, semester).filter(
    (r) => r.active !== false,
  );
  const latest = latestDocuments(files);
  const summary = repositorySummary(scoped, files);
  const seriesSummary = repositorySummary(courseRequests, files);
  const presence = summary.total
    ? Math.round((summary.sent * 100) / summary.total)
    : 0;
  const periods = [
    ...new Set([
      ...evidenceSemesters(semester),
      ...courseRequests
        .map((r) => repositorySemester(r.semester))
        .filter(Boolean),
    ]),
  ].sort();
  const ownIds = new Set(scoped.map((r) => r.id));
  const ownFiles = files
    .filter((f) => ownIds.has(String(f.request_id)))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const indicators = [
    ...new Set(scoped.flatMap((r) => indicatorList(r.indicator))),
  ];
  const indicatorsCovered = indicators.filter((i) =>
    scoped.some(
      (r) => indicatorList(r.indicator).includes(i) && latest.has(r.id),
    ),
  ).length;
  const canSend = (r: Row) =>
    r.active !== false &&
    (manager || (role === "equipe" && r.assigned_to === userId));
  const courseName = String(course?.name ?? "Documentos institucionais");
  const goCourse = (id: string) => {
    setCourseId(id);
    setView("cobertura");
    setNotice("");
    setError("");
  };
  const goHome = () => {
    setCourseId(null);
    setGoalFilter("");
    setNotice("");
    setError("");
  };
  const openSend = (id = "") => {
    setUpload(id);
    setNotice("");
    setError("");
  };
  async function download(f: Row) {
    setWorking(f.id);
    setError("");
    try {
      const { data, error } = await supabase.storage
        .from(REPOSITORY_BUCKET)
        .download(String(f.storage_path));
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = String(f.file_name);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setError(explain(e));
    } finally {
      setWorking("");
    }
  }
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([coverageCsv(scoped, files)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobertura-${course?.code ?? "institucional"}-${semester}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const documentTable = (rows: Row[], catalogView = false) => (
    <div className="er-table-scroll">
      <table className="er-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Documento</th>
            <th>Indicadores</th>
            <th>Periodicidade</th>
            {catalogView && <th>Responsável</th>}
            <th>Situação</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const template = catalog.find((t) => t.codigo === r.document_code);
            const f = latest.get(r.id);
            const state = String(f?.status ?? "pendente");
            return (
              <tr key={r.id}>
                <td className="er-code">{String(r.document_code ?? "—")}</td>
                <td>
                  <strong>{String(r.title)}</strong>
                  {Boolean(r.instructions) && (
                    <small>{String(r.instructions)}</small>
                  )}
                  {Boolean(r.goal_id) && (
                    <small>
                      Meta:{" "}
                      {String(
                        goals.find((g) => g.id === r.goal_id)?.title ??
                          "Vinculada",
                      )}
                    </small>
                  )}
                </td>
                <td className="er-muted">{String(r.indicator || "—")}</td>
                <td className="er-muted">
                  {template?.rotulo_periodicidade ?? "Definida pela gestão"}
                  {Boolean(r.due_date) && (
                    <small>Prazo: {fmtDate(r.due_date)}</small>
                  )}
                </td>
                {catalogView && (
                  <td>{String(r.assignee_email ?? "Gestão da IES")}</td>
                )}
                <td>
                  <Pill state={state} />
                  {Boolean(f?.review_note) && (
                    <small>{String(f?.review_note)}</small>
                  )}
                </td>
                <td>
                  <div className="er-actions">
                    {canSend(r) && (
                      <button
                        className="er-btn er-small"
                        onClick={() => openSend(r.id)}
                      >
                        {f ? "Nova versão" : "Enviar"}
                      </button>
                    )}
                    {f && (
                      <button
                        className="er-btn er-small"
                        disabled={Boolean(working)}
                        onClick={() => void download(f)}
                      >
                        Baixar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="evidence-repo">
      <div className="er-top">
        <div className="er-brand">
          <span>V</span>
          <div>
            <strong>Repositório de Reconhecimento</strong>
            <small>Vértice · Evidências de cursos</small>
          </div>
        </div>
        <Pill state="neutro">
          {role === "master"
            ? "Master · visão integral"
            : role === "gestor"
              ? "Gestão da IES"
              : role === "equipe"
                ? "Equipe"
                : "Consulta"}
        </Pill>
      </div>
      <div className="er-content">
        <header className="er-page-head">
          <div>
            <h2>{courseId === null ? "Painel de evidências" : courseName}</h2>
            <p>
              {courseId === null
                ? "Situação por curso e acompanhamento das entregas"
                : "Cobertura de evidências"}{" "}
              · {semester}
            </p>
          </div>
          <div className="er-actions">
            {courseId !== null ? (
              <>
                <button className="er-btn" onClick={goHome}>
                  Voltar ao painel
                </button>
                <button className="er-btn" onClick={exportCsv}>
                  Exportar cobertura (CSV)
                </button>
                {(manager || role === "equipe") && (
                  <button
                    className="er-btn er-primary"
                    onClick={() => openSend()}
                  >
                    Enviar documento
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  className="er-btn"
                  onClick={() => goCourse("institucional")}
                >
                  Acervo institucional
                </button>
                {manager && (
                  <button
                    className="er-btn er-soft"
                    onClick={() => setManaging(true)}
                  >
                    Administração
                  </button>
                )}
              </>
            )}
          </div>
        </header>
        <div className="er-toolbar">
          <label>
            Semestre de referência
            <input
              aria-label="Semestre de referência"
              type="text"
              pattern="[0-9]{4}-[12]"
              value={semester}
              onChange={(e) => {
                if (/^\d{0,4}(-[12]?)?$/.test(e.target.value))
                  setSemester(e.target.value);
              }}
              placeholder="2026-2"
              list="er-periods"
            />
          </label>
          <datalist id="er-periods">
            {periods.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          {goalFilter && (
            <span className="er-notice">
              Meta:{" "}
              {String(
                goals.find((g) => g.id === goalFilter)?.title ?? "Selecionada",
              )}{" "}
              <button className="er-link" onClick={() => setGoalFilter("")}>
                Ver todas as metas
              </button>
            </span>
          )}
        </div>
        {notice && (
          <p role="status" className="er-alert success">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="er-alert error">
            {error}
          </p>
        )}
        <div className="er-grid er-grid-4">
          {courseId === null ? (
            <>
              <Kpi
                title="Cursos acompanhados"
                value={courses.length}
                detail="todos os cursos cadastrados na IES"
              />
              <Kpi
                title="Cobertura documental"
                value={summary.total ? `${presence}%` : "—"}
                detail={
                  summary.total
                    ? `${summary.sent} de ${summary.total} exigências com documento`
                    : "Checklist a configurar"
                }
                percent={presence}
              />
              <Kpi
                title="Pendências"
                value={summary.pending + summary.returned}
                detail="faltas e devoluções a resolver"
              />
              <Kpi
                title="Semestre"
                value={semester || "—"}
                detail="período selecionado para acompanhamento"
              />
            </>
          ) : (
            <>
              <Kpi
                title="Presença no semestre"
                value={summary.total ? `${presence}%` : "—"}
                detail={`${summary.sent} de ${summary.total} exigências com documento`}
                percent={presence}
              />
              <Kpi
                title="Indicadores cobertos"
                value={`${indicatorsCovered}/${indicators.length}`}
                detail="referências cadastradas com evidência"
                percent={
                  indicators.length
                    ? Math.round((indicatorsCovered * 100) / indicators.length)
                    : 0
                }
              />
              <Kpi
                title="Validado"
                value={summary.total ? `${summary.percent}%` : "—"}
                detail={`${summary.validated} conferidos de ${summary.total}`}
                percent={summary.percent}
              />
              <Kpi
                title="Pendências"
                value={summary.pending + summary.returned}
                detail={`${summary.pending} sem arquivo · ${summary.returned} devolvidos`}
              />
            </>
          )}
        </div>
        {courseId === null ? (
          <>
            <div className="er-toolbar">
              <label>
                Buscar curso
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, código ou coordenação"
                />
              </label>
              <label>
                Situação
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="todos">Todos os cursos</option>
                  <option value="pendentes">Com pendências</option>
                  <option value="configurar">Sem checklist</option>
                </select>
              </label>
            </div>
            <Card
              title="Situação por curso"
              detail="Cursos com pendências aparecem primeiro"
            >
              {courses
                .map((c) => ({
                  c,
                  s: repositorySummary(
                    requestsInSemester(
                      requests.filter((r) => r.course_id === c.id),
                      semester,
                    ),
                    files,
                  ),
                }))
                .filter(
                  ({ c, s }) =>
                    `${c.name} ${c.code ?? ""} ${c.coordinator ?? ""}`
                      .toLowerCase()
                      .includes(search.toLowerCase()) &&
                    (filter === "todos" ||
                      (filter === "pendentes" && s.pending + s.returned > 0) ||
                      (filter === "configurar" && !s.total)),
                )
                .sort(
                  (a, b) =>
                    b.s.late - a.s.late ||
                    b.s.pending + b.s.returned - a.s.pending - a.s.returned ||
                    String(a.c.name).localeCompare(String(b.c.name), "pt-BR"),
                )
                .map(({ c, s }) => {
                  const pc = s.total ? Math.round((s.sent * 100) / s.total) : 0;
                  const state = !s.total
                    ? "neutro"
                    : s.returned || s.late
                      ? "falta"
                      : s.pending
                        ? "devolvido"
                        : s.validated === s.total
                          ? "ok"
                          : "em_analise";
                  return (
                    <div className="er-course" key={c.id}>
                      <div className="er-course-info">
                        <strong>{String(c.name)}</strong>
                        <small>
                          {label(DEGREE, c.degree)} ·{" "}
                          {label(MODALITY, c.modality)}
                          {c.status !== "ativo"
                            ? ` · ${String(c.status ?? "")}`
                            : ""}
                        </small>
                        <small>
                          Coordenação:{" "}
                          {String(c.coordinator ?? "Não informada")}
                        </small>
                      </div>
                      <div className="er-progress">
                        <div>
                          <span>
                            <b>{s.total ? `${pc}%` : "Sem checklist"}</b>{" "}
                            {s.total ? "com documento" : ""}
                          </span>
                          <span>{s.pending + s.returned} pendências</span>
                        </div>
                        <div className="er-bar">
                          <i style={{ width: `${pc}%` }} />
                        </div>
                      </div>
                      <Pill state={state}>
                        {!s.total
                          ? "Configurar exigências"
                          : s.late
                            ? `${s.late} em atraso`
                            : s.pending + s.returned
                              ? "Pendências"
                              : s.validated === s.total
                                ? "Em dia"
                                : "A validar"}
                      </Pill>
                      <button
                        className="er-btn er-small er-primary"
                        onClick={() => goCourse(c.id)}
                      >
                        Abrir
                      </button>
                    </div>
                  );
                })}
              {!courses.length && (
                <div className="er-empty">
                  Nenhum curso cadastrado nesta instituição.
                </div>
              )}
            </Card>
          </>
        ) : (
          <>
            {course && (
              <p className="er-course-meta">
                {label(DEGREE, course.degree)} ·{" "}
                {label(MODALITY, course.modality)} · Coordenação:{" "}
                {String(course.coordinator ?? "Não informada")}
              </p>
            )}
            <nav className="er-tabs" aria-label="Seções do repositório">
              {(
                [
                  ["cobertura", "Cobertura do semestre"],
                  ["arquivos", "Arquivos enviados"],
                  ["serie", "Série histórica"],
                  ["catalogo", "Documentos exigidos"],
                ] as [View, string][]
              ).map(([id, text]) => (
                <button
                  key={id}
                  className={view === id ? "active" : ""}
                  aria-current={view === id ? "page" : undefined}
                  onClick={() => setView(id)}
                >
                  {text}
                </button>
              ))}
            </nav>
            {manager && (
              <div className="er-course-tools">
                <button
                  className="er-btn er-small er-soft"
                  onClick={() => setConfiguring(true)}
                >
                  Configurar exigências do semestre
                </button>
                <button
                  className="er-btn er-small"
                  onClick={() => setManaging(true)}
                >
                  Metas, responsáveis e prazos
                </button>
              </div>
            )}
            {view === "cobertura" ? (
              <>
                {!scoped.length ? (
                  <div className="er-alert info">
                    <strong>
                      Checklist ainda não configurado neste semestre.
                    </strong>
                    <p>
                      Consulte os modelos em “Documentos exigidos”. A gestão
                      pode configurar as exigências ou enviar um documento
                      diretamente.
                    </p>
                    <button
                      className="er-btn"
                      onClick={() => setView("catalogo")}
                    >
                      Ver documentos do catálogo
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="er-grid er-grid-3">
                      <Kpi
                        title="Exigidos no semestre"
                        value={summary.total}
                        detail="documentos ativos"
                      />
                      <Kpi
                        title="Com documento"
                        value={summary.sent}
                        detail={`${summary.validated} validados`}
                      />
                      <Kpi
                        title="Pendentes"
                        value={summary.pending + summary.returned}
                        detail="faltas e devoluções"
                      />
                    </div>
                    {scoped.some(
                      (r) =>
                        !latest.has(r.id) ||
                        latest.get(r.id)?.status === "devolvido",
                    ) ? (
                      <Card
                        title="Pendências do semestre"
                        detail={
                          <Pill state="pendente">
                            {summary.pending + summary.returned} a resolver
                          </Pill>
                        }
                      >
                        {documentTable(
                          scoped.filter(
                            (r) =>
                              !latest.has(r.id) ||
                              latest.get(r.id)?.status === "devolvido",
                          ),
                        )}
                      </Card>
                    ) : (
                      <p className="er-alert success">
                        Todas as exigências deste semestre possuem envio. A
                        validação é feita pela gestão.
                      </p>
                    )}
                    <Card
                      title="Documentos com material no semestre"
                      detail="Validado é o que já passou pela conferência"
                    >
                      {scoped.some(
                        (r) =>
                          latest.has(r.id) &&
                          latest.get(r.id)?.status !== "devolvido",
                      ) ? (
                        documentTable(
                          scoped.filter(
                            (r) =>
                              latest.has(r.id) &&
                              latest.get(r.id)?.status !== "devolvido",
                          ),
                        )
                      ) : (
                        <div className="er-empty">
                          Nenhum documento com material neste semestre ainda.
                        </div>
                      )}
                    </Card>
                  </>
                )}
              </>
            ) : view === "arquivos" ? (
              <Card
                title={`Arquivos enviados em ${semester}`}
                detail={`${ownFiles.length} arquivos`}
              >
                {!ownFiles.length ? (
                  <div className="er-empty">
                    <h3>Nenhum arquivo neste semestre</h3>
                    <p>Comece enviando os documentos do ciclo selecionado.</p>
                    {(manager || role === "equipe") && (
                      <button
                        className="er-btn er-primary"
                        onClick={() => openSend()}
                      >
                        Enviar documento
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="er-table-scroll">
                    <table className="er-table">
                      <thead>
                        <tr>
                          <th>Documento</th>
                          <th>Arquivo</th>
                          <th>Versão</th>
                          <th>Enviado em</th>
                          <th>Situação</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {ownFiles.map((f) => {
                          const r = courseRequests.find(
                            (r) => r.id === f.request_id,
                          );
                          const versions = files
                            .filter((x) => x.request_id === f.request_id)
                            .sort(
                              (a, b) =>
                                String(a.created_at).localeCompare(
                                  String(b.created_at),
                                ) || a.id.localeCompare(b.id),
                            );
                          return (
                            <tr key={f.id}>
                              <td>
                                <span className="er-code">
                                  {String(r?.document_code ?? "—")}
                                </span>
                                <small>{String(r?.title ?? "Documento")}</small>
                                {Boolean(f.reference) && (
                                  <small>{String(f.reference)}</small>
                                )}
                              </td>
                              <td>
                                <strong>{String(f.file_name)}</strong>
                                <small>
                                  {(Number(f.size_bytes) / 1024 / 1024).toFixed(
                                    2,
                                  )}{" "}
                                  MB
                                </small>
                                {Boolean(f.upload_note) && (
                                  <small>{String(f.upload_note)}</small>
                                )}
                              </td>
                              <td>
                                v{versions.findIndex((x) => x.id === f.id) + 1}
                              </td>
                              <td>
                                {fmtDate(f.created_at)}
                                <small>
                                  {String(
                                    f.uploaded_email ?? "Conta vinculada",
                                  )}
                                </small>
                              </td>
                              <td>
                                <Pill state={String(f.status)} />
                                {Boolean(f.review_note) && (
                                  <small>{String(f?.review_note)}</small>
                                )}
                              </td>
                              <td>
                                <div className="er-actions">
                                  <button
                                    className="er-btn er-small"
                                    disabled={Boolean(working)}
                                    onClick={() => void download(f)}
                                  >
                                    Baixar
                                  </button>
                                  {manager && (
                                    <button
                                      className="er-btn er-small er-soft"
                                      onClick={() => setReviewing(f)}
                                    >
                                      Analisar
                                    </button>
                                  )}
                                  {r && canSend(r) && (
                                    <button
                                      className="er-btn er-small"
                                      onClick={() => openSend(r.id)}
                                    >
                                      Nova versão
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : view === "serie" ? (
              <Card
                title="Série histórica"
                detail="Comparação por documento e semestre"
              >
                <p className="er-card-note">
                  {seriesSummary.sent} de {seriesSummary.total} exigências com
                  envio na série cadastrada. “Não configurado” indica ausência
                  de exigência cadastrada, não uma entrega pendente.
                </p>
                {!courseRequests.some((r) => r.active !== false) ? (
                  <div className="er-empty">
                    A série aparece após cadastrar as primeiras exigências.
                  </div>
                ) : (
                  <div className="er-table-scroll">
                    <table className="er-table">
                      <thead>
                        <tr>
                          <th>Documento</th>
                          {periods.map((p) => (
                            <th key={p}>{p}</th>
                          ))}
                          {courseRequests.some((r) => !r.semester) && (
                            <th>Sem período definido</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {evidenceSeries(courseRequests, files, periods).map(
                          (row) => (
                            <tr key={row.key}>
                              <td>
                                <span className="er-code">{row.code}</span>
                                <small>{row.title}</small>
                              </td>
                              {row.cells.map((cell) => (
                                <td key={cell.period}>
                                  <Pill state={cell.status} />
                                </td>
                              ))}
                              {courseRequests.some((r) => !r.semester) && (
                                <td>
                                  {courseRequests
                                    .filter(
                                      (r) =>
                                        !r.semester &&
                                        String(
                                          r.document_code ||
                                            `custom:${r.title}`,
                                        ) === row.key,
                                    )
                                    .map((r) => (
                                      <Pill
                                        key={r.id}
                                        state={String(
                                          latest.get(r.id)?.status ??
                                            "pendente",
                                        )}
                                      />
                                    ))}
                                </td>
                              )}
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : (
              <>
                {scoped.length > 0 &&
                  Object.entries(REPOSITORY_DIMENSIONS).map(([dim, text]) => {
                    const rows = scoped.filter(
                      (r) => repositoryDimension(r.indicator) === dim,
                    );
                    return rows.length ? (
                      <Card
                        key={dim}
                        title={
                          dim === "outros" ? text : `Dimensão ${dim} — ${text}`
                        }
                        detail={`${rows.length} documentos`}
                      >
                        {documentTable(rows, true)}
                      </Card>
                    ) : null;
                  })}
                <CatalogPreview
                  course={course}
                  manager={manager}
                  configured={scoped}
                  onConfigure={() => setConfiguring(true)}
                  onSend={(code) => openSend(`modelo:${code}`)}
                />
              </>
            )}
          </>
        )}
        <p className="er-footer">
          Os arquivos e as entregas pertencem a esta IES. O master tem acesso
          integral. A postagem registra a evidência; a gestão confere o
          documento e acompanha a meta vinculada.
        </p>
      </div>
      {upload !== null && (
        <UploadDialog
          {...props}
          course={course}
          institutional={courseId === "institucional"}
          semester={semester}
          initialTarget={upload}
          userId={userId}
          onClose={() => setUpload(null)}
          onSent={() => {
            setUpload(null);
            setView("arquivos");
            setNotice(
              "Documento enviado. A entrega aguarda conferência da gestão.",
            );
          }}
        />
      )}
      {configuring && (
        <Modal
          title="Configurar documentos exigidos"
          onClose={() => setConfiguring(false)}
        >
          <RepositoryChecklist
            institutionId={institutionId}
            course={course}
            goals={goals}
            requests={requests}
            semester={semester}
            onClose={() => setConfiguring(false)}
            onSaved={reload}
          />
        </Modal>
      )}
      {managing && (
        <Modal
          title={
            courseId === null
              ? "Administração do repositório"
              : "Metas, responsáveis e prazos"
          }
          onClose={() => setManaging(false)}
        >
          <div className="er-manage">
            <RepositoryDocuments
              {...props}
              courses={courseId === null ? courses : course ? [course] : []}
              requests={courseId === null ? requests : courseRequests}
              initialCourseId={course?.id ?? ""}
            />
          </div>
        </Modal>
      )}
      {reviewing && (
        <ReviewDialog
          file={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={async () => {
            await reload();
            setReviewing(null);
            setNotice("Análise registrada.");
          }}
        />
      )}
    </div>
  );
}
function CatalogPreview({
  course,
  manager,
  configured,
  onConfigure,
  onSend,
}: {
  course: Row | null;
  manager: boolean;
  configured: Row[];
  onConfigure: () => void;
  onSend: (code: string) => void;
}) {
  const [area, setArea] = useState(
    /direito/i.test(String(course?.name ?? "")) ? "juridica" : "geral",
  );
  const models = catalogForProfile(
    catalog,
    course ?? { id: "", degree: "", modality: "" },
    area,
  ).filter((t) => !configured.some((r) => r.document_code === t.codigo));
  return (
    <div className="er-catalog">
      <div className="er-toolbar">
        <div>
          <h3>Catálogo de documentos do repositório original</h3>
          <p className="er-muted">
            Modelos disponíveis. A gestão confirma quais serão exigidos neste
            curso e semestre.
          </p>
        </div>
        <label>
          Perfil do catálogo
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="geral">Geral</option>
            <option value="juridica">Jurídico</option>
            <option value="saude">Saúde</option>
          </select>
        </label>
        {manager && (
          <button className="er-btn er-soft" onClick={onConfigure}>
            Configurar exigências
          </button>
        )}
      </div>
      {[1, 2, 3].map((dim) => {
        const rows = models.filter((t) => t.dimensao === dim);
        return !rows.length ? null : (
          <Card
            key={dim}
            title={`Dimensão ${dim} — ${REPOSITORY_DIMENSIONS[String(dim)]}`}
            detail={`${rows.length} modelos disponíveis`}
          >
            <div className="er-table-scroll">
              <table className="er-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Documento</th>
                    <th>Indicadores</th>
                    <th>Periodicidade</th>
                    <th>Responsável sugerido</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.codigo}>
                      <td className="er-code">{t.codigo}</td>
                      <td>
                        <strong>{t.nome}</strong>
                        <small>{t.finalidade}</small>
                      </td>
                      <td>{t.indicadores.join(", ")}</td>
                      <td>{t.rotulo_periodicidade}</td>
                      <td>{t.responsavel}</td>
                      <td>
                        {manager ? (
                          <button
                            className="er-btn er-small"
                            onClick={() => onSend(t.codigo)}
                          >
                            Enviar
                          </button>
                        ) : (
                          <Pill state="neutro">Modelo</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function UploadDialog(
  props: RepositoryProps & {
    course: Row | null;
    institutional: boolean;
    semester: string;
    initialTarget: string;
    userId: string;
    onClose: () => void;
    onSent: () => void;
  },
) {
  const manager = can.manageGoals(props.role);
  const [target, setTarget] = useState(props.initialTarget);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [goalId, setGoalId] = useState(props.goalFilter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState<Row | null>(null);
  const [created, setCreated] = useState<Row | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const scoped = requestsInSemester(
    props.requests.filter(
      (r) =>
        (props.institutional
          ? !r.course_id
          : r.course_id === props.course?.id) &&
        r.active !== false &&
        (manager ||
          (props.role === "equipe" && r.assigned_to === props.userId)),
    ),
    props.semester,
  );
  const selected = scoped.find((r) => r.id === target);
  const courseGoals = props.goals.filter(
    (g) =>
      (!g.course_id || g.course_id === props.course?.id) &&
      g.status !== "cancelada",
  );
  const choose = (f?: File) => {
    if (!f) return;
    try {
      documentFile(f);
      setFile(f);
      setError("");
    } catch (e) {
      setError(explain(e));
    }
  };
  async function register(values: Row) {
    const { error } = await supabase
      .from("vertice_repository_files")
      .insert(values);
    if (error) {
      const { data, error: readError } = await supabase
        .from("vertice_repository_files")
        .select("id")
        .eq("id", values.id)
        .maybeSingle();
      if (readError || !data) throw error;
    }
    setPending(null);
    await props.reload();
    props.onSent();
  }
  async function send() {
    setError("");
    if (!/^\d{4}-[12]$/.test(props.semester)) {
      setError("Escolha um semestre válido (ex.: 2026-2).");
      return;
    }
    if (!file) {
      setError("Escolha o arquivo a enviar.");
      return;
    }
    if (!target) {
      setError("Escolha o documento a que se refere o arquivo.");
      return;
    }
    setBusy(true);
    try {
      const { ext, mime } = documentFile(file);
      let request = selected ?? created;
      if (!request) {
        if (!manager)
          throw new Error("Selecione uma entrega atribuída à sua conta.");
        const template = target.startsWith("modelo:")
          ? catalog.find((t) => t.codigo === target.slice(7))
          : null;
        if (target !== "novo" && !template)
          throw new Error("Documento não encontrado.");
        const goal = courseGoals.find((g) => g.id === goalId);
        const title = template?.nome ?? customTitle.trim();
        if (!title) throw new Error("Informe o nome do novo documento.");
        const { data, error } = await supabase
          .from("vertice_repository_requests")
          .insert({
            institution_id: props.institutionId,
            course_id: props.course?.id ?? null,
            semester: props.semester,
            title,
            document_code: template?.codigo ?? null,
            indicator: template?.indicadores.join(", ") ?? null,
            instructions: template?.finalidade ?? null,
            goal_id: goal?.id ?? null,
            assigned_to: goal?.owner_user_id ?? null,
            due_date: goal?.due_date ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        request = data as Row;
        setCreated(request);
      }
      const id = crypto.randomUUID();
      const path = `${props.institutionId}/${request.id}/${id}.${ext}`;
      const { error } = await supabase.storage
        .from(REPOSITORY_BUCKET)
        .upload(path, file, { contentType: mime, upsert: false });
      if (error) throw error;
      const values: Row = {
        id,
        institution_id: props.institutionId,
        request_id: request.id,
        storage_path: path,
        file_name: file.name.slice(0, 250),
        size_bytes: file.size,
        mime_type: mime,
        reference: reference.trim() || null,
        upload_note: note.trim() || null,
      };
      setPending(values);
      await register(values);
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Enviar documento de evidência"
      busy={busy}
      onClose={props.onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) void send();
        }}
      >
        <div className="er-modal-body">
          <p className="er-alert info">
            O documento entra como pendente de análise. Só consta como validado
            depois da conferência da gestão.
          </p>
          <p className="er-muted">
            {String(props.course?.name ?? "Acervo institucional")} · semestre{" "}
            {props.semester}
          </p>
          <label className="er-field">
            Documento
            <select
              required
              disabled={busy || Boolean(pending) || Boolean(created)}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Selecione o documento…</option>
              {scoped.length > 0 && (
                <optgroup label="Exigências deste curso e semestre">
                  {scoped.map((r) => (
                    <option key={r.id} value={r.id}>
                      {String(r.document_code ?? "")} · {String(r.title)}
                    </option>
                  ))}
                </optgroup>
              )}
              {manager && (
                <>
                  <optgroup label="Novo documento">
                    <option value="novo">Documento personalizado</option>
                  </optgroup>
                  <optgroup label="Catálogo original — cadastrar e enviar">
                    {catalog
                      .filter(
                        (t) =>
                          !scoped.some((r) => r.document_code === t.codigo),
                      )
                      .map((t) => (
                        <option key={t.codigo} value={`modelo:${t.codigo}`}>
                          {t.codigo} · {t.nome}
                        </option>
                      ))}
                  </optgroup>
                </>
              )}
            </select>
          </label>
          {!manager && !scoped.length && (
            <p className="er-alert warning">
              Nenhuma entrega atribuída à sua conta neste curso e semestre.
              Solicite a atribuição à gestão.
            </p>
          )}
          {manager && target === "novo" && (
            <label className="er-field">
              Nome do documento
              <input
                required
                maxLength={500}
                disabled={busy || Boolean(created)}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Ex.: Ata do NDE"
              />
            </label>
          )}
          <label className="er-field">Arquivo</label>
          <button
            type="button"
            className={`er-drop ${drag ? "active" : ""}`}
            disabled={busy || Boolean(pending)}
            onClick={() => picker.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (!busy && !pending) choose(e.dataTransfer.files[0]);
            }}
          >
            <strong>Clique para escolher o arquivo</strong>
            <span>
              ou arraste para esta área · PDF, Word, Excel, PowerPoint ou imagem
              · até 20 MB
            </span>
          </button>
          <input
            ref={picker}
            aria-label="Escolher arquivo de evidência"
            type="file"
            className="er-file-input"
            accept={Object.keys(FILE_TYPES)
              .map((x) => `.${x}`)
              .join(",")}
            disabled={busy || Boolean(pending)}
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {file && (
            <div className="er-chosen">
              <strong>{file.name}</strong>
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              <button
                type="button"
                className="er-btn er-small"
                disabled={busy || Boolean(pending)}
                onClick={() => setFile(null)}
              >
                Remover
              </button>
            </div>
          )}
          <label className="er-field">
            Referência
            <input
              maxLength={250}
              disabled={busy || Boolean(pending)}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex.: Ata NDE 05 — 2026-2"
            />
            <small>Identifica este arquivo dentro do semestre.</small>
          </label>
          <label className="er-field">
            Observação
            <textarea
              maxLength={4000}
              disabled={busy || Boolean(pending)}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observações para a gestão (opcional)"
            />
          </label>
          {manager && !selected && (
            <label className="er-field">
              Vincular à meta (opcional)
              <select
                value={goalId}
                disabled={busy || Boolean(created)}
                onChange={(e) => setGoalId(e.target.value)}
              >
                <option value="">Sem meta vinculada</option>
                {courseGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {String(g.title)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {Boolean(selected?.goal_id) && (
            <p className="er-alert info">
              Meta vinculada:{" "}
              {String(
                props.goals.find((g) => g.id === selected?.goal_id)?.title ??
                  "Meta da gestão",
              )}
            </p>
          )}
          {target.startsWith("modelo:") && (
            <p className="er-alert warning">
              Este envio cadastra o modelo como exigência deste curso no
              semestre selecionado. Confira a aplicabilidade ao curso.
            </p>
          )}
          {error && (
            <p role="alert" className="er-alert error">
              {error}
            </p>
          )}
          {pending && (
            <p className="er-alert warning">
              O arquivo já foi recebido. Conclua o registro sem reenviar.
            </p>
          )}
        </div>
        <div className="er-modal-foot">
          <button
            type="button"
            className="er-btn"
            disabled={busy}
            onClick={props.onClose}
          >
            Cancelar
          </button>
          {pending ? (
            <button
              type="button"
              className="er-btn er-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await register(pending);
                } catch (e) {
                  setError(explain(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Concluir registro
            </button>
          ) : (
            <button
              className="er-btn er-primary"
              disabled={busy || !file || !target}
            >
              {busy ? "Enviando…" : "Enviar documento"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
function ReviewDialog({
  file,
  onClose,
  onSaved,
}: {
  file: Row;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState("validado");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title="Analisar documento" busy={busy} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const { data, error } = await supabase
              .from("vertice_repository_files")
              .update({ status, review_note: note.trim() || null })
              .eq("id", file.id)
              .select("id")
              .single();
            if (error || !data)
              throw error ?? new Error("Análise não registrada.");
            await onSaved();
          } catch (e) {
            setError(explain(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="er-modal-body">
          <strong>{String(file.file_name)}</strong>
          {Boolean(file.reference) && <p>{String(file.reference)}</p>}
          {Boolean(file.upload_note) && <p>{String(file.upload_note)}</p>}
          <label className="er-field">
            Decisão
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="validado">Validar documento</option>
              <option value="devolvido">Devolver para correção</option>
            </select>
          </label>
          <label className="er-field">
            Parecer
            <textarea
              required={status === "devolvido"}
              maxLength={4000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Informe o motivo caso devolva o documento"
            />
          </label>
          {error && (
            <p role="alert" className="er-alert error">
              {error}
            </p>
          )}
        </div>
        <div className="er-modal-foot">
          <button
            type="button"
            className="er-btn"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="er-btn er-primary" disabled={busy}>
            {busy ? "Registrando…" : "Registrar análise"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
