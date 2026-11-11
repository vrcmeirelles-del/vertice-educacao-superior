// Vértice · Pré-validação inteligente de documentos
// Lê o documento do storage, extrai texto, identifica indicadores via IA,
// sugere espelhamento transversal entre instrumentos regulatórios.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Instrumentos regulatórios e seus indicadores (reconhecimento de curso 2017)
const INSTRUMENT_RECONHECIMENTO_2017 = {
  code: "reconhecimento_curso",
  version: "2017",
  label: "Reconhecimento de Curso (2017)",
  dimensions: [
    { dim: "1", label: "Organização didático-pedagógica", indicators: ["1.1","1.2","1.3","1.4","1.5","1.6","1.7","1.8","1.9","1.10","1.11","1.12","1.13","1.14","1.15","1.16","1.17","1.18","1.19","1.20","1.21","1.22"] },
    { dim: "2", label: "Corpo docente e tutorial", indicators: ["2.1","2.2","2.3","2.4","2.5","2.6","2.7","2.8","2.9","2.10","2.11","2.12","2.13","2.14","2.15","2.16","2.17","2.18"] },
    { dim: "3", label: "Infraestrutura", indicators: ["3.1","3.2","3.3","3.4","3.5","3.6","3.7","3.8","3.9","3.10","3.11","3.12","3.13","3.14","3.15","3.16","3.17"] },
  ],
};

// Novo instrumento 2026 (eixos institucionais)
const INSTRUMENT_NOVO_2026 = {
  code: "novo_instrumento_2026",
  version: "2026",
  label: "Novo Instrumento de Avaliação (2026)",
  dimensions: [
    { dim: "E1", label: "Planejamento e Avaliação Institucional", indicators: ["E1.1","E1.2","E1.3","E1.4","E1.5"] },
    { dim: "E2", label: "Responsabilidade Social", indicators: ["E2.1","E2.2","E2.3","E2.4"] },
    { dim: "E3", label: "Políticas Acadêmicas", indicators: ["E3.1","E3.2","E3.3","E3.4","E3.5","E3.6","E3.7"] },
    { dim: "E4", label: "Governança e Gestão", indicators: ["E4.1","E4.2","E4.3","E4.4","E4.5"] },
    { dim: "E5", label: "Infraestrutura", indicators: ["E5.1","E5.2","E5.3","E5.4","E5.5"] },
  ],
};

// Recredenciamento 2017 (5 eixos)
const INSTRUMENT_RECREDENCIAMENTO_2017 = {
  code: "recredenciamento_2017",
  version: "2017",
  label: "Recredenciamento Institucional (2017)",
  dimensions: [
    { dim: "R1", label: "Planejamento e Avaliação Institucional", indicators: ["R1.1","R1.2","R1.3","R1.4","R1.5","R1.6","R1.7","R1.8"] },
    { dim: "R2", label: "Desenvolvimento Institucional", indicators: ["R2.1","R2.2","R2.3","R2.4","R2.5","R2.6"] },
    { dim: "R3", label: "Políticas Acadêmicas", indicators: ["R3.1","R3.2","R3.3","R3.4","R3.5","R3.6","R3.7","R3.8"] },
    { dim: "R4", label: "Políticas de Gestão", indicators: ["R4.1","R4.2","R4.3","R4.4","R4.5","R4.6"] },
    { dim: "R5", label: "Infraestrutura Física", indicators: ["R5.1","R5.2","R5.3","R5.4","R5.5","R5.6"] },
  ],
};

const ALL_INSTRUMENTS = [INSTRUMENT_RECONHECIMENTO_2017, INSTRUMENT_NOVO_2026, INSTRUMENT_RECREDENCIAMENTO_2017];

interface IndicatorLink {
  instrument_code: string;
  instrument_version: string;
  object_code: string;
  dimension: string;
  is_primary: boolean;
  compatibility: "alta" | "media" | "baixa";
  justification: string;
  evidence_excerpts: { page?: number; section?: string; text: string }[];
  limitations?: string;
}

interface PrevalidationResult {
  summary: string;
  nature: string;
  institution_detected?: string;
  course_detected?: string;
  period_detected?: string;
  scope_detected: string;
  indicator_links: IndicatorLink[];
}

async function extractTextFromStorage(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Falha ao baixar documento: ${error?.message || "sem dados"}`);

  const bytes = new Uint8Array(await data.arrayBuffer());
  // Detect PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    // Extração básica de texto de PDF (streams de texto)
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    // Remove binary noise, keep readable text
    const readable = text
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x80-\xff]{3,}/g, " ")
      .replace(/\s+/g, " ")
      .replace(/stream[\s\S]*?endstream/gi, (match) => {
        // Try to find Tj/TJ text operators
        const textParts: string[] = [];
        const tjPattern = /\(([^)]*)\)\s*Tj/g;
        let m;
        while ((m = tjPattern.exec(match)) !== null) textParts.push(m[1]);
        const tjArrayPattern = /\[([^\]]*)\]\s*TJ/gi;
        while ((m = tjArrayPattern.exec(match)) !== null) {
          const inner = m[1];
          const parts = inner.match(/\(([^)]*)\)/g);
          if (parts) textParts.push(...parts.map((p) => p.slice(1, -1)));
        }
        return textParts.join(" ");
      })
      .trim();
    return readable.slice(0, 50000); // Limit to ~50k chars for AI
  }

  // DOCX detection (PK zip)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    // Basic XML extraction from docx
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const xmlText = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return xmlText.slice(0, 50000);
  }

  // Plain text fallback
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 50000);
}

async function analyzeWithAI(
  text: string,
  fileName: string,
  existingCategory: string,
  existingIndicators: string[],
): Promise<PrevalidationResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY") || "";
  if (!apiKey) throw new Error("Nenhuma chave de IA configurada (ANTHROPIC_API_KEY ou OPENAI_API_KEY)");

  const instrumentsSummary = ALL_INSTRUMENTS.map((inst) =>
    `\n## ${inst.label} (${inst.code} v${inst.version})\n` +
    inst.dimensions.map((d) => `  ${d.dim} — ${d.label}: ${d.indicators.join(", ")}`).join("\n")
  ).join("\n");

  const systemPrompt = `Você é um analista regulatório de educação superior brasileira (MEC/INEP).
Analise o CONTEÚDO do documento e identifique TODOS os indicadores regulatórios relacionados em TODOS os instrumentos aplicáveis.

INSTRUMENTOS DISPONÍVEIS:
${instrumentsSummary}

REGRAS:
1. Analise o CONTEÚDO real, não apenas o nome do arquivo
2. Um documento pode ser pertinente a VÁRIOS indicadores em VÁRIOS instrumentos diferentes
3. Classifique a compatibilidade: "alta" (evidência direta), "media" (relacionado mas precisa complemento), "baixa" (relação indireta)
4. Cite trechos específicos do documento que sustentam cada associação
5. Identifique limitações (informações faltantes, desatualizações)
6. NÃO invente indicadores que não existam nos instrumentos listados
7. Distinga pertinência documental de comprovação integral
8. Indicadores com códigos iguais em instrumentos DIFERENTES podem ter significados diferentes

Responda EXCLUSIVAMENTE em JSON válido com esta estrutura:
{
  "summary": "resumo do conteúdo",
  "nature": "tipo do documento (PPC, ata NDE, regulamento, etc.)",
  "institution_detected": "nome da IES se mencionada",
  "course_detected": "curso se mencionado",
  "period_detected": "período de referência se identificável",
  "scope_detected": "institucional|curso|ambos",
  "indicator_links": [
    {
      "instrument_code": "reconhecimento_curso",
      "instrument_version": "2017",
      "object_code": "1.5",
      "dimension": "1",
      "is_primary": true,
      "compatibility": "alta",
      "justification": "O PPC contém...",
      "evidence_excerpts": [{"page": 5, "section": "Perfil do egresso", "text": "trecho relevante"}],
      "limitations": "Falta atualização para 2025"
    }
  ]
}`;

  const userPrompt = `Arquivo: ${fileName}
Categoria atual: ${existingCategory}
Indicadores manuais: ${existingIndicators.join(", ") || "nenhum"}

CONTEÚDO DO DOCUMENTO (extraído):
${text.slice(0, 30000)}`;

  // Try Anthropic first, fallback to OpenAI
  const isAnthropic = apiKey.startsWith("sk-ant-");

  if (isAnthropic) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Anthropic API: ${res.status}`);
    const body = await res.json();
    const content = body.content?.[0]?.text || "";
    // Extract JSON from response (may be wrapped in ```json blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta da IA não contém JSON válido");
    return JSON.parse(jsonMatch[0]) as PrevalidationResult;
  }

  // OpenAI path
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`OpenAI API: ${res.status}`);
  const body = await res.json();
  return JSON.parse(body.choices?.[0]?.message?.content || "{}") as PrevalidationResult;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("", { headers: cors });
  if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405);

  try {
    const jwt = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!jwt || !projectUrl) return respond({ error: "authentication_required" }, 401);

    // Client for auth check
    const userClient = createClient(projectUrl, anonKey, {
      global: { headers: { Authorization: "Bearer " + jwt } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(jwt);
    if (userError || !user) return respond({ error: "authentication_required" }, 401);

    // Service client for writes (bypasses RLS)
    const admin = createClient(projectUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await request.json();
    const institutionId = String(body?.institution_id ?? "");
    const sourceTable = String(body?.source_table ?? "vertice_repository_files");
    const fileId = String(body?.file_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(institutionId) || !/^[0-9a-f-]{36}$/i.test(fileId)) {
      return respond({ error: "invalid_parameters" }, 400);
    }

    // 1. Create prevalidation record
    const pvRecord = {
      institution_id: institutionId,
      source_table: sourceTable,
      ai_status: "processing",
      requested_by: user.id,
      ...(sourceTable === "vertice_documents"
        ? { document_id: fileId }
        : { repository_file_id: fileId }),
    };

    const { data: pv, error: pvErr } = await admin
      .from("vertice_doc_prevalidation")
      .insert(pvRecord)
      .select("id")
      .single();
    if (pvErr) return respond({ error: "prevalidation_insert_failed", detail: pvErr.message }, 500);

    // Audit: prevalidation requested
    await admin.from("vertice_mirror_audit_log").insert({
      institution_id: institutionId,
      action: "prevalidation_requested",
      entity_type: "prevalidation",
      entity_id: pv.id,
      actor_id: user.id,
      actor_type: "human",
      details: { source_table: sourceTable, file_id: fileId },
    });

    // 2. Get file info
    let fileName = "", storagePath = "", bucket = "", category = "", indicators: string[] = [];

    if (sourceTable === "vertice_repository_files") {
      const { data: file } = await admin
        .from("vertice_repository_files")
        .select("file_name,storage_path,document_category,instrument_indicators")
        .eq("id", fileId)
        .single();
      if (!file) {
        await admin.from("vertice_doc_prevalidation").update({ ai_status: "failed", ai_error: "Arquivo não encontrado" }).eq("id", pv.id);
        return respond({ error: "file_not_found" }, 404);
      }
      fileName = file.file_name;
      storagePath = file.storage_path;
      bucket = "vertice-repositorios";
      category = file.document_category ?? "";
      indicators = Array.isArray(file.instrument_indicators) ? file.instrument_indicators.map(String) : [];
    } else {
      const { data: doc } = await admin
        .from("vertice_documents")
        .select("file_name,storage_path,category_code,tags")
        .eq("id", fileId)
        .single();
      if (!doc) {
        await admin.from("vertice_doc_prevalidation").update({ ai_status: "failed", ai_error: "Documento não encontrado" }).eq("id", pv.id);
        return respond({ error: "document_not_found" }, 404);
      }
      fileName = doc.file_name;
      storagePath = doc.storage_path;
      bucket = "vertice-documents";
      category = doc.category_code ?? "";
      indicators = Array.isArray(doc.tags) ? doc.tags.map(String) : [];
    }

    // 3. Extract text from document
    let extractedText: string;
    try {
      extractedText = await extractTextFromStorage(admin, bucket, storagePath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("vertice_doc_prevalidation").update({
        ai_status: "failed",
        ai_error: `Extração de texto falhou: ${msg}`,
        ai_analyzed_at: new Date().toISOString(),
      }).eq("id", pv.id);
      return respond({ error: "text_extraction_failed", detail: msg }, 500);
    }

    if (extractedText.trim().length < 50) {
      await admin.from("vertice_doc_prevalidation").update({
        ai_status: "failed",
        ai_error: "Texto extraído insuficiente para análise (documento possivelmente escaneado sem OCR)",
        ai_analyzed_at: new Date().toISOString(),
      }).eq("id", pv.id);
      return respond({ error: "insufficient_text", note: "Documento com texto insuficiente. Possível imagem/escaneado sem OCR." }, 422);
    }

    // 4. AI analysis
    let result: PrevalidationResult;
    let modelVersion = "unknown";
    try {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY") || "";
      modelVersion = apiKey.startsWith("sk-ant-") ? "claude-sonnet-4" : "gpt-4.1-mini";
      result = await analyzeWithAI(extractedText, fileName, category, indicators);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("vertice_doc_prevalidation").update({
        ai_status: "failed",
        ai_error: `Análise IA falhou: ${msg}`,
        ai_model_version: modelVersion,
        ai_analyzed_at: new Date().toISOString(),
      }).eq("id", pv.id);
      return respond({ error: "ai_analysis_failed", detail: msg }, 500);
    }

    // 5. Update prevalidation record
    await admin.from("vertice_doc_prevalidation").update({
      ai_status: "completed",
      ai_summary: result.summary?.slice(0, 4000),
      ai_nature: result.nature?.slice(0, 200),
      ai_institution_detected: result.institution_detected?.slice(0, 200),
      ai_course_detected: result.course_detected?.slice(0, 200),
      ai_period_detected: result.period_detected?.slice(0, 100),
      ai_scope_detected: result.scope_detected?.slice(0, 50),
      ai_model_version: modelVersion,
      ai_analyzed_at: new Date().toISOString(),
    }).eq("id", pv.id);

    // 6. Create indicator links
    const allInstrumentCodes = new Set(ALL_INSTRUMENTS.flatMap((i) =>
      i.dimensions.flatMap((d) => d.indicators.map((ind) => `${i.code}/${i.version}/${ind}`))
    ));

    const links = (result.indicator_links || [])
      .filter((link) =>
        allInstrumentCodes.has(`${link.instrument_code}/${link.instrument_version}/${link.object_code}`) &&
        ["alta", "media", "baixa"].includes(link.compatibility) &&
        link.justification?.length >= 5
      )
      .map((link) => ({
        prevalidation_id: pv.id,
        institution_id: institutionId,
        instrument_code: link.instrument_code,
        instrument_version: link.instrument_version,
        object_code: link.object_code,
        dimension: link.dimension || "",
        is_primary: Boolean(link.is_primary),
        compatibility: link.compatibility,
        justification: link.justification.slice(0, 2000),
        evidence_excerpts: JSON.stringify(
          (link.evidence_excerpts || []).slice(0, 5).map((e) => ({
            page: e.page ?? null,
            section: (e.section ?? "").slice(0, 200),
            text: (e.text ?? "").slice(0, 500),
          }))
        ),
        limitations: link.limitations?.slice(0, 1000) ?? null,
        status: "sugerido",
      }));

    let createdLinks = 0;
    if (links.length > 0) {
      const { data: inserted, error: linkErr } = await admin
        .from("vertice_doc_indicator_links")
        .insert(links)
        .select("id");
      if (linkErr) {
        console.error("Link insert error:", linkErr);
      } else {
        createdLinks = inserted?.length ?? 0;
      }
    }

    // 7. Audit: prevalidation completed
    await admin.from("vertice_mirror_audit_log").insert({
      institution_id: institutionId,
      action: "prevalidation_completed",
      entity_type: "prevalidation",
      entity_id: pv.id,
      actor_type: "ai",
      ai_model: modelVersion,
      details: {
        links_created: createdLinks,
        instruments_covered: [...new Set(links.map((l) => l.instrument_code))],
        nature: result.nature,
        scope: result.scope_detected,
      },
    });

    return respond({
      prevalidation_id: pv.id,
      status: "completed",
      summary: result.summary,
      nature: result.nature,
      scope: result.scope_detected,
      links_created: createdLinks,
      instruments_covered: [...new Set(links.map((l) => l.instrument_code))],
      model: modelVersion,
    });
  } catch (e) {
    return respond({ error: "prevalidation_failed", detail: String(e instanceof Error ? e.message : e).slice(0, 250) }, 500);
  }
});
