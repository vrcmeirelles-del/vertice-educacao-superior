import { useId, useState } from "react";
export type ExtensionEvidenceProject = {
  id: string;
  title: string;
  courses?: { id: string; name: string }[];
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
const NO_COURSE = "__without_course__";
export default function ExtensionEvidenceProjects({
  projects,
  selected,
  locked = [],
  disabled = false,
  onChange,
}: {
  projects: ExtensionEvidenceProject[];
  selected: string[];
  locked?: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [candidate, setCandidate] = useState("");
  const courses = [
    ...new Map(
      projects.flatMap((p) => p.courses || []).map((c) => [c.id, c]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const withoutCourse = projects.some((p) => !p.courses?.length);
  const available = projects
    .filter(
      (p) =>
        !selected.includes(p.id) &&
        (!course ||
          (course === NO_COURSE
            ? !p.courses?.length
            : p.courses?.some((c) => c.id === course))) &&
        normalize(p.title).includes(normalize(search.trim())),
    )
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  const groups = course
    ? []
    : [
        ...courses.map((c) => ({
          id: c.id,
          name: c.name,
          items: available.filter((p) =>
            p.courses?.some((pc) => pc.id === c.id),
          ),
        })),
        {
          id: NO_COURSE,
          name: "Sem curso vinculado",
          items: available.filter((p) => !p.courses?.length),
        },
      ].filter((g) => g.items.length);
  function add() {
    if (disabled || !available.some((p) => p.id === candidate)) return;
    onChange([...new Set([...selected, candidate])]);
    setCandidate("");
  }
  return (
    <fieldset
      className="ext-source-box ext-evidence-projects"
      disabled={disabled}
      aria-describedby={id + "-help"}
    >
      <legend>Projetos vinculados — selecione um ou mais</legend>
      <p id={id + "-help"}>
        Filtre pelo curso e adicione projetos à lista. A mesma evidência pode
        atender vários projetos, com um único arquivo. Vínculos já existentes
        são preservados.
      </p>
      <div className="ext-evidence-project-filters">
        <label htmlFor={id + "-course"}>
          Curso vinculado
          <select
            id={id + "-course"}
            value={course}
            onChange={(e) => {
              setCourse(e.target.value);
              setCandidate("");
            }}
          >
            <option value="">Todos os cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {withoutCourse && (
              <option value={NO_COURSE}>Sem curso vinculado</option>
            )}
          </select>
        </label>
        <label htmlFor={id + "-search"}>
          Buscar projeto
          <input
            id={id + "-search"}
            type="search"
            placeholder="Digite parte do nome"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCandidate("");
            }}
          />
        </label>
      </div>
      <div className="ext-evidence-project-add">
        <label htmlFor={id + "-project"}>
          Projeto
          <select
            id={id + "-project"}
            value={candidate}
            onChange={(e) => setCandidate(e.target.value)}
          >
            <option value="">
              {available.length
                ? "Selecione um projeto"
                : "Nenhum projeto disponível neste filtro"}
            </option>
            {course
              ? available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))
              : groups.map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {g.items.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
          </select>
        </label>
        <button
          type="button"
          className="ext-btn-secondary"
          disabled={!candidate || !available.some((p) => p.id === candidate)}
          onClick={add}
        >
          Adicionar projeto
        </button>
      </div>
      {!available.length && (
        <p>
          {projects.length
            ? "Nenhum projeto disponível para adicionar com estes filtros. Os selecionados continuam na lista abaixo."
            : "Nenhum projeto disponível para vincular com seu perfil."}
        </p>
      )}
      <p>
        <strong>{selected.length}</strong> projeto(s) selecionado(s)
      </p>
      <ul
        className="ext-evidence-selected-projects"
        aria-label="Projetos selecionados"
      >
        {selected.map((projectId) => {
          const p = projects.find((p) => p.id === projectId);
          return (
            <li key={projectId}>
              <div>
                <strong>
                  {p?.title || "Projeto já vinculado fora da lista disponível"}
                </strong>
                <small>
                  {p
                    ? p.courses?.map((c) => c.name).join(" · ") ||
                      "Sem curso vinculado"
                    : "Vínculo existente preservado"}
                </small>
              </div>
              {locked.includes(projectId) ? (
                <span>Já vinculado</span>
              ) : (
                <button
                  type="button"
                  className="ext-btn-secondary"
                  aria-label={"Remover " + p?.title + " da seleção"}
                  onClick={() =>
                    onChange(selected.filter((v) => v !== projectId))
                  }
                >
                  Remover
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
