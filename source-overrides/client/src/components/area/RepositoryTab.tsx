import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  can,
  explain,
  fmtDate,
  saveRow,
  type Field,
  type Role,
  type Row,
} from "@/lib/area";
import {
  DOCUMENT_STATUS,
  FILE_TYPES,
  REPOSITORY_BUCKET,
  documentFile,
  latestDocuments,
  repositorySummary,
  type DocumentStatus,
} from "@/lib/repository";
import RecordForm from "./RecordForm";
import catalog from "@/lib/repository-catalog.json";
import {
  RepositoryCourseHome,
  RepositoryCoverage,
  RepositoryNumbers,
} from "./RepositoryHome";
import RepositoryChecklist from "./RepositoryChecklist";
import { requestsInSemester, repositorySemester } from "@/lib/repository";
import "./repository.css";
const REQUESTS = "vertice_repository_requests",
  FILES = "vertice_repository_files";
type Member = { user_id: string; email: string; role: string };
type Props = {
  institutionId: string;
  role: Role | null;
  courses: Row[];
  goals: Row[];
  requests: Row[];
  files: Row[];
  goalFilter: string;
  setGoalFilter: (id: string) => void;
  reload: () => Promise<void>;
  initialCourseId?: string;
  requestFocus?: string;
};
function RepositoryDocuments({
  institutionId,
  role,
  courses,
  goals,
  requests,
  files,
  goalFilter,
  setGoalFilter,
  reload,
  initialCourseId = "",
  requestFocus = "",
}: Props) {
  const [userId, setUserId] = useState(""),
    [members, setMembers] = useState<Member[]>([]),
    [editing, setEditing] = useState<Row | "new" | null>(null);
  const [query, setQuery] = useState(""),
    [course, setCourse] = useState(initialCourseId),
    [status, setStatus] = useState(""),
    [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(""),
    [msg, setMsg] = useState(""),
    [history, setHistory] = useState(""),
    [review, setReview] = useState<Row | null>(null);
  const [reviewStatus, setReviewStatus] = useState("validado"),
    [reviewNote, setReviewNote] = useState("");
  const [template, setTemplate] = useState(""),
    [pending, setPending] = useState<Row | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? "");
    });
    if (can.manageGoals(role))
      supabase
        .rpc("vertice_team", { target: institutionId })
        .then(({ data, error }) => {
          if (active && !error) setMembers((data ?? []) as Member[]);
        });
    return () => {
      active = false;
    };
  }, [institutionId, role]);
  const manager = can.manageGoals(role);
  const latest = latestDocuments(files);
  const ownRequests = requests.filter(
    (r) =>
      (showArchived || r.active !== false) &&
      (!goalFilter || r.goal_id === goalFilter) &&
      (!course || r.course_id === course),
  );
  const summary = repositorySummary(ownRequests, files);
  const shown = ownRequests.filter(
    (r) =>
      (!requestFocus || r.id === requestFocus) &&
      (!query ||
        `${r.title} ${r.document_code ?? ""} ${r.assignee_email ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!status || (latest.get(r.id)?.status ?? "pendente") === status),
  );
  const goalName = (id: unknown) => goals.find((g) => g.id === id)?.title;
  const courseName = (id: unknown) => courses.find((c) => c.id === id)?.name;
  const fields: Field[] = [
    { name: "title", label: "Documento exigido", required: true, wide: true },
    {
      name: "goal_id",
      label: "Meta vinculada (opcional)",
      type: "select",
      options: goals.map((g) => [g.id, String(g.title)]),
    },
    {
      name: "course_id",
      label: "Curso (opcional)",
      type: "select",
      options: courses.map((c) => [c.id, String(c.name)]),
    },
    {
      name: "assigned_to",
      label: "Coordenador / responsável com acesso",
      type: "select",
      options: [
        [userId, "Minha conta (gestão)"],
        ...members
          .filter(
            (m) =>
              ["gestor", "equipe"].includes(m.role) && m.user_id !== userId,
          )
          .map((m) => [m.user_id, m.email] as [string, string]),
      ],
    },
    { name: "due_date", label: "Prazo de entrega", type: "date" },
    {
      name: "semester",
      label: "Semestre de referência",
      placeholder: "2026-2",
    },
    { name: "document_code", label: "Código do documento (opcional)" },
    { name: "indicator", label: "Indicador / referência (opcional)" },
    {
      name: "instructions",
      label: "Orientação para a entrega",
      type: "textarea",
      wide: true,
    },
  ];
  const baseGoal = goals.find((g) => g.id === goalFilter);
  const selectedTemplate = catalog.find((t) => t.codigo === template);
  const templateValues = selectedTemplate
    ? {
        title: selectedTemplate.nome,
        document_code: selectedTemplate.codigo,
        indicator: selectedTemplate.indicadores.join(", "),
        instructions: selectedTemplate.finalidade,
      }
    : {};
  const base =
    editing === "new"
      ? {
          goal_id: goalFilter,
          course_id: baseGoal?.course_id ?? course,
          due_date: baseGoal?.due_date ?? "",
          assigned_to: baseGoal?.owner_user_id ?? "",
          ...templateValues,
        }
      : editing;
  async function register(values: Row) {
    const { error } = await supabase.from(FILES).insert(values);
    if (error) {
      if (error.code === "23505") {
        const { data } = await supabase
          .from(FILES)
          .select("id")
          .eq("id", values.id)
          .maybeSingle();
        if (data) {
          setPending(null);
          await reload();
          return;
        }
      }
      throw error;
    }
    setPending(null);
    setMsg("Documento registrado. A entrega aguarda análise da gestão.");
    await reload();
  }
  async function upload(r: Row, file: File) {
    setBusy(r.id);
    setMsg("");
    try {
      const { ext, mime } = documentFile(file),
        id = crypto.randomUUID(),
        path = `${institutionId}/${r.id}/${id}.${ext}`;
      const { error } = await supabase.storage
        .from(REPOSITORY_BUCKET)
        .upload(path, file, { contentType: mime, upsert: false });
      if (error) throw error;
      const values: Row = {
        id,
        institution_id: institutionId,
        request_id: r.id,
        storage_path: path,
        file_name: file.name.slice(0, 250),
        size_bytes: file.size,
        mime_type: mime,
      };
      setPending(values);
      await register(values);
    } catch (e) {
      setMsg(
        e instanceof Error && /Formato|arquivo deve/.test(e.message)
          ? e.message
          : explain(e) +
              " Se o arquivo já foi enviado, use “Concluir registro” antes de reenviar.",
      );
    } finally {
      setBusy("");
    }
  }
  async function download(f: Row) {
    setBusy(f.id);
    setMsg("");
    try {
      const { data, error } = await supabase.storage
        .from(REPOSITORY_BUCKET)
        .download(String(f.storage_path));
      if (error) throw error;
      const url = URL.createObjectURL(data),
        a = document.createElement("a");
      a.href = url;
      a.download = String(f.file_name);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setMsg(
        "Não foi possível baixar o documento. Confira sua sessão e o vínculo com a IES.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="area-panel">
      <div className="area-panel-head">
        <h3>Documentos exigidos e entregas</h3>
        {manager && (
          <button
            className="corp-button small"
            onClick={() => {
              setTemplate("");
              setEditing("new");
            }}
          >
            Adicionar documento
          </button>
        )}
      </div>
      <p className="area-muted">
        Organize as evidências desta IES por curso, meta, responsável e prazo. O
        envio fica separado da validação pela gestão.
      </p>
      <div className="area-stat-grid">
        <article>
          <small>Exigências ativas</small>
          <b>{summary.total}</b>
        </article>
        <article>
          <small>Com envio</small>
          <b>{summary.sent}</b>
        </article>
        <article>
          <small>Validadas</small>
          <b>{summary.validated}</b>
          <span>{summary.percent}% das exigências</span>
        </article>
        <article>
          <small>Sem envio</small>
          <b>{summary.pending}</b>
        </article>
        <article className={summary.late ? "warn" : ""}>
          <small>Em atraso</small>
          <b>{summary.late}</b>
        </article>
        <article>
          <small>Devolvidas</small>
          <b>{summary.returned}</b>
        </article>
      </div>
      {manager && editing && (
        <div className="area-panel">
          {editing === "new" && (
            <label>
              Usar modelo do catálogo (opcional)
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="">Documento personalizado</option>
                {catalog.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.codigo} · {t.nome}
                  </option>
                ))}
              </select>
              <small className="area-field-help">
                Modelos do repositório original. Confira a aplicabilidade ao
                curso antes de exigir.
              </small>
            </label>
          )}
          <RecordForm
            key={`${editing === "new" ? "new" : editing.id}:${template}`}
            title={
              editing === "new"
                ? "Nova exigência documental"
                : "Editar exigência"
            }
            fields={fields}
            initial={base ?? {}}
            onCancel={() => setEditing(null)}
            onSubmit={async (v) => {
              const g = goals.find((g) => g.id === v.goal_id);
              if (g?.course_id && v.course_id && g.course_id !== v.course_id)
                throw new Error("A meta selecionada pertence a outro curso.");
              await saveRow(
                REQUESTS,
                {
                  ...v,
                  assigned_to: v.assigned_to ?? g?.owner_user_id ?? null,
                  course_id: g?.course_id ?? v.course_id ?? null,
                  ...(editing === "new"
                    ? { institution_id: institutionId }
                    : {}),
                },
                editing === "new" ? undefined : editing.id,
              );
              setEditing(null);
              await reload();
            }}
          />
          <p className="area-field-help">
            Para atribuir a outra pessoa, vincule sua conta como Equipe na aba
            Equipe. Somente o responsável atribuído e a gestão podem enviar
            nesta exigência.
          </p>
        </div>
      )}
      <div className="area-inline">
        <label>
          Meta
          <select
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
          >
            <option value="">Todas as metas</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {String(g.title)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Curso
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">Todos os cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {String(c.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Situação
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(DOCUMENT_STATUS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Documento ou responsável"
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />{" "}
          Incluir arquivadas
        </label>
        <button className="corp-login-text-button" onClick={reload}>
          Atualizar entregas
        </button>
      </div>
      {msg && (
        <p role="status" className="area-note">
          {msg}
        </p>
      )}
      {pending && (
        <p role="alert">
          Há um envio aguardando registro no painel.{" "}
          <button
            className="corp-button small"
            disabled={Boolean(busy)}
            onClick={async () => {
              setBusy(pending.id);
              try {
                await register(pending);
              } catch (e) {
                setMsg(explain(e));
              } finally {
                setBusy("");
              }
            }}
          >
            Concluir registro
          </button>
        </p>
      )}
      {review && (
        <form
          className="area-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(review.id);
            try {
              const { error } = await supabase
                .from(FILES)
                .update({
                  status: reviewStatus,
                  review_note: reviewNote.trim() || null,
                })
                .eq("id", review.id);
              if (error) throw error;
              setReview(null);
              await reload();
            } catch (e) {
              setMsg(explain(e));
            } finally {
              setBusy("");
            }
          }}
        >
          <h4>Analisar · {String(review.file_name)}</h4>
          <label>
            Decisão
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value)}
            >
              <option value="validado">Validar documento</option>
              <option value="devolvido">Devolver para correção</option>
            </select>
          </label>
          <label>
            Parecer
            <textarea
              required={reviewStatus === "devolvido"}
              maxLength={4000}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </label>
          <div className="area-row-actions">
            <button className="corp-button small" disabled={Boolean(busy)}>
              Registrar análise
            </button>
            <button
              type="button"
              className="corp-login-text-button"
              onClick={() => setReview(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {!shown.length ? (
        <p className="area-muted">
          Nenhuma exigência documental encontrada.
          {manager
            ? " Use “Adicionar documento” para definir a entrega e atribuir o responsável."
            : ""}
        </p>
      ) : (
        <div className="area-cards">
          {shown.map((r) => {
            const f = latest.get(r.id),
              state = (f?.status ?? "pendente") as DocumentStatus,
              versions = files
                .filter((x) => x.request_id === r.id)
                .sort((a, b) =>
                  String(b.created_at).localeCompare(String(a.created_at)),
                );
            const mayUpload =
              r.active !== false &&
              (manager || (role === "equipe" && r.assigned_to === userId));
            return (
              <article className="area-card" key={r.id}>
                <div className="area-card-top">
                  <span
                    className={`badge ${state === "validado" ? "green" : state === "devolvido" ? "red" : "amber"}`}
                  >
                    {DOCUMENT_STATUS[state]}
                  </span>
                  {r.active === false && (
                    <span className="badge gray">Arquivada</span>
                  )}
                </div>
                <h4>{String(r.title)}</h4>
                <p className="area-muted">
                  {String(courseName(r.course_id) ?? "Institucional")}
                  {r.semester ? ` · ${r.semester}` : ""}
                  {r.document_code ? ` · ${r.document_code}` : ""}
                </p>
                <p>
                  Meta:{" "}
                  <strong>
                    {String(goalName(r.goal_id) ?? "Sem vínculo com meta")}
                  </strong>
                  <br />
                  Responsável:{" "}
                  <strong>
                    {String(r.assignee_email ?? "A definir pela gestão")}
                  </strong>
                  <br />
                  Prazo: <strong>{fmtDate(r.due_date)}</strong>
                </p>
                {Boolean(r.indicator) && (
                  <p>Referência: {String(r.indicator)}</p>
                )}
                {Boolean(r.instructions) && <p>{String(r.instructions)}</p>}
                {f && (
                  <p>
                    Último envio: <strong>{String(f.file_name)}</strong> ·{" "}
                    {fmtDate(f.created_at)} ·{" "}
                    {String(f.uploaded_email ?? "Conta vinculada")}
                    {Boolean(f.review_note) && (
                      <>
                        <br />
                        Parecer: {String(f.review_note)}
                      </>
                    )}
                  </p>
                )}
                <div className="area-row-actions">
                  {mayUpload && (
                    <label className="corp-login-text-button">
                      {busy === r.id
                        ? "Enviando…"
                        : f
                          ? "Enviar nova versão"
                          : "Enviar documento"}
                      <input
                        aria-label={`Enviar documento: ${r.title}`}
                        type="file"
                        accept={Object.keys(FILE_TYPES)
                          .map((x) => "." + x)
                          .join(",")}
                        disabled={Boolean(busy) || Boolean(pending)}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void upload(r, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                  {f && (
                    <button
                      className="corp-login-text-button"
                      disabled={Boolean(busy)}
                      onClick={() => download(f)}
                    >
                      Baixar último envio
                    </button>
                  )}
                  {manager && f && (
                    <button
                      className="corp-login-text-button"
                      onClick={() => {
                        setReview(f);
                        setReviewStatus("validado");
                        setReviewNote("");
                      }}
                    >
                      Analisar
                    </button>
                  )}
                  <button
                    className="corp-login-text-button"
                    onClick={() => setHistory(history === r.id ? "" : r.id)}
                  >
                    Histórico ({versions.length})
                  </button>
                  {manager && (
                    <>
                      <button
                        className="corp-login-text-button"
                        onClick={() => setEditing(r)}
                      >
                        Editar exigência
                      </button>
                      <button
                        className="corp-login-text-button"
                        onClick={async () => {
                          try {
                            await saveRow(
                              REQUESTS,
                              { active: r.active === false },
                              r.id,
                            );
                            await reload();
                          } catch (e) {
                            setMsg(explain(e));
                          }
                        }}
                      >
                        {r.active === false ? "Reativar" : "Arquivar exigência"}
                      </button>
                    </>
                  )}
                </div>
                {history === r.id && (
                  <div className="table-scroll">
                    <table className="area-table">
                      <thead>
                        <tr>
                          <th>Envio</th>
                          <th>Arquivo</th>
                          <th>Responsável pelo envio</th>
                          <th>Situação</th>
                          <th>Análise</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((v) => (
                          <tr key={v.id}>
                            <td>
                              {new Date(String(v.created_at)).toLocaleString(
                                "pt-BR",
                              )}
                            </td>
                            <td>{String(v.file_name)}</td>
                            <td>{String(v.uploaded_email ?? "—")}</td>
                            <td>
                              {DOCUMENT_STATUS[v.status as DocumentStatus]}
                            </td>
                            <td>
                              {String(v.review_note ?? "—")}
                              {Boolean(v.reviewed_at) &&
                                ` · ${fmtDate(v.reviewed_at)}`}
                            </td>
                            <td>
                              <button
                                className="corp-login-text-button"
                                onClick={() => download(v)}
                              >
                                Baixar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <p className="area-muted small">
        Arquivos privados de até 20 MB. Cada reenvio preserva as versões
        anteriores. Os acessos seguem o vínculo com a IES e o segundo fator da
        Vértice. Postar um documento não conclui automaticamente a meta.
      </p>
    </div>
  );
}

type RepositoryView = "cobertura" | "arquivos" | "historico" | "documentos";
export default function RepositoryTab(props: Props) {
  const { courses, requests, files, role, goalFilter, setGoalFilter } = props;
  const [selectedCourse, setSelectedCourse] = useState<string | null>(() =>
    goalFilter
      ? String(
          props.goals.find((g) => g.id === goalFilter)?.course_id ??
            "institucional",
        )
      : null,
  );
  const [semester, setSemester] = useState("");
  const [view, setView] = useState<RepositoryView>(
    goalFilter ? "documentos" : "cobertura",
  );
  const [configuring, setConfiguring] = useState(false),
    [focus, setFocus] = useState(""),
    [downloadError, setDownloadError] = useState("");
  useEffect(() => {
    if (goalFilter) {
      setSelectedCourse(
        String(
          props.goals.find((g) => g.id === goalFilter)?.course_id ??
            "institucional",
        ),
      );
      setView("documentos");
      setFocus("");
    }
  }, [goalFilter]);
  const selected = courses.find((c) => c.id === selectedCourse);
  const isInstitutional = selectedCourse === "institucional";
  const scoped = requestsInSemester(
    requests.filter(
      (r) =>
        (!goalFilter || r.goal_id === goalFilter) &&
        (selectedCourse === null ||
          (!r.course_id ? isInstitutional : r.course_id === selectedCourse)),
    ),
    semester,
  );
  const ownIds = new Set(scoped.map((r) => r.id));
  const ownFiles = files.filter((f) => ownIds.has(String(f.request_id)));
  const semesters = [
    ...new Set(
      requests.map((r) => repositorySemester(r.semester)).filter(Boolean),
    ),
  ]
    .sort()
    .reverse();
  const courseTitle = String(selected?.name ?? "Documentos institucionais");
  const back = () => {
    setSelectedCourse(null);
    setFocus("");
    setConfiguring(false);
    setGoalFilter("");
  };
  const selectCourse = (id: string) => {
    setSelectedCourse(id);
    setView("cobertura");
    setFocus("");
    setConfiguring(false);
    setDownloadError("");
  };
  async function download(f: Row) {
    try {
      setDownloadError("");
      const { data, error } = await supabase.storage
        .from(REPOSITORY_BUCKET)
        .download(String(f.storage_path));
      if (error) throw error;
      const url = URL.createObjectURL(data),
        a = document.createElement("a");
      a.href = url;
      a.download = String(f.file_name);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setDownloadError(
        "Não foi possível baixar o arquivo. Confira sua sessão e tente novamente.",
      );
    }
  }
  return (
    <section
      className="repository-shell"
      aria-label="Repositório documental da IES"
    >
      <header className="repo-header">
        <div>
          <small>
            REPOSITÓRIO DOCUMENTAL ·{" "}
            {role === "master"
              ? "VISÃO MASTER"
              : role === "gestor"
                ? "GESTÃO DA IES"
                : "ACERVO DA IES"}
          </small>
          <h2>
            {selectedCourse === null ? "Painel do repositório" : courseTitle}
          </h2>
          <p>
            {selectedCourse === null
              ? "Todos os cursos e documentos desta instituição em um só lugar."
              : "Cobertura documental, entregas e validação das evidências."}
          </p>
        </div>
        <div className="repo-header-actions">
          {selectedCourse !== null && (
            <button className="repo-secondary" onClick={back}>
              ← Todos os cursos
            </button>
          )}
          <button className="repo-secondary" onClick={props.reload}>
            Atualizar acervo
          </button>
        </div>
      </header>
      <div className="repo-toolbar">
        <label>
          Período de referência
          <select
            value={semester}
            onChange={(e) => {
              setSemester(e.target.value);
              setFocus("");
            }}
          >
            <option value="">Todos os semestres</option>
            {semesters.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {goalFilter && (
          <span className="repo-goal-context">
            Meta:{" "}
            {String(
              props.goals.find((g) => g.id === goalFilter)?.title ??
                "Selecionada",
            )}{" "}
            <button
              className="corp-login-text-button"
              onClick={() => setGoalFilter("")}
            >
              Limpar filtro
            </button>
          </span>
        )}
      </div>
      <RepositoryNumbers
        courses={selectedCourse === null ? courses.length : undefined}
        requests={scoped}
        files={ownFiles}
      />
      {selectedCourse === null ? (
        <RepositoryCourseHome
          courses={courses}
          requests={scoped}
          files={ownFiles}
          onCourse={selectCourse}
        />
      ) : (
        <>
          <div className="repo-course-heading">
            <div>
              <strong>
                {[selected?.code, selected?.degree, selected?.modality]
                  .filter(Boolean)
                  .map(String)
                  .join(" · ") || "Acervo institucional"}
              </strong>
              {selected && (
                <p>
                  Coordenação:{" "}
                  {String(selected.coordinator ?? "Não informada no cadastro")}
                </p>
              )}
            </div>
            <div className="repo-header-actions">
              {can.manageGoals(role) && (
                <button
                  className="repo-secondary"
                  onClick={() => setConfiguring((v) => !v)}
                >
                  Configurar checklist
                </button>
              )}
              <button
                className="corp-button"
                onClick={() => {
                  setView("documentos");
                  setFocus("");
                }}
              >
                Enviar / consultar documento
              </button>
            </div>
          </div>
          {configuring && can.manageGoals(role) && (
            <RepositoryChecklist
              institutionId={props.institutionId}
              course={selected ?? null}
              goals={props.goals}
              requests={requests}
              semester={semester}
              onClose={() => setConfiguring(false)}
              onSaved={props.reload}
            />
          )}
          <nav
            className="repo-subtabs"
            aria-label="Seções do repositório do curso"
          >
            {(
              [
                ["cobertura", "Cobertura documental"],
                ["arquivos", "Arquivos enviados"],
                ["historico", "Histórico por semestre"],
                ["documentos", "Documentos exigidos"],
              ] as [RepositoryView, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                aria-current={view === k ? "page" : undefined}
                className={view === k ? "active" : ""}
                onClick={() => {
                  setView(k);
                  setFocus("");
                }}
              >
                {label}
                {k === "arquivos" ? ` (${ownFiles.length})` : ""}
              </button>
            ))}
          </nav>
          {downloadError && (
            <p role="alert" className="area-error">
              {downloadError}
            </p>
          )}
          {view === "cobertura" ? (
            <RepositoryCoverage
              requests={scoped}
              files={ownFiles}
              onDocument={(id) => {
                setFocus(id);
                setView("documentos");
              }}
            />
          ) : view === "arquivos" ? (
            <div className="repo-dimension">
              <div className="repo-dimension-title">
                <h3>Arquivos enviados</h3>
                <span>{ownFiles.length} versões registradas</span>
              </div>
              {!ownFiles.length ? (
                <p className="repo-empty">
                  Nenhum arquivo enviado para este curso no período selecionado.
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="repo-table">
                    <thead>
                      <tr>
                        <th>Arquivo e documento</th>
                        <th>Enviado por</th>
                        <th>Data</th>
                        <th>Situação</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {ownFiles
                        .slice()
                        .sort((a, b) =>
                          String(b.created_at).localeCompare(
                            String(a.created_at),
                          ),
                        )
                        .map((f) => (
                          <tr key={f.id}>
                            <td>
                              <strong>{String(f.file_name)}</strong>
                              <small>
                                {String(
                                  scoped.find((r) => r.id === f.request_id)
                                    ?.title ?? "Documento",
                                )}
                              </small>
                            </td>
                            <td>{String(f.uploaded_email ?? "—")}</td>
                            <td>{fmtDate(f.created_at)}</td>
                            <td>
                              {DOCUMENT_STATUS[f.status as DocumentStatus]}
                            </td>
                            <td>
                              <button
                                className="repo-open"
                                onClick={() => download(f)}
                              >
                                Baixar arquivo
                              </button>
                              <button
                                className="repo-secondary"
                                onClick={() => {
                                  setFocus(String(f.request_id));
                                  setView("documentos");
                                }}
                              >
                                Abrir entrega
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : view === "historico" ? (
            <div className="repo-dimension">
              <div className="repo-dimension-title">
                <h3>Histórico por semestre</h3>
              </div>
              <div className="table-scroll">
                <table className="repo-table">
                  <thead>
                    <tr>
                      <th>Referência</th>
                      <th>Exigidos</th>
                      <th>Com envio</th>
                      <th>Validados</th>
                      <th>Sem envio</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...new Set(
                        requests
                          .filter((r) =>
                            !r.course_id
                              ? isInstitutional
                              : r.course_id === selectedCourse,
                          )
                          .map(
                            (r) =>
                              repositorySemester(r.semester) ||
                              "Sem período definido",
                          ),
                      ),
                    ]
                      .sort()
                      .reverse()
                      .map((s) => {
                        const rows = requests.filter(
                          (r) =>
                            (!r.course_id
                              ? isInstitutional
                              : r.course_id === selectedCourse) &&
                            (repositorySemester(r.semester) ||
                              "Sem período definido") === s,
                        );
                        const summary = repositorySummary(rows, files);
                        return (
                          <tr key={s}>
                            <td>{s}</td>
                            <td>{summary.total}</td>
                            <td>{summary.sent}</td>
                            <td>{summary.validated}</td>
                            <td>{summary.pending}</td>
                            <td>
                              <button
                                className="repo-open"
                                onClick={() => {
                                  setSemester(
                                    s === "Sem período definido" ? "" : s,
                                  );
                                  setView("cobertura");
                                }}
                              >
                                Abrir período
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              {!requests.some((r) =>
                !r.course_id ? isInstitutional : r.course_id === selectedCourse,
              ) && (
                <p className="repo-empty">
                  O histórico aparece após a configuração das primeiras
                  exigências.
                </p>
              )}
            </div>
          ) : (
            <>
              {focus && (
                <div className="repo-toolbar">
                  <button
                    className="repo-secondary"
                    onClick={() => setFocus("")}
                  >
                    ← Todos os documentos do curso
                  </button>
                </div>
              )}
              <RepositoryDocuments
                key={`${selectedCourse}:${focus}`}
                {...props}
                courses={selected ? [selected] : []}
                goals={props.goals.filter(
                  (g) => !g.course_id || g.course_id === selected?.id,
                )}
                requests={scoped}
                files={ownFiles}
                initialCourseId={selected?.id ?? ""}
                requestFocus={focus}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
