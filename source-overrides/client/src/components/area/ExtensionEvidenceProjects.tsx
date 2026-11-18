import { useId, useState } from "react";
type Project = { id: string; title: string };
export default function ExtensionEvidenceProjects({
  projects,
  selected,
  locked = [],
  disabled = false,
  onChange,
}: {
  projects: Project[];
  selected: string[];
  locked?: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const id = useId(),
    [search, setSearch] = useState("");
  const shown = projects.filter((p) =>
    p.title
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <fieldset
      className="ext-source-box ext-evidence-projects"
      disabled={disabled}
      aria-describedby={id + "-help"}
    >
      <legend>Projetos vinculados — selecione um ou mais</legend>
      <p id={id + "-help"}>
        A mesma evidência pode atender vários projetos, sem duplicar o arquivo.
        Vínculos já existentes são preservados.
      </p>
      {projects.length > 5 && (
        <label htmlFor={id + "-search"}>
          Buscar projeto
          <input
            id={id + "-search"}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      )}
      <div
        style={{
          display: "grid",
          gap: 8,
          maxHeight: 220,
          overflowY: "auto",
          padding: 4,
        }}
      >
        {shown.map((project) => (
          <label
            key={project.id}
            style={{ display: "flex", gap: 8, alignItems: "baseline" }}
          >
            <input
              type="checkbox"
              value={project.id}
              checked={selected.includes(project.id)}
              disabled={locked.includes(project.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...new Set([...selected, project.id])]
                    : selected.filter((v) => v !== project.id),
                )
              }
            />
            <span>
              {project.title}
              {locked.includes(project.id) && <small> · Já vinculado</small>}
            </span>
          </label>
        ))}
      </div>
      {!shown.length && (
        <p>
          {projects.length
            ? "Nenhum projeto corresponde à busca."
            : "Nenhum projeto disponível para vincular com seu perfil."}
        </p>
      )}
      <p>
        <strong>
          {selected.filter((v) => projects.some((p) => p.id === v)).length}
        </strong>{" "}
        projeto(s) selecionado(s)
      </p>
    </fieldset>
  );
}
