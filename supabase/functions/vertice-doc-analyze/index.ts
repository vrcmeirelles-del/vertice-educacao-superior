import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { unzipSync } from "npm:fflate@0.8.2";
import { ruleAnalysis } from "./doc-rules.ts";
// Algorithm-only documentary processing: no provider or environment opt-in.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DAILY_LIMIT_PER_INSTITUTION = Number(Deno.env.get("DOC_ANALYZE_DAILY_LIMIT") || "40");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const ALLOWED_ORIGINS = new Set([
  "https://www.verticesuperior.com.br",
  "https://verticesuperior.com.br",
  "https://vertice-portal.onrender.com",
  "https://vertice-educacao-superior.onrender.com",
  "https://vertice-educacao-superior-site.onrender.com",
  "https://vertice-educacao-superior-jlri.onrender.com",
]);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://www.verticesuperior.com.br",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const zip = unzipSync(new Uint8Array(buffer), { filter: f => {
    if(f.name !== "word/document.xml")return false;
    if(f.originalSize>32*1024*1024)throw Error("zip_expansion_limit");
    return true;
  }});
  const xml = zip["word/document.xml"] ? new TextDecoder("utf-8",{fatal:true}).decode(zip["word/document.xml"]) : "";
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error("xml_entities_not_supported");
  if (!xml) return "";
  return xml
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<w:p[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjs: any = await import("npm:pdfjs-dist@6.5.438/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)), useSystemFonts: false, disableFontFace: true, isEvalSupported: false, useWorkerFetch: false, stopAtErrors: true });
    try {
      const doc = await task.promise; const pages: string[] = [];
      for (let n = 1; n <= Math.min(doc.numPages, 120); n++) {
        const c = await (await doc.getPage(n)).getTextContent();
        pages.push(c.items.map((x: any) => (x.str || "") + (x.hasEOL ? "\n" : " ")).join(""));
        if (pages.join("").length > 200000) break;
      }
      const text = pages.join("\n").trim();
      if (text.length >= 50) return text;
    } finally { await task.destroy(); }
  } catch (_) { /* cai na leitura simples abaixo */ }
  return ""; // No binary-regex fallback: unreadable/scanned PDF requires explicit OCR review.
}

interface DocCategory { code: string; label: string; tier: string; regulatory_basis: string | null; renewal_months: number | null; required_for: string[] | null; }
interface Finding { type: string; severity: string; title: string; message: string; regulatory_reference?: string; suggestion?: string; page_number?: number; }
interface AnalysisResult { summary: string; compliance_score: number; findings: Finding[]; }

Deno.serve(async (req: Request) => {
  const corsHeaders = corsFor(req);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Método não permitido" }, 405);

  let documentId: string | null = null;
  let authorized = false;
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return reply({ error: "Não autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return reply({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    documentId = typeof body?.document_id === "string" ? body.document_id : null;
    if (!documentId) return reply({ error: "document_id obrigatório" }, 400);

    // Autorização: o documento precisa ser visível ao usuário pelo RLS.
    const { data: visible } = await userClient.from("vertice_documents").select("id").eq("id", documentId).maybeSingle();
    if (!visible) return reply({ error: "Documento não encontrado" }, 404);
    authorized = true;

    const { data: doc, error: docErr } = await supabase
      .from("vertice_documents")
      .select("*, vertice_doc_categories(*)")
      .eq("id", documentId)
      .single();
    if (docErr || !doc) return reply({ error: "Documento não encontrado" }, 404);

    // Cota diária por instituição.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("vertice_documents")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", doc.institution_id)
      .gte("ai_analyzed_at", since);
    if ((count ?? 0) >= DAILY_LIMIT_PER_INSTITUTION) {
      return reply({ status: "rate_limited", error: "Limite diário de análises da instituição atingido" }, 429);
    }

    await supabase.from("vertice_documents").update({ ai_status: "processing", updated_at: new Date().toISOString() }).eq("id", documentId);

    const { data: inst } = await supabase.from("vertice_institutions").select("tier").eq("id", doc.institution_id).single();
    const tier = inst?.tier || "superior";

    let extractedText = doc.extracted_text;
    if (!extractedText && doc.storage_path) {
      const { data: fileData, error: fileErr } = await supabase.storage.from("vertice-documents").download(doc.storage_path);
      if (fileErr) throw new Error("Erro ao baixar arquivo");
      const buffer = await fileData.arrayBuffer();
      const mime = doc.mime_type || "";
      if (mime.includes("pdf") || doc.file_name?.endsWith(".pdf")) extractedText = await extractTextFromPdf(buffer);
      else if (mime.includes("wordprocessingml") || mime.includes("msword") || doc.file_name?.endsWith(".docx")) extractedText = await extractTextFromDocx(buffer);
      else if (mime.includes("text") || doc.file_name?.endsWith(".txt")) extractedText = new TextDecoder().decode(buffer);
      if (extractedText) {
        await supabase.from("vertice_documents").update({ extracted_text: extractedText, text_extracted_at: new Date().toISOString() }).eq("id", documentId);
      }
    }

    if (!extractedText || extractedText.length < 50) {
      await supabase.from("vertice_documents").update({
        ai_status: "failed",
        ai_findings: [{ type: "risk", severity: "medium", title: "Texto insuficiente", message: "Não foi possível extrair texto suficiente para análise." }],
        updated_at: new Date().toISOString(),
      }).eq("id", documentId);
      return reply({ status: "failed", reason: "insufficient_text" });
    }

    const category: DocCategory = doc.vertice_doc_categories;
    const analysis: AnalysisResult = ruleAnalysis(extractedText, category);
    const modelVersion = "regras-doc-v1";

    const {error:saveError}=await supabase.from("vertice_documents").update({
      ai_status: "completed",
      ai_summary: analysis.summary,
      ai_compliance_score: analysis.compliance_score,
      ai_findings: analysis.findings,
      ai_analyzed_at: new Date().toISOString(),
      ai_model_version: modelVersion,
      updated_at: new Date().toISOString(),
    }).eq("id", documentId);

    if(saveError)throw Error("analysis_persistence_failed");

    if (analysis.findings.length > 0) {
      const {error:findingsError}=await supabase.from("vertice_doc_findings").insert(analysis.findings.map((f) => ({
        document_id: documentId,
        institution_id: doc.institution_id,
        finding_type: f.type,
        severity: f.severity,
        title: f.title,
        message: f.message,
        regulatory_reference: f.regulatory_reference || null,
        suggestion: f.suggestion || null,
        page_number: f.page_number || null,
      })));
      if(findingsError)throw Error("findings_persistence_failed");
    }

    const criticalCount = analysis.findings.filter((f) => f.severity === "critical").length;
    if (criticalCount > 0) await supabase.rpc("generate_doc_alerts", { p_institution_id: doc.institution_id });

    return reply({ status: "completed", document_id: documentId, compliance_score: analysis.compliance_score, findings_count: analysis.findings.length, critical_count: criticalCount });
  } catch (err) {
    console.error("vertice-doc-analyze error:", (err as Error).message);
    if (authorized && documentId) {
      try { await supabase.from("vertice_documents").update({ ai_status: "failed", updated_at: new Date().toISOString() }).eq("id", documentId); } catch (_) { /* noop */ }
    }
    return reply({ error: "Falha ao processar a análise" }, 500);
  }
});
