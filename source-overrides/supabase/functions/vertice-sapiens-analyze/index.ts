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

// ================================================================
// DUAL-LLM ENGINE: OpenAI gera, Anthropic revisa (e vice-versa)
// Se apenas uma key estiver configurada, ela faz ambos os papéis.
// ================================================================

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  model = "gpt-4o",
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
  return { content: data.choices?.[0]?.message?.content || "{}", model };
}

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  model = "claude-sonnet-4-20250514",
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
  return { content: data.content?.[0]?.text || "{}", model };
}

// Generate: OpenAI primary, Anthropic fallback
async function generateDiagnosis(
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; model: string }> {
  const oai = await callOpenAI(systemPrompt, userPrompt);
  if (oai) return oai;
  const anth = await callAnthropic(systemPrompt, userPrompt);
  if (anth) return anth;
  throw new Error("No LLM API key configured (OPENAI_API_KEY or ANTHROPIC_API_KEY)");
}

// Contradictory review: Anthropic primary (different LLM reviews), OpenAI fallback
async function reviewContradictory(
  diagnosis: Record<string, unknown>,
  context: string,
  generatorModel: string
): Promise<{ notes: string; reviewer: string; divergence: "none" | "minor" | "major" }> {
  const reviewSystem = `Você é um auditor crítico independente. Sua função é REVISAR um diagnóstico pedagógico produzido por outra IA (${generatorModel}).

VOCÊ NÃO GEROU ESTE DIAGNÓSTICO. Sua tarefa é encontrar furos nele.

Seja rigoroso. Procure:
1. Conclusões que os dados NÃO sustentam
2. Vieses de seleção ignorados (apenas alunos do Fato & Ordem, não a turma inteira)
3. Amostra insuficiente tratada como conclusiva
4. Intervenção desproporcional ao problema
5. Confusão entre dificuldade do instrumento e deficiência de aprendizagem
6. Hipóteses apresentadas como fatos

Responda APENAS em JSON:
{
  "contradictory_notes": "string — sua análise crítica do diagnóstico (200-800 chars)",
  "issues_found": ["lista de problemas identificados"],
  "divergence": "none | minor | major",
  "recommendation": "proceed | revise | reject_for_human_review"
}`;

  const reviewUser = `DIAGNÓSTICO SENDO REVISADO:
${JSON.stringify(diagnosis, null, 2)}

DADOS ORIGINAIS:
${context}

Revise criticamente. Se o diagnóstico for sólido, diga — mas não concorde por cortesia.`;

  // Use the OTHER LLM for review — if generator was OpenAI, reviewer is Anthropic
  let result: { content: string; model: string } | null = null;

  if (generatorModel.startsWith("gpt")) {
    // Generator was OpenAI → reviewer is Anthropic
    result = await callAnthropic(reviewSystem, reviewUser);
    if (!result) result = await callOpenAI(reviewSystem, reviewUser); // same-LLM fallback
  } else {
    // Generator was Anthropic → reviewer is OpenAI
    result = await callOpenAI(reviewSystem, reviewUser);
    if (!result) result = await callAnthropic(reviewSystem, reviewUser); // same-LLM fallback
  }

  if (!result) {
    return { notes: "Contraditório não executado: nenhuma LLM disponível para revisão.", reviewer: "none", divergence: "none" };
  }

  try {
    const parsed = JSON.parse(result.content);
    return {
      notes: String(parsed.contradictory_notes || "Revisão sem observações."),
      reviewer: result.model,
      divergence: (["none", "minor", "major"].includes(parsed.divergence) ? parsed.divergence : "none") as "none" | "minor" | "major",
    };
  } catch {
    return { notes: result.content.slice(0, 800), reviewer: result.model, divergence: "minor" };
  }
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
    const diagnosisIds: string[] = [];
    const interventionIds: string[] = [];

    for (const [key, agg] of competencyMap.entries()) {
      if (agg.studentCount < 3) continue; // Skip tiny samples

      const severity = classifySeverity(agg.accuracy, agg.avgPKnow || agg.accuracy);

      // For critical/warning: generate LLM diagnosis
      let summary = "";
      let detailedAnalysis = {};
      let recommendedActions: unknown[] = [];
      let contradictoryNotes = "";
      let llmModel = "rule-based";

      if (severity === "critical" || severity === "warning") {
        const courseName = courseNames.get(agg.courseId) || "Curso";
        const prev = prevMap.get(`${agg.courseId}:${agg.module}`);

        // STEP 1: GENERATE — OpenAI produces the diagnosis
        const generatePrompt = `Você é um auditor pedagógico institucional sênior. Analise dados de desempenho acadêmico e produza diagnóstico fundamentado. Responda APENAS em JSON válido com os campos: summary (string, 50-500 chars), detailed_analysis (object com campos: main_findings, possible_causes, methodology_notes), recommended_actions (array de {type, title, description, priority}).

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

        try {
          // Step 1: Generate diagnosis
          const generated = await generateDiagnosis(generatePrompt, dataContext);
          llmModel = generated.model;
          const parsed = JSON.parse(generated.content);
          summary = String(parsed.summary || "").slice(0, 2000);
          detailedAnalysis = parsed.detailed_analysis || {};
          recommendedActions = Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions : [];

          // Step 2: REVIEW — the OTHER LLM reviews the diagnosis
          const review = await reviewContradictory(parsed, dataContext, generated.model);
          contradictoryNotes = review.notes;
          llmModel = `${generated.model}+${review.reviewer}`;

          // Enrich the detailed analysis with review metadata
          (detailedAnalysis as Record<string, unknown>).contradictory_review = {
            reviewer_model: review.reviewer,
            generator_model: generated.model,
            divergence: review.divergence,
            notes: review.notes,
          };

          // If major divergence, flag for human review
          if (review.divergence === "major") {
            summary = `⚠️ DIVERGÊNCIA ENTRE IAs — ${summary}`;
            (detailedAnalysis as Record<string, unknown>).requires_human_review = true;
            (detailedAnalysis as Record<string, unknown>).divergence_reason =
              "O diagnóstico gerado e a revisão crítica chegaram a conclusões significativamente diferentes. Revisão humana obrigatória.";
          }
        } catch (llmError) {
          console.error("[sapiens-analyze] LLM error:", llmError);
          summary = `Competência ${agg.module} com taxa de acerto de ${(agg.accuracy * 100).toFixed(1)}% (${severity}). Diagnóstico automatizado requer revisão.`;
          llmModel = "fallback-rule";
        }
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
