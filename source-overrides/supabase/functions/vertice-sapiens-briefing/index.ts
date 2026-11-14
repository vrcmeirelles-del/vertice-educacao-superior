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

const BRIEFING_PROMPTS: Record<string, string> = {
  morning: `Você é o Vértice Sapiens, sistema de inteligência institucional. Gere o briefing MATINAL para o coordenador.

FOCO: panorama do dia — riscos ativos, metas fora da trajetória, ações pendentes, agenda regulatória.
TOM: direto, executivo, prático. O coordenador começa o dia lendo este briefing.
FORMATO JSON: {summary: string (300-1000 chars), sections: [{title, severity: "critical"|"high"|"medium"|"low"|"info", items: [{text, action_required: boolean}]}]}`,

  midday: `Você é o Vértice Sapiens. Gere o briefing do MEIO-DIA.

FOCO: atualização operacional — novos dados desde a manhã, alertas disparados, status das ações em andamento, decisões pendentes de aprovação.
TOM: objetivo, focado no que mudou.
FORMATO JSON: {summary: string, sections: [{title, severity, items: [{text, action_required: boolean}]}]}`,

  evening: `Você é o Vértice Sapiens. Gere o briefing de ENCERRAMENTO do dia.

FOCO: consolidação — o que foi resolvido, o que ficou pendente, riscos que surgiram ou se agravaram, preparação para o dia seguinte.
TOM: conclusivo, preparatório.
FORMATO JSON: {summary: string, sections: [{title, severity, items: [{text, action_required: boolean}]}]}`,

  weekly_audit: `Você é o Vértice Sapiens. Gere a AUDITORIA SEMANAL TOTAL.

ESTA É A ANÁLISE MAIS COMPLETA. Cobre:
1. Balanço da semana: dados ingressados, decisões tomadas, ações executadas, pendências
2. Revisão de metas: no rumo / atenção / fora da trajetória / crítica
3. Revisão de ações 5W2H: concluída / em andamento / atrasada / não iniciada / bloqueada
4. Mapa de riscos: novos, agravados, mitigados, eliminados
5. Plano de ação semanal: prioridades reordenadas, novas ações recomendadas

TOM: analítico, estratégico, completo. O coordenador abre a segunda-feira com visão total.
FORMATO JSON: {summary: string (500-2000 chars), sections: [{title, severity, items: [{text, action_required: boolean}]}]}`,
};

// ================================================================
// DUAL-LLM BRIEFING: OpenAI gera, Anthropic revisa (e vice-versa)
// ================================================================

async function callOpenAI(system: string, user: string): Promise<{ content: string; model: string } | null> {
  const key = env("OPENAI_API_KEY");
  if (!key) return null;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: 4000, temperature: 0.3,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) return null;
  const d = await r.json();
  return { content: d.choices?.[0]?.message?.content || "{}", model: "gpt-4o" };
}

async function callAnthropic(system: string, user: string): Promise<{ content: string; model: string } | null> {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) return null;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 4000, system,
      messages: [{ role: "user", content: user + "\n\nResponda APENAS com JSON válido." }],
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) return null;
  const d = await r.json();
  return { content: d.content?.[0]?.text || "{}", model: "claude-sonnet-4" };
}

async function generateBriefing(system: string, user: string): Promise<{ content: string; model: string }> {
  const oai = await callOpenAI(system, user);
  if (oai) return oai;
  const anth = await callAnthropic(system, user);
  if (anth) return anth;
  throw new Error("No LLM configured");
}

async function reviewBriefing(
  briefing: Record<string, unknown>,
  context: string,
  generatorModel: string
): Promise<{ adjustments: string; reviewer: string }> {
  const reviewSystem = `Você é um revisor executivo independente. Outra IA (${generatorModel}) gerou um briefing institucional. Revise-o:

1. Algum risco foi subestimado ou omitido?
2. Alguma conclusão foi inflada sem base nos dados?
3. Alguma ação pendente ficou de fora?
4. O tom é adequado para o coordenador?

Responda APENAS em JSON: {"adjustments": "string com correções ou 'Briefing aprovado sem ressalvas.'", "issues": ["lista se houver"]}`;

  const reviewUser = `BRIEFING GERADO:\n${JSON.stringify(briefing, null, 2)}\n\nDADOS ORIGINAIS:\n${context}`;

  let result: { content: string; model: string } | null = null;
  if (generatorModel.startsWith("gpt")) {
    result = await callAnthropic(reviewSystem, reviewUser);
    if (!result) result = await callOpenAI(reviewSystem, reviewUser);
  } else {
    result = await callOpenAI(reviewSystem, reviewUser);
    if (!result) result = await callAnthropic(reviewSystem, reviewUser);
  }

  if (!result) return { adjustments: "", reviewer: "none" };
  try {
    const parsed = JSON.parse(result.content);
    return { adjustments: String(parsed.adjustments || ""), reviewer: result.model };
  } catch {
    return { adjustments: result.content.slice(0, 500), reviewer: result.model };
  }
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

    // Build context for LLM
    const context = JSON.stringify({
      institution: inst.name,
      briefingType,
      timestamp: now,
      diagnoses: (diagnoses || []).map((d: Record<string, unknown>) => ({
        module: d.module, severity: d.severity, summary: String(d.summary || "").slice(0, 200),
        status: d.status, age: d.created_at,
      })),
      interventions: (interventions || []).map((i: Record<string, unknown>) => ({
        title: i.title, status: i.status, module: i.module,
      })),
      findings: (findings || []).map((f: Record<string, unknown>) => ({
        ref: f.finding_ref, risk: f.risk_level, status: f.resolution_status,
        recommendation: String(f.recommendation || "").slice(0, 200), due: f.due_date,
      })),
      goals: (goals || []).map((g: Record<string, unknown>) => ({
        title: g.title, trajectory: g.trajectory, current: g.current_value,
        target: g.target_value, due: g.due_at,
      })),
      pendingActions: (actions || []).map((a: Record<string, unknown>) => ({
        what: a.what, status: a.status, date: a.planned_date,
      })),
      counters: { activeRisks, offTrackGoals, pendingActions, pendingApprovals, inProgress },
    });

    const systemPrompt = BRIEFING_PROMPTS[briefingType] || BRIEFING_PROMPTS.morning;
    const contextStr = `DADOS ATUAIS DA INSTITUIÇÃO:\n${context}`;

    // Step 1: GENERATE briefing
    const generated = await generateBriefing(systemPrompt, contextStr);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(generated.content);
    } catch {
      parsed = { summary: generated.content.slice(0, 5000), sections: [] };
    }

    // Step 2: REVIEW — the other LLM checks the briefing
    const review = await reviewBriefing(parsed, contextStr, generated.model);
    const llmModel = review.reviewer !== "none"
      ? `${generated.model}+${review.reviewer}`
      : generated.model;

    let summary = String(parsed.summary || "Briefing gerado sem resumo.").slice(0, 5000);
    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];

    // If reviewer had adjustments, append as a review section
    if (review.adjustments && review.adjustments !== "Briefing aprovado sem ressalvas.") {
      sections.push({
        title: "📋 Revisão independente",
        severity: "info",
        items: [{ text: review.adjustments, action_required: false }],
      });
    }

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
