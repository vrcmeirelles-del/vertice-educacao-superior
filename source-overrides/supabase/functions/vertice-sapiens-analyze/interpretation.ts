// Pure, deterministic interpretation of the authorized snapshot. No external reads or writes.
type Row = Record<string, any>;
export type Source = {
  ref: string;
  table: string;
  record_id: string | null;
  field: string;
  period: string | null;
  value: unknown;
  series_key: string | null;
};
export type Finding = {
  id: string;
  type: "fato" | "tendência" | "hipótese" | "lacuna";
  text: string;
  source_refs: string[];
  priority: "alta" | "média" | "baixa";
  audience: "coordenacao" | "direcao" | "alta_gestao";
};
const rows = (v: unknown): Row[] =>
  Array.isArray(v)
    ? v.filter((x) => x && typeof x === "object" && !Array.isArray(x))
    : [];
const number = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const pick = (r: Row, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => k in r).map((k) => [k, r[k]]));
export function buildPlanningSources(context: Row): Source[] {
  const sources: Source[] = [];
  const add = (
    ref: string,
    table: string,
    r: Row | null,
    field: string,
    period: string | null,
    value: unknown = r,
    series_key: string | null = null,
  ) =>
    sources.push({
      ref,
      table,
      record_id: r?.id ?? null,
      field,
      period,
      value,
      series_key,
    });
  for (const [i, c] of rows(context.courses).entries()) {
    const p = `/courses/${i}`;
    add(
      `${p}/strategic`,
      "vertice_app.strategic_plans",
      c.strategic,
      "plan",
      null,
      c.strategic
        ? pick(c.strategic, [
            "id",
            "version",
            "status",
            "updated_at",
            "alignment",
          ])
        : null,
    );
    for (const [j, o] of rows(c.strategic?.strategic_objectives).entries())
      add(
        `${p}/strategic/strategic_objectives/${j}`,
        "vertice_app.strategic_plans",
        c.strategic,
        `strategic_objectives[${j}]`,
        null,
        {
          ...o,
          plan_id: c.strategic.id,
          version: c.strategic.version,
          status: c.strategic.status,
        },
      );
    add(
      `${p}/semester`,
      "vertice_app.semester_plannings",
      c.semester,
      "plan",
      c.semester?.semester ?? context.semester ?? null,
    );
    for (const [j, g] of rows(c.goals).entries()) {
      const gp = `${p}/goals/${j}`;
      add(
        gp,
        "vertice_goals",
        g,
        "goal",
        null,
        pick(g, [
          "id",
          "title",
          "indicator",
          "unit",
          "direction",
          "baseline",
          "baseline_date",
          "target",
          "due_date",
          "status",
          "source",
          "updated_at",
        ]),
      );
      for (const [k, m] of rows(g.measurements).entries())
        add(
          `${gp}/measurements/${k}`,
          "vertice_goal_measurements",
          m,
          "value",
          m.measured_on,
          m,
          `${c.id}:goal:${g.id}`,
        );
      for (const [k, d] of rows(g.documents).entries())
        add(
          `${gp}/documents/${k}`,
          "vertice_repository_files",
          d,
          "latest_file",
          d.semester ?? null,
          d,
        );
      for (const [k, d] of rows(g.action_documents).entries())
        add(
          `${gp}/action_documents/${k}`,
          "vertice_documents",
          d,
          "approval_metadata",
          null,
          d,
        );
    }
    for (const [key, table] of [
      ["actions", "vertice_actions"],
      ["objective_links", "vertice_planning.objective_goal_links"],
      ["enrollment_history", "vertice_course_semester_stats"],
      ["learning_history", "vertice_learning_course_metrics"],
    ] as const)
      for (const [j, r] of rows(c[key]).entries())
        add(
          `${p}/${key}/${j}`,
          table,
          r,
          key,
          r.semester ?? r.semestre ?? null,
          r,
          key === "enrollment_history"
            ? r.matches === 1
              ? `${c.id}:enrollment`
              : null
            : key === "learning_history"
              ? `${c.id}:learning:${r.subject_code}:${r.module}:${r.competency}`
              : null,
        );
    for (const key of [
      "goals",
      "actions",
      "enrollment_history",
      "learning_history",
    ])
      add(`${p}/${key}`, "snapshot", null, key, context.semester ?? null, {
        available_records: rows(c[key]).length,
        total_before_limit: c[`${key}_total`] ?? null,
      });
    for (const [key, table] of [
      ["tcc", "v_tcc_course_summary"],
      ["ac", "v_ac_course_summary"],
      ["internship", "v_internship_course_summary"],
      ["permanence", "v_student_evasion_risk"],
    ] as const)
      add(`${p}/${key}`, table, c[key], key, null, c[key] ?? null);
  }
  if (!Array.isArray(context.courses))
    add(
      "/school_context",
      "vertice_planning.school_planning",
      null,
      "school_snapshot",
      context.requested_semester ?? null,
      context,
    );
  // Missing data and collection limits are themselves traceable snapshot facts.
  add(
    "/collection_rules",
    "snapshot",
    null,
    "rules",
    context.semester ?? null,
    context.collection_rules ?? {
      notice: "Contexto legado; verificar períodos e cobertura.",
    },
  );
  return sources;
}
export function checkPlanning(context: Row): Finding[] {
  const out: Finding[] = [];
  const emit = (
    type: Finding["type"],
    text: string,
    source_refs: string[],
    priority: Finding["priority"] = "média",
  ) =>
    out.push({
      id: `check-${out.length + 1}`,
      type,
      text,
      source_refs,
      priority,
      audience: "coordenacao",
    });
  const today = context.reference_date;
  for (const [i, c] of rows(context.courses).entries()) {
    const p = `/courses/${i}`;
    const links = rows(c.objective_links).filter(
      (l) =>
        l.valid_for_snapshot === true &&
        rows(c.goals).some(
          (g) => g.id === l.goal_id && g.status !== "cancelada",
        ),
    );
    for (const [j, o] of rows(c.strategic?.strategic_objectives).entries()) {
      if (!links.some((l) => l.objective_index === j))
        emit(
          "lacuna",
          `${c.name}: objetivo “${o.theme || o.description || j + 1}” sem meta vinculada e confirmada para esta versão.`,
          [`${p}/strategic/strategic_objectives/${j}`],
        );
    }
    for (const [j, g] of rows(c.goals).entries()) {
      if (g.status === "cancelada") continue;
      const gp = `${p}/goals/${j}`;
      const measurements = rows(g.measurements)
        .map((m, k): Row & { ref: string } => ({
          ...m,
          ref: `${gp}/measurements/${k}`,
        }))
        .filter(
          (m) =>
            number(m.value) &&
            /^\d{4}-\d{2}-\d{2}$/.test(m.measured_on) &&
            m.measured_on <= today,
        )
        .sort((a, b) => b.measured_on.localeCompare(a.measured_on));
      const last = measurements[0];
      const sameDate = last
        ? measurements.filter((m) => m.measured_on === last.measured_on)
        : [];
      const unambiguous = last && sameDate.length === 1;
      const sufficient =
        unambiguous &&
        typeof last.source === "string" &&
        last.source.trim().length > 0;
      if (!last)
        emit(
          "lacuna",
          `${c.name}: meta “${g.title}” sem medição disponível até a data de referência; seu resultado não pode ser aferido.`,
          [gp],
          g.status === "concluida" ? "alta" : "média",
        );
      else if (!sufficient)
        emit(
          "lacuna",
          `${c.name}: medição de “${g.title}” ${sameDate.length > 1 ? "ambígua na mesma data" : "sem fonte informada"}; confronto numérico bloqueado.`,
          [gp, ...sameDate.map((m) => m.ref)],
          "alta",
        );
      const validatedDocs = [
        ...rows(g.documents).filter(
          (d) => d.status === "validado" && d.not_applicable !== true,
        ),
        ...rows(g.action_documents).filter((d) => d.human_approved === true),
      ];
      const actions = rows(c.actions).filter(
        (a) => a.goal_id === g.id && a.status !== "cancelada",
      );
      if (
        g.status === "concluida" &&
        (!sufficient ||
          !validatedDocs.length ||
          !actions.some((a) => a.status === "concluida"))
      )
        emit(
          "lacuna",
          `${c.name}: meta “${g.title}” declarada concluída com suporte de execução insuficiente nas fontes consultadas (medição com fonte, ação concluída e documento validado ou aprovado são verificados separadamente).`,
          [
            gp,
            `${p}/actions`,
            ...rows(g.documents).map((_, k) => `${gp}/documents/${k}`),
            ...rows(g.action_documents).map(
              (_, k) => `${gp}/action_documents/${k}`,
            ),
          ],
          "alta",
        );
      if (
        !unambiguous ||
        !sufficient ||
        !number(g.target) ||
        !["aumentar", "reduzir", "manter"].includes(g.direction)
      )
        continue;
      const offTarget =
        g.direction === "aumentar"
          ? last.value < g.target
          : g.direction === "reduzir"
            ? last.value > g.target
            : last.value !== g.target;
      const isDue =
        typeof g.due_date === "string" &&
        g.due_date <= today &&
        last.measured_on >= g.due_date;
      const linked = links.filter((l) => l.goal_id === g.id);
      if (offTarget && (g.status === "concluida" || isDue))
        emit(
          "fato",
          `${c.name}: ${g.status === "concluida" ? "conclusão declarada" : "alvo vencido"} de “${g.title}” diverge da medição registrada: ${last.value} ${g.unit || ""}, alvo ${g.target}, direção ${g.direction}. ${linked.length ? "A meta está vinculada a objetivo estratégico desta versão." : "O vínculo ao objetivo ainda não foi confirmado."} Isso não determina a causa do desvio.`,
          [
            gp,
            last.ref,
            ...linked.map(
              (l) =>
                `${p}/objective_links/${rows(c.objective_links).indexOf(l)}`,
            ),
          ],
          "alta",
        );
      // A stale measurement before the deadline cannot establish failure at that deadline.
      if (
        offTarget &&
        g.due_date &&
        g.due_date <= today &&
        last.measured_on < g.due_date
      )
        emit(
          "lacuna",
          `${c.name}: última medição de “${g.title}” antecede o prazo da meta; falta aferição após o vencimento.`,
          [gp, last.ref],
        );
      const series = measurements
        .filter(
          (m) =>
            m.source?.trim() &&
            measurements.filter((x) => x.measured_on === m.measured_on)
              .length === 1,
        )
        .slice(0, 3)
        .reverse();
      if (series.length === 3) {
        const diffs = [
          series[1].value - series[0].value,
          series[2].value - series[1].value,
        ];
        const adverse =
          g.direction === "aumentar"
            ? diffs.every((d) => d < 0)
            : g.direction === "reduzir"
              ? diffs.every((d) => d > 0)
              : false;
        if (adverse)
          emit(
            "tendência",
            `${c.name}: “${g.title}” apresenta três medições sucessivas em sentido contrário à direção da meta (${series.map((m) => m.value).join(" → ")}). Série descritiva da mesma meta cadastral; comparabilidade da definição e da população exige revisão.`,
            [gp, ...series.map((m) => m.ref)],
            "alta",
          );
      }
    }
    const history = rows(c.enrollment_history);
    if (history.some((h) => h.matches !== 1))
      emit(
        "lacuna",
        `${c.name}: existem períodos com registros acadêmicos ambíguos; valores desses períodos foram mantidos indisponíveis.`,
        history.map((_, j) => `${p}/enrollment_history/${j}`),
      );
  }
  return out;
}
