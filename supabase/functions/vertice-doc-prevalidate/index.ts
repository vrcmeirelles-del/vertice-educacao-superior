// Vértice · Pré-validação documental por algoritmo
// Lê o documento do storage, extrai texto, sugere indicadores por regras,
// sugere espelhamento transversal entre instrumentos regulatórios.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";
import {extractDocument,groundedLinks,ExtractionFailure} from "./document-text.mjs";
import {openTextPdf} from "./pdf-runtime.mjs";
import {analyzeByRules,RULES_VERSION} from "./rule-analysis.mjs";
import {assessDocumentQuality,rulesJobVersion,sourceBaseline} from "./document-quality.mjs";
// Documentary processing is algorithm-only. No provider or environment opt-in.
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

async function extractTextFromStorage(client: SupabaseClient<any>, bucket:string,path:string,fileName:string,onFingerprint:(fingerprint:any)=>Promise<void>) {
 const {data,error}=await client.storage.from(bucket).download(path);
 if(error||!data)throw Error("original_unavailable");
 if(data.size>30*1024*1024)throw Error("file_too_large");
 const bytes=new Uint8Array(await data.arrayBuffer());
 return extractDocument(bytes,fileName,{onFingerprint,unzip:unzipSync,pdf:async(b:Uint8Array)=>{
  // Upstream fix #21721 initializes DOMMatrix only when rendering a canvas.
  // Text extraction in the Edge runtime does not provide a graphics DOM.
  const pdfjs=await import("npm:pdfjs-dist@6.5.438/legacy/build/pdf.mjs");
  return openTextPdf(b,pdfjs.getDocument);
 }});
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("", { headers: cors });
  if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405);

  let activeId: string | null = null;
  let activeAdmin: any = null;
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
    if (userError || !user || user.is_anonymous) return respond({ error: "authentication_required" }, 401);

    // Service client for writes (bypasses RLS)
    const admin = createClient(projectUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    activeAdmin = admin;
    const body = await request.json();
    const institutionId = String(body?.institution_id ?? "");
    const sourceTable = String(body?.source_table ?? "vertice_repository_files");
    const fileId = String(body?.file_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(institutionId) || !/^[0-9a-f-]{36}$/i.test(fileId)) {
      return respond({ error: "invalid_parameters" }, 400);
    }

    if(!["vertice_documents","vertice_repository_files"].includes(sourceTable))return respond({error:"invalid_source_table"},400);
    const action=body.action??"analyze";
    if(!["index","analyze"].includes(action))return respond({error:"invalid_action"},400);
    // Existing institutional rights and MFA, checked before service writes.
    const {data:allowed,error:scopeError}=await userClient.rpc("vertice_evidence_can_manage",{p_institution_id:institutionId});
    if(scopeError||allowed!==true)return respond({error:"access_denied"},403);
    const {data:visible,error:visibilityError}=await userClient.from(sourceTable).select(sourceTable==="vertice_documents"?"id,institution_id,superseded_by":"id,institution_id").eq("id",fileId).eq("institution_id",institutionId).maybeSingle();
    if(visibilityError||!visible)return respond({error:"file_not_visible"},404);
    // A newly superseded source must not reuse a completed pre-substitution job.
    const supersededBy=sourceTable==="vertice_documents"?(visible as any).superseded_by:null;
    const jobRulesVersion=rulesJobVersion(RULES_VERSION,supersededBy);

    const {data:claim,error:claimError}=await admin.rpc("vertice_doc_claim_rules",{
      p_institution_id:institutionId,p_source_table:sourceTable,p_file_id:fileId,
      p_actor:user.id,p_action:action,p_rules_version:jobRulesVersion,
    });
    if(claimError)throw Error("claim_failed");
    if(claim.status!=="claimed")return respond(claim,claim.status==="retry_limit"?429:202);
    const pv={id:claim.prevalidation_id}; activeId=pv.id;

    // 2. Get file info
    let fileName = "", storagePath = "", bucket = "", category = "", expectedHash = "", indicators: string[] = [];
    let sourceQuality: { superseded_by?: string; previous_sha256?: string } = {};
    const sourceIdColumn = sourceTable === "vertice_documents" ? "document_id" : "repository_file_id";
    const {data:previous,error:previousError}=await admin.from("vertice_doc_prevalidation")
      .select("source_sha256,extraction_metadata").eq("institution_id",institutionId).eq(sourceIdColumn,fileId)
      .neq("id",pv.id).not("source_sha256","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(previousError)throw Error("source_history_unavailable");
    // Index-then-analyze cannot silently clear a revision warning for the same bytes.
    sourceQuality.previous_sha256=sourceBaseline(previous);
    // Acervo e catálogo pela seção da solicitação (vertice_doc_source_scope). Reconhecimento e documentos
    // gerais seguem como antes: vertice-repositorios ou vertice-documents e os catálogos ativos.
    let scope: { bucket: string; catalog_code: string | null; catalog_version: string | null } = { bucket: "vertice-documents", catalog_code: null, catalog_version: null };

    if (sourceTable === "vertice_repository_files") {
      const { data: file } = await admin
        .from("vertice_repository_files")
        .select("file_name,storage_path,document_category,instrument_indicators")
        .eq("id", fileId)
        .eq("institution_id",institutionId)
        .single();
      if (!file) {
        await admin.from("vertice_doc_prevalidation").update({ ai_status: "failed", ai_error: "Arquivo não encontrado" }).eq("id", pv.id);
        return respond({ error: "file_not_found" }, 404);
      }
      fileName = file.file_name;
      storagePath = file.storage_path;
      const { data: sc, error: scError } = await admin.rpc("vertice_doc_source_scope", { p_institution_id: institutionId, p_source_table: sourceTable, p_file_id: fileId });
      // Função ainda não criada no banco (PGRST202): mantém o comportamento anterior.
      if (scError && scError.code !== "PGRST202") {
        await admin.from("vertice_doc_prevalidation").update({ ai_status: "failed", ai_error: "Acervo do arquivo indisponível" }).eq("id", pv.id);
        return respond({ error: "source_scope_unavailable" }, 503);
      }
      scope = !scError && typeof sc?.bucket === "string" ? sc : { bucket: "vertice-repositorios", catalog_code: null, catalog_version: null };
      bucket = scope.bucket;
      category = file.document_category ?? "";
      indicators = Array.isArray(file.instrument_indicators) ? file.instrument_indicators.map(String) : [];
    } else {
      const { data: doc } = await admin
        .from("vertice_documents")
        .select("file_name,storage_path,category_code,tags,sha256,superseded_by")
        .eq("id", fileId)
        .eq("institution_id",institutionId)
        .single();
      if (!doc) {
        await admin.from("vertice_doc_prevalidation").update({ ai_status: "failed", ai_error: "Documento não encontrado" }).eq("id", pv.id);
        return respond({ error: "document_not_found" }, 404);
      }
      expectedHash=doc.sha256??"";
      sourceQuality.superseded_by=doc.superseded_by??undefined;
      if((doc.superseded_by??null)!==(supersededBy??null))throw Error("source_changed_during_claim");
      fileName = doc.file_name;
      storagePath = doc.storage_path;
      bucket = "vertice-documents";
      category = doc.category_code ?? "";
      indicators = Array.isArray(doc.tags) ? doc.tags.map(String) : [];
    }

    // 3. Extract text from document
    let extractedText: string;
    let extraction:any;
    try {
      extraction = await extractTextFromStorage(userClient, bucket, storagePath,fileName,async(fingerprint:any)=>{
       if(expectedHash&&expectedHash!==fingerprint.sha256)throw Error("source_hash_mismatch");
       const {error}=await admin.from("vertice_doc_prevalidation").update({source_sha256:fingerprint.sha256,extraction_metadata:{received_bytes:fingerprint.receivedBytes,execution_id:Deno.env.get("SB_EXECUTION_ID")??null,stage:"fingerprint_persisted_before_parser",fingerprinted_at:new Date().toISOString(),ocr_applied:false}}).eq("id",pv.id).eq("institution_id",institutionId);
       if(error)throw Error("fingerprint_persistence_failed");
      });
      if(expectedHash&&expectedHash!==extraction.sha256)throw Error("source_hash_mismatch");
      extractedText=extraction.text;
      extraction.quality=assessDocumentQuality(extraction,sourceQuality);
      const {error:persistError}=await admin.from("vertice_doc_prevalidation").update({
       processing_stage:extraction.partial?"partial_extraction":"extracted",
       extracted_text:extraction.text,extracted_pages:extraction.pages,source_sha256:extraction.sha256,
       extraction_method:extraction.method,extraction_status:extraction.partial?"partial":"ready",
       extracted_at:new Date().toISOString(),keyword_suggestions:extraction.keywords,
       extraction_metadata:{page_count:extraction.pageCount,characters:extraction.characters,partial:extraction.partial,pages_without_text:extraction.pagesWithoutText,quality:extraction.quality,previous_sha256:sourceQuality.previous_sha256??null,review_signals:extraction.reviewSignals,ocr_applied:false,parser_version:extraction.method==='pdfjs_text_layer'?'pdfjs-dist@6.5.438':extraction.method==='utf8_text'?'TextDecoder UTF-8':'fflate@0.8.2'}
      }).eq("id",pv.id).eq("institution_id",institutionId);
      if(persistError)throw Error("index_persistence_failed");
      if(sourceTable==="vertice_documents"){
       const {error:docIndexError}=await admin.from("vertice_documents").update({extracted_text:extraction.text,text_extracted_at:new Date().toISOString(),page_count:extraction.pageCount,sha256:extraction.sha256}).eq("id",fileId).eq("institution_id",institutionId);
       if(docIndexError)throw Error("document_index_persistence_failed");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("vertice_doc_prevalidation").update({
        ai_status: "failed",
        ai_error: `Extração de texto falhou: ${msg}`,
        processing_stage: /ocr_required|insufficient_text|unsupported_format/.test(msg)?"manual_extraction_required":"retry_required",
        extraction_status:"failed",
        ...(e instanceof ExtractionFailure?{source_sha256:e.sourceSha256,extraction_method:e.method,extracted_at:new Date().toISOString(),extraction_metadata:{failure_code:msg.slice(0,200),received_bytes:e.receivedBytes,ocr_applied:false,parser_version:e.method==='pdfjs_text_layer'?'pdfjs-dist@6.5.438':null}}:{}),
        ai_analyzed_at: new Date().toISOString(),
      }).eq("id", pv.id);
      const expected=/^(?:no_embedded_text_ocr_required|unsupported_format|insufficient_text|file_too_large|zip_entry_limit|zip_expansion_limit|binary_content|xml_entities_not_supported|docx_main_part_missing)$/.test(msg);
      return respond({ error: "text_extraction_failed", detail: msg,source_sha256:e instanceof ExtractionFailure?e.sourceSha256:null }, expected?422:500);
    }

    if (extractedText.trim().length < 50) {
      await admin.from("vertice_doc_prevalidation").update({
        ai_status: "failed",
        ai_error: "Texto extraído insuficiente para análise (documento possivelmente escaneado sem OCR)",
        ai_analyzed_at: new Date().toISOString(),
      }).eq("id", pv.id);
      return respond({ error: "insufficient_text", note: "Documento com texto insuficiente. Possível imagem/escaneado sem OCR." }, 422);
    }

    if(action==="index"){
     const {error:indexError}=await admin.from("vertice_doc_prevalidation").update({ai_status:"pending",processing_stage:"indexed",lease_until:null}).eq("id",pv.id).eq("ai_status","processing");
     if(indexError)throw Error("index_completion_failed");
     const {error:auditError}=await admin.from("vertice_mirror_audit_log").insert({institution_id:institutionId,action:"document_text_indexed",entity_type:"prevalidation",entity_id:pv.id,actor_id:user.id,actor_type:"human",details:{source_table:sourceTable,file_id:fileId,sha256:extraction.sha256,method:extraction.method,characters:extraction.characters,partial:extraction.partial,provider_transmission:false}});
     if(auditError)throw Error("index_audit_failed");
     activeId=null;
     return respond({prevalidation_id:pv.id,status:"indexed",extraction_status:extraction.partial?"partial":"ready",sha256:extraction.sha256,characters:extraction.characters,keyword_suggestions:extraction.keywords,provider_transmission:false,review_required:true});
    }

    // Only configured catalog objects may be proposed; no invented instrument codes.
    const catalogQuery=userClient.from("vertice_instrument_catalog").select("id,instrument_code,instrument_version,instrument_label,source_provenance").eq("institution_id",institutionId);
    const {data:catalogs,error:catalogError}=await (scope.catalog_code?catalogQuery.eq("instrument_code",scope.catalog_code).eq("instrument_version",scope.catalog_version):catalogQuery.eq("is_active",true));
    const {data:objects,error:objectsError}=catalogs?.length?await userClient.from("vertice_instrument_objects").select("catalog_id,object_code,object_label,description").in("catalog_id",catalogs.map((c:any)=>c.id)):{data:[],error:null};
    if(catalogError||objectsError||!objects?.length){
     await admin.from("vertice_doc_prevalidation").update({ai_status:"failed",ai_error:"Texto indexado. Catálogo de indicadores não configurado para esta instituição; classificação manual preservada."}).eq("id",pv.id);
     return respond({error:"instrument_catalog_unavailable",detail:"Texto indexado; os códigos oficiais e suas versões precisam estar cadastrados antes de sugerir vínculos.",prevalidation_id:pv.id},422);
    }
    const [{data:instRow},{data:courseRows}]=await Promise.all([
     admin.from("vertice_institutions").select("name,acronym").eq("id",institutionId).maybeSingle(),
     admin.from("vertice_courses").select("name").eq("institution_id",institutionId).limit(500),
    ]);
    const result: PrevalidationResult = analyzeByRules({extraction,fileName,category,objects,catalogs,institution:instRow,courses:courseRows??[],source:sourceQuality}) as PrevalidationResult;
    const modelVersion=jobRulesVersion;

    // Result, literal source links and audit commit together; failed inserts never report success.
    const {data:completed,error:completeError}=await admin.rpc("vertice_doc_finish_rules",{
      p_id:pv.id,p_result:result,
      p_links:groundedLinks(result.indicator_links,extraction),
    });
    if(completeError)throw Error("completion_persistence_failed");
    activeId=null;
    return respond({...completed,summary:result.summary,nature:result.nature,
      scope:result.scope_detected,model:modelVersion,provider_transmission:false,review_required:true});
  } catch (e) {
    if(activeId&&activeAdmin)await activeAdmin.from("vertice_doc_prevalidation").update({ai_status:"failed",ai_error:"Falha de processamento; nenhuma aprovação foi feita.",updated_at:new Date().toISOString()}).eq("id",activeId).eq("ai_status","processing");
    return respond({ error: "prevalidation_failed", detail: String(e instanceof Error ? e.message : e).slice(0, 250) }, 500);
  }
});
