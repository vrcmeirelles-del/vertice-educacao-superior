import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import "../bi/planning/management.css";
type Props = {
  institutionId: string;
  semester?: string;
  courseId?: string;
  school?: boolean;
};
type Item = Record<string, any>;
const STATUS: Record<string, string> = {
  generating: "Em geração",
  pending_review: "Aguardando revisão da gestão",
  reviewed: "Revisado pela gestão",
  rejected: "Devolvido pela gestão",
  failed: "Geração não concluída",
};
const AUDIENCE: Record<string, string> = {
  coordenacao: "Coordenação",
  direcao: "Direção acadêmica",
  alta_gestao: "Alta gestão",
};
const PRIORITY: Record<string, number> = { alta: 0, média: 1, baixa: 2 };
// Scope changes remount the stateful panel, including pending mutation callbacks and notes.
export default function SapiensPlanning(props: Props) {
  return (
    <PlanningAnalysis
      key={`${props.institutionId}:${props.courseId || ""}:${props.semester || ""}:${props.school || false}`}
      {...props}
    />
  );
}
function Sources({ refs, sources }: { refs: string[]; sources: Item[] }) {
  return (
    <details className="sp-sources">
      <summary>Conferir fontes do snapshot ({refs.length})</summary>
      {refs.map((ref) => {
        const source = sources.find((s) => s.ref === ref);
        return source ? (
          <article key={ref}>
            <strong>{source.table}</strong>
            <p>
              Registro: {source.record_id || "agregado ou ausência registrada"}{" "}
              · Campo: {source.field} · Período:{" "}
              {source.period || "cadastro atual"}
            </p>
            <code>{ref}</code>
            <pre>{JSON.stringify(source.value, null, 2)}</pre>
          </article>
        ) : (
          <p role="alert" key={ref}>
            Referência indisponível: {ref}
          </p>
        );
      })}
    </details>
  );
}
function IndicatorDefinition({ value }: { value?: Item }) {
  if (!value) return null;
  return (
    <dl>
      {Object.entries({
        indicator: "Indicador",
        unit: "Unidade",
        direction: "Direção",
        formula: "Fórmula",
        population: "População",
      })
        .filter(([key]) => value[key] != null)
        .map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {typeof value[key] === "object"
                ? JSON.stringify(value[key])
                : String(value[key])}
            </dd>
          </div>
        ))}
    </dl>
  );
}
function PlanningAnalysis({
  institutionId,
  semester,
  courseId,
  school,
}: Props) {
  const [selected, setSelected] = useState(courseId || ""),
    [courses, setCourses] = useState<Item[]>([]),
    [options, setOptions] = useState<Item>({
      scope: school ? "escolas" : "superior",
      can_review: false,
      institutional: false,
    }),
    [rows, setRows] = useState<Item[]>([]),
    [links, setLinks] = useState<Item | null>(null),
    [loadedKey, setLoadedKey] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [type, setType] = useState("all"),
    [audience, setAudience] = useState("all"),
    [objective, setObjective] = useState(""),
    [goal, setGoal] = useState(""),
    [rationale, setRationale] = useState("");
  const requestKey = `${institutionId}:${selected}:${semester || ""}`;
  useEffect(() => {
    let active = true;
    setError("");
    setLoading(true);
    setRows([]);
    setLinks(null);
    setNotes({});
    setObjective("");
    setGoal("");
    setRationale("");
    const rpc = (action: string) =>
      supabase.rpc("vertice_sapiens_planning", {
        p_institution_id: institutionId,
        p_action: action,
        p_payload: { course_id: selected || null, semester: semester || null },
      });
    Promise.all([
      rpc("options"),
      rpc("list"),
      selected && !school
        ? rpc("links")
        : Promise.resolve({ data: null, error: null }),
    ])
      .then(([o, h, l]) => {
        if (!active) return;
        if (o.error || h.error || l.error) throw o.error || h.error || l.error;
        setOptions(o.data || {});
        setCourses(o.data?.courses || []);
        setRows(h.data || []);
        setLinks(l.data);
        setLoadedKey(requestKey);
      })
      .catch((e) => {
        if (active) {
          setOptions({ can_review: false, institutional: false });
          setError(e.message || "Falha ao consultar pareceres Sapiens");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [institutionId, selected, semester, tick, school]);
  const fresh = loadedKey === requestKey && !loading;
  const scope = options.scope || "superior";
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.functions.invoke(
        "vertice-sapiens-analyze",
        {
          body: {
            action: "planning",
            institutionId,
            courseId: scope === "escolas" ? null : selected || null,
            semester: semester || null,
          },
        },
      );
      if (error) {
        let message = error.message;
        try {
          const detail = await error.context?.json();
          message = detail?.error || message;
        } catch {}
        throw new Error(message);
      }
      if (!data?.ok) throw new Error(data?.error || "Parecer indisponível");
      setTick((t) => t + 1);
    } catch (e: any) {
      setError(e.message || "Falha na análise pelo Sapiens");
    } finally {
      setBusy(false);
    }
  };
  const mutate = async (action: string, payload: Item) => {
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.rpc("vertice_sapiens_planning", {
        p_institution_id: institutionId,
        p_action: action,
        p_payload: {
          ...payload,
          course_id: selected || null,
          semester: semester || null,
        },
      });
      if (error) throw error;
      setTick((t) => t + 1);
    } catch (e: any) {
      setError(e.message || "Não foi possível registrar a operação");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="planning-management sapiens-planning"
      aria-label="Análise interpretativa pelo Sapiens"
    >
      <header>
        <div>
          <p className="pm-eyebrow">SAPIENS · PLANEJAMENTO E EVIDÊNCIAS</p>
          <h2>Análise interpretativa dos planejamentos</h2>
          <p>
            Objetivos, resultados e execução com justificativas para a decisão
            gerencial.
          </p>
        </div>
      </header>
      <p className="pm-note">
        Usa versões salvas, incluindo rascunhos identificados. Salve as
        alterações antes de gerar. Pareceres são propostas sujeitas à
        verificação humana. Revisar um parecer não publica planos nem cria
        intervenções.
      </p>
      {scope !== "escolas" && !courseId && (
        <label className="sp-field">
          Curso da análise
          <select
            aria-label="Curso da análise Sapiens"
            disabled={busy || loading}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {options.institutional ? (
              <option value="">Todos os cursos com planejamento</option>
            ) : (
              <option value="">Selecione um curso autorizado</option>
            )}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="pm-filters">
        <button
          type="button"
          disabled={busy || !fresh || (!options.institutional && !selected)}
          onClick={run}
        >
          {busy ? "Sapiens trabalhando…" : "Gerar análise pelo Sapiens"}
        </button>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => setTick((t) => t + 1)}
        >
          Atualizar pareceres
        </button>
        <span>
          {semester
            ? `Recorte acadêmico: ${semester}`
            : "Recorte acadêmico mais recente"}{" "}
          · {scope === "escolas" ? "Escola" : "Educação Superior"} ·{" "}
          {AUDIENCE[options.audience] || "Verificando acesso"}
        </span>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Consultando Sapiens…</p>}
      {busy && (
        <p role="status">
          Aguarde a conclusão. A geração e a revisão por IA podem levar alguns
          minutos.
        </p>
      )}
      {fresh && links?.plan && (
        <details className="sp-links">
          <summary>
            Vincular objetivos, metas e indicadores · v{links.plan.version} (
            {links.plan.status === "published" ? "publicada" : "rascunho"})
          </summary>
          <p className="pm-note">
            Confirme relações por escolha explícita. A meta fornece indicador,
            unidade, direção e medições. Alterar o objetivo, a definição do
            indicador ou criar outra versão exige conferir os vínculos
            novamente. Esta associação não altera o planejamento nem comprova
            alinhamento ao PDI.
          </p>
          <div className="sp-link-grid">
            <label className="sp-field">
              Objetivo estratégico
              <select
                aria-label="Objetivo do vínculo"
                disabled={busy}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              >
                <option value="">Selecione o objetivo</option>
                {(links.plan.strategic_objectives || []).map(
                  (o: Item, i: number) => (
                    <option key={i} value={i}>
                      {o.theme || o.description || `Objetivo ${i + 1}`}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="sp-field">
              Meta e indicador
              <select
                aria-label="Meta do vínculo"
                disabled={busy}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              >
                <option value="">Selecione a meta</option>
                {links.goals.map((g: Item) => (
                  <option key={g.id} value={g.id}>
                    {g.title} · {g.indicator}
                  </option>
                ))}
              </select>
            </label>
            <label className="sp-field">
              Justificativa do vínculo
              <textarea
                aria-label="Justificativa do vínculo"
                maxLength={2000}
                value={rationale}
                disabled={busy}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Explique como o indicador mede este objetivo (mínimo 10 caracteres)"
              />
            </label>
          </div>
          {goal && (
            <details>
              <summary>Definição atual do indicador selecionado</summary>
              <IndicatorDefinition
                value={
                  links.goals.find((g: Item) => g.id === goal)
                    ?.indicator_definition
                }
              />
            </details>
          )}
          <button
            type="button"
            disabled={
              busy || objective === "" || !goal || rationale.trim().length < 10
            }
            onClick={() =>
              mutate("link_objective", {
                plan_id: links.plan.id,
                expected_updated_at: links.plan.updated_at,
                objective_index: Number(objective),
                goal_id: goal,
                expected_goal_updated_at: links.goals.find(
                  (g: Item) => g.id === goal,
                )?.updated_at,
                expected_indicator_definition: links.goals.find(
                  (g: Item) => g.id === goal,
                )?.indicator_definition,
                rationale,
              })
            }
          >
            Registrar vínculo justificado
          </button>
          {!links.links.length ? (
            <p>Nenhum vínculo confirmado nesta versão.</p>
          ) : (
            links.links.map((l: Item) => (
              <article key={l.id}>
                <strong>
                  {links.plan.strategic_objectives?.[l.objective_index]
                    ?.theme || `Objetivo ${l.objective_index + 1}`}{" "}
                  →{" "}
                  {links.goals.find((g: Item) => g.id === l.goal_id)?.title ||
                    "Meta arquivada ou indisponível"}
                </strong>
                <p>
                  {l.valid_for_snapshot
                    ? "Vínculo compatível com o objetivo e o indicador salvos"
                    : l.objective_matches !== true
                      ? "Objetivo alterado — vínculo exige revisão"
                      : "Meta ou definição do indicador alterada — vínculo exige revisão"}
                  . {l.rationale}
                </p>
                {l.indicator_snapshot && (
                  <details>
                    <summary>Indicador confirmado no vínculo</summary>
                    <IndicatorDefinition value={l.indicator_snapshot} />
                  </details>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    mutate("unlink_objective", {
                      id: l.id,
                      plan_id: links.plan.id,
                      expected_updated_at: links.plan.updated_at,
                    })
                  }
                >
                  Encerrar vínculo
                </button>
              </article>
            ))
          )}
        </details>
      )}
      {fresh && (
        <>
          <div className="sp-link-grid">
            <label className="sp-field">
              Tipo de achado
              <select
                aria-label="Tipo de achado"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="all">Todos os tipos</option>
                {["fato", "tendência", "hipótese", "lacuna"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            {options.institutional && (
              <label className="sp-field">
                Foco gerencial
                <select
                  aria-label="Foco gerencial"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                >
                  <option value="all">Todos os níveis</option>
                  {Object.entries(AUDIENCE).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="pm-note">
            Histórico: até 20 pareceres deste recorte. Comparações longitudinais
            utilizam até 8 semestres acadêmicos, 24 medições por meta e 100
            grupos de aprendizagem; limites e totais são registrados no
            snapshot. Ações e documentos mostram o cadastro atual. Dados
            posteriores exigem nova geração.
          </p>
          {!rows.length && <p>Nenhum parecer neste recorte.</p>}
          {rows.map((row, i) => {
            const result = row.result || {};
            const findings = [
              ...(result.checks || []),
              ...(result.findings || []),
            ];
            const shown = findings
              .filter(
                (f) =>
                  (type === "all" || f.type === type) &&
                  (audience === "all" || f.audience === audience),
              )
              .sort(
                (a, b) =>
                  (PRIORITY[a.priority] ?? 1) - (PRIORITY[b.priority] ?? 1),
              );
            const sources = result.sources || [];
            return (
              <details className="sp-opinion" key={row.id} open={i === 0}>
                <summary>
                  {new Date(row.created_at).toLocaleString("pt-BR")} ·{" "}
                  {STATUS[row.status] || row.status} ·{" "}
                  {row.course_id
                    ? courses.find((c) => c.id === row.course_id)?.name ||
                      "Curso"
                    : "Institucional"}
                </summary>
                {row.result && (
                  <>
                    <p className="pm-note">
                      <strong>
                        Parecer de IA — sujeito à verificação humana.
                      </strong>{" "}
                      Referência: {result.reference_date || "formato anterior"}.
                      Referência encontrada no snapshot não comprova que a
                      interpretação esteja correta.
                    </p>
                    <p>{result.summary}</p>
                    <div className="pm-kpis">
                      {[
                        ["fato", "Fatos registrados"],
                        ["tendência", "Tendências"],
                        ["hipótese", "Hipóteses"],
                        ["lacuna", "Lacunas"],
                      ].map(([key, label]) => (
                        <article key={key}>
                          <strong>
                            {findings.filter((f) => f.type === key).length}
                          </strong>
                          <span>{label}</span>
                        </article>
                      ))}
                    </div>
                    <h3>Achados e justificativas</h3>
                    {!shown.length && <p>Nenhum achado neste filtro.</p>}
                    {shown.map((f: Item, j: number) => (
                      <article className="sp-finding" key={f.id || j}>
                        <span
                          className={`sp-badge sp-${f.type === "hipótese" ? "hypothesis" : f.type === "lacuna" ? "gap" : "fact"}`}
                        >
                          {f.type} · {f.priority || "sem prioridade"}
                        </span>
                        <p>{f.text}</p>
                        {f.type === "tendência" && f.metric_field && (
                          <p className="pm-note">
                            Campo numérico: {f.metric_field}. Comparabilidade
                            declarada: {f.comparability}
                          </p>
                        )}
                        <small>
                          {f.id?.startsWith("check-")
                            ? "Regra de conferência do cadastro"
                            : "Interpretação de IA"}{" "}
                          · {AUDIENCE[f.audience] || "parecer anterior"} ·{" "}
                          {f.id || `legado-${j + 1}`}
                        </small>
                        {f.source_refs ? (
                          <Sources refs={f.source_refs} sources={sources} />
                        ) : (
                          <p className="pm-note">
                            Evidência declarada pela IA em formato anterior, sem
                            referência estruturada: {f.evidence}
                          </p>
                        )}
                      </article>
                    ))}
                    <h3>Prioridades de intervenção propostas</h3>
                    {result.recommendations?.map((r: Item, j: number) => (
                      <article className="sp-finding" key={j}>
                        <strong>
                          {r.priority} · {r.action}
                        </strong>
                        <p>{r.rationale}</p>
                        <p>
                          Papel sugerido: {r.owner_role} · Prazo proposto:{" "}
                          {r.timeframe}
                        </p>
                        <p>Verificação: {r.success_indicator}</p>
                        <small>
                          Justificativa nos achados:{" "}
                          {r.finding_ids?.join(", ") || "formato anterior"}
                        </small>
                      </article>
                    ))}
                    <h3>Limitações</h3>
                    <ul>
                      {result.limitations?.map((l: string, j: number) => (
                        <li key={j}>{l}</li>
                      ))}
                    </ul>
                    <h3>Revisão crítica por IA</h3>
                    <p>
                      {row.review?.available
                        ? `Revisor: ${row.reviewer_model}`
                        : "Segunda IA indisponível — sem revisão independente confirmada."}
                    </p>
                    <p>{row.review?.notes}</p>
                    <ul>
                      {row.review?.issues?.map((l: string, j: number) => (
                        <li key={j}>{l}</li>
                      ))}
                    </ul>
                    <p>
                      Encaminhamento do revisor: {row.review?.recommendation}
                    </p>
                    <details>
                      <summary>Rastreabilidade do parecer</summary>
                      <p>
                        Gerador: {row.generator_model} · Registro: {row.id}
                      </p>
                      <p className="sp-hash">
                        SHA-256 do contexto armazenado: {row.input_hash}
                      </p>
                      <p>
                        {result.traceability ||
                          "Parecer anterior ao catálogo de fontes estruturado."}
                      </p>
                    </details>
                    {row.status === "pending_review" &&
                      (options.can_review ? (
                        <div className="sp-review">
                          <label className="sp-field">
                            Justificativa da gestão
                            <textarea
                              aria-label={`Justificativa ${row.id}`}
                              value={notes[row.id] || ""}
                              maxLength={4000}
                              onChange={(e) =>
                                setNotes((n) => ({
                                  ...n,
                                  [row.id]: e.target.value,
                                }))
                              }
                              placeholder="Registre sua avaliação do parecer (mínimo 10 caracteres)"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={
                              busy || (notes[row.id] || "").trim().length < 10
                            }
                            onClick={() =>
                              mutate("review", {
                                id: row.id,
                                status: "reviewed",
                                note: notes[row.id],
                              })
                            }
                          >
                            Registrar revisão da gestão
                          </button>
                          <button
                            type="button"
                            disabled={
                              busy || (notes[row.id] || "").trim().length < 10
                            }
                            onClick={() =>
                              mutate("review", {
                                id: row.id,
                                status: "rejected",
                                note: notes[row.id],
                              })
                            }
                          >
                            Devolver parecer
                          </button>
                        </div>
                      ) : (
                        <p className="pm-note">
                          A revisão gerencial deste parecer cabe à direção ou à
                          alta gestão autorizada.
                        </p>
                      ))}
                    {row.reviewed_at && (
                      <p>
                        Revisão humana em{" "}
                        {new Date(row.reviewed_at).toLocaleString("pt-BR")}:{" "}
                        {row.review_note}
                      </p>
                    )}
                  </>
                )}
                {row.status === "failed" && (
                  <p>
                    Não houve parecer concluído. Verifique os provedores e tente
                    novamente.
                  </p>
                )}
              </details>
            );
          })}
        </>
      )}
    </section>
  );
}
