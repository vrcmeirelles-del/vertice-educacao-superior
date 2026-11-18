import { describe, it, expect, vi } from "vitest";
import { analyzePlanning, parsePlanning } from "./planning";
import { buildPlanningSources, checkPlanning } from "./interpretation";
const result = {
  schema_version: 2,
  summary: "Síntese",
  findings: [
    {
      id: "f1",
      type: "lacuna",
      text: "Limites das fontes",
      source_refs: ["/collection_rules"],
      priority: "média",
      audience: "direcao",
    },
  ],
  recommendations: [
    {
      priority: "alta",
      action: "Conferir dados",
      owner_role: "Coordenação",
      timeframe: "Próxima reunião",
      success_indicator: "Fontes conferidas",
      rationale: "Cobertura insuficiente",
      finding_ids: ["f1"],
    },
  ],
  limitations: ["Rascunho"],
};
const context = {
  reference_date: "2026-11-15",
  semester: "2026/2",
  courses: [
    {
      id: "c",
      name: "Direito",
      strategic: {
        id: "p",
        version: 1,
        status: "draft",
        strategic_objectives: [{ theme: "Permanência" }],
      },
      goals: [
        {
          id: "g",
          title: "Indicador registrado",
          status: "concluida",
          target: 80,
          unit: "%",
          direction: "aumentar",
          due_date: "2026-10-01",
          measurements: [
            {
              id: "m1",
              measured_on: "2026-07-01",
              value: 70,
              source: "Cadastro",
            },
            {
              id: "m2",
              measured_on: "2026-09-01",
              value: 60,
              source: "Cadastro",
            },
            {
              id: "m3",
              measured_on: "2026-10-15",
              value: 50,
              source: "Cadastro",
            },
          ],
          documents: [],
        },
      ],
      actions: [],
      objective_links: [],
    },
  ],
};
const adminFixture = () => {
  let saved: any;
  const admin = {
    from: () => ({
      update: (v: any) => {
        saved = v;
        const query: any = {
          eq: () => query,
          select: () => query,
          single: async () => ({ data: { id: "j", status: "pending_review" } }),
        };
        return query;
      },
    }),
  };
  return {
    admin,
    get saved() {
      return saved;
    },
  };
};
describe("Sapiens interpretation and traceability", () => {
  it("rejects malformed output, nonexistent citations, unsupported trends and ungrounded recommendations", () => {
    const sources = buildPlanningSources(context);
    expect(() => parsePlanning("{}", sources)).toThrow();
    expect(() =>
      parsePlanning(
        JSON.stringify({
          ...result,
          findings: [{ ...result.findings[0], source_refs: ["/invented"] }],
        }),
        sources,
      ),
    ).toThrow();
    expect(() =>
      parsePlanning(
        JSON.stringify({
          ...result,
          findings: [{ ...result.findings[0], type: "tendência" }],
        }),
        sources,
      ),
    ).toThrow();
    expect(() =>
      parsePlanning(
        JSON.stringify({
          ...result,
          recommendations: [
            { ...result.recommendations[0], finding_ids: ["invented"] },
          ],
        }),
        sources,
      ),
    ).toThrow();
    expect(parsePlanning(JSON.stringify(result), sources).summary).toBe(
      "Síntese",
    );
  });
  it("distinguishes contradictory records, adverse sequence, missing objective links and insufficient execution evidence", () => {
    const findings = checkPlanning(context);
    expect(
      findings.some((f) => f.type === "fato" && f.text.includes("diverge")),
    ).toBe(true);
    expect(findings.some((f) => f.type === "tendência")).toBe(true);
    expect(findings.some((f) => f.text.includes("sem meta vinculada"))).toBe(
      true,
    );
    expect(
      findings.some((f) => f.text.includes("suporte de execução insuficiente")),
    ).toBe(true);
    const refs = new Set(buildPlanningSources(context).map((s) => s.ref));
    expect(
      findings.every((f) => f.source_refs.every((ref) => refs.has(ref))),
    ).toBe(true);
    expect(findings.some((f) => f.text.includes("taxa de evasão"))).toBe(false);
  });
  it("never converts missing values to zero, ignores future data, duplicate dates, cancelled goals and stale measurements", () => {
    const c = structuredClone(context);
    c.courses[0].goals[0].measurements = [];
    expect(checkPlanning(c).some((f) => f.type === "fato")).toBe(false);
    c.courses[0].goals[0].measurements = [
      { id: "future", measured_on: "2027-01-01", value: 0, source: "Cadastro" },
    ];
    expect(checkPlanning(c).some((f) => f.type === "fato")).toBe(false);
    c.courses[0].goals[0].measurements = [
      { id: "a", measured_on: "2026-10-15", value: 0, source: "Cadastro" },
      { id: "b", measured_on: "2026-10-15", value: 80, source: "Cadastro" },
    ];
    expect(checkPlanning(c).some((f) => f.type === "fato")).toBe(false);
    c.courses[0].goals[0].status = "ativa";
    c.courses[0].goals[0].measurements = [
      { id: "a", measured_on: "2026-09-01", value: 0, source: "Cadastro" },
    ];
    expect(checkPlanning(c).some((f) => f.type === "fato")).toBe(false);
    expect(
      checkPlanning(c).some((f) => f.text.includes("antecede o prazo")),
    ).toBe(true);
    c.courses[0].goals[0].status = "cancelada";
    expect(
      checkPlanning(c).some((f) => f.text.includes("Indicador registrado")),
    ).toBe(false);
  });
  it("preserves zero as an observed value and requires valid frozen mapping, with no text matching", () => {
    const c: any = structuredClone(context);
    c.courses[0].goals[0].measurements = [
      { id: "a", measured_on: "2026-10-15", value: 0, source: "Cadastro" },
    ];
    c.courses[0].objective_links = [
      { id: "l", goal_id: "g", objective_index: 0, valid_for_snapshot: false },
    ];
    expect(
      checkPlanning(c).some((f) => f.type === "fato" && f.text.includes("0 %")),
    ).toBe(true);
    expect(
      checkPlanning(c).some((f) => f.text.includes("sem meta vinculada")),
    ).toBe(true);
    c.courses[0].objective_links[0].valid_for_snapshot = true;
    expect(
      checkPlanning(c).some((f) => f.text.includes("sem meta vinculada")),
    ).toBe(false);
    expect(
      checkPlanning(c).some((f) => f.text.includes("vinculada a objetivo")),
    ).toBe(true);
  });
  it("counts explicitly approved action documents and refuses to treat active uploads as approval", () => {
    const c: any = structuredClone(context);
    c.courses[0].actions = [{ id: "a", goal_id: "g", status: "concluida" }];
    c.courses[0].goals[0].action_documents = [
      { id: "d", status: "active", human_approved: false },
    ];
    expect(
      checkPlanning(c).some((f) =>
        f.text.includes("suporte de execução insuficiente"),
      ),
    ).toBe(true);
    c.courses[0].goals[0].action_documents[0].human_approved = true;
    expect(
      checkPlanning(c).some((f) =>
        f.text.includes("suporte de execução insuficiente"),
      ),
    ).toBe(false);
    expect(
      buildPlanningSources(c).some(
        (s) => s.table === "vertice_documents" && s.record_id === "d",
      ),
    ).toBe(true);
  });
  it("does not invoke providers without institutional authorization", async () => {
    const call = vi.fn();
    const response = await analyzePlanning(
      { rpc: async () => ({ error: { code: "42501", message: "denied" } }) },
      {},
      "i",
      {},
      call,
      call,
    );
    expect(response.status).toBe(403);
    expect(call).not.toHaveBeenCalled();
  });
  it("keeps pending human review even when independent AI suggests proceeding; stores exact sources and hash", async () => {
    const f = adminFixture();
    const response = await analyzePlanning(
      { rpc: async () => ({ data: { id: "j", context } }) },
      f.admin,
      "i",
      {},
      async () => ({ content: JSON.stringify(result), model: "gpt-test" }),
      async () => ({
        content: JSON.stringify({
          notes: "Revisão crítica",
          issues: [],
          recommendation: "proceed",
        }),
        model: "review-test",
      }),
    );
    expect(response.status).toBe(200);
    expect(f.saved.status).toBe("pending_review");
    expect(f.saved.review.available).toBe(true);
    expect(f.saved.result.checks.length).toBeGreaterThan(1);
    expect(f.saved.result.sources.some((s: any) => s.record_id === "m3")).toBe(
      true,
    );
    expect(f.saved.input_hash).toHaveLength(64);
  });
  it("uses the persisted teaching/PDI/evidence context in the provider and source catalog without treating it as a series", async () => {
    const f = adminFixture();
    const teaching = {
      semester: "2026/2",
      eligible_count: 1,
      activities: [
        {
          id: "a1",
          course_id: "c",
          title: "Oficina de sustentabilidade",
          category: "pratica",
          activity_date: "2026-09-25",
          status: "validada",
          pdi_goal_id: "pg1",
          evidence: { id: "memo", status: "approved" },
        },
      ],
      goals: [
        {
          id: "pg1",
          indicator: "Resíduo por semana",
          title: "Reduzir resíduos",
          program_id: "p1",
        },
      ],
      notice: "Contribuição, não medição.",
    };
    const scoped = { ...context, scope: "superior", teaching_pdi: teaching };
    const refs = [
      "/teaching_pdi/activities/0",
      "/teaching_pdi/activities/0/evidence",
      "/teaching_pdi/goals/0",
    ];
    const generated = {
      ...result,
      findings: [{ ...result.findings[0], type: "fato", source_refs: refs }],
    };
    const provider = vi.fn(async (system: string, input: string) => {
      const parsed = JSON.parse(input);
      expect(system).toContain("não uma medição");
      expect(parsed.snapshot.teaching_pdi).toEqual(teaching);
      expect(
        parsed.source_catalog
          .filter((s: any) => refs.includes(s.ref))
          .map((s: any) => s.record_id),
      ).toEqual(["a1", "memo", "pg1"]);
      return { content: JSON.stringify(generated), model: "synthetic-test" };
    });
    const response = await analyzePlanning(
      { rpc: async () => ({ data: { id: "j", context: scoped } }) },
      f.admin,
      "i",
      {},
      provider,
      async () => null,
    );
    expect(response.status).toBe(200);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(
      f.saved.result.sources
        .filter((s: any) => refs.includes(s.ref))
        .every((s: any) => s.series_key === null),
    ).toBe(true);
    expect(f.saved.result.findings[0].source_refs).toEqual(refs);
    expect(
      buildPlanningSources({ ...scoped, scope: "escolas" }).some((s) =>
        s.ref.startsWith("/teaching_pdi"),
      ),
    ).toBe(false);
  });

  it("records missing independent review and uses fallback when primary throws", async () => {
    const f = adminFixture();
    const oai = vi.fn(async () => {
      throw Error("timeout");
    });
    const other = vi.fn(async () => ({
      content: JSON.stringify(result),
      model: "fallback-test",
    }));
    const response = await analyzePlanning(
      { rpc: async () => ({ data: { id: "j", context } }) },
      f.admin,
      "i",
      {},
      oai,
      other,
    );
    expect(response.status).toBe(200);
    expect(f.saved.review.available).toBe(false);
    expect(f.saved.reviewer_model).toBeNull();
    expect(other).toHaveBeenCalledTimes(1);
  });
  it("fails closed on invented citations and oversized context, before a false success or extra provider cost", async () => {
    const f = adminFixture();
    const bad = {
      ...result,
      findings: [{ ...result.findings[0], source_refs: ["/invented"] }],
    };
    let response = await analyzePlanning(
      { rpc: async () => ({ data: { id: "j", context } }) },
      f.admin,
      "i",
      {},
      async () => ({ content: JSON.stringify(bad), model: "test" }),
      async () => null,
    );
    expect(response.status).toBe(502);
    expect(f.saved.status).toBe("failed");
    const call = vi.fn();
    response = await analyzePlanning(
      {
        rpc: async () => ({
          data: { id: "j", context: { extra: "x".repeat(180001) } },
        }),
      },
      f.admin,
      "i",
      {},
      call,
      call,
    );
    expect(response.status).toBe(502);
    expect(call).not.toHaveBeenCalled();
  });
});

describe("Review regressions: observed periods, complete sources and numeric eligibility", () => {
  const trend = (refs: string[], field = "value") => ({
    ...result,
    findings: [
      {
        ...result.findings[0],
        type: "tendência",
        source_refs: refs,
        metric_field: field,
        comparability:
          "Série descritiva do mesmo cadastro; fórmula e população históricas ainda exigem conferência humana.",
      },
    ],
  });
  it("reports missing post-deadline measurement even when the old observation met the target", () => {
    const c: any = structuredClone(context);
    const g = c.courses[0].goals[0];
    g.status = "ativa";
    g.measurements = [
      { id: "old", measured_on: "2026-09-01", value: 80, source: "Cadastro" },
    ];
    expect(
      checkPlanning(c).some(
        (f) => f.type === "lacuna" && f.text.includes("após o vencimento"),
      ),
    ).toBe(true);
    g.target = null;
    expect(
      checkPlanning(c).some((f) => f.text.includes("após o vencimento")),
    ).toBe(true);
    g.measurements.push({
      id: "current",
      measured_on: "2026-10-15",
      value: 80,
      source: "Cadastro",
    });
    expect(
      checkPlanning(c).some((f) => f.text.includes("após o vencimento")),
    ).toBe(false);
  });
  it("retains strategic fields with frozen values, field names, version and update time", () => {
    const c: any = structuredClone(context);
    Object.assign(c.courses[0].strategic, {
      updated_at: "2026-11-14T10:00:00Z",
      swot: { weaknesses: [{ text: "Fragilidade documentada" }] },
      risks: [{ description: "Risco registrado" }],
      operational_objectives: [{ description: "Ação operacional" }],
      vision_text: "Visão registrada",
    });
    const sources = buildPlanningSources(c);
    for (const field of [
      "swot",
      "risks",
      "operational_objectives",
      "vision_text",
    ]) {
      const s: any = sources.find(
        (x) => x.ref === `/courses/0/strategic/${field}`,
      );
      expect(s.record_id).toBe("p");
      expect(s.field).toBe(field);
      expect(s.value.version).toBe(1);
      expect(s.value.updated_at).toBe("2026-11-14T10:00:00Z");
      expect(s.value.value).toEqual(c.courses[0].strategic[field]);
    }
    expect(
      (
        sources.find((x) => x.ref.endsWith("strategic_objectives/0"))
          ?.value as any
      ).updated_at,
    ).toBe("2026-11-14T10:00:00Z");
  });
  it("accepts an explicit numeric metric over three eligible observations, preserving observed zero", () => {
    const c = structuredClone(context);
    c.courses[0].goals[0].measurements[2].value = 0;
    const sources = buildPlanningSources(c);
    const refs = sources.filter((s) => s.series_key).map((s) => s.ref);
    const parsed = parsePlanning(JSON.stringify(trend(refs)), sources);
    expect(parsed.findings[0].metric_field).toBe("value");
    expect(parsed.findings[0].comparability).toContain("conferência humana");
  });
  it("refuses null values, absent sources, duplicate dates, future dates and a missing metric/comparability", () => {
    for (const change of [
      (c: any) => {
        c.courses[0].goals[0].measurements[0].value = null;
      },
      (c: any) => {
        c.courses[0].goals[0].measurements[0].source = "";
      },
      (c: any) => {
        c.courses[0].goals[0].measurements.push({
          ...c.courses[0].goals[0].measurements[0],
          id: "duplicate",
        });
      },
      (c: any) => {
        c.courses[0].goals[0].measurements[0].measured_on = "2027-01-01";
      },
    ]) {
      const c: any = structuredClone(context);
      change(c);
      const sources = buildPlanningSources(c);
      const refs = sources.filter((s) => s.series_key).map((s) => s.ref);
      expect(() =>
        parsePlanning(JSON.stringify(trend(refs)), sources),
      ).toThrow();
    }
    const sources = buildPlanningSources(context);
    const refs = sources.filter((s) => s.series_key).map((s) => s.ref);
    for (const missing of ["metric_field", "comparability"]) {
      const invalid: any = trend(refs);
      delete invalid.findings[0][missing];
      expect(() => parsePlanning(JSON.stringify(invalid), sources)).toThrow();
    }
    expect(() =>
      parsePlanning(JSON.stringify(trend(refs, "target")), sources),
    ).toThrow();
  });
  it("refuses an enrollment trend with unavailable values or ambiguous course codes", () => {
    const c: any = {
      reference_date: "2026-11-15",
      semester: "2026/2",
      courses: [
        {
          id: "c",
          code_matches: 2,
          enrollment_history: ["2025/2", "2026/1", "2026/2"].map(
            (semester, i) => ({
              id: `s${i}`,
              semester,
              matches: 1,
              matriculados: null,
            }),
          ),
        },
      ],
    };
    let sources = buildPlanningSources(c);
    const refs = sources.filter((s) => s.series_key).map((s) => s.ref);
    expect(() =>
      parsePlanning(JSON.stringify(trend(refs, "matriculados")), sources),
    ).toThrow();
    c.courses[0].enrollment_history.forEach((r: any, i: number) => {
      r.matriculados = 100 - i * 10;
    });
    sources = buildPlanningSources(c);
    expect(() =>
      parsePlanning(JSON.stringify(trend(refs, "matriculados")), sources),
    ).toThrow();
    c.courses[0].code_matches = 1;
    sources = buildPlanningSources(c);
    expect(
      parsePlanning(JSON.stringify(trend(refs, "matriculados")), sources)
        .findings[0].type,
    ).toBe("tendência");
    c.courses[0].enrollment_history[1].matches = 2;
    sources = buildPlanningSources(c);
    expect(() =>
      parsePlanning(JSON.stringify(trend(refs, "matriculados")), sources),
    ).toThrow();
  });
  it("accepts learning trends only within one eligible group and for a metric present in every period", () => {
    const c: any = {
      reference_date: "2026-11-15",
      semester: "2026/2",
      courses: [
        {
          id: "c",
          learning_history: ["2025/2", "2026/1", "2026/2"].map(
            (semester, i) => ({
              semester,
              subject_code: "LAW",
              module: "oab",
              competency: "A",
              participants: 10,
              external_accuracy: 0.5 + i / 10,
              curricular_average: null,
            }),
          ),
        },
      ],
    };
    let sources = buildPlanningSources(c);
    const refs = sources.filter((s) => s.series_key).map((s) => s.ref);
    expect(
      parsePlanning(JSON.stringify(trend(refs, "external_accuracy")), sources)
        .findings[0].metric_field,
    ).toBe("external_accuracy");
    expect(() =>
      parsePlanning(JSON.stringify(trend(refs, "curricular_average")), sources),
    ).toThrow();
    c.courses[0].learning_history[0].competency = "B";
    sources = buildPlanningSources(c);
    expect(() =>
      parsePlanning(JSON.stringify(trend(refs, "external_accuracy")), sources),
    ).toThrow();
    c.courses[0].learning_history[0].competency = "A";
    c.courses[0].learning_history[0].participants = 4;
    sources = buildPlanningSources(c);
    expect(() =>
      parsePlanning(JSON.stringify(trend(refs, "external_accuracy")), sources),
    ).toThrow();
  });
});
