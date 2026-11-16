import {
  buildPlanningSources,
  checkPlanning,
} from "../../../supabase/functions/vertice-sapiens-analyze/interpretation";
export let viewer = "alta_gestao";
export const setViewer = (v: string) => {
  viewer = v;
};
const plan = {
  id: "plan-demo",
  version: 3,
  status: "draft",
  updated_at: "2026-11-15T19:00:00Z",
  strategic_objectives: [
    {
      theme: "Permanência e êxito",
      description: "Acompanhar a trajetória acadêmica",
      indicator: "Indicador de acompanhamento",
      targets: { year1: "80%" },
    },
  ],
};
const goal = {
  id: "goal-demo",
  title: "Acompanhamento acadêmico",
  indicator: "Estudantes com acompanhamento registrado",
  unit: "%",
  direction: "aumentar",
  target: 80,
  status: "concluida",
  due_date: "2026-10-01",
  measurements: [
    {
      id: "m1",
      value: 70,
      measured_on: "2026-07-01",
      source: "Cadastro sintético de acompanhamento",
    },
    {
      id: "m2",
      value: 60,
      measured_on: "2026-09-01",
      source: "Cadastro sintético de acompanhamento",
    },
    {
      id: "m3",
      value: 50,
      measured_on: "2026-10-15",
      source: "Cadastro sintético de acompanhamento",
    },
  ],
  documents: [],
};
const context = {
  reference_date: "2026-11-15",
  semester: "2026/2",
  courses: [
    {
      id: "course-demo",
      name: "Direito · Exemplo fictício",
      strategic: plan,
      semester: {
        id: "semester-demo",
        version: 1,
        status: "draft",
        semester: "2026/2",
        activities: [],
      },
      goals: [goal],
      actions: [],
      objective_links: [],
      learning_history: [],
      enrollment_history: [],
      permanence: { status: "unavailable" },
    },
  ],
  collection_rules: {
    notice:
      "DADOS FICTÍCIOS para conferência visual; nenhuma consulta a produção.",
  },
};
const result = {
  schema_version: 2,
  reference_date: "2026-11-15",
  summary:
    "Dados fictícios: a meta aparece como concluída, mas a última medição registrada ficou abaixo do alvo. A sequência de medições pede revisão; causas e comparabilidade ainda precisam de verificação humana.",
  checks: checkPlanning(context),
  sources: buildPlanningSources(context),
  findings: [
    {
      id: "f1",
      type: "hipótese",
      priority: "média",
      audience: "direcao",
      text: "A redução observada pode decorrer de mudanças no registro ou no acompanhamento. Conferir a definição do indicador, a população e as evidências antes de atribuir causa.",
      source_refs: ["/courses/0/goals/0", "/courses/0/goals/0/measurements/2"],
    },
  ],
  recommendations: [
    {
      priority: "alta",
      action:
        "Revisar a conclusão declarada e conferir os registros de execução",
      owner_role: "Coordenação, com apreciação da direção acadêmica",
      timeframe: "Próxima reunião de acompanhamento",
      success_indicator:
        "Medição atualizada, ação registrada e documentação submetida à validação",
      rationale:
        "A medição de 50% diverge do alvo de 80% e o recorte não contém documento validado.",
      finding_ids: ["check-2", "check-3"],
    },
  ],
  limitations: [
    "Exemplo inteiramente fictício, sem valor de diagnóstico institucional.",
    "Rascunhos e cadastros atuais não comprovam execução histórica.",
    "Fórmula e população não são historizadas; interpretação requer conferência.",
  ],
};
let row = {
  id: "opinion-demo",
  institution_id: "institution-demo",
  course_id: "course-demo",
  semester: "2026/2",
  created_at: "2026-11-15T23:00:00Z",
  status: "pending_review",
  result,
  review: {
    available: false,
    notes: "Revisão por IA não executada nesta demonstração local.",
    issues: [],
    recommendation: "reject_for_human_review",
  },
  generator_model: "simulação local",
  reviewer_model: null,
  input_hash: "exemplo-ficticio-sem-chave-ou-provedor-real",
  reviewed_at: null as string | null,
  review_note: "",
};
let links: any[] = [];
export const supabase = {
  rpc: async (_name: string, a: any) => {
    const action = a.p_action,
      p = a.p_payload || {};
    if (action === "options")
      return {
        data: {
          scope: "superior",
          can_review: viewer !== "coordenacao",
          institutional: viewer !== "coordenacao",
          audience: viewer,
          courses: [{ id: "course-demo", name: "Direito · Exemplo fictício" }],
        },
        error: null,
      };
    if (action === "list") return { data: [row], error: null };
    if (action === "links")
      return { data: { plan, goals: [goal], links }, error: null };
    if (action === "link_objective") {
      links = [
        ...links,
        {
          id: "link-demo",
          goal_id: p.goal_id,
          objective_index: p.objective_index,
          rationale: p.rationale,
          valid_for_snapshot: true,
        },
      ];
      return { data: { ok: true }, error: null };
    }
    if (action === "unlink_objective") {
      links = links.filter((l) => l.id !== p.id);
      return { data: { ok: true }, error: null };
    }
    if (action === "review") {
      row = {
        ...row,
        status: p.status,
        review_note: p.note,
        reviewed_at: new Date().toISOString(),
      };
      return { data: { ok: true }, error: null };
    }
    return {
      data: null,
      error: { message: "Operação não implementada no exemplo local" },
    };
  },
  functions: { invoke: async () => ({ data: { ok: true }, error: null }) },
};
