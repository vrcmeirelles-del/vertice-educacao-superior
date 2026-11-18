export const STATUSES = [
  "em desenvolvimento",
  "em revisão",
  "integrado",
  "publicado",
  "comprovadamente funcional",
  "não confirmado",
  "bloqueado",
  "pronto para homologação",
  "homologado",
] as const;
export const ENVIRONMENTS = [
  "Local",
  "Demonstração",
  "Homologação",
  "Produção",
] as const;
export const LEVELS = [
  "local",
  "sintético",
  "autenticado",
  "dados reais",
] as const;
export const FRONTS = [
  [
    "core",
    "Núcleo genérico",
    "Bacharelados, regras por edição, comparabilidade e identificadores oficiais.",
  ],
  [
    "github",
    "GitHub",
    "Branch, commit, revisão, integração e resultados de CI.",
  ],
  [
    "supabase",
    "Supabase e migrações",
    "Banco existente, RLS, funções, versão aplicada e ambiente autorizado.",
  ],
  [
    "render",
    "Render e publicação",
    "Serviço existente, commit servido e recibo de publicação.",
  ],
  [
    "extraction",
    "Extração PDF e DOCX",
    "Bytes, SHA-256, páginas, células, versões e falhas verificáveis.",
  ],
  [
    "ocr",
    "OCR e capacidade",
    "Cobertura parcial, páginas sem texto, CPU e reprocessamento.",
  ],
  [
    "classification",
    "Classificação de evidências",
    "Sugestões, revisão humana e erros dos provedores de IA.",
  ],
  [
    "index",
    "Indexação compartilhada",
    "Busca no mesmo escopo institucional e de curso.",
  ],
  [
    "sapiens",
    "Vínculos com Sapiens",
    "Evidência recuperada, diagnóstico e isolamento por curso.",
  ],
  [
    "planning",
    "Planejamento Estratégico",
    "Vínculos documentais, metas e ações 5W2H.",
  ],
  [
    "r2",
    "Relatório R2",
    "Contrato, fontes, reprodução, conciliação e aceite científico.",
  ],
  [
    "r3",
    "Relatório R3",
    "Contrato, fontes, reprodução, conciliação e aceite científico.",
  ],
  [
    "r4",
    "Relatório R4",
    "Contrato, fontes, reprodução, conciliação e aceite científico.",
  ],
  [
    "r5",
    "Relatório R5",
    "Contrato, fontes, reprodução, conciliação e aceite científico.",
  ],
  [
    "r6",
    "Relatório R6",
    "Contrato, fontes, reprodução, conciliação e aceite científico.",
  ],
  [
    "science",
    "Validação científica",
    "Metodologia oficial, tolerâncias, dados reais e decisão humana.",
  ],
  [
    "access",
    "Autenticação e MFA",
    "Master, Reitoria, Coordenação, NDE e CPA em sessões reais.",
  ],
] as const;
export const CHECKS = {
  Desenvolvimento: ["version", "local", "synthetic", "provenance"],
  Homologação: ["access", "authenticated", "real", "scientific"],
  Produção: ["approval", "migration", "deploy", "smoke"],
} as const;
export const CHECK_LABELS: Record<string, string> = {
  version: "Versão e branch identificadas",
  local: "Teste local validado",
  synthetic: "Teste sintético validado",
  provenance: "Proveniência e limitações verificadas",
  access: "Perfis e MFA exercitados",
  authenticated: "Teste autenticado validado",
  real: "Fluxo com dados reais validado",
  scientific: "Aceite científico explícito",
  approval: "Aprovação da mudança vinculada",
  migration: "Migração conferida no ambiente autorizado",
  deploy: "Commit publicado conferido",
  smoke: "Jornada real após publicação",
};
export type Test = {
  level: (typeof LEVELS)[number];
  executed: boolean;
  validated: boolean;
  evidence: string;
  result: string;
  outcome: "não executado" | "passou" | "falhou" | "parcial";
};
export type Check = {
  key: string;
  result: "pendente" | "atendido" | "não aplicável";
  evidence: string;
  note: string;
};
export type Payload = {
  status: string;
  version: string;
  branch: string;
  url: string;
  migration: string;
  note: string;
  failure: string;
  cause: string;
  correction: string;
  dependencies: string;
  risks: string;
  decisions: string;
  next: string;
  provenance: string;
  tests: Test[];
  checks: Check[];
  confirmHuman: boolean;
  action?: string;
  target?: string;
  approvalReference?: string;
};
export type Entry = {
  id: string;
  seq: number;
  front: string;
  institution_id: string | null;
  course_id: string | null;
  environment: string;
  kind: "revision" | "approval";
  payload: Payload;
  created_at: string;
};
export type State = {
  entries: Entry[];
  current: Entry[];
  next_before: number | null;
  fetched_at: string;
};
export type Scope = {
  institution_id: string | null;
  course_id: string | null;
  environment: string;
};
export function blank(): Payload {
  return {
    status: "não confirmado",
    version: "",
    branch: "",
    url: "",
    migration: "",
    note: "",
    failure: "",
    cause: "",
    correction: "",
    dependencies: "",
    risks: "",
    decisions: "",
    next: "",
    provenance: "",
    tests: LEVELS.map((level) => ({
      level,
      executed: false,
      validated: false,
      evidence: "",
      result: "",
      outcome: "não executado",
    })),
    checks: Object.values(CHECKS)
      .flat()
      .map((key) => ({ key, result: "pendente", evidence: "", note: "" })),
    confirmHuman: false,
  };
}
export function safeUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function merge(...groups: Entry[][]) {
  return [...new Map(groups.flat().map((e) => [e.id, e])).values()].sort(
    (a, b) => b.seq - a.seq,
  );
}
export function validation(p: Payload, environment: string) {
  if (!STATUSES.includes(p.status as (typeof STATUSES)[number]))
    return "Status inválido.";
  if (p.note.trim().length < 5)
    return "Registre o resultado observado ou a justificativa.";
  if (
    p.tests.some(
      (t) =>
        t.validated &&
        (!t.executed ||
          !safeUrl(t.evidence) ||
          !t.result.trim() ||
          t.outcome === "não executado"),
    )
  )
    return "Teste validado exige execução, resultado e URL HTTPS de evidência.";
  if (
    p.checks.some(
      (c) =>
        c.result !== "pendente" &&
        (!c.note.trim() || (c.result === "atendido" && !safeUrl(c.evidence))),
    )
  )
    return "Checklist exige justificativa e evidência para itens atendidos.";
  if (
    [
      "integrado",
      "publicado",
      "comprovadamente funcional",
      "pronto para homologação",
      "homologado",
    ].includes(p.status) &&
    (!p.version.trim() || !safeUrl(p.url))
  )
    return "Esse status exige versão e URL verificável.";
  if (
    [
      "comprovadamente funcional",
      "pronto para homologação",
      "homologado",
    ].includes(p.status)
  ) {
    if (
      ["Local", "Demonstração"].includes(environment) ||
      !p.tests.some(
        (t) =>
          t.level === "autenticado" && t.validated && t.outcome === "passou",
      ) ||
      !p.tests.some(
        (t) =>
          t.level === "dados reais" && t.validated && t.outcome === "passou",
      )
    )
      return "Exige testes autenticados e com dados reais validados em homologação ou produção.";
    if (
      p.dependencies.trim() ||
      p.failure.trim() ||
      p.tests.some(
        (t) => t.executed && ["falhou", "parcial"].includes(t.outcome),
      )
    )
      return "Resolva ou reclassifique as falhas e dependências antes desse status.";
  }
  if (
    ["pronto para homologação", "homologado"].includes(p.status) &&
    Object.values(CHECKS)
      .slice(0, 2)
      .flat()
      .filter((key) => p.status === "homologado" || key !== "scientific")
      .some((key) => p.checks.find((c) => c.key === key)?.result !== "atendido")
  )
    return "Conclua os checklists de desenvolvimento e homologação com evidências.";
  if (p.status === "homologado" && !p.confirmHuman)
    return "O aceite exige decisão humana explícita para esta versão e este ambiente.";
  if (
    p.status === "homologado" &&
    environment === "Produção" &&
    CHECKS.Produção.some(
      (key) => p.checks.find((c) => c.key === key)?.result !== "atendido",
    )
  )
    return "Conclua também o checklist de produção.";
  return "";
}
