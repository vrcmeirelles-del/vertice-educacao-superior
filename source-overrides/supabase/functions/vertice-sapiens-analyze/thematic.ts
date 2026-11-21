/**
 * Revisão temática por regras (sem IA). Só conferência: nenhum cliente de banco nem publicação.
 * Valida o snapshot e aplica regras determinísticas: rótulo específico, gabarito, anulação, mídia,
 * referência temporal (medicina e recortes normativos) e marcações docentes. Nunca publica.
 */
type Obj = Record<string, any>;
export const THEMATIC_VERSION = "sapiens-thematic-rules-2026-11-v2";
const modules = new Set(["oab1", "oab2", "carreiras", "cfc", "enade", "enamed", "residencia", "enem"]);
const fail = (code: string) => Object.assign(new Error(code), { status: 400 });
const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const norm = (v: string) => v.normalize("NFKC").replace(/\s+/g, " ").trim();
const allowedFlags = ["missing_media", "annulled", "missing_answer", "experimental", "human_locked"];
export function validateThematic(input: Obj): Obj {
  if (!input || !modules.has(input.module) || !text(input.sourceKey) || !text(input.stem) || !text(input.sourceVersion)) throw fail("invalid_question_snapshot");
  if (!input.proposed || !["discipline", "theme", "subtheme"].every(k => text(input.proposed[k]))) throw fail("specific_classification_required");
  const label = (v: string) => norm(v).toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const generic = new Set(["direito", "medicina", "formacao geral", "conhecimentos gerais", "outros", "geral", "a definir", "sem tema", "sem subtema"]);
  if (generic.has(label(input.proposed.theme)) || generic.has(label(input.proposed.subtheme)) || label(input.proposed.theme) === label(input.proposed.subtheme) || label(input.proposed.theme) === label(input.proposed.discipline)) throw fail("generic_classification");
  if (Object.keys(input.proposed).some(k => !["area", "discipline", "theme", "subtheme", "secondary"].includes(k))) throw fail("invalid_classification_fields");
  if (!Array.isArray(input.flags) || input.flags.some((x: unknown) => !allowedFlags.includes(String(x)))) throw fail("invalid_flags");
  if (!Array.isArray(input.references) || input.references.length > 10) throw fail("invalid_references");
  for (const r of input.references) {
    if (!r || !["id", "url", "locator", "excerpt", "version", "retrievedAt"].every(k => text(r[k]))) throw fail("reference_traceability_required");
    let u; try { u = new URL(r.url); } catch { throw fail("invalid_reference_url"); }
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password) throw fail("invalid_reference_url");
    if (!Number.isFinite(Date.parse(r.retrievedAt))) throw fail("invalid_reference_date");
  }
  if (new Set(input.references.map((r: Obj) => r.id)).size !== input.references.length) throw fail("duplicate_reference_id");
  if (JSON.stringify(input).length > 24000 || input.stem.length > 12000) throw fail("question_snapshot_too_large");
  return input;
}

export function thematicDecision(input: Obj) {
  const reasons = [...input.flags];
  if (!input.answer && !input.rubric?.length && input.format !== "discursive") reasons.push("missing_answer");
  if (["ANULADA", "X"].includes(String(input.answer).toUpperCase())) reasons.push("annulled");
  if (input.mediaRequired === true || /\[\s*imagem\s*:/i.test(input.stem) || /tirinhas|(?:na|pela|da) (?:imagem|figura)|(?:imagem|figura) (?:abaixo|acima|apresentada)/i.test(input.command || input.stem)) reasons.push("media_not_confirmed");
  if (["enamed", "residencia"].includes(input.module) || input.temporalReferenceRequired === true) {
    if (!input.references.length || !text(input.examDate) || !Number.isFinite(Date.parse(input.examDate))) reasons.push("temporal_reference_required");
  }
  return { status: reasons.length ? "blocked" : "rules_passed_proposal_only", reasons: [...new Set(reasons)], publicationAllowed: false };
}
async function hash(value: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
}
// Revisão por regras: o resultado é uma proposta conferida, nunca uma publicação.
export async function reviewThematic(raw: Obj) {
  const input = validateThematic(raw);
  const snapshotHash = await hash(JSON.stringify(input));
  return { command: "thematic_review", version: THEMATIC_VERSION, method: "regras", snapshotHash, sourceKey: input.sourceKey, sourceVersion: input.sourceVersion,
    sourceVerification: "supplied_snapshot_not_operational_read", referencesVerification: "provided_excerpts_not_independently_fetched",
    decision: thematicDecision(input),
    note: "Revisão por regras determinísticas, sem IA. A aprovação do descritor cabe à revisão humana; nada é publicado.",
    proposed: input.proposed, sourceWrites: 0, publicationAllowed: false, persistence: "returned_receipt_only" };
}
