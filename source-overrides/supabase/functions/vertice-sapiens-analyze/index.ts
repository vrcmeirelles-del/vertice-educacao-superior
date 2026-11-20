/**
 * vertice-sapiens-analyze
 *
 * Diagnostic engine: reads learning events + metrics, aggregates by competency,
 * classifies severity, builds the diagnosis by rule (no AI since 20/11/2026)
 * and proposes pedagogical interventions from a severity × module table.
 *
 * Invoked by sapiens-sync when new data is detected, or manually by coordinator.
 */

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (fn: (req: Request) => Promise<Response>) => void;
};

import { analyzePlanning } from "./planning.ts";
import { reviewThematic, precheckThematic } from "./thematic.ts";
import { buildDiagnosis } from "./diagnosis.ts";

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// IA suspensa até a plataforma gerar receita (decisão de 19/11/2026). Para religar: secret AI_SUSPENDED=false.
{const __aiFetch=globalThis.fetch;const __aiHosts=/(^|\.)(api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com)$/i;
globalThis.fetch=((input:any,init?:any)=>{let host="";try{host=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url).hostname;}catch{}
if(__aiHosts.test(host)&&String(Deno.env.get("AI_SUSPENDED")??"true").toLowerCase()!=="false")
 return Promise.resolve(new Response(JSON.stringify({error:{type:"ai_suspended",message:"IA suspensa temporariamente."}}),{status:503,headers:{"content-type":"application/json"}}));
return __aiFetch(input,init);}) as typeof fetch;}

const env = (k: string) => String(Deno.env.get(k) || "");
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
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
  new Response(status === 204 ? null : JSON.stringify(body), {
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

type Severity = "critical" | "warning" | "watch" | "adequate" | "strong";

function classifySeverity(accuracyRate: number, avgPKnow: number): Severity {
  const score = (accuracyRate + avgPKnow) / 2;
  if (score < 0.3) return "critical";
  if (score < 0.5) return "warning";
  if (score < 0.7) return "watch";
  if (score < 0.85) return "adequate";
  return "strong";
}

function currentSemester(): string {
  const now = new Date();
  return `${now.getFullYear()}/${now.getMonth() < 6 ? 1 : 2}`;
}

interface CompetencyAgg {
  module: string;
  competency: string | null;
  courseId: string;
  attempts: number;
  graded: number;
  semester: string;
  correct: number;
  accuracy: number;
  avgPKnow: number;
  avgElo: number;
  studentCount: number;
}

// ================================================================
// DUAL-LLM ENGINE: OpenAI gera, Anthropic revisa (e vice-versa)
// Se apenas uma key estiver configurada, ela faz ambos os papéis.
// ================================================================

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  model = env("OPENAI_MODEL") || "gpt-4o",
  maxTokens = 3000
): Promise<{ content: string; model: string } | null> {
  const key = env("OPENAI_API_KEY");
  if (!key) return null;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      max_tokens: maxTokens,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return { content: data.choices?.[0]?.message?.content || "{}", model: data.model || model };
}

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  model = env("ANTHROPIC_MODEL") || "claude-sonnet-4-6",
  maxTokens = 3000
): Promise<{ content: string; model: string } | null> {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) return null;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt + "\n\nResponda APENAS com JSON válido." }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return { content: data.content?.[0]?.text || "{}", model: data.model || model };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return send({ ok: true }, 204, origin);
  if (req.method !== "POST") return send({ error: "method_not_allowed" }, 405, origin);

  try {
    const { url, sk } = cfg();
    const admin = createClient(url, sk, { auth: { persistSession: false } });

    // Auth: either service_role (from sync) or authenticated user with appropriate role
    const auth = req.headers.get("authorization") || "";
    const isService = auth === `Bearer ${sk}`;
    let actorId: string | null = null;

    if (!isService) {
      if (!auth.startsWith("Bearer ")) return send({ error: "auth_required" }, 401, origin);
      const pk = env("SUPABASE_ANON_KEY") || (() => { try { return JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") || "{}").default; } catch { return ""; } })();
      const { data, error } = await admin.auth.getUser(auth.slice(7));
      if (error || !data.user) return send({ error: "auth_required" }, 401, origin);
      actorId = data.user.id;
    }

    const body = await req.json();
    if (body.action === "thematic_review") {
      if (isService || !actorId) return send({error:"user_auth_required"},403,origin);
      let claims: {aal?: string} = {};
      try { const p=auth.slice(7).split(".")[1].replace(/-/g,"+").replace(/_/g,"/"); claims=JSON.parse(atob(p.padEnd(Math.ceil(p.length/4)*4,"="))); } catch {}
      if (claims.aal !== "aal2") return send({error:"mfa_required"},403,origin);
      const master = await admin.from("vertice_admins").select("user_id").eq("user_id",actorId).maybeSingle();
      if (master.error) return send({error:"authorization_unavailable"},503,origin);
      if (!master.data) return send({error:"master_required"},403,origin);
      if (Object.keys(body).some(k=>!["action","question"].includes(k))) return send({error:"invalid_review_request"},400,origin);
      // IA suspensa (padrão): devolve só a pré-checagem por regras (auditoria V14).
      if (String(Deno.env.get("AI_SUSPENDED") ?? "true").toLowerCase() !== "false") {
        try { return send(await precheckThematic(body.question),200,origin); }
        catch(e) { const err=e as Error&{status?:number}; return send({error:err.status===400?err.message:"invalid_review_request"},400,origin); }
      }
      if (!env("OPENAI_API_KEY") || !env("ANTHROPIC_API_KEY")) return send({error:"two_providers_required"},503,origin);
      if (Object.keys(body).some(k=>!["action","question"].includes(k))) return send({error:"invalid_review_request"},400,origin);
      try {
        const result = await reviewThematic(body.question,callOpenAI,callAnthropic);
        return send(result,200,origin);
      } catch(e) {
        const err=e as Error & {status?:number};
        return send({error:err.status===400?err.message:"thematic_review_failed"},err.status===400?400:503,origin);
      }
    }
    const institutionId = String(body.institutionId || "").trim().toLowerCase();
    if (!UUID.test(institutionId)) return send({ error: "invalid_institution" }, 400, origin);

    if (body.action === "planning") {
      if (isService || !actorId) return send({error:"user_auth_required"},403,origin);
      const pk = env("SUPABASE_ANON_KEY") || (()=>{try{return JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS")||"{}").default;}catch{return "";}})();
      const userClient = createClient(url, pk || sk, {global:{headers:{Authorization:auth}},auth:{persistSession:false}});
      const output = await analyzePlanning(userClient,admin,institutionId,body,callOpenAI,callAnthropic);
      return send(output.body,output.status,origin);
    }

    if (!isService) {
      const jwt=auth.slice(7);let aal="";
      try {const part=jwt.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");aal=JSON.parse(atob(part.padEnd(Math.ceil(part.length/4)*4,"="))).aal;}catch{}
      if(aal!=="aal2")return send({error:"mfa_required"},403,origin);
      const master=await admin.from("vertice_admins").select("user_id").eq("user_id",actorId).maybeSingle();
      if(master.error)return send({error:"authorization_unavailable"},503,origin);
      if(!master.data){
        const member=await admin.from("vertice_memberships").select("role").eq("user_id",actorId).eq("institution_id",institutionId).maybeSingle();
        if(member.error||!member.data||!["gestor","reitor","diretor_geral","diretor_pedagogico","procurador"].includes(member.data.role))return send({error:"forbidden"},403,origin);
      }
    }

    // Get institution info
    const { data: inst } = await admin
      .from("vertice_institutions")
      .select("id, name, tier")
      .eq("id", institutionId)
      .maybeSingle();
    if (!inst) return send({ error: "institution_not_found" }, 404, origin);

    // Get course metrics from learning bridge
    const { data: metrics, error: metricsError } = await admin
      .from("vertice_learning_course_metrics")
      .select("*")
      .eq("institution_id", institutionId);

    if(metricsError)return send({error:'metrics_unavailable'},503,origin);
    if (!metrics?.length) {
      return send({ ok: true, message: "No learning data available for analysis", diagnoses: [] }, 200, origin);
    }

    // Aggregate by competency
    const competencyMap = new Map<string, CompetencyAgg>();
    for (const m of metrics) {
      const key = JSON.stringify([m.course_id,m.module,m.semester,m.subject_code,m.competency]);
      const existing = competencyMap.get(key);
      if (existing) {
        existing.attempts += m.attempts || 0;
        existing.graded += m.graded || 0;
        existing.correct += m.correct || 0;
        existing.studentCount = Math.max(existing.studentCount, m.participants || 0);
      } else {
        competencyMap.set(key, {
          module: m.module,
          competency: [m.subject_code,m.competency].filter(Boolean).join(' · ') || null,
          courseId: m.course_id,
          semester:m.semester,
          graded:m.graded||0,
          attempts: m.attempts || 0,
          correct: m.correct || 0,
          accuracy: m.attempts > 0 ? (m.correct || 0) / m.attempts : 0,
          avgPKnow: 0, // Will be enriched from mastery data
          avgElo: 0,
          studentCount: m.participants || 0,
        });
      }
    }

    // Recalculate accuracy
    for (const agg of competencyMap.values()) {
      agg.accuracy = agg.graded > 0 ? agg.correct / agg.graded : 0;
    }

    // Get courses for names
    const courseIds = [...new Set([...competencyMap.values()].map(a => a.courseId))];
    const { data: courses } = await admin
      .from("vertice_courses")
      .select("id, name")
      .in("id", courseIds);
    const courseNames = new Map((courses || []).map((c: { id: string; name: string }) => [c.id, c.name]));

    // Get previous diagnoses for cycle tracking
    const { data: prevDiagnoses } = await admin
      .from("vertice_sapiens_diagnoses")
      .select("id, course_id, module, sapiens_cycle, accuracy_rate")
      .eq("institution_id", institutionId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100);

    // Mais recente primeiro: mantém só o primeiro de cada curso/módulo.
    const prevMap = new Map<string, Record<string, unknown>>();
    for (const d of (prevDiagnoses || []) as Record<string, unknown>[]) {
      const k = `${d.course_id}:${d.module}`;
      if (!prevMap.has(k)) prevMap.set(k, d);
    }

    const semester = currentSemester();
    const diagnosisIds: string[] = [];
    const interventionIds: string[] = [];

    for (const [key, agg] of competencyMap.entries()) {
      if (agg.studentCount < 5 || agg.graded === 0) continue; // Skip tiny samples

      const severity = classifySeverity(agg.accuracy, agg.avgPKnow || agg.accuracy);

      // Diagnóstico por algoritmo (sem IA): texto dos números e ações por tabela.
      const prevForText = prevMap.get(`${agg.courseId}:${agg.module}`);
      const built = buildDiagnosis({
        courseName: String(courseNames.get(agg.courseId) || "Curso"), module: agg.module, competency: agg.competency,
        semester: agg.semester, severity, accuracy: agg.accuracy, graded: agg.graded, attempts: agg.attempts,
        studentCount: agg.studentCount,
        previousAccuracy: prevForText && prevForText.accuracy_rate != null ? Number(prevForText.accuracy_rate) : null,
        previousCycle: prevForText ? Number(prevForText.sapiens_cycle || 0) || null : null,
      });
      let summary = built.summary;
      const detailedAnalysis: Record<string, unknown> = built.detailedAnalysis;
      const recommendedActions: unknown[] = built.recommendedActions;
      const contradictoryNotes = "";
      const llmModel = "algoritmo";

      if (summary.length < 10) summary = `Diagnóstico ${severity} para ${agg.module} — ${agg.studentCount} estudantes, ${(agg.accuracy * 100).toFixed(1)}% acerto.`;

      const prev = prevMap.get(`${agg.courseId}:${agg.module}`);
      const cycle = prev ? Number((prev as Record<string, unknown>).sapiens_cycle || 0) + 1 : 1;

      // Insert diagnosis
      const { data: diagnosis, error: diagError } = await admin
        .from("vertice_sapiens_diagnoses")
        .insert({
          institution_id: institutionId,
          course_id: agg.courseId,
          module: agg.module,
          competency: agg.competency,
          semester:agg.semester,
          sample_size: agg.studentCount,
          avg_p_know: agg.avgPKnow || null,
          avg_elo_rating: agg.avgElo || null,
          accuracy_rate: agg.accuracy,
          attempt_count: agg.attempts,
          severity,
          summary,
          detailed_analysis: detailedAnalysis,
          recommended_actions: recommendedActions,
          contradictory_checked: contradictoryNotes.length > 0,
          contradictory_notes: contradictoryNotes || null,
          llm_model: llmModel,
          data_snapshot_at: new Date().toISOString(),
          sapiens_cycle: cycle,
          previous_diagnosis_id: prev ? (prev as Record<string, unknown>).id as string : null,
          status: "draft",
        })
        .select("id")
        .single();

      if (diagError) {
        console.error("[sapiens-analyze] diagnosis insert error:", diagError);
        continue;
      }

      diagnosisIds.push(diagnosis.id);

      // For critical/warning: auto-create intervention proposal
      if ((severity === "critical" || severity === "warning") && recommendedActions.length > 0) {
        const topAction = recommendedActions[0] as Record<string, unknown>;
        const { data: intervention, error: intError } = await admin
          .from("vertice_sapiens_interventions")
          .insert({
            institution_id: institutionId,
            diagnosis_id: diagnosis.id,
            course_id: agg.courseId,
            module: agg.module,
            competency: agg.competency,
            intervention_type: String(topAction.type || "remedial_practice").slice(0, 30) as
              "diagnostic_activity" | "remedial_practice" | "content_review" | "custom",
            title: String(topAction.title || `Intervenção: ${agg.module}`).slice(0, 200),
            description: String(topAction.description || summary).slice(0, 2000),
            suggested_kc_ids: [],
            target_p_know: severity === "critical" ? 0.5 : 0.7,
            llm_model: llmModel,
            llm_rationale: JSON.stringify(topAction),
            status: "proposed",
            baseline_avg_p_know: agg.avgPKnow || agg.accuracy,
            baseline_avg_elo: agg.avgElo || null,
            baseline_sample_size: agg.studentCount,
            baseline_measured_at: new Date().toISOString(),
            sapiens_cycle: cycle,
          })
          .select("id")
          .single();

        if (!intError && intervention) interventionIds.push(intervention.id);
      }

      // Audit trail
      await admin.from("vertice_sapiens_audit_trail").insert({
        institution_id: institutionId,
        entity_type: "diagnosis",
        entity_id: diagnosis.id,
        action: "created",
        actor_id: actorId,
        actor_type: isService ? "system" : "user",
        details: { severity, module: agg.module, accuracy: agg.accuracy, sample: agg.studentCount },
      });
    }

    return send(
      {
        ok: true,
        institutionId,
        semester,
        diagnoses: diagnosisIds.length,
        interventionsProposed: interventionIds.length,
        diagnosisIds,
        interventionIds,
      },
      200,
      origin
    );
  } catch (e) {
    console.error("[sapiens-analyze] fatal:", e);
    return send({ error: "internal", message: (e as Error).message }, 500, origin);
  }
});

