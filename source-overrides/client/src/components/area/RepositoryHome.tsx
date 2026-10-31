import { useState } from "react";
import {
  fmtDate,
  label,
  DEGREE,
  MODALITY,
  COURSE_STATUS,
  type Row,
} from "@/lib/area";
import {
  courseRepositoryStatus,
  repositoryDimension,
  REPOSITORY_DIMENSIONS,
  latestDocuments,
  DOCUMENT_STATUS,
  type DocumentStatus,
} from "@/lib/repository";
export function RepositoryNumbers({
  courses,
  requests,
  files,
}: {
  courses?: number;
  requests: Row[];
  files: Row[];
}) {
  const s = courseRepositoryStatus(requests, files);
  return (
    <div className="repo-numbers">
      {courses !== undefined && (
        <article>
          <span>Cursos no repositório</span>
          <strong>{courses}</strong>
          <small>Todos os cursos cadastrados</small>
        </article>
      )}
      <article>
        <span>Documentos exigidos</span>
        <strong>{s.total}</strong>
        <small>{s.sent} com arquivo enviado</small>
      </article>
      <article>
        <span>Documentos validados</span>
        <strong>{s.validated}</strong>
        <small>
          {s.total
            ? `${s.percent}% do checklist`
            : s.nsa
              ? `${s.nsa} itens NSA`
              : "Checklist ainda não configurado"}
        </small>
      </article>
      <article className={s.pending || s.returned ? "attention" : ""}>
        <span>Pendências documentais</span>
        <strong>{s.pending + s.returned}</strong>
        <small>
          {s.pending} sem envio · {s.returned} devolvidos
        </small>
      </article>
      <article className={s.late ? "attention" : ""}>
        <span>Entregas em atraso</span>
        <strong>{s.late}</strong>
        <small>Exigências com prazo vencido</small>
      </article>
    </div>
  );
}
export function RepositoryCourseHome({
  courses,
  requests,
  files,
  onCourse,
}: {
  courses: Row[];
  requests: Row[];
  files: Row[];
  onCourse: (id: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("todos");
  const rows = courses
    .map((c) => ({
      course: c,
      summary: courseRepositoryStatus(
        requests.filter((r) => r.course_id === c.id),
        files,
      ),
    }))
    .filter(
      ({ course: c, summary: s }) =>
        `${c.name} ${c.code ?? ""} ${c.coordinator ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "todos" ||
          (filter === "pendencias" && s.pending + s.returned + s.late > 0) ||
          (filter === "configurar" && !s.total) ||
          (filter === "validado" && s.total > 0 && s.percent === 100)),
    )
    .sort(
      (a, b) =>
        b.summary.late +
          b.summary.returned -
          (a.summary.late + a.summary.returned) ||
        String(a.course.name).localeCompare(String(b.course.name), "pt-BR"),
    );
  const institutional = courseRepositoryStatus(
    requests.filter((r) => !r.course_id),
    files,
  );
  return (
    <>
      <div className="repo-intro">
        <div>
          <h3>Acervo da instituição</h3>
          <p>
            Escolha um curso para consultar a cobertura, enviar arquivos e
            acompanhar as validações.
          </p>
        </div>
        <button
          className="repo-secondary"
          onClick={() => onCourse("institucional")}
        >
          Documentos institucionais <span>{institutional.total}</span>
        </button>
      </div>
      <div className="repo-toolbar">
        <label>
          Buscar curso
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, código ou coordenação"
          />
        </label>
        <label>
          Mostrar
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="todos">Todos os cursos</option>
            <option value="pendencias">Com pendências ou atraso</option>
            <option value="configurar">Checklist não configurado</option>
            <option value="validado">Documentação validada</option>
          </select>
        </label>
        <span>
          {rows.length} de {courses.length} cursos
        </span>
      </div>
      <div className="table-scroll">
        <table className="repo-table">
          <thead>
            <tr>
              <th>Curso e coordenação</th>
              <th>Documentos</th>
              <th>Cobertura validada</th>
              <th>Pendências</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ course: c, summary: s }) => (
              <tr key={c.id}>
                <td>
                  <strong>{String(c.name)}</strong>
                  <small>
                    {[
                      c.code,
                      c.degree ? label(DEGREE, c.degree) : null,
                      c.modality ? label(MODALITY, c.modality) : null,
                    ]
                      .filter(Boolean)
                      .map(String)
                      .join(" · ")}
                    {c.status && c.status !== "ativo"
                      ? ` · ${label(COURSE_STATUS, c.status)}`
                      : ""}
                  </small>
                  <small>
                    Coordenação: {String(c.coordinator ?? "Não informada")}
                  </small>
                </td>
                <td>
                  {s.sent} / {s.total}
                  <small>com envio / exigidos</small>
                </td>
                <td>
                  <div
                    className="repo-meter"
                    aria-label={
                      s.total
                        ? `${s.percent}% validado`
                        : "Sem checklist configurado"
                    }
                  >
                    <span style={{ width: `${s.percent}%` }} />
                  </div>
                  <small>
                    {s.total
                      ? `${s.percent}% · ${s.validated} validados`
                      : s.nsa
                        ? "NSA — Não se aplica"
                        : "A definir pela gestão"}
                  </small>
                </td>
                <td>
                  {s.pending + s.returned}
                  <small>{s.late} em atraso</small>
                </td>
                <td>
                  <span
                    className={`repo-status ${s.late || s.returned ? "warning" : s.total && s.percent === 100 ? "success" : "neutral"}`}
                  >
                    {s.label}
                  </span>
                </td>
                <td>
                  <button className="repo-open" onClick={() => onCourse(c.id)}>
                    Abrir repositório <span aria-hidden="true">→</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="repo-empty">
          Nenhum curso encontrado para estes filtros.
        </p>
      )}
      <p className="repo-footnote">
        “Sem checklist” significa que a gestão ainda não definiu as exigências
        deste curso. Os modelos do catálogo não são contabilizados como
        pendência antes dessa configuração.
      </p>
    </>
  );
}
export function RepositoryCoverage({
  requests,
  files,
  onDocument,
}: {
  requests: Row[];
  files: Row[];
  onDocument: (id: string) => void;
}) {
  const latest = latestDocuments(files),
    active = requests.filter((r) => r.active !== false);
  if (!active.length)
    return (
      <div className="repo-empty">
        <h4>O checklist deste curso ainda não foi configurado</h4>
        <p>
          Use “Configurar checklist” para selecionar os documentos esperados ou
          “Adicionar documento” para definir uma entrega específica.
        </p>
      </div>
    );
  return (
    <div className="repo-dimensions">
      {Object.entries(REPOSITORY_DIMENSIONS).map(([key, title]) => {
        const rows = active.filter(
          (r) => repositoryDimension(r.indicator) === key,
        );
        if (!rows.length) return null;
        const s = courseRepositoryStatus(rows, files);
        return (
          <section key={key} className="repo-dimension">
            <div className="repo-dimension-title">
              <div>
                <small>
                  {key === "outros" ? "Acervo complementar" : `Dimensão ${key}`}
                </small>
                <h4>{title}</h4>
              </div>
              <span>
                {s.validated}/{s.total} validados
              </span>
            </div>
            <div className="table-scroll">
              <table className="repo-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Referência</th>
                    <th>Responsável</th>
                    <th>Prazo</th>
                    <th>Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const f = latest.get(r.id),
                      status = (f?.status ?? "pendente") as DocumentStatus;
                    return (
                      <tr key={r.id}>
                        <td>
                          <strong>{String(r.title)}</strong>
                          <small>
                            {String(
                              r.document_code ?? "Documento personalizado",
                            )}
                            {r.semester ? ` · ${String(r.semester)}` : ""}
                          </small>
                        </td>
                        <td>{String(r.indicator ?? "—")}</td>
                        <td>{String(r.assignee_email ?? "A definir")}</td>
                        <td>{fmtDate(r.due_date)}</td>
                        <td>
                          <span
                            className={`repo-status ${status === "validado" ? "success" : status === "devolvido" ? "warning" : "neutral"}`}
                          >
                            {DOCUMENT_STATUS[status]}
                          </span>
                        </td>
                        <td>
                          <button
                            className="repo-open"
                            onClick={() => onDocument(r.id)}
                          >
                            {!f || status === "devolvido"
                              ? "Abrir para enviar"
                              : "Abrir documento"}{" "}
                            →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
