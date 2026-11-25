/**
 * vertice-impacto-analyze — Edge Function para IA Documental do Impacto
 *
 * Recebe: { institution_id, analysis_type, document_paths[], project_id? }
 * Processo:
 * 1. Baixa documentos do Storage (extension-evidence bucket)
 * 2. Extrai texto (PDF text layer, DOCX paragraphs, etc.)
 * 3. Envia para Claude com prompt estruturado por tipo de análise
 * 4. Registra achados com referências de fonte no banco
 *
 * Restrição: apenas roles master, reitor, pro_reitoria
 * Limites: max 5 documentos, 100k chars total, 120s timeout
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ruleFindings } from "./impacto-rules.ts";
// Política de IA (20/11/2026): o algoritmo é o padrão em todo o portal. A IA só é chamada para as funções
// listadas em AI_FEATURES (padrão desde 25/11/2026: só transcrição de manuscrito e geração de questão
// nova; a segunda opinião na correção e a redação da CPA passaram ao algoritmo) e com a chave geral AI_SUSPENDED=false (suspensa desde 19/11/2026).
const AI_FEATURES_DEFAULT="discursiva.transcribe,discursiva.generate";
const aiPolicy=(get:(k:string)=>string|undefined)=>(feature:string)=>String(get("AI_SUSPENDED")??"true").toLowerCase()==="false"&&String(get("AI_FEATURES")??AI_FEATURES_DEFAULT).split(",").map(x=>x.trim()).includes(feature);
const aiAllowed=aiPolicy(k=>Deno.env.get(k));
const __AI_FN_FEATURES:string[]=["impacto.analyze"];
{const __aiFetch=globalThis.fetch;const __aiHosts=/(^|\.)(api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com)$/i;
globalThis.fetch=((input:any,init?:any)=>{let host="";try{host=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url).hostname;}catch{}
if(__aiHosts.test(host)&&!__AI_FN_FEATURES.some(aiAllowed))
 return Promise.resolve(new Response(JSON.stringify({error:{type:"ai_suspended",message:"IA suspensa temporariamente."}}),{status:503,headers:{"content-type":"application/json"}}));
return __aiFetch(input,init);}) as typeof fetch;}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const MAX_DOCS = 5;
const MAX_CHARS = 100_000;
const TIMEOUT_MS = 120_000;

// ============================================================
// Prompts por tipo de análise
// ============================================================

const SYSTEM_PROMPTS: Record<string, string> = {
  documental: `Você é um analista documental de extensão universitária. Analise o documento e classifique cada informação encontrada segundo os tipos:
- informacao_comprovada: dado factual com fonte clara no documento
- informacao_parcial: dado presente mas incompleto
- inferencia_ia: conclusão que você tirou mas não está explícita
- informacao_nao_localizada: informação esperada mas não encontrada
- inconsistencia: contradição entre partes do documento
- lacuna: ausência relevante
- recomendacao: sugestão de melhoria

Para cada achado, indique: título, descrição, tipo, confiança (0.0-1.0), severidade (critico/alto/medio/baixo/informativo), e a localização no documento (página, seção, trecho).

Responda APENAS em JSON: { "findings": [{ "type", "title", "description", "confidence", "severity", "page", "section", "excerpt" }] }`,

  estrutural: `Você é um analista de estrutura curricular de extensão. Compare o documento com os requisitos das DCNs (Resolução CNE/CES 7/2018):
- Art. 4º: curricularização com mínimo 10% da carga horária
- Art. 5º: interação dialógica, interdisciplinaridade, impacto social, formação cidadã
- Art. 7º: regulamentação por política institucional

Identifique conformidades, parcialidades e lacunas. Para cada achado, classifique como conforme, parcialmente_conforme, nao_conforme ou nao_identificado.

Responda APENAS em JSON: { "findings": [{ "type", "title", "description", "confidence", "severity", "conformity", "page", "section", "excerpt" }] }`,

  evidencia: `Você é um verificador de evidências de extensão universitária. Analise o documento e avalie:
- Autenticidade: o documento parece genuíno?
- Completude: contém as informações necessárias?
- Relevância: corresponde ao projeto/atividade declarados?
- Qualidade: nível de detalhamento adequado?

Responda APENAS em JSON: { "findings": [{ "type", "title", "description", "confidence", "severity", "page", "section", "excerpt" }] }`,

  conformidade: `Você é um auditor de conformidade regulatória para extensão universitária. Analise o documento contra os indicadores do Instrumento de Avaliação do INEP/MEC, especialmente:
- Dimensão 2: Corpo docente e tutorial
- Dimensão 3: Infraestrutura
- Dimensão 5: Políticas acadêmicas (extensão)
- Indicadores 5.3 e 5.4: atividades e integração com comunidade

Para cada indicador, classifique: conforme, parcialmente_conforme, nao_conforme, nao_identificado, nao_aplicavel.

Responda APENAS em JSON: { "findings": [{ "type", "title", "description", "confidence", "severity", "conformity", "page", "section", "excerpt" }] }`,
};

// ============================================================
// Extração de texto simples (sem dependências pesadas)
// ============================================================

async function extractText(bytes: Uint8Array, mimeType: string): Promise<string> {
  // PDF: camada de texto com pdfjs (mesma versão de vertice-doc-prevalidate). A leitura anterior,
  // por regex entre parênteses, só funcionava em PDF sem compressão.
  if (mimeType === "application/pdf") {
    try {
      const pdfjs: any = await import("npm:pdfjs-dist@6.5.438/legacy/build/pdf.mjs");
      const task = pdfjs.getDocument({ data: bytes, useSystemFonts: false, disableFontFace: true, isEvalSupported: false, useWorkerFetch: false, stopAtErrors: true });
      try {
        const doc = await task.promise; const pages: string[] = [];
        for (let n = 1; n <= Math.min(doc.numPages, 60); n++) {
          const c = await (await doc.getPage(n)).getTextContent();
          pages.push(c.items.map((x: any) => (x.str || "") + (x.hasEOL ? "\n" : " ")).join(""));
          if (pages.join("").length > MAX_CHARS) break;
        }
        const text = pages.join("\n").trim();
        return text.length > 50 ? text.slice(0, MAX_CHARS) : "[PDF sem camada de texto — necessita OCR para análise]";
      } finally { await task.destroy(); }
    } catch { return "[PDF ilegível pelo extrator]"; }
  }

  // DOCX: o arquivo é um ZIP; descompacta word/document.xml (fflate, como em vertice-doc-prevalidate).
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      const { unzipSync } = await import("npm:fflate@0.8.2");
      const z = unzipSync(bytes, { filter: (f: any) => f.name === "word/document.xml" });
      const xml = new TextDecoder("utf-8").decode(z["word/document.xml"] || new Uint8Array());
      return xml.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").trim().slice(0, MAX_CHARS);
    } catch { return "[DOCX ilegível pelo extrator]"; }
  }

  // CSV/TXT
  if (mimeType.startsWith("text/") || mimeType === "application/csv") {
    return new TextDecoder("utf-8").decode(bytes).slice(0, MAX_CHARS);
  }

  // XLSX: extrair sharedStrings
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const strings = text.match(/<t[^>]*>([^<]+)<\/t>/g) || [];
    return strings.map(s => s.replace(/<[^>]+>/g, "")).join(" | ").slice(0, MAX_CHARS);
  }

  return "[Formato não suportado para extração de texto]";
}

// ============================================================
// Chamar Claude
// ============================================================

async function callClaude(systemPrompt: string, userPrompt: string): Promise<any> {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Anthropic API: ${res.status} ${await res.text()}`);
  const body = await res.json();
  const content = body.content?.[0]?.text || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta da IA não contém JSON válido");
  return JSON.parse(jsonMatch[0]);
}

// ============================================================
// Handler
// ============================================================

// CORS restrito aos domínios da Vértice em todas as respostas (antes só o preflight tinha cabeçalho,
// e o navegador bloqueava a leitura do resultado).
const ORIGINS = new Set(["https://www.verticesuperior.com.br", "https://verticesuperior.com.br", "https://vertice-portal.onrender.com", "https://vertice-educacao-superior.onrender.com", "https://vertice-educacao-superior-site.onrender.com", "https://vertice-educacao-superior-jlri.onrender.com"]);
function corsHeaders(origin: string): Record<string, string> {
  return { "access-control-allow-origin": ORIGINS.has(origin) ? origin : "https://www.verticesuperior.com.br", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "authorization, content-type, apikey, x-client-info", "vary": "Origin" };
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  const res = await handle(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return new Response(res.body, { status: res.status, headers });
});

async function handle(req: Request): Promise<Response> {

  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Autenticar usuário
    const { data: { user }, error: authError } = await createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { authorization: authHeader } },
    }).auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401 });

    const { institution_id, analysis_type, document_paths, project_id } = await req.json();
    if (!institution_id || !analysis_type || !document_paths?.length) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: institution_id, analysis_type, document_paths" }), { status: 400 });
    }

    // Verificar permissão (alta gestão)
    const { data: roles } = await supabase.from("vertice_impacto_roles")
      .select("role").eq("institution_id", institution_id)
      .eq("user_id", user.id).eq("active", true)
      .in("role", ["master", "reitor", "pro_reitoria"]);
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Acesso restrito à alta gestão" }), { status: 403 });
    }

    if (document_paths.length > MAX_DOCS) {
      return new Response(JSON.stringify({ error: `Máximo ${MAX_DOCS} documentos por análise` }), { status: 400 });
    }

    // Criar registro da análise
    const { data: analysis, error: insertError } = await supabase.from("vertice_ai_analyses").insert({
      institution_id, analysis_type, project_id: project_id || null,
      document_ids: [], model_used: "claude-sonnet-4-20250514",
      status: "processando", requested_by: user.id,
    }).select("id").single();
    if (insertError) throw insertError;

    const startTime = Date.now();

    // Baixar e extrair texto dos documentos
    const docTexts: { name: string; text: string }[] = [];
    for (const path of document_paths) {
      const { data: fileData, error: dlError } = await supabase.storage
        .from("extension-evidence").download(path);
      if (dlError || !fileData) {
        docTexts.push({ name: path, text: `[Erro ao baixar: ${dlError?.message || "não encontrado"}]` });
        continue;
      }
      const bytes = new Uint8Array(await fileData.arrayBuffer());
      const mimeType = fileData.type || "application/octet-stream";
      const text = await extractText(bytes, mimeType);
      docTexts.push({ name: path.split("/").pop() || path, text });
    }

    // Montar prompt
    const systemPrompt = SYSTEM_PROMPTS[analysis_type] || SYSTEM_PROMPTS.documental;
    const userPrompt = docTexts.map((d, i) =>
      `=== DOCUMENTO ${i + 1}: ${d.name} ===\n${d.text.slice(0, Math.floor(MAX_CHARS / document_paths.length))}`
    ).join("\n\n");

    // IA suspensa (padrão desde 19/11/2026): achados por regras (auditoria V7).
    const aiOn = aiAllowed("impacto.analyze");
    let result: any;
    if (!aiOn) {
      result = { findings: ruleFindings(analysis_type, docTexts) };
      await supabase.from("vertice_ai_analyses").update({ model_used: "regras" }).eq("id", analysis.id);
    } else try {
      result = await callClaude(systemPrompt, userPrompt);
    } catch (aiError: any) {
      await supabase.from("vertice_ai_analyses").update({
        status: "falha", completed_at: new Date().toISOString(),
        validation_notes: aiError.message,
      }).eq("id", analysis.id);
      return new Response(JSON.stringify({ error: "Falha na análise: " + aiError.message, analysis_id: analysis.id }), { status: 500 });
    }

    // Registrar achados
    const findings = result.findings || [];
    let count = 0;
    for (const f of findings) {
      const { data: findingRec } = await supabase.from("vertice_ai_findings").insert({
        analysis_id: analysis.id, institution_id,
        finding_type: f.type || "pendente_validacao",
        title: f.title || "Achado sem título",
        description: f.description || "",
        confidence: typeof f.confidence === "number" ? f.confidence : null,
        conformity_status: f.conformity || null,
        severity: f.severity || "informativo",
        recommendation: f.recommendation || null,
      }).select("id").single();

      if (findingRec && (f.page || f.section || f.excerpt)) {
        await supabase.from("vertice_ai_source_references").insert({
          finding_id: findingRec.id,
          document_name: docTexts[0]?.name || "documento",
          page_number: f.page || null,
          section_title: f.section || null,
          text_excerpt: f.excerpt?.slice(0, 500) || null,
        });
      }
      count++;
    }

    // Atualizar análise
    const processingTime = Date.now() - startTime;
    await supabase.from("vertice_ai_analyses").update({
      status: "concluida", findings_count: count,
      completed_at: new Date().toISOString(),
      processing_time_ms: processingTime,
    }).eq("id", analysis.id);

    return new Response(JSON.stringify({
      analysis_id: analysis.id,
      findings_count: count,
      processing_time_ms: processingTime,
    }), { headers: { "content-type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
