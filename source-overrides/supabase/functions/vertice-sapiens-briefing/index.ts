/**
 * vertice-sapiens-briefing
 *
 * Generates executive briefings at scheduled times:
 *   06:00 — morning overview
 *   13:00 — midday operational update
 *   18:30 — evening closure
 *   Sunday night — weekly_audit (full audit + weekly action plan)
 *
 * Invoked by cron or manually by coordinator.
 */

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (fn: (req: Request) => Promise<Response>) => void;
};

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// Política de IA (20/11/2026): o algoritmo é o padrão em todo o portal. A IA só é chamada para as funções
// listadas em AI_FEATURES (padrão desde 25/11/2026: só transcrição de manuscrito e geração de questão
// nova; a segunda opinião na correção e a redação da CPA passaram ao algoritmo) e com a chave geral AI_SUSPENDED=false (suspensa desde 19/11/2026).
const AI_FEATURES_DEFAULT="discursiva.transcribe,discursiva.generate";
const aiPolicy=(get:(k:string)=>string|undefined)=>(feature:string)=>String(get("AI_SUSPENDED")??"true").toLowerCase()==="false"&&String(get("AI_FEATURES")??AI_FEATURES_DEFAULT).split(",").map(x=>x.trim()).includes(feature);
const aiAllowed=aiPolicy(k=>Deno.env.get(k));
const __AI_FN_FEATURES:string[]=[];
{const __aiFetch=globalThis.fetch;const __aiHosts=/(^|\.)(api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com)$/i;
globalThis.fetch=((input:any,init?:any)=>{let host="";try{host=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url).hostname;}catch{}
if(__aiHosts.test(host)&&!__AI_FN_FEATURES.some(aiAllowed))
 return Promise.resolve(new Response(JSON.stringify({error:{type:"ai_suspended",message:"IA suspensa temporariamente."}}),{status:503,headers:{"content-type":"application/json"}}));
return __aiFetch(input,init);}) as typeof fetch;}

const env = (k: string) => String(Deno.env.get(k) || "");
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BRIEFING_TYPES = new Set(["morning", "midday", "evening", "weekly_audit"]);
const ORIGINS = new Set([
  "https://www.verticesuperior.com.br", "https://verticesuperior.com.br",
  "https://vertice-portal.onrender.com", "https://vertice-educacao-superior.onrender.com",
  "https://vertice-educacao-superior-site.onrender.com",
]);

function cfg() {
  const url = env("SUPABASE_URL");
  const raw = env("SUPABASE_SECRET_KEYS");
  let sk = "";
  if (raw) try { const o = JSON.parse(raw); sk = o.default || Object.values(o)[0] as string; } catch { /* */ }
  if (!sk) sk = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !sk) throw new Error("Supabase not configured");
  return { url, sk };
}

const send = (body: unknown, status = 200, origin = "") =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://www.verticesuperior.com.br",
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    },
  });

// ================================================================
// BRIEFING POR ALGORITMO (20/11/2026): montado diretamente dos dados já
// consultados; nenhuma chamada de IA. Cada item é um fato do banco.
// ================================================================
type Row = Record<string, unknown>;
type Item = { text: string; action_required: boolean };
type Section = { title: string; severity: "critical" | "high" | "medium" | "low" | "info"; items: Item[] };
export type BriefingData = {
  institution: string; briefingType: string;
  diagnoses: Row[]; interventions: Row[]; findings: Row[]; goals: Row[]; actions: Row[];
  counters: { activeRisks: number; offTrackGoals: number; pendingActions: number; pendingApprovals: number; inProgress: number };
  now?: Date;
};
const TITLES: Record<string, string> = {
  morning: "Briefing matinal", midday: "Atualização do meio-dia", evening: "Encerramento do dia", weekly_audit: "Auditoria semanal",
};
const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV: Record<string, Section["severity"]> = { critical: "critical", high: "high", medium: "medium", low: "low" };
const MODULES: Record<string, string> = { oab: "OAB", enade: "ENADE", enamed: "ENAMED", residencia: "Residência", enem: "ENEM", cfc: "CFC" };
const date = (v: unknown) => { const raw = String(v || ""); const only = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (only) return `${only[3]}/${only[2]}/${only[1]}`; const d = new Date(raw); return Number.isFinite(d.getTime()) ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem data"; };
const short = (v: unknown, n = 160) => { const t = String(v ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildBriefing(d: BriefingData): { summary: string; sections: Section[] } {
  const now = d.now || new Date();
  const c = d.counters;
  const sections: Section[] = [];
  const findings = [...d.findings].sort((a, b) => (RISK_ORDER[String(a.risk_level)] ?? 9) - (RISK_ORDER[String(b.risk_level)] ?? 9));
  const highRisks = findings.filter((f) => f.risk_level === "critical" || f.risk_level === "high");
  if (highRisks.length) sections.push({
    title: "Riscos críticos e altos", severity: highRisks.some((f) => f.risk_level === "critical") ? "critical" : "high",
    items: highRisks.slice(0, 8).map((f) => ({ text: `${short(f.finding_ref, 40)}: ${short(f.recommendation)} (prazo ${date(f.due_date)}; ${f.resolution_status === "in_progress" ? "em andamento" : "aberto"})`, action_required: true })),
  });
  const offTrack = d.goals.filter((g) => g.trajectory === "off_track" || g.trajectory === "critical");
  const attention = d.goals.filter((g) => g.trajectory === "attention");
  if (offTrack.length || attention.length) sections.push({
    title: "Metas fora da trajetória", severity: offTrack.some((g) => g.trajectory === "critical") ? "critical" : offTrack.length ? "high" : "medium",
    items: [...offTrack, ...attention].slice(0, 8).map((g) => ({ text: `${short(g.title, 100)}: atual ${g.current_value ?? "—"} de meta ${g.target_value ?? "—"} (prazo ${date(g.due_at)})`, action_required: g.trajectory !== "attention" })),
  });
  if (c.pendingApprovals) sections.push({
    title: "Intervenções aguardando aprovação", severity: "medium",
    items: d.interventions.filter((i) => i.status === "proposed").slice(0, 8).map((i) => ({ text: `${short(i.title, 120)} (${MODULES[String(i.module)] || String(i.module || "geral")})`, action_required: true })),
  });
  const overdue = d.actions.filter((a) => a.status !== "blocked" && a.planned_date && new Date(String(a.planned_date)).getTime() < now.getTime());
  const blocked = d.actions.filter((a) => a.status === "blocked");
  if (overdue.length || blocked.length) sections.push({
    title: "Ações 5W2H atrasadas ou bloqueadas", severity: blocked.length ? "high" : "medium",
    items: [...blocked.map((a) => ({ text: `Bloqueada: ${short(a.what, 140)}`, action_required: true })),
            ...overdue.map((a) => ({ text: `Atrasada desde ${date(a.planned_date)}: ${short(a.what, 120)}`, action_required: true }))].slice(0, 10),
  });
  const diag = d.diagnoses.filter((x) => x.severity === "critical" || x.severity === "high");
  if (diag.length) sections.push({
    title: "Diagnósticos de maior severidade", severity: diag.some((x) => x.severity === "critical") ? "critical" : "high",
    items: diag.slice(0, 6).map((x) => ({ text: `${MODULES[String(x.module)] || String(x.module || "")}: ${short(x.summary)}`, action_required: x.status === "draft" })),
  });
  if (d.briefingType === "weekly_audit") sections.push({
    title: "Balanço da semana", severity: "info",
    items: [
      { text: `Metas ativas: ${d.goals.length} (${plural(offTrack.length, "fora da trajetória", "fora da trajetória")}, ${attention.length} em atenção)`, action_required: false },
      { text: `Ações abertas: ${d.actions.length} (${c.pendingActions} não iniciadas, ${blocked.length} bloqueadas, ${overdue.length} atrasadas)`, action_required: false },
      { text: `Achados de auditoria abertos: ${findings.length} (${highRisks.length} críticos ou altos)`, action_required: false },
      { text: `Intervenções: ${c.pendingApprovals} aguardando aprovação, ${c.inProgress} em execução`, action_required: false },
    ],
  });
  if (!sections.length) sections.push({ title: "Situação", severity: "info", items: [{ text: "Nenhum risco alto, meta fora da trajetória, ação atrasada ou aprovação pendente nos dados atuais.", action_required: false }] });

  const parts = [
    `${TITLES[d.briefingType] || "Briefing"} — ${d.institution}, ${now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
    `${plural(c.activeRisks, "risco crítico ou alto ativo", "riscos críticos ou altos ativos")}, ${plural(c.offTrackGoals, "meta fora da trajetória", "metas fora da trajetória")}, ${plural(c.pendingActions, "ação não iniciada", "ações não iniciadas")}, ${plural(c.pendingApprovals, "intervenção aguardando aprovação", "intervenções aguardando aprovação")} e ${plural(c.inProgress, "intervenção em execução", "intervenções em execução")}.`,
  ];
  const first = sections.find((s) => s.severity === "critical") || sections.find((s) => s.severity === "high");
  if (first) parts.push(`Prioridade: ${first.title.toLowerCase()} — ${first.items[0]?.text || ""}`);
  return { summary: parts.join(" ").slice(0, 5000), sections };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return send({ ok: true }, 204, origin);
  if (req.method !== "POST") return send({ error: "method_not_allowed" }, 405, origin);

  try {
    const { url, sk } = cfg();
    const admin = createClient(url, sk, { auth: { persistSession: false } });

    const body = await req.json();
    const institutionId = String(body.institutionId || "").trim().toLowerCase();
    if (!UUID.test(institutionId)) return send({ error: "invalid_institution" }, 400, origin);

    const briefingType = String(body.briefingType || "morning");
    if (!BRIEFING_TYPES.has(briefingType))
      return send({ error: "invalid_briefing_type", valid: [...BRIEFING_TYPES] }, 400, origin);

    // Get institution
    const { data: inst } = await admin
      .from("vertice_institutions")
      .select("id, name")
      .eq("id", institutionId)
      .maybeSingle();
    if (!inst) return send({ error: "institution_not_found" }, 404, origin);

    // Gather current state for the briefing
    const now = new Date().toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const since = briefingType === "weekly_audit" ? weekAgo : dayAgo;

    // Active diagnoses
    const { data: diagnoses } = await admin
      .from("vertice_sapiens_diagnoses")
      .select("id, module, severity, summary, created_at, status")
      .eq("institution_id", institutionId)
      .in("status", ["draft", "published"])
      .order("created_at", { ascending: false })
      .limit(50);

    // Pending interventions
    const { data: interventions } = await admin
      .from("vertice_sapiens_interventions")
      .select("id, title, status, module, created_at, reviewed_at")
      .eq("institution_id", institutionId)
      .in("status", ["proposed", "approved", "sent"])
      .order("created_at", { ascending: false })
      .limit(30);

    // Audit findings
    const { data: findings } = await admin
      .from("vertice_sapiens_audit_findings")
      .select("id, finding_ref, risk_level, resolution_status, recommendation, due_date")
      .eq("institution_id", institutionId)
      .in("resolution_status", ["open", "in_progress"])
      .order("risk_level")
      .limit(30);

    // Goals
    const { data: goals } = await admin
      .from("vertice_sapiens_goals")
      .select("id, title, trajectory, status, current_value, target_value, due_at")
      .eq("institution_id", institutionId)
      .eq("status", "active")
      .limit(30);

    // Action plans
    const { data: actions } = await admin
      .from("vertice_sapiens_action_plans")
      .select("id, what, status, planned_date, goal_id")
      .eq("institution_id", institutionId)
      .in("status", ["pending", "in_progress", "blocked"])
      .order("planned_date")
      .limit(50);

    // Metrics
    const activeRisks = (findings || []).filter((f: Record<string, unknown>) =>
      f.risk_level === "critical" || f.risk_level === "high"
    ).length;
    const offTrackGoals = (goals || []).filter((g: Record<string, unknown>) =>
      g.trajectory === "off_track" || g.trajectory === "critical"
    ).length;
    const pendingActions = (actions || []).filter((a: Record<string, unknown>) =>
      a.status === "pending"
    ).length;
    const pendingApprovals = (interventions || []).filter((i: Record<string, unknown>) =>
      i.status === "proposed"
    ).length;
    const inProgress = (interventions || []).filter((i: Record<string, unknown>) =>
      i.status === "sent"
    ).length;

    // Briefing por algoritmo, a partir dos dados acima (sem IA).
    const built = buildBriefing({
      institution: String(inst.name || ""), briefingType,
      diagnoses: diagnoses || [], interventions: interventions || [], findings: findings || [],
      goals: goals || [], actions: actions || [],
      counters: { activeRisks, offTrackGoals, pendingActions, pendingApprovals, inProgress },
    });
    const summary = built.summary;
    const sections = built.sections;
    const llmModel = "algoritmo";

    // Save briefing
    const { data: briefing, error: saveError } = await admin
      .from("vertice_sapiens_briefings")
      .insert({
        institution_id: institutionId,
        briefing_type: briefingType,
        scheduled_for: now,
        summary,
        sections,
        active_risks: activeRisks,
        off_track_goals: offTrackGoals,
        pending_actions: pendingActions,
        pending_approvals: pendingApprovals,
        interventions_in_progress: inProgress,
        llm_model: llmModel,
        data_sources: ["sapiens_diagnoses", "sapiens_interventions", "sapiens_findings", "sapiens_goals", "sapiens_action_plans"],
      })
      .select("id")
      .single();

    if (saveError) {
      console.error("[sapiens-briefing] save error:", saveError);
      return send({ error: "save_failed", detail: saveError.message }, 500, origin);
    }

    // Audit trail
    await admin.from("vertice_sapiens_audit_trail").insert({
      institution_id: institutionId,
      entity_type: "briefing",
      entity_id: briefing.id,
      action: "created",
      actor_type: "system",
      details: { briefingType, counters: { activeRisks, offTrackGoals, pendingActions, pendingApprovals, inProgress } },
    });

    return send({
      ok: true,
      briefingId: briefing.id,
      briefingType,
      summary,
      sections,
      counters: { activeRisks, offTrackGoals, pendingActions, pendingApprovals, inProgress },
    }, 200, origin);
  } catch (e) {
    console.error("[sapiens-briefing] fatal:", e);
    return send({ error: "internal", message: (e as Error).message }, 500, origin);
  }
});
