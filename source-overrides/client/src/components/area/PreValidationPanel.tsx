import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { type Row, explain } from "@/lib/area";

interface IndicatorLink {
  id: string;
  instrument_code: string;
  instrument_version: string;
  object_code: string;
  dimension: string;
  is_primary: boolean;
  compatibility: "alta" | "media" | "baixa";
  justification: string;
  evidence_excerpts: { page?: number; section?: string; text: string }[];
  limitations?: string;
  status: string;
}

interface Prevalidation {
  id: string;
  ai_status: string;
  ai_summary: string;
  ai_nature: string;
  ai_institution_detected: string;
  ai_course_detected: string;
  ai_period_detected: string;
  ai_scope_detected: string;
  ai_model_version: string;
  ai_analyzed_at: string;
  ai_error: string;
}

const COMPAT_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  alta: { bg: "#dcfce7", border: "#16a34a", label: "ALTA" },
  media: { bg: "#fef3c7", border: "#d97706", label: "MÉDIA" },
  baixa: { bg: "#fee2e2", border: "#dc2626", label: "BAIXA" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  sugerido: { label: "Sugerido pela IA", color: "#d97706" },
  aprovado: { label: "Aprovado", color: "#16a34a" },
  rejeitado: { label: "Rejeitado", color: "#dc2626" },
  revisao_humana: { label: "Em revisão humana", color: "#7c3aed" },
};

const INSTRUMENT_LABELS: Record<string, string> = {
  reconhecimento_curso: "Reconhecimento de Curso (2017)",
  novo_instrumento_2026: "Novo Instrumento (2026)",
  recredenciamento_2017: "Recredenciamento (2017)",
};

export default function PreValidationPanel({
  file,
  institutionId,
  sourceTable = "vertice_repository_files",
  onClose,
  onLinksUpdated,
}: {
  file: Row;
  institutionId: string;
  sourceTable?: string;
  onClose: () => void;
  onLinksUpdated?: () => void;
}) {
  const [prevalidation, setPrevalidation] = useState<Prevalidation | null>(null);
  const [links, setLinks] = useState<IndicatorLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [expandedLink, setExpandedLink] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());

  const fileId = String(file.id);

  const loadExisting = useCallback(async () => {
    setLoading(true);
    try {
      const col = sourceTable === "vertice_documents" ? "document_id" : "repository_file_id";
      const { data: pvs } = await supabase
        .from("vertice_doc_prevalidation")
        .select("*")
        .eq(col, fileId)
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (pvs?.length) {
        setPrevalidation(pvs[0] as Prevalidation);
        const { data: linkData } = await supabase
          .from("vertice_doc_indicator_links")
          .select("*")
          .eq("prevalidation_id", pvs[0].id)
          .order("compatibility", { ascending: true })
          .order("is_primary", { ascending: false });
        setLinks((linkData ?? []) as IndicatorLink[]);
      }
    } catch (e) {
      setError(explain(e));
    } finally {
      setLoading(false);
    }
  }, [fileId, institutionId, sourceTable]);

  useEffect(() => { void loadExisting(); }, [loadExisting]);

  async function startPrevalidation() {
    setAnalyzing(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("vertice-doc-prevalidate", {
        body: { institution_id: institutionId, source_table: sourceTable, file_id: fileId },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.detail || data.error);
      await loadExisting();
    } catch (e) {
      setError(explain(e));
    } finally {
      setAnalyzing(false);
    }
  }

  async function updateLinkStatus(linkId: string, status: string, reason?: string) {
    try {
      const update: Record<string, unknown> = {
        status,
        reviewed_at: new Date().toISOString(),
      };
      if (reason) update.rejection_reason = reason;
      const { error: err } = await supabase
        .from("vertice_doc_indicator_links")
        .update(update)
        .eq("id", linkId);
      if (err) throw err;
      setLinks((prev) => prev.map((l) => l.id === linkId ? { ...l, status, ...(reason ? { rejection_reason: reason } : {}) } : l));
      setRejectingId(null);
      setRejectReason("");
      onLinksUpdated?.();
    } catch (e) {
      setError(explain(e));
    }
  }

  async function bulkApprove() {
    const toApprove = links.filter((l) =>
      (bulkMode ? selectedLinks.has(l.id) : l.compatibility === "alta") && l.status === "sugerido"
    );
    for (const link of toApprove) {
      await updateLinkStatus(link.id, "aprovado");
    }
    setBulkMode(false);
    setSelectedLinks(new Set());
  }

  const byInstrument = links.reduce<Record<string, IndicatorLink[]>>((acc, link) => {
    const key = `${link.instrument_code}/${link.instrument_version}`;
    (acc[key] ??= []).push(link);
    return acc;
  }, {});

  const highCount = links.filter((l) => l.compatibility === "alta" && l.status === "sugerido").length;
  const pendingCount = links.filter((l) => l.status === "sugerido").length;
  const approvedCount = links.filter((l) => l.status === "aprovado").length;

  return (
    <div className="er-prevalidation-panel" style={{ border: "2px solid var(--color-primary, #2563eb)", borderRadius: 12, padding: 24, background: "var(--color-surface, #fff)", marginTop: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--color-primary, #1e40af)" }}>
            🤖 PRÉ-VALIDAÇÃO COM IA
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
            {String(file.file_name)}
          </p>
        </div>
        <button onClick={onClose} className="er-btn er-small" style={{ fontSize: 18, lineHeight: 1 }}>✕</button>
      </header>

      {error && <p role="alert" className="er-alert error" style={{ marginBottom: 12 }}>{error}</p>}

      {/* Status atual */}
      {loading && <p style={{ color: "#64748b" }}>Carregando análises anteriores…</p>}

      {!loading && !prevalidation && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <p style={{ fontSize: 15, marginBottom: 12 }}>
            Este documento ainda não foi pré-validado pela IA.
          </p>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
            A IA irá ler o documento, identificar indicadores relacionados em todos os instrumentos regulatórios
            e sugerir onde esta evidência pode ser aproveitada.
          </p>
          <button
            onClick={startPrevalidation}
            disabled={analyzing}
            className="er-btn er-primary"
            style={{ fontSize: 16, padding: "12px 32px", fontWeight: 700 }}
          >
            {analyzing ? "⏳ Analisando documento…" : "🔍 PRÉ-VALIDAR COM IA"}
          </button>
        </div>
      )}

      {prevalidation?.ai_status === "processing" && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>⏳ Análise em andamento…</p>
          <p style={{ fontSize: 13, color: "#64748b" }}>A IA está lendo o documento e identificando indicadores.</p>
        </div>
      )}

      {prevalidation?.ai_status === "failed" && (
        <div style={{ padding: 16, background: "#fef2f2", borderRadius: 8, marginBottom: 16 }}>
          <p style={{ fontWeight: 600, color: "#dc2626" }}>❌ Análise falhou</p>
          <p style={{ fontSize: 13 }}>{prevalidation.ai_error}</p>
          <button onClick={startPrevalidation} disabled={analyzing} className="er-btn er-small" style={{ marginTop: 8 }}>
            {analyzing ? "Reprocessando…" : "Tentar novamente"}
          </button>
        </div>
      )}

      {prevalidation?.ai_status === "completed" && (
        <>
          {/* Resumo da análise */}
          <div style={{ background: "#f0f9ff", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><small style={{ color: "#64748b" }}>Natureza</small><br /><strong>{prevalidation.ai_nature}</strong></div>
              <div><small style={{ color: "#64748b" }}>Abrangência</small><br /><strong>{prevalidation.ai_scope_detected}</strong></div>
              {prevalidation.ai_course_detected && <div><small style={{ color: "#64748b" }}>Curso detectado</small><br /><strong>{prevalidation.ai_course_detected}</strong></div>}
              {prevalidation.ai_period_detected && <div><small style={{ color: "#64748b" }}>Período</small><br /><strong>{prevalidation.ai_period_detected}</strong></div>}
            </div>
            <p style={{ fontSize: 13, margin: 0 }}>{prevalidation.ai_summary}</p>
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
              Analisado por {prevalidation.ai_model_version} em{" "}
              {new Date(prevalidation.ai_analyzed_at).toLocaleString("pt-BR")}
            </p>
          </div>

          {/* KPIs */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, background: "#dcfce7", borderRadius: 8, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{approvedCount}</div>
              <div style={{ fontSize: 11 }}>Aprovados</div>
            </div>
            <div style={{ flex: 1, background: "#fef3c7", borderRadius: 8, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{pendingCount}</div>
              <div style={{ fontSize: 11 }}>Pendentes</div>
            </div>
            <div style={{ flex: 1, background: "#ede9fe", borderRadius: 8, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{Object.keys(byInstrument).length}</div>
              <div style={{ fontSize: 11 }}>Instrumentos</div>
            </div>
            <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 8, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{links.length}</div>
              <div style={{ fontSize: 11 }}>Vínculos totais</div>
            </div>
          </div>

          {/* Ações em lote */}
          {pendingCount > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {highCount > 0 && (
                <button className="er-btn er-primary er-small" onClick={() => void bulkApprove()}>
                  ✅ Aprovar {bulkMode ? selectedLinks.size : highCount} vínculo(s){!bulkMode ? " de alta compatibilidade" : " selecionado(s)"}
                </button>
              )}
              <button className="er-btn er-small" onClick={() => { setBulkMode(!bulkMode); setSelectedLinks(new Set()); }}>
                {bulkMode ? "Cancelar seleção" : "Selecionar individualmente"}
              </button>
              <button onClick={startPrevalidation} disabled={analyzing} className="er-btn er-small">
                🔄 Reanalisar
              </button>
            </div>
          )}

          {/* DESTINOS SUGERIDOS PARA ESTA EVIDÊNCIA */}
          <h4 style={{ fontSize: 16, fontWeight: 700, margin: "20px 0 12px", color: "var(--color-primary, #1e40af)" }}>
            DESTINOS SUGERIDOS PARA ESTA EVIDÊNCIA
          </h4>

          {Object.entries(byInstrument).map(([key, instrumentLinks]) => {
            const [code] = key.split("/");
            return (
              <div key={key} style={{ marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: 14 }}>
                  📋 {INSTRUMENT_LABELS[code] ?? code}
                  <span style={{ float: "right", fontSize: 12, color: "#64748b" }}>
                    {instrumentLinks.length} indicador(es)
                  </span>
                </div>
                {instrumentLinks.map((link) => {
                  const compat = COMPAT_COLORS[link.compatibility] ?? COMPAT_COLORS.baixa;
                  const statusInfo = STATUS_LABELS[link.status] ?? { label: link.status, color: "#64748b" };
                  const isExpanded = expandedLink === link.id;
                  return (
                    <div key={link.id} style={{ borderBottom: "1px solid #f1f5f9", padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {bulkMode && link.status === "sugerido" && (
                          <input
                            type="checkbox"
                            checked={selectedLinks.has(link.id)}
                            onChange={() => {
                              const next = new Set(selectedLinks);
                              next.has(link.id) ? next.delete(link.id) : next.add(link.id);
                              setSelectedLinks(next);
                            }}
                          />
                        )}
                        <span
                          style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 4,
                            fontSize: 11, fontWeight: 700, background: compat.bg, color: compat.border, border: `1px solid ${compat.border}`,
                          }}
                        >
                          {compat.label}
                        </span>
                        <strong style={{ fontSize: 14 }}>
                          {link.object_code}
                          {link.is_primary && <span style={{ color: "#d97706", marginLeft: 4 }}>★</span>}
                        </strong>
                        <span style={{ color: "#64748b", fontSize: 12 }}>Dim. {link.dimension}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: statusInfo.color, fontWeight: 600 }}>
                          {statusInfo.label}
                        </span>
                        <button className="er-btn er-small" onClick={() => setExpandedLink(isExpanded ? null : link.id)} style={{ padding: "2px 8px", fontSize: 12 }}>
                          {isExpanded ? "▲" : "▼"}
                        </button>
                      </div>

                      <p style={{ fontSize: 13, margin: "6px 0 0", color: "#475569" }}>
                        {link.justification}
                      </p>

                      {isExpanded && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e2e8f0" }}>
                          {link.evidence_excerpts?.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <small style={{ fontWeight: 600, color: "#475569" }}>Trechos identificados:</small>
                              {(Array.isArray(link.evidence_excerpts) ? link.evidence_excerpts : JSON.parse(String(link.evidence_excerpts))).map((ex: { page?: number; section?: string; text: string }, i: number) => (
                                <div key={i} style={{ background: "#fefce8", padding: 8, borderRadius: 4, margin: "4px 0", fontSize: 12 }}>
                                  {ex.page && <span style={{ color: "#92400e" }}>Pág. {ex.page}</span>}
                                  {ex.section && <span style={{ color: "#64748b" }}> · {ex.section}</span>}
                                  <p style={{ margin: "4px 0 0", fontStyle: "italic" }}>"{ex.text}"</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {link.limitations && (
                            <div style={{ background: "#fff7ed", padding: 8, borderRadius: 4, fontSize: 12, marginBottom: 8 }}>
                              <strong>⚠️ Limitações:</strong> {link.limitations}
                            </div>
                          )}

                          {link.status === "sugerido" && (
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button className="er-btn er-primary er-small" onClick={() => void updateLinkStatus(link.id, "aprovado")}>
                                ✅ Aprovar vínculo
                              </button>
                              <button className="er-btn er-small" onClick={() => void updateLinkStatus(link.id, "revisao_humana")}>
                                👁️ Solicitar revisão
                              </button>
                              <button className="er-btn er-small" style={{ color: "#dc2626" }} onClick={() => setRejectingId(link.id)}>
                                ❌ Rejeitar
                              </button>
                            </div>
                          )}
                          {rejectingId === link.id && (
                            <div style={{ marginTop: 8 }}>
                              <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Justificativa da rejeição"
                                style={{ width: "100%", minHeight: 60 }}
                              />
                              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                <button className="er-btn er-small" style={{ color: "#dc2626" }} onClick={() => void updateLinkStatus(link.id, "rejeitado", rejectReason)}>
                                  Confirmar rejeição
                                </button>
                                <button className="er-btn er-small" onClick={() => setRejectingId(null)}>Cancelar</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {links.length === 0 && (
            <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>
              A IA não identificou indicadores relacionados neste documento.
            </p>
          )}
        </>
      )}
    </div>
  );
}
