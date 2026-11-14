/** Request-scoped dual-provider execution. No secrets, prompts or raw errors in telemetry. */
export type Provider = "openai" | "anthropic";
export type Workload = "diagnosis" | "briefing";
type Json = Record<string, unknown>;
type Stage = "generation" | "review";
export interface Attempt {
  provider: Provider;
  stage: Stage;
  requested_model: string;
  resolved_model?: string;
  status: "success" | "failed" | "skipped";
  code?: string;
  http_status?: number;
  request_id?: string;
}
interface Completion { provider: Provider; model: string; parsed: Json }
export interface Review {
  status: "independent" | "same_provider" | "unavailable";
  completed: boolean;
  independent: boolean;
  reviewer_model: string | null;
  reviewer_provider: Provider | null;
  divergence: "none" | "minor" | "major" | "unknown";
  recommendation: "proceed" | "revise" | "reject_for_human_review";
  notes: string;
  issues: string[];
}
export interface Execution {
  generated: Completion | null;
  review: Review;
  attempts: Attempt[];
  llm_model: string;
  requires_human_review: true;
}

// Official Claude API ID, active on 2026-11-14. Preserve the existing OpenAI model.
export const DEFAULT_MODELS = { openai: "gpt-4o", anthropic: "claude-sonnet-4-6" };
const RETIRED_CLAUDE = new Set(["claude-sonnet-4-20250514", "claude-sonnet-4-0"]);
const isObject = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");

function parseJson(text: string): Json | null {
  try {
    const parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1"));
    return isObject(parsed) ? parsed : null;
  } catch { return null; }
}

function validGeneration(p: Json, kind: Workload): boolean {
  if (!isText(p.summary)) return false;
  if (kind === "briefing") return Array.isArray(p.sections) && p.sections.every(s =>
    isObject(s) && isText(s.title) && ["critical", "high", "medium", "low", "info"].includes(String(s.severity)) &&
    Array.isArray(s.items) && s.items.every(i => isObject(i) && isText(i.text) && typeof i.action_required === "boolean"));
  return isObject(p.detailed_analysis) && Array.isArray(p.recommended_actions) && p.recommended_actions.every(a =>
    isObject(a) && ["diagnostic_activity", "remedial_practice", "content_review", "custom"].includes(String(a.type)) &&
    isText(a.title) && a.title.length >= 5 && isText(a.description) && a.description.length >= 10);
}

function validReview(p: Json, kind: Workload): boolean {
  return isText(p[kind === "diagnosis" ? "contradictory_notes" : "adjustments"]) &&
    strings(p[kind === "diagnosis" ? "issues_found" : "issues"]) &&
    ["none", "minor", "major"].includes(String(p.divergence)) &&
    ["proceed", "revise", "reject_for_human_review"].includes(String(p.recommendation));
}

/** One engine per HTTP request; a failed provider is not hammered again in that request. */
export function createSapiensEngine(
  env: (key: string) => string | undefined,
  request: typeof fetch = fetch,
  options: { maxTokens?: number; timeoutMs?: number } = {},
) {
  const blocked = new Set<Provider>();
  const models = {
    openai: env("SAPIENS_OPENAI_MODEL")?.trim() || DEFAULT_MODELS.openai,
    anthropic: env("SAPIENS_ANTHROPIC_MODEL")?.trim() || DEFAULT_MODELS.anthropic,
  };
  const keys = { openai: env("OPENAI_API_KEY")?.trim(), anthropic: env("ANTHROPIC_API_KEY")?.trim() };

  async function call(provider: Provider, stage: Stage, system: string, user: string, kind: Workload, attempts: Attempt[]): Promise<Completion | null> {
    const model = models[provider];
    const attempt: Attempt = { provider, stage, requested_model: model, status: "failed" };
    attempts.push(attempt);
    if (!keys[provider]) { attempt.status = "skipped"; attempt.code = "not_configured"; return null; }
    if (provider === "anthropic" && RETIRED_CLAUDE.has(model)) {
      attempt.code = "retired_model"; blocked.add(provider); return null;
    }
    if (blocked.has(provider)) { attempt.status = "skipped"; attempt.code = "blocked_after_failure"; return null; }
    const maxTokens = options.maxTokens ?? 3000;
    const body = provider === "openai" ? {
      model, messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: maxTokens, temperature: 0.3, response_format: { type: "json_object" },
    } : {
      model, max_tokens: maxTokens, system,
      messages: [{ role: "user", content: `${user}\n\nResponda APENAS com JSON válido.` }],
    };
    try {
      const response = await request(provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.anthropic.com/v1/messages", {
        method: "POST", redirect: "error",
        headers: provider === "openai"
          ? { "Content-Type": "application/json", Authorization: `Bearer ${keys.openai}` }
          : { "Content-Type": "application/json", "x-api-key": keys.anthropic!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
      });
      attempt.http_status = response.status;
      const requestId = response.headers.get("request-id") || response.headers.get("x-request-id");
      if (requestId) attempt.request_id = requestId.slice(0, 200);
      if (!response.ok) {
        attempt.code = response.status === 401 || response.status === 403 ? "authentication_error"
          : response.status === 404 ? "model_or_endpoint_not_found"
          : response.status === 429 ? "rate_limit" : response.status >= 500 ? "service_unavailable" : "http_error";
        blocked.add(provider);
        await response.body?.cancel().catch(() => {});
        return null;
      }
      let data: Json;
      try { const raw = await response.json(); if (!isObject(raw)) throw new SyntaxError(); data = raw; }
      catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        attempt.code = "invalid_response";
        return null;
      }
      // The response model is authoritative; requested ID is retained separately.
      if (!isText(data.model)) { attempt.code = "missing_model_metadata"; return null; }
      attempt.resolved_model = data.model;
      const choice = Array.isArray(data.choices) ? data.choices[0] : null;
      const message = isObject(choice) && isObject(choice.message) ? choice.message : null;
      const complete = provider === "openai" ? isObject(choice) && choice.finish_reason === "stop" && !message?.refusal
        : data.stop_reason === "end_turn";
      if (!complete) { attempt.code = "incomplete_or_refused"; return null; }
      const content = provider === "openai" ? message?.content : Array.isArray(data.content)
        ? data.content.filter(c => isObject(c) && c.type === "text" && typeof c.text === "string").map(c => c.text).join("\n") : null;
      const parsed = typeof content === "string" ? parseJson(content) : null;
      if (!parsed || !(stage === "generation" ? validGeneration(parsed, kind) : validReview(parsed, kind))) {
        attempt.code = "invalid_output"; return null;
      }
      attempt.status = "success";
      return { provider, model: data.model, parsed };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      attempt.code = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error";
      blocked.add(provider);
      return null;
    }
  }

  return {
    async run(system: string, context: string, kind: Workload): Promise<Execution> {
      const attempts: Attempt[] = [];
      const generated = await call("openai", "generation", system, context, kind, attempts)
        || await call("anthropic", "generation", system, context, kind, attempts);
      const review: Review = {
        status: "unavailable", completed: false, independent: false,
        reviewer_model: null, reviewer_provider: null, divergence: "unknown",
        recommendation: "reject_for_human_review", issues: [],
        notes: "Revisão não executada: nenhum provedor forneceu uma revisão válida. Revisão humana obrigatória.",
      };
      if (generated) {
        const field = kind === "diagnosis" ? "contradictory_notes" : "adjustments";
        const issuesField = kind === "diagnosis" ? "issues_found" : "issues";
        const reviewSystem = `Você é um auditor crítico. Revise o ${kind === "diagnosis" ? "diagnóstico pedagógico" : "briefing institucional"} gerado por ${generated.provider} (${generated.model}).
Verifique conclusões sem evidência, vieses de seleção (participantes do Fato & Ordem não representam toda a turma), amostra insuficiente, intervenções desproporcionais, riscos omitidos e hipóteses tratadas como fatos.
Responda APENAS em JSON: {"${field}": "análise crítica", "${issuesField}": ["problemas identificados"], "divergence": "none|minor|major", "recommendation": "proceed|revise|reject_for_human_review"}.
Use major quando a divergência alterar a decisão. A revisão é uma proposta e não substitui aprovação humana.`;
        const reviewUser = `DOCUMENTO A REVISAR:\n${JSON.stringify(generated.parsed)}\n\nDADOS ORIGINAIS:\n${context}`;
        const other: Provider = generated.provider === "openai" ? "anthropic" : "openai";
        const result = await call(other, "review", reviewSystem, reviewUser, kind, attempts)
          || await call(generated.provider, "review", `${reviewSystem}\nEsta é uma segunda passagem pelo mesmo provedor; não a apresente como revisão independente.`, reviewUser, kind, attempts);
        if (result) {
          const independent = generated.provider !== result.provider;
          Object.assign(review, {
            status: independent ? "independent" : "same_provider", completed: true, independent,
            reviewer_model: result.model, reviewer_provider: result.provider,
            divergence: result.parsed.divergence, recommendation: result.parsed.recommendation,
            notes: String(result.parsed[field]).slice(0, 2000), issues: result.parsed[issuesField],
          });
        }
      }
      return {
        generated, review, attempts, requires_human_review: true,
        llm_model: generated ? [generated.model, ...(review.reviewer_model ? [review.reviewer_model] : [])].join("+") : "fallback-rule",
      };
    },
  };
}

export function executionMetadata(result: Execution): Json {
  return {
    generator_model: result.generated?.model ?? null, generator_provider: result.generated?.provider ?? null,
    ...result.review, attempts: result.attempts, requires_human_review: true,
  };
}
