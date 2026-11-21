import { describe, it, expect } from "vitest";
import { analyzePlanning } from "./planning";
import { buildPlanningSources, checkPlanning } from "./interpretation";
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
  it("does not start an analysis without institutional authorization", async () => {
    const response = await analyzePlanning(
      { rpc: async () => ({ error: { code: "42501", message: "denied" } }) },
      {},
      "i",
      {},
    );
    expect(response.status).toBe(403);
  });
  it("grava relatório por regras, pendente de revisão humana, com fontes exatas e hash do snapshot", async () => {
    const f = adminFixture();
    const response = await analyzePlanning(
      { rpc: async () => ({ data: { id: "j", context } }) },
      f.admin,
      "i",
      {},
    );
    expect(response.status).toBe(200);
    expect(f.saved.status).toBe("pending_review");
    expect(f.saved.generator_model).toBe("regras");
    expect(f.saved.reviewer_model).toBeNull();
    expect(f.saved.review.available).toBe(false);
    expect(f.saved.result.summary).toMatch(/Relatório por regras/);
    expect(f.saved.result.checks.length).toBeGreaterThan(1);
    for (const r of f.saved.result.recommendations) expect(r.finding_ids[0]).toMatch(/^check-/);
    expect(f.saved.result.sources.some((s: any) => s.record_id === "m3")).toBe(true);
    expect(f.saved.input_hash).toHaveLength(64);
  });
  it("cataloga o contexto de ensino/PDI/evidências sem tratá-lo como série", async () => {
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
      goals: [{ id: "pg1", indicator: "Resíduo por semana", title: "Reduzir resíduos", program_id: "p1" }],
      notice: "Contribuição, não medição.",
    };
    const scoped = { ...context, scope: "superior", teaching_pdi: teaching };
    const refs = ["/teaching_pdi/activities/0", "/teaching_pdi/activities/0/evidence", "/teaching_pdi/goals/0"];
    const response = await analyzePlanning(
      { rpc: async () => ({ data: { id: "j", context: scoped } }) },
      f.admin,
      "i",
      {},
    );
    expect(response.status).toBe(200);
    const catalogued = f.saved.result.sources.filter((s: any) => refs.includes(s.ref));
    expect(catalogued.map((s: any) => s.record_id)).toEqual(["a1", "memo", "pg1"]);
    expect(catalogued.every((s: any) => s.series_key === null)).toBe(true);
    expect(
      buildPlanningSources({ ...scoped, scope: "escolas" }).some((s) => s.ref.startsWith("/teaching_pdi")),
    ).toBe(false);
  });
  it("falha fechado com recorte muito extenso", async () => {
    const f = adminFixture();
    const response = await analyzePlanning(
      { rpc: async () => ({ data: { id: "j", context: { extra: "x".repeat(180001) } } }) },
      f.admin,
      "i",
      {},
    );
    expect(response.status).toBe(502);
    expect(f.saved.status).toBe("failed");
  });
});

describe("Review regressions: observed periods, complete sources and numeric eligibility", () => {
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
});
