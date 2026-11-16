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
