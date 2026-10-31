import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { explain, type Row } from "@/lib/area";
import { catalogForProfile, repositorySemester } from "@/lib/repository";
import catalog from "@/lib/repository-catalog.json";
type Props = {
  institutionId: string;
  course: Row | null;
  goals: Row[];
  requests: Row[];
  semester: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
};
export default function RepositoryChecklist({
  institutionId,
  course,
  goals,
  requests,
  semester,
  onClose,
  onSaved,
}: Props) {
  const [area, setArea] = useState(
      /direito/i.test(String(course?.name ?? "")) ? "juridica" : "geral",
    ),
    [sem, setSem] = useState(
      semester ||
        `${new Date().getFullYear()}-${new Date().getMonth() < 6 ? 1 : 2}`,
    ),
    [selected, setSelected] = useState<string[]>([]),
    [due, setDue] = useState(""),
    [owner, setOwner] = useState(""),
    [goal, setGoal] = useState(""),
    [members, setMembers] = useState<{ user_id: string; email: string }[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.rpc("vertice_team", { target: institutionId }),
      supabase.auth.getUser(),
    ]).then(([team, user]) => {
      if (!live) return;
      const m = (team.data ?? []) as {
        user_id: string;
        email: string;
        role: string;
      }[];
      const allowed = m.filter((x) => ["gestor", "equipe"].includes(x.role));
      if (
        user.data.user &&
        !allowed.some((x) => x.user_id === user.data.user!.id)
      )
        allowed.unshift({
          user_id: user.data.user.id,
          email: user.data.user.email ?? "Minha conta",
          role: "master",
        });
      setMembers(allowed);
    });
    return () => {
      live = false;
    };
  }, [institutionId]);
  const profileCourse = course ?? { id: "", degree: "", modality: "" };
  const templates = catalogForProfile(catalog, profileCourse, area);
  const exists = (code: string) =>
    requests.some(
      (r) =>
        (r.course_id ?? null) === (course?.id ?? null) &&
        r.document_code === code &&
        repositorySemester(r.semester) === repositorySemester(sem),
    );
  const available = templates.filter((t) => !exists(t.codigo));
  const visible = templates.filter((t) =>
    `${t.nome} ${t.codigo}`.toLowerCase().includes(query.toLowerCase()),
  );
  const choice = available.filter((t) => selected.includes(t.codigo));
  return (
    <form
      className="repo-checklist"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!choice.length) {
          setError("Selecione ao menos um documento ainda não configurado.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          const g = goals.find((g) => g.id === goal);
          const values = choice.map((t) => ({
            institution_id: institutionId,
            course_id: course?.id ?? null,
            goal_id: goal || null,
            title: t.nome,
            document_code: t.codigo,
            indicator: t.indicadores.join(", "),
            instructions: t.finalidade,
            semester: repositorySemester(sem),
            due_date: due || null,
            assigned_to: owner || g?.owner_user_id || null,
          }));
          const { error } = await supabase
            .from("vertice_repository_requests")
            .insert(values);
          if (error) throw error;
          await onSaved();
          onClose();
        } catch (e) {
          setError(explain(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="repo-intro">
        <div>
          <small>Preparação do acervo</small>
          <h3>
            Configurar checklist ·{" "}
            {String(course?.name ?? "Documentos institucionais")}
          </h3>
          <p>
            Revise os modelos, marque os documentos que serão exigidos e
            confirme a configuração.
          </p>
        </div>
        <button
          type="button"
          className="repo-secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
      </div>
      <div className="repo-form-grid">
        <label>
          Perfil do checklist (confira)
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setSelected([]);
            }}
          >
            <option value="geral">Geral</option>
            <option value="juridica">Jurídico</option>
            <option value="saude">Saúde</option>
          </select>
        </label>
        <label>
          Semestre
          <input
            required
            pattern="[0-9]{4}[-/][12]"
            value={sem}
            onChange={(e) => setSem(e.target.value)}
            placeholder="2026-2"
          />
        </label>
        <label>
          Prazo para as entregas
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        <label>
          Responsável
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Definir depois / responsável da meta</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vincular à meta (opcional)
          <select value={goal} onChange={(e) => setGoal(e.target.value)}>
            <option value="">Sem meta vinculada</option>
            {goals
              .filter((g) => !g.course_id || g.course_id === course?.id)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {String(g.title)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Buscar modelo
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código ou documento"
          />
        </label>
      </div>
      <div className="repo-toolbar">
        <button
          type="button"
          className="repo-secondary"
          onClick={() => setSelected(available.map((t) => t.codigo))}
        >
          Selecionar todos os disponíveis ({available.length})
        </button>
        <button
          type="button"
          className="repo-secondary"
          onClick={() => setSelected([])}
        >
          Limpar seleção
        </button>
        <strong>{choice.length} documentos selecionados</strong>
      </div>
      <div className="repo-template-list">
        {visible.map((t) => (
          <label
            key={t.codigo}
            className={exists(t.codigo) ? "configured" : ""}
          >
            <input
              type="checkbox"
              disabled={busy || exists(t.codigo)}
              checked={selected.includes(t.codigo) && !exists(t.codigo)}
              onChange={(e) =>
                setSelected((v) =>
                  e.target.checked
                    ? [...v, t.codigo]
                    : v.filter((x) => x !== t.codigo),
                )
              }
            />
            <span>
              <strong>{t.nome}</strong>
              <small>
                {t.codigo} · Referências {t.indicadores.join(", ")} ·{" "}
                {t.periodicidade}
                {exists(t.codigo) ? " · Já configurado neste semestre" : ""}
              </small>
            </span>
          </label>
        ))}
      </div>
      <p className="repo-footnote">
        Os modelos aproveitam o catálogo original. Confira a aplicabilidade ao
        PPC, à modalidade e ao período antes de confirmar. A configuração cria
        exigências e pendências; não comprova conformidade regulatória.
      </p>
      {error && (
        <p role="alert" className="area-error">
          {error}
        </p>
      )}
      <button className="corp-button" disabled={busy || !choice.length}>
        {busy
          ? "Configurando…"
          : `Criar ${choice.length} exigências selecionadas`}
      </button>
    </form>
  );
}
