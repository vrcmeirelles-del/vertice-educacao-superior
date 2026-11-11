import {syncInstitutionDirectory} from "@/lib/institution-directory";
import { supabase } from "@/lib/supabase";

// Papéis efetivos numa instituição. A permissão real é aplicada pelo banco (RLS);
// estes valores só decidem o que a interface oferece.
// --------------------------------------------------------------------------
// Hierarquia de perfis:
//   master            → Vértice (vê todas as IES)
//   reitor            → acesso total dentro da própria IES
//   diretor_geral     → acesso total dentro da própria IES
//   diretor_pedagogico→ acesso total dentro da própria IES
//   procurador        → acesso total dentro da própria IES
//   cpa               → acesso institucional amplo, sem gestão financeira
//   coordenador       → acesso limitado ao(s) curso(s) vinculado(s)
//   nde               → acesso limitado ao(s) curso(s) vinculado(s)
//   gestor            → (legado) equivale a reitor
//   equipe            → (legado) acesso operacional
//   leitor            → somente leitura
// --------------------------------------------------------------------------
export type Role =
  | "master"
  | "reitor"
  | "diretor_geral"
  | "diretor_pedagogico"
  | "procurador"
  | "cpa"
  | "coordenador"
  | "nde"
  | "gestor"
  | "equipe"
  | "leitor";

export const ROLE_LABEL: Record<Role, string> = {
  master: "Master (Vértice)",
  reitor: "Direção",
  diretor_geral: "Diretor Geral",
  diretor_pedagogico: "Diretor Pedagógico",
  procurador: "Procurador Institucional",
  cpa: "CPA",
  coordenador: "Coordenador de Curso",
  nde: "Membro do NDE",
  gestor: "Gestor da IES",
  equipe: "Equipe",
  leitor: "Leitura",
};

/** Perfis com visão completa da instituição (equivalente ao antigo "gestor" ou superior). */
const FULL_ACCESS: Role[] = ["master", "reitor", "diretor_geral", "diretor_pedagogico", "procurador", "gestor"];
/** Perfis de nível de curso (veem apenas dados do(s) curso(s) vinculado(s)). */
const COURSE_SCOPED: Role[] = ["coordenador", "nde"];
/** CPA é institucional mas com escopo de abas limitado. */
const INSTITUTIONAL_LIMITED: Role[] = ["cpa"];

export function isFullAccess(r?: Role | null): boolean { return !!r && FULL_ACCESS.includes(r); }
export function isCourseScoped(r?: Role | null): boolean { return !!r && COURSE_SCOPED.includes(r); }
export function isInstitutionalLimited(r?: Role | null): boolean { return !!r && INSTITUTIONAL_LIMITED.includes(r); }

// --------------------------------------------------------------------------
// Abas visíveis por perfil
// --------------------------------------------------------------------------
export type Tab = "aprendizagem" | "enade" | "backups" | "fontes" | "conexoes" | "avaliacao" | "novo_instrumento" | "emec" | "base" | "ia" | "analise" | "geral" | "visao" | "cadastro" | "metas" | "plano" | "diagnostico" | "equipe" | "repositorio" | "biblioteca" | "reitor" | "eorbit" | "resultado-curso" | "auditoria" | "simulador" | "raio-x-direito" | "egressos" | "governanca" | "inclusao" | "acompanhamento-especial" | "sync" | "aquisicoes" | "billing" | "contrato" | "modulos" | "documentos" | "conta" | "escola-enem" | "escola-egressos" | "catalogo" | "integracao-ies";

/** Abas disponíveis para cada grupo de perfis. */
const TABS_FULL: Tab[] = ["aprendizagem", "enade", "backups", "fontes", "conexoes", "avaliacao", "novo_instrumento", "base", "ia", "geral", "analise", "visao", "cadastro", "emec", "eorbit", "auditoria", "metas", "repositorio", "biblioteca", "reitor", "resultado-curso", "simulador", "raio-x-direito", "plano", "diagnostico", "equipe", "egressos", "governanca", "inclusao", "acompanhamento-especial", "sync", "aquisicoes", "billing", "contrato", "modulos", "catalogo", "integracao-ies", "documentos", "conta", "escola-enem", "escola-egressos"];
const TABS_CPA: Tab[] = ["aprendizagem", "enade", "avaliacao", "geral", "visao", "metas", "repositorio", "biblioteca", "plano", "equipe", "governanca", "inclusao", "acompanhamento-especial", "conta", "contrato", "catalogo", "integracao-ies"];
const TABS_COURSE: Tab[] = ["aprendizagem", "geral", "visao", "metas", "repositorio", "biblioteca", "plano", "equipe"];

export function visibleTabs(r?: Role | null): Tab[] {
  if (!r) return [];
  if (isFullAccess(r)) return TABS_FULL;
  if (isInstitutionalLimited(r)) return TABS_CPA;
  if (isCourseScoped(r)) return TABS_COURSE;
  // equipe e leitor
  return ["geral", "visao", "biblioteca"];
}
// --------------------------------------------------------------------------
// Permissões granulares (o que a interface oferece; RLS aplica no banco)
// --------------------------------------------------------------------------
export const can = {
  editInstitution: (r?: Role | null) => isFullAccess(r),
  manageCourses: (r?: Role | null) => isFullAccess(r),
  deleteCourse: (r?: Role | null) => r === "master",
  manageGoals: (r?: Role | null) => isFullAccess(r),
  record: (r?: Role | null) => isFullAccess(r) || r === "cpa" || r === "coordenador" || r === "nde" || r === "equipe",
  remove: (r?: Role | null) => isFullAccess(r),
  manageTeam: (r?: Role | null) => isFullAccess(r) || r === "coordenador" || r === "cpa",
  /** Coordenador/NDE podem cadastrar membros do NDE; CPA pode cadastrar membros da CPA */
  manageNde: (r?: Role | null) => isFullAccess(r) || r === "coordenador" || r === "nde",
  /** Documentos postados por coordenador/NDE/CPA precisam de validação da instância superior */
  needsValidation: (r?: Role | null) => r === "coordenador" || r === "nde" || r === "cpa",
  /** Pode validar documentos postados por perfis inferiores */
  canValidate: (r?: Role | null) => isFullAccess(r),
  /** Vê dados financeiros (EBITDA, DRE) */
  viewFinancials: (r?: Role | null) => isFullAccess(r),
  /** Vê diagnóstico por IA */
  viewDiagnostics: (r?: Role | null) => isFullAccess(r),
  /** Vê análise documental por IA */
  viewDocumentAI: (r?: Role | null) => isFullAccess(r),
  /** Vê análise gerencial */
  viewManagement: (r?: Role | null) => isFullAccess(r),
  /** Vê cadastro e cursos */
  viewRegistry: (r?: Role | null) => isFullAccess(r),
  /** Vê base da organização */
  viewOrgBase: (r?: Role | null) => isFullAccess(r),
};

// --------------------------------------------------------------------------
// Descrição textual do perfil (para área de demonstração)
// --------------------------------------------------------------------------
export const ROLE_DESCRIPTION: Record<Role, string> = {
  master: "Acesso completo a todas as instituições, cursos e funcionalidades do sistema. Único perfil que visualiza outras IES além da própria.",
  reitor: "Acesso completo dentro da própria instituição: todos os módulos, todos os cursos, dados financeiros e análises por IA.",
  diretor_geral: "Mesmo nível de acesso da Direção dentro da instituição.",
  diretor_pedagogico: "Acesso completo à instituição com foco pedagógico. Vê todos os módulos incluindo análises e metas.",
  procurador: "Acesso completo à instituição com foco regulatório. Vê todos os módulos incluindo e-MEC e repositório.",
  cpa: "Visão institucional ampla: vê dados de todos os cursos, mas sem acesso a módulos de gestão financeira, análise por IA ou diagnóstico. Pode postar documentos (sujeitos a validação pela instância superior).",
  coordenador: "Acesso limitado ao(s) curso(s) vinculado(s): visão geral, matrículas, metas, repositório e plano de ação do próprio curso. Pode cadastrar membros do NDE. Documentos postados são validados pela instância superior.",
  nde: "Mesmo escopo do Coordenador: vê e colabora nos dados do curso vinculado. Pode postar documentos (sujeitos a validação).",
  gestor: "Perfil legado equivalente à Direção. Acesso completo dentro da instituição.",
  equipe: "Acesso operacional básico: visão geral, matrículas e biblioteca INEP.",
  leitor: "Somente leitura: visão geral, matrículas e biblioteca INEP.",
};
export type FieldType = "text" | "textarea" | "number" | "date" | "select";
export type Field = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: [string, string][];
  help?: string;
  wide?: boolean;
  step?: string;
  min?: number;
  max?: number;
  placeholder?: string;
};
export type Row = Record<string, unknown> & { id: string };

// ---------------------------------------------------------------- rótulos
export const DEGREE: [string, string][] = [
  ["bacharelado", "Bacharelado"],
  ["licenciatura", "Licenciatura"],
  ["tecnologo", "Tecnólogo"],
  ["especializacao", "Especialização"],
  ["mestrado", "Mestrado"],
  ["doutorado", "Doutorado"],
  ["outro", "Outro"],
];
export const MODALITY: [string, string][] = [
  ["presencial", "Presencial"],
  ["semipresencial", "Semipresencial"],
  ["ead", "EAD"],
];
export const COURSE_STATUS: [string, string][] = [
  ["ativo", "Ativo"],
  ["em_implantacao", "Em implantação"],
  ["em_extincao", "Em extinção"],
  ["extinto", "Extinto"],
];
export const GOAL_STATUS: [string, string][] = [
  ["planejada", "Planejada"],
  ["ativa", "Em acompanhamento"],
  ["concluida", "Concluída"],
  ["cancelada", "Cancelada"],
];
export const DIRECTION: [string, string][] = [
  ["aumentar", "Aumentar"],
  ["reduzir", "Reduzir"],
  ["manter", "Manter"],
];
export const FREQUENCY: [string, string][] = [
  ["mensal", "Mensal"],
  ["bimestral", "Bimestral"],
  ["trimestral", "Trimestral"],
  ["semestral", "Semestral"],
  ["anual", "Anual"],
];
export const ACTION_STATUS: [string, string][] = [
  ["nao_iniciada", "Não iniciada"],
  ["em_andamento", "Em andamento"],
  ["concluida", "Concluída"],
  ["bloqueada", "Bloqueada"],
  ["cancelada", "Cancelada"],
];
export const PRIORITY: [string, string][] = [
  ["alta", "Alta"],
  ["media", "Média"],
  ["baixa", "Baixa"],
];
export const FINDING_STATUS: [string, string][] = [
  ["aberto", "Aberto"],
  ["em_tratamento", "Em tratamento"],
  ["resolvido", "Resolvido"],
];
export const DIMENSIONS = [
  "Organização didático-pedagógica",
  "Corpo docente e tutorial",
  "Infraestrutura",
  "Gestão e governança",
  "Captação e ingresso",
  "Permanência e êxito",
  "Sustentabilidade financeira",
  "Avaliação e regulação",
];
export const UF = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
  .split(" ")
  .map(u => [u, u] as [string, string]);

export const label = (list: [string, string][], v: unknown) =>
  list.find(([k]) => k === v)?.[1] ?? (v ? String(v) : "—");

export const fmtDate = (v: unknown) =>
  v ? new Date(String(v) + (String(v).length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "—";
export const fmtNum = (v: unknown, unit?: unknown) =>
  v === null || v === undefined || v === ""
    ? "—"
    : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`;
export const today = () => new Date().toISOString().slice(0, 10);
// ---------------------------------------------------------------- dados
export const TABLES = {
  institutions: "vertice_institutions",
  courses: "vertice_courses",
  goals: "vertice_goals",
  measurements: "vertice_goal_measurements",
  actions: "vertice_actions",
  diagnosis: "vertice_diagnosis_items",
  invites: "vertice_invites",
  memberships: "vertice_memberships",
} as const;

/** Converte valores do formulário: vazio vira null; números viram number. */
export function clean(values: Record<string, unknown>, fields: Field[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    let v = values[f.name];
    if (typeof v === "string") v = v.trim();
    if (v === "" || v === undefined) v = null;
    if (v !== null && f.type === "number") v = Number(String(v).replace(",", "."));
    out[f.name] = v;
  }
  return out;
}

export async function listByInstitution(table: string, institutionId: string, order = "created_at") {
  const all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select("*").eq("institution_id", institutionId).order(order, { ascending: true });
    if (order !== "id") query = query.order("id", { ascending: true });
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    all.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return all;
  }
}

export async function saveRow(table: string, values: Record<string, unknown>, id?: string) {
  const q = id
    ? supabase.from(table).update(values).eq("id", id).select().single()
    : supabase.from(table).insert(values).select().single();
  const { data, error } = await q;
  if (error) throw error;
  if(table===TABLES.institutions){
    await syncInstitutionDirectory(String(data.id));
  }
  return data as Row;
}

export async function deleteRow(table: string, id: string) {
  const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw new Error("sem permissão");
}

/** Mensagem legível para erros do banco (RLS, validação). */
export function explain(e: unknown) {
  const err = e as { code?: string; message?: string };
  const msg = err?.message ?? "";
  if (err?.code === "42501" || /row-level security|sem permissão|permission/i.test(msg))
    return "Seu perfil não tem permissão para esta alteração.";
  if (err?.code === "23514" || /check constraint|violates check/i.test(msg))
    return msg.includes("outra instituição") ? "O vínculo escolhido pertence a outra instituição." : "Algum campo está fora do formato aceito. Confira datas, números e siglas.";
  if (err?.code === "23505") return "Já existe um registro igual.";
  if (err?.code === "23503") return "Este registro está em uso por outros dados e não pode ser removido.";
  if (/JWT|session|aal/i.test(msg)) return "Sua sessão expirou. Entre novamente.";
  return "Não foi possível salvar. Tente novamente.";
}

/** Progresso da meta (0–100) pela última medição, conforme a direção. */
export function goalProgress(goal: Row, last?: number | null) {
  const target = Number(goal.target);
  const base = goal.baseline === null || goal.baseline === undefined ? null : Number(goal.baseline);
  if (last === null || last === undefined || !Number.isFinite(target)) return null;
  if (goal.direction === "manter") {
    const tol = Math.abs(target) * 0.05 || 0.5;
    return Math.abs(last - target) <= tol ? 100 : 50;
  }
  if (base === null || base === target) {
    const hit = goal.direction === "reduzir" ? last <= target : last >= target;
    return hit ? 100 : 0;
  }
  const p = ((last - base) / (target - base)) * 100;
  return Math.max(0, Math.min(100, Math.round(p)));
}

export function isLate(due: unknown, status: unknown) {
  return Boolean(due) && String(due) < today() && !["concluida", "cancelada", "resolvido"].includes(String(status));
}


