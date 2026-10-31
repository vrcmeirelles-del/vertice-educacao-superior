import { useCallback, useEffect, useState } from "react";
import type { Row } from "@/lib/area";
import { listAllRepository } from "@/lib/repository-data";
import { courseRepositoryStatus } from "@/lib/repository";
import { RepositoryNumbers } from "./RepositoryHome";
import "./repository.css";
export default function GlobalRepository({
  institutions,
  courses,
  onOpen,
}: {
  institutions: Row[];
  courses: Row[];
  onOpen: (id: string) => void;
}) {
  const [requests, setRequests] = useState<Row[]>([]),
    [files, setFiles] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      const [r, f] = await Promise.all([
        listAllRepository("vertice_repository_requests"),
        listAllRepository("vertice_repository_files"),
      ]);
      setRequests(r);
      setFiles(f);
    } catch {
      setError(
        "Não foi possível carregar o panorama dos repositórios. Tente atualizar.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);
  return (
    <section className="repo-global" aria-label="Todos os repositórios das IES">
      <header className="repo-header">
        <div>
          <small>VISÃO MASTER · TODAS AS INSTITUIÇÕES</small>
          <h2>Repositórios das IES</h2>
          <p>
            Acompanhe o acervo documental de todas as instituições e abra cada
            repositório para ver seus cursos e arquivos.
          </p>
        </div>
        <button className="repo-secondary" onClick={load}>
          Atualizar panorama
        </button>
      </header>
      {loading ? (
        <p role="status">Carregando todos os repositórios…</p>
      ) : error ? (
        <p role="alert" className="area-error">
          {error}
        </p>
      ) : (
        <>
          <RepositoryNumbers
            courses={courses.length}
            requests={requests}
            files={files}
          />
          <div className="repo-toolbar">
            <label>
              Buscar instituição
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome ou sigla da IES"
              />
            </label>
            <span>
              {institutions.length} instituições · acesso master sem filtro por
              responsável
            </span>
          </div>
          <div className="table-scroll">
            <table className="repo-table">
              <thead>
                <tr>
                  <th>Instituição</th>
                  <th>Cursos</th>
                  <th>Documentos com envio</th>
                  <th>Validados</th>
                  <th>Pendências</th>
                  <th>Atrasos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {institutions
                  .filter((i) =>
                    `${i.name} ${i.acronym ?? ""}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((i) => {
                    const s = courseRepositoryStatus(
                      requests.filter((r) => r.institution_id === i.id),
                      files,
                    );
                    return (
                      <tr key={i.id}>
                        <td>
                          <strong>{String(i.name)}</strong>
                          <small>
                            {String(i.acronym ?? "")}
                            {i.status === "arquivada" ? " · IES arquivada" : ""}
                          </small>
                        </td>
                        <td>
                          {
                            courses.filter((c) => c.institution_id === i.id)
                              .length
                          }
                        </td>
                        <td>
                          {s.sent} / {s.total}
                          <small>com envio / exigidos</small>
                        </td>
                        <td>
                          {s.validated}
                          <small>
                            {s.total
                              ? `${s.percent}% validado`
                              : "Sem checklist configurado"}
                          </small>
                        </td>
                        <td>{s.pending + s.returned}</td>
                        <td>{s.late}</td>
                        <td>
                          <button
                            className="repo-open"
                            onClick={() => onOpen(i.id)}
                          >
                            Abrir repositório →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="repo-footnote">
            Esta visão inclui todas as IES e todos os cursos disponíveis ao
            master, inclusive os que ainda não possuem documentos ou checklist
            configurado.
          </p>
        </>
      )}
    </section>
  );
}
