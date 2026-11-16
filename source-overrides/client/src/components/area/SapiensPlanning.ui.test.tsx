import { it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
const { rpc, invoke } = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc, functions: { invoke } } }));
import SapiensPlanning from "./SapiensPlanning";
let root: Root;
let el: HTMLDivElement;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  el?.remove();
  rpc.mockReset();
  invoke.mockReset();
});
async function render(props: any) {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  await act(async () => root.render(<SapiensPlanning {...props} />));
}
const row = (id = "opinion", type = "fato") => ({
  id,
  course_id: "c1",
  semester: "2026/2",
  created_at: "2026-11-15T12:00:00Z",
  status: "pending_review",
  result: {
    schema_version: 2,
    summary: "Síntese do curso autorizado",
    checks: [],
    findings: [
      {
        id: "f1",
        type,
        text: "Meta declarada concluída diverge da medição",
        priority: "alta",
        audience: "coordenacao",
        source_refs: ["/g1"],
      },
    ],
    recommendations: [
      {
        priority: "alta",
        action: "Conferir execução",
        rationale: "Medição divergente",
        finding_ids: ["f1"],
      },
    ],
    sources: [
      {
        ref: "/g1",
        table: "vertice_goals",
        record_id: "goal-1",
        field: "goal",
        period: "2026/2",
        value: { target: 80 },
      },
    ],
    limitations: ["Dados do cadastro atual"],
  },
  review: { available: false },
  input_hash: "hash-synthetic",
});
function mock(rows = [row()], canReview = false) {
  rpc.mockImplementation(async (_name: any, args: any) => ({
    error: null,
    data:
      args.p_action === "options"
        ? {
            scope: "superior",
            can_review: canReview,
            institutional: canReview,
            audience: canReview ? "alta_gestao" : "coordenacao",
            courses: [{ id: "c1", name: "Direito" }],
          }
        : args.p_action === "links"
          ? { plan: null }
          : rows,
  }));
}
it("loads a course-scoped history, distinguishes categories and exposes exact record sources without managerial review to coordinator", async () => {
  mock();
  await render({ institutionId: "ies-a", courseId: "c1", semester: "2026/2" });
  expect(rpc).toHaveBeenCalledWith("vertice_sapiens_planning", {
    p_institution_id: "ies-a",
    p_action: "list",
    p_payload: { course_id: "c1", semester: "2026/2" },
  });
  expect(el.textContent).toContain("goal-1");
  expect(el.textContent).toContain("vertice_goals");
  expect(el.textContent).toContain("Tendências");
  expect(el.textContent).toContain("Medição divergente");
  expect(el.textContent).not.toContain("Registrar revisão da gestão");
  expect(el.textContent).toContain("cabe à direção");
  expect(el.textContent).toContain("não publica planos");
});
it("filters hypotheses separately and keeps generation tied to the authorized course and semester", async () => {
  mock([row("opinion", "hipótese")]);
  invoke.mockResolvedValue({ data: { ok: true }, error: null });
  await render({ institutionId: "ies-a", courseId: "c1", semester: "2026/2" });
  const filter = el.querySelector(
    '[aria-label="Tipo de achado"]',
  ) as HTMLSelectElement;
  await act(async () => {
    filter.value = "fato";
    filter.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(el.textContent).toContain("Nenhum achado neste filtro.");
  const generate = Array.from(el.querySelectorAll("button")).find(
    (b) => b.textContent === "Gerar análise pelo Sapiens",
  )!;
  await act(async () => generate.click());
  expect(invoke).toHaveBeenCalledWith("vertice-sapiens-analyze", {
    body: {
      action: "planning",
      institutionId: "ies-a",
      courseId: "c1",
      semester: "2026/2",
    },
  });
});
it("discards the prior institution snapshot and late async replies when the institution changes", async () => {
  mock();
  await render({ institutionId: "ies-a", courseId: "c1" });
  expect(el.textContent).toContain("Síntese do curso");
  let releaseLate: (value: unknown) => void = () => {};
  const late = new Promise((resolve) => {
    releaseLate = resolve;
  });
  rpc.mockImplementation((_name: string, args: any) =>
    args.p_institution_id === "ies-a"
      ? late
      : Promise.resolve({ data: null, error: { message: "Acesso restrito" } }),
  );
  const refresh = Array.from(el.querySelectorAll("button")).find(
    (b) => b.textContent === "Atualizar pareceres",
  )!;
  await act(async () => refresh.click());
  await act(async () =>
    root.render(<SapiensPlanning institutionId="ies-b" courseId="c1" />),
  );
  await act(async () => releaseLate({ data: [row()], error: null }));
  expect(el.querySelector("[role=alert]")?.textContent).toContain(
    "Acesso restrito",
  );
  expect(el.textContent).not.toContain("Síntese do curso");
  expect(el.textContent).not.toContain("goal-1");
});
it("keeps human review notes specific to each opinion and disables decisions until justified", async () => {
  mock([row("first"), row("second")], true);
  await render({ institutionId: "ies-a", courseId: "c1" });
  const buttons = Array.from(el.querySelectorAll("button")).filter(
    (b) => b.textContent === "Registrar revisão da gestão",
  );
  expect(buttons.length).toBe(2);
  expect(buttons.every((b) => b.disabled)).toBe(true);
  expect(el.querySelector('[aria-label="Justificativa first"]')).not.toBeNull();
  expect(
    el.querySelector('[aria-label="Justificativa second"]'),
  ).not.toBeNull();
});
it("marks legacy evidence as unstructured and exposes no fabricated source link", async () => {
  const old: any = row();
  old.result = {
    summary: "Parecer anterior",
    findings: [
      {
        type: "fato",
        text: "Registro antigo",
        evidence: "Fonte textual antiga",
      },
    ],
    recommendations: [],
    limitations: [],
  };
  mock([old]);
  await render({ institutionId: "ies-a", courseId: "c1" });
  expect(el.textContent).toContain("sem referência estruturada");
  expect(el.textContent).toContain("Fonte textual antiga");
  expect(el.querySelector("a[href]")).toBeNull();
});

it("confirms the loaded indicator revision and exposes changed definitions for human review", async () => {
  const updated = "2026-11-16T07:00:00Z";
  const definition = {
    indicator: "Acompanhamento",
    unit: "%",
    direction: "aumentar",
  };
  rpc.mockImplementation(async (_name: string, args: any) => ({
    error: null,
    data:
      args.p_action === "options"
        ? {
            scope: "superior",
            can_review: false,
            institutional: false,
            audience: "coordenacao",
            courses: [{ id: "c1", name: "Direito" }],
          }
        : args.p_action === "list"
          ? []
          : args.p_action === "links"
            ? {
                plan: {
                  id: "plan",
                  version: 1,
                  status: "draft",
                  updated_at: updated,
                  strategic_objectives: [{ theme: "Permanência" }],
                },
                goals: [
                  {
                    id: "g1",
                    title: "Acompanhamento",
                    indicator: "Acompanhamento",
                    updated_at: updated,
                    indicator_definition: definition,
                  },
                ],
                links: [
                  {
                    id: "old",
                    goal_id: "g1",
                    objective_index: 0,
                    valid_for_snapshot: false,
                    objective_matches: true,
                    indicator_matches: false,
                    rationale: "Vínculo anterior",
                    indicator_snapshot: { ...definition, unit: "alunos" },
                  },
                ],
              }
            : { ok: true },
  }));
  await render({ institutionId: "ies-a", courseId: "c1" });
  expect(el.textContent).toContain(
    "Meta ou definição do indicador alterada — vínculo exige revisão",
  );
  expect(el.textContent).toContain("Indicador confirmado no vínculo");
  expect(el.textContent).toContain("alunos");
  for (const [label, value] of [
    ["Objetivo do vínculo", "0"],
    ["Meta do vínculo", "g1"],
  ]) {
    const select = el.querySelector(
      `[aria-label="${label}"]`,
    ) as HTMLSelectElement;
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  const textarea = el.querySelector(
    '[aria-label="Justificativa do vínculo"]',
  ) as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(
      textarea,
      "O indicador mede o acompanhamento previsto neste objetivo",
    );
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const register = Array.from(el.querySelectorAll("button")).find(
    (b) => b.textContent === "Registrar vínculo justificado",
  )!;
  expect(register.disabled).toBe(false);
  await act(async () => register.click());
  expect(rpc).toHaveBeenCalledWith(
    "vertice_sapiens_planning",
    expect.objectContaining({
      p_action: "link_objective",
      p_payload: expect.objectContaining({
        goal_id: "g1",
        expected_goal_updated_at: updated,
        expected_indicator_definition: definition,
      }),
    }),
  );
});

it("shows the exact metric and declared comparability of an AI trend", async () => {
  const r: any = row("trend", "tendência");
  Object.assign(r.result.findings[0], {
    metric_field: "matriculados",
    comparability: "Estoque cadastral do mesmo curso, sem coorte verificada",
  });
  mock([r]);
  await render({ institutionId: "ies-a", courseId: "c1" });
  expect(el.textContent).toContain("Campo numérico: matriculados");
  expect(el.textContent).toContain("sem coorte verificada");
});
