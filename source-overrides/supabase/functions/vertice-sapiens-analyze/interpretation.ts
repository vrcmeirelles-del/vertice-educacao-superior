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
  series_eligible?: boolean;
  numeric_fields?: string[];
  series_definition?: unknown;
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
const hasText = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;
const observedPeriod = (period: unknown, context: Row): boolean => {
  const reference = context.reference_date;
  if (typeof period !== "string" || typeof reference !== "string") return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const date = new Date(period);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === period &&
      period <= reference
    );
  }
  if (!/^\d{4}\/[12]$/.test(period)) return false;
  const limit = `${reference.slice(0, 4)}/${reference.slice(5, 7) <= "06" ? 1 : 2}`;
  return period <= limit && (!context.semester || period <= context.semester);
};
const pointer = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");
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
    series?: Pick<
      Source,
      "series_eligible" | "numeric_fields" | "series_definition"
    >,
  ) =>
    sources.push({
      ref,
      table,
      record_id: r?.id ?? null,
      field,
      period,
      value,
      series_key,
      ...(series || {}),
    });
  for (const [i, c] of rows(context.courses).entries()) {
    const p = `/courses/${i}`;
    add(
      `${p}/strategic`,
      "vertice_app.strategic_plans",
      c.strategic,
      "plan_metadata",
      null,
      c.strategic
        ? pick(c.strategic, ["id", "version", "status", "updated_at"])
        : null,
    );
    // Every strategic field sent to the model is available for human inspection.
    // Keep objectives individually addressable and avoid duplicating the whole plan.
    if (c.strategic) {
      for (const [key, value] of Object.entries(c.strategic)) {
        if (
          [
            "id",
            "version",
            "status",
            "updated_at",
            "strategic_objectives",
          ].includes(key)
        )
          continue;
        add(
          `${p}/strategic/${pointer(key)}`,
          "vertice_app.strategic_plans",
          c.strategic,
          key,
          null,
          {
            ...pick(c.strategic, ["id", "version", "status", "updated_at"]),
            value,
          },
        );
      }
    }
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
          updated_at: c.strategic.updated_at,
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
          "indicator_definition",
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
          {
            series_eligible:
              g.status !== "cancelada" &&
              hasText(m.source) &&
              observedPeriod(m.measured_on, context) &&
              rows(g.measurements).filter(
                (r) => r.measured_on === m.measured_on,
              ).length === 1,
            numeric_fields: number(m.value) ? ["value"] : [],
            series_definition:
              g.indicator_definition ||
              pick(g, ["indicator", "unit", "direction"]),
          },
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
      for (const [j, r] of rows(c[key]).entries()) {
        const enrollment = key === "enrollment_history";
        const learning = key === "learning_history";
        const period = r.semester ?? r.semestre ?? null;
        const unique =
          !(enrollment || learning) ||
          rows(c[key]).filter(
            (other) =>
              (other.semester ?? other.semestre) === period &&
              (!learning ||
                (other.subject_code === r.subject_code &&
                  other.module === r.module &&
                  other.competency === r.competency)),
          ).length === 1;
        add(
          `${p}/${key}/${j}`,
          table,
          r,
          key,
          period,
          r,
          enrollment
            ? `${c.id}:enrollment`
            : learning
              ? `${c.id}:learning:${JSON.stringify([r.subject_code, r.module, r.competency])}`
              : null,
          enrollment || learning
            ? {
                series_eligible:
                  observedPeriod(period, context) &&
                  unique &&
                  (enrollment
                    ? r.matches === 1 && c.code_matches === 1
                    : number(r.participants) && r.participants >= 5),
                numeric_fields: (enrollment
                  ? [
                      "matriculados",
                      "abandono",
                      "trancado",
                      "cancelado",
                      "transferido",
                    ]
                  : [
                      "participants",
                      "paired_students",
                      "curricular_average",
                      "external_accuracy",
                      "activity_rate",
                    ]
                ).filter((field) => number(r[field])),
                series_definition: enrollment
                  ? {
                      course_id: c.id,
                      population:
                        "Estoque declarado do curso; sem coorte verificada",
                    }
                  : {
                      course_id: c.id,
                      subject_code: r.subject_code,
                      module: r.module,
                      competency: r.competency,
                      population:
                        "Participantes do grupo; comparabilidade histórica exige conferência",
                    },
              }
            : undefined,
        );
      }
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
  // Current, authorized operational metadata: never a measurement series.
  const teaching = context.teaching_pdi;
  if (
    teaching &&
    typeof teaching === "object" &&
    context.scope === "superior"
  ) {
    add(
      "/teaching_pdi",
      "snapshot",
      null,
      "teaching_pdi_scope",
      teaching.semester ?? null,
      {
        semester: teaching.semester ?? null,
        eligible_count: teaching.eligible_count ?? null,
        available_records: rows(teaching.activities).length,
        notice: teaching.notice ?? null,
      },
    );
    for (const [i, activity] of rows(teaching.activities).entries()) {
      add(
        `/teaching_pdi/activities/${i}`,
        "vertice_teaching_activities",
        activity,
        "validated_activity_metadata",
        activity.activity_date ?? null,
        pick(activity, [
          "id",
          "course_id",
          "course_name",
          "title",
          "category",
          "activity_date",
          "status",
          "ods_goal",
          "exam_module",
          "updated_at",
          "pdi_goal_id",
        ]),
      );
      if (activity.evidence && typeof activity.evidence.id === "string")
        add(
          `/teaching_pdi/activities/${i}/evidence`,
          "vertice_documents",
          activity.evidence,
          "linked_document_status",
          null,
          pick(activity.evidence, ["id", "status"]),
        );
    }
    for (const [i, goal] of rows(teaching.goals).entries())
      add(
        `/teaching_pdi/goals/${i}`,
        "vertice_goals",
        goal,
        "pdi_goal_metadata",
        null,
        pick(goal, [
          "id",
          "title",
          "indicator",
          "due_date",
          "status",
          "expected_result",
          "program_id",
          "program_title",
        ]),
      );
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
      // The absence of a post-deadline observation is independent of the old value.
      if (
        last &&
        g.due_date &&
        g.due_date <= today &&
        last.measured_on < g.due_date
      )
        emit(
          "lacuna",
          `${c.name}: última medição de “${g.title}” antecede o prazo da meta; falta aferição após o vencimento.`,
          [gp, last.ref],
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
