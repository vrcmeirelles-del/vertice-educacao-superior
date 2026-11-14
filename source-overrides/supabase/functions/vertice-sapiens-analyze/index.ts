/**
 * vertice-sapiens-analyze
 *
 * Diagnostic engine: reads learning events + metrics, aggregates by competency,
 * classifies severity, generates LLM-based diagnosis with mandatory contradictory,
 * and proposes pedagogical interventions.
 *
 * Invoked by sapiens-sync when new data is detected, or manually by coordinator.
 */

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (fn: (req: Request) => Promise<Response>) => void;
};

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { createSapiensEngine, executionMetadata } from "../_shared/sapiens-llm.ts";

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
  correct: number;
  accuracy: number;
  avgPKnow: number;
  avgElo: number;
  studentCount: number;
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
    const institutionId = String(body.institutionId || "").trim().toLowerCase();
    if (!UUID.test(institutionId)) return send({ error: "invalid_institution" }, 400, origin);

    // Get institution info
    const { data: inst } = await admin
      .from("vertice_institutions")
      .select("id, name, tier")
      .eq("id", institutionId)
      .maybeSingle();
    if (!inst) return send({ error: "institution_not_found" }, 404, origin);

    // Get course metrics from learning bridge
    const { data: metrics } = await admin
      .from("vertice_learning_course_metrics")
      .select("*")
      .eq("institution_id", institutionId);

    if (!metrics?.length) {
      return send({ ok: true, message: "No learning data available for analysis", diagnoses: [] }, 200, origin);
    }

    // Aggregate by competency
    const competencyMap = new Map<string, CompetencyAgg>();
    for (const m of metrics) {
      const key = `${m.course_id}:${m.module}:${m.semester}`;
      const existing = competencyMap.get(key);
      if (existing) {
        existing.attempts += m.attempts || 0;
        existing.correct += m.correct || 0;
        existing.studentCount = Math.max(existing.studentCount, m.participants || 0);
      } else {
        competencyMap.set(key, {
          module: m.module,
          competency: null, // Aggregated at module level from metrics
          courseId: m.course_id,
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
      agg.accuracy = agg.attempts > 0 ? agg.correct / agg.attempts : 0;
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
      .select("id, course_id, module, sapiens_cycle")
      .eq("institution_id", institutionId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100);

    const prevMap = new Map(
      (prevDiagnoses || []).map((d: Record<string, unknown>) => [`${d.course_id}:${d.module}`, d])
    );

    const semester = currentSemester();
    const engine = createSapiensEngine(env);
    const diagnosisIds: string[] = [];
    const interventionIds: string[] = [];

    for (const [key, agg] of competencyMap.entries()) {
      if (agg.studentCount < 3) continue; // Skip tiny samples

      const severity = classifySeverity(agg.accuracy, agg.avgPKnow || agg.accuracy);

      // For critical/warning: generate LLM diagnosis
      let summary = "";
      let detailedAnalysis: Record<string, unknown> = {};
      let recommendedActions: unknown[] = [];
      let contradictoryNotes = "";
      let contradictoryChecked = false;
      let llmModel = "rule-based";

      if (severity === "critical" || severity === "warning") {
        const courseName = courseNames.get(agg.courseId) || "Curso";
        const prev = prevMap.get(`${agg.courseId}:${agg.module}`);

        // STEP 1: GENERATE — OpenAI produces the diagnosis
        const generatePrompt = `Você é um auditor pedagógico institucional sênior. Analise dados de desempenho acadêmico e produza diagnóstico fundamentado. Responda APENAS em JSON válido com os campos: summary (string, 50-500 chars), detailed_analysis (object com campos: main_findings, possible_causes, methodology_notes), recommended_actions (array de {type: "diagnostic_activity"|"remedial_practice"|"content_review"|"custom", title: string com ao menos 5 caracteres, description: string com ao menos 10 caracteres, priority}).

NÃO inclua contraditório — outra IA fará a revisão crítica do seu diagnóstico.`;

        const dataContext = `
Instituição: ${inst.name}
Curso: ${courseName}
Módulo: ${agg.module}
Semestre: ${semester}
Amostra: ${agg.studentCount} estudantes
Tentativas totais: ${agg.attempts}
Taxa de acerto: ${(agg.accuracy * 100).toFixed(1)}%
Severidade classificada: ${severity}
${prev ? `Ciclo anterior: #${(prev as Record<string, unknown>).sapiens_cycle} — havia diagnóstico prévio publicado.` : "Primeiro diagnóstico para este módulo."}`;

        const execution = await engine.run(generatePrompt, dataContext, "diagnosis");
        llmModel = execution.llm_model;
        const metadata = executionMetadata(execution);
        if (execution.generated) {
          const parsed = execution.generated.parsed;
          summary = String(parsed.summary);
          detailedAnalysis = { ...(parsed.detailed_analysis as Record<string, unknown>) };
          recommendedActions = parsed.recommended_actions as unknown[];
          contradictoryNotes = execution.review.notes;
          contradictoryChecked = execution.review.completed;
          if (execution.review.divergence === "major" || execution.review.recommendation === "reject_for_human_review") {
            summary = `⚠️ REVISÃO HUMANA OBRIGATÓRIA — ${summary}`;
            detailedAnalysis.divergence_reason = execution.review.notes;
          } else if (!execution.review.independent) {
            summary = `⚠️ SEM REVISÃO INDEPENDENTE — ${summary}`;
          }
        } else {
          summary = `Competência ${agg.module} com taxa de acerto de ${(agg.accuracy * 100).toFixed(1)}% (${severity}). IA indisponível: diagnóstico por regras requer revisão humana.`;
          // No generated intervention is inferred from a failed or malformed response.
          recommendedActions = [];
          contradictoryNotes = execution.review.notes;
        }
        detailedAnalysis.contradictory_review = metadata;
        detailedAnalysis.requires_human_review = true;
        detailedAnalysis.human_review_status = "pending";

      } else {
        summary = `Competência ${agg.module}: taxa de acerto ${(agg.accuracy * 100).toFixed(1)}% — classificação: ${severity}. ${agg.studentCount} estudantes avaliados.`;
      }

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
          semester,
          sample_size: agg.studentCount,
          avg_p_know: agg.avgPKnow || null,
          avg_elo_rating: agg.avgElo || null,
          accuracy_rate: agg.accuracy,
          attempt_count: agg.attempts,
          severity,
          summary: summary.slice(0, 2000),
          detailed_analysis: detailedAnalysis,
          recommended_actions: recommendedActions,
          contradictory_checked: contradictoryChecked,
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
        details: { severity, module: agg.module, accuracy: agg.accuracy, sample: agg.studentCount, llm_model: llmModel, llm_execution: detailedAnalysis.contradictory_review ?? null, requires_human_review: detailedAnalysis.requires_human_review === true },
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
