/**
 * PreValidationQueue.tsx — Fila de pré-validação e espelhamento
 * Central de documentos pendentes de validação por IA e aprovação humana.
 */
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { type Row, explain } from "@/lib/area";

const PreValidationPanel = lazy(() => import("./PreValidationPanel"));

interface PrevalidationRow {
  id: string;
  institution_id: string;
  document_id: string | null;
  repository_file_id: string | null;
  source_table: string;
  ai_status: string;
  ai_summary: string | null;
  ai_nature: string | null;
  ai_scope_detected: string | null;
  ai_model_version: string | null;
  ai_analyzed_at: string | null;
  ai_error: string | null;
  created_at: string;
}

interface IndicatorLink {
  id: string;
  prevalidation_id: string;
  instrument_code: string;
  object_code: string;
  compatibility: string;
  status: string;
  justification: string;
}

interface QueueItem {
  prevalidation: PrevalidationRow;
  file_name: string;
  file_id: string;
  links: IndicatorLink[];
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  instruments: string[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: "Aguardando análise", color: "#d97706", bg: "#fef3c7", icon: "⏳" },
  processing: { label: "Em pré-validação", color: "#2563eb", bg: "#dbeafe", icon: "🔄" },
  completed: { label: "Análise concluída", color: "#16a34a", bg: "#dcfce7", icon: "✅" },
  failed: { label: "Falha na análise", color: "#dc2626", bg: "#fee2e2", icon: "❌" },
};

const INSTRUMENT_LABELS: Record<string, string> = {
  reconhecimento_curso: "Reconhecimento",
  novo_instrumento_2026: "Novo Instrumento 2026",
  recredenciamento_2017: "Recredenciamento",
};

type FilterStatus = "all" | "pending_approval" | "completed" | "processing" | "failed";

export default function PreValidationQueue({ institutionId, role }: { institutionId: string; role: string }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const isManager = ["master", "reitor", "gestor", "diretor_geral", "procurador"].includes(role);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Load all prevalidations for this institution
      const { data: pvs, error: pvErr } = await supabase
        .from("vertice_doc_prevalidation")
        .select("*")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false });
      if (pvErr) throw pvErr;
      if (!pvs?.length) { setItems([]); return; }

      // Load all indicator links
      const pvIds = pvs.map((p: PrevalidationRow) => p.id);
      const { data: links } = await supabase
        .from("vertice_doc_indicator_links")
        .select("id,prevalidation_id,instrument_code,object_code,compatibility,status,justification")
        .in("prevalidation_id", pvIds);

      // Load file names from repository_files
      const repoFileIds = pvs.filter((p: PrevalidationRow) => p.repository_file_id).map((p: PrevalidationRow) => p.repository_file_id);
      const docIds = pvs.filter((p: PrevalidationRow) => p.document_id).map((p: PrevalidationRow) => p.document_id);

      let fileMap: Record<string, string> = {};
      if (repoFileIds.length) {
        const { data: files } = await supabase
          .from("vertice_repository_files")
          .select("id,file_name")
          .in("id", repoFileIds);
        (files ?? []).forEach((f: Row) => { fileMap[String(f.id)] = String(f.file_name); });
      }
      if (docIds.length) {
        const { data: docs } = await supabase
          .from("vertice_documents")
          .select("id,file_name")
          .in("id", docIds);
        (docs ?? []).forEach((d: Row) => { fileMap[String(d.id)] = String(d.file_name); });
      }

      const linkMap = new Map<string, IndicatorLink[]>();
      (links ?? []).forEach((l: IndicatorLink) => {
        const arr = linkMap.get(l.prevalidation_id) ?? [];
        arr.push(l);
        linkMap.set(l.prevalidation_id, arr);
      });

      const queue: QueueItem[] = pvs.map((pv: PrevalidationRow) => {
        const pvLinks = linkMap.get(pv.id) ?? [];
        const fileId = pv.repository_file_id ?? pv.document_id ?? "";
        return {
          prevalidation: pv,
          file_name: fileMap[fileId] ?? "Documento desconhecido",
          file_id: fileId,
          links: pvLinks,
          pending_count: pvLinks.filter((l) => l.status === "sugerido").length,
          approved_count: pvLinks.filter((l) => l.status === "aprovado").length,
          rejected_count: pvLinks.filter((l) => l.status === "rejeitado").length,
          instruments: [...new Set(pvLinks.map((l) => l.instrument_code))],
        };
      });

      setItems(queue);
    } catch (e) {
      setError(explain(e));
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const filtered = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "pending_approval") return item.pending_count > 0 && item.prevalidation.ai_status === "completed";
    if (filter === "completed") return item.pending_count === 0 && item.approved_count > 0;
    if (filter === "processing") return item.prevalidation.ai_status === "processing" || item.prevalidation.ai_status === "pending";
    if (filter === "failed") return item.prevalidation.ai_status === "failed";
    return true;
  });

  // KPIs
  const totalDocs = items.length;
  const pendingApproval = items.filter((i) => i.pending_count > 0 && i.prevalidation.ai_status === "completed").length;
  const fullyApproved = items.filter((i) => i.pending_count === 0 && i.approved_count > 0).length;
  const inProgress = items.filter((i) => ["pending", "processing"].includes(i.prevalidation.ai_status)).length;
  const failedCount = items.filter((i) => i.prevalidation.ai_status === "failed").length;
  const totalLinks = items.reduce((s, i) => s + i.links.length, 0);
  const approvedLinks = items.reduce((s, i) => s + i.approved_count, 0);

  async function deletePrevalidation(pvId: string) {
    if (!confirm("Excluir esta pré-validação e todos os seus vínculos? Você poderá repetir o processo depois.")) return;
    try {
      // Links are CASCADE deleted via FK
      await supabase.from("vertice_doc_indicator_links").delete().eq("prevalidation_id", pvId);
      await supabase.from("vertice_doc_prevalidation").delete().eq("id", pvId);
      setSelectedItem(null);
      await loadQueue();
    } catch (e) {
      setError(explain(e));
    }
  }

  async function bulkApproveHigh() {
    setAnalyzing(true);
    try {
      const highLinks = items
        .flatMap((i) => i.links)
        .filter((l) => l.status === "sugerido" && l.compatibility === "alta");
      for (const link of highLinks) {
        await supabase
          .from("vertice_doc_indicator_links")
          .update({ status: "aprovado", reviewed_at: new Date().toISOString() })
          .eq("id", link.id);
      }
      await loadQueue();
    } catch (e) {
      setError(explain(e));
    } finally {
      setAnalyzing(false);
    }
  }

  const kpiStyle = (bg: string, border: string) => ({
    flex: 1, minWidth: 120, padding: 16, borderRadius: 8, background: bg,
    borderLeft: `4px solid ${border}`, textAlign: "center" as const,
  });

  return (
    <section className="er-card" style={{ padding: 0 }}>
      <header style={{ padding: "20px 24px 12px", borderBottom: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--color-primary, #1e40af)" }}>
          📋 Fila de Pré-validação e Espelhamento
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
          Documentos analisados pela IA com vínculos regulatórios pendentes de aprovação
        </p>
      </header>

      {error && <p role="alert" className="er-alert error" style={{ margin: 16 }}>{error}</p>}

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, padding: "16px 24px", flexWrap: "wrap" }}>
        <div style={kpiStyle("#dbeafe", "#2563eb")}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{totalDocs}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>Documentos analisados</div>
        </div>
        <div style={kpiStyle("#fef3c7", "#d97706")}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{pendingApproval}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>Aguardando aprovação</div>
        </div>
        <div style={kpiStyle("#dcfce7", "#16a34a")}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{fullyApproved}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>Totalmente aprovados</div>
        </div>
        <div style={kpiStyle("#f0f9ff", "#0ea5e9")}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{approvedLinks}/{totalLinks}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>Vínculos aprovados</div>
        </div>
        {failedCount > 0 && (
          <div style={kpiStyle("#fee2e2", "#dc2626")}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#dc2626" }}>{failedCount}</div>
            <div style={{ fontSize: 11, color: "#475569" }}>Falhas</div>
          </div>
        )}
      </div>

      {/* Filtros e ações */}
      <div style={{ padding: "0 24px 12px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterStatus)}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
        >
          <option value="all">Todos ({totalDocs})</option>
          <option value="pending_approval">⏳ Aguardando aprovação ({pendingApproval})</option>
          <option value="completed">✅ Aprovados ({fullyApproved})</option>
          <option value="processing">🔄 Em análise ({inProgress})</option>
          {failedCount > 0 && <option value="failed">❌ Falhas ({failedCount})</option>}
        </select>
        {isManager && pendingApproval > 0 && (
          <button
            className="er-btn er-primary er-small"
            disabled={analyzing}
            onClick={() => void bulkApproveHigh()}
            style={{ fontSize: 13 }}
          >
            {analyzing ? "Processando…" : `✅ Aprovar todos os vínculos de alta compatibilidade`}
          </button>
        )}
        <button className="er-btn er-small" onClick={() => void loadQueue()} style={{ fontSize: 13 }}>
          🔄 Atualizar
        </button>
      </div>

      {/* Painel de detalhe */}
      {selectedItem && (
        <div style={{ padding: "0 24px 16px" }}>
          <Suspense fallback={<p>Carregando painel…</p>}>
            <PreValidationPanel
              file={{ id: selectedItem.file_id, file_name: selectedItem.file_name } as Row}
              institutionId={institutionId}
              sourceTable={selectedItem.prevalidation.source_table}
              onClose={() => setSelectedItem(null)}
              onLinksUpdated={() => void loadQueue()}
            />
          </Suspense>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p style={{ padding: 24, textAlign: "center", color: "#64748b" }}>Carregando fila…</p>
      ) : filtered.length === 0 ? (
        <p style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
          {totalDocs === 0
            ? "Nenhum documento foi pré-validado ainda. Use o botão 🤖 Pré-validar nos documentos do Repositório."
            : "Nenhum documento neste filtro."}
        </p>
      ) : (
        <div style={{ padding: "0 24px 24px" }}>
          {filtered.map((item) => {
            const st = STATUS_CONFIG[item.prevalidation.ai_status] ?? STATUS_CONFIG.pending;
            const isSelected = selectedItem?.prevalidation.id === item.prevalidation.id;
            return (
              <div
                key={item.prevalidation.id}
                style={{
                  border: isSelected ? "2px solid var(--color-primary, #2563eb)" : "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                  background: "var(--color-surface, #fff)",
                  cursor: "pointer",
                  transition: "border-color .15s",
                }}
                onClick={() => setSelectedItem(isSelected ? null : item)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 12,
                        fontSize: 11, fontWeight: 600, background: st.bg, color: st.color,
                      }}>
                        {st.icon} {st.label}
                      </span>
                      {item.pending_count > 0 && (
                        <span style={{
                          display: "inline-block", padding: "2px 10px", borderRadius: 12,
                          fontSize: 11, fontWeight: 600, background: "#fef3c7", color: "#d97706",
                        }}>
                          {item.pending_count} vínculo(s) pendente(s)
                        </span>
                      )}
                      {item.approved_count > 0 && (
                        <span style={{
                          display: "inline-block", padding: "2px 10px", borderRadius: 12,
                          fontSize: 11, fontWeight: 600, background: "#dcfce7", color: "#16a34a",
                        }}>
                          {item.approved_count} aprovado(s)
                        </span>
                      )}
                    </div>
                    <strong style={{ fontSize: 14 }}>{item.file_name}</strong>
                    {item.prevalidation.ai_nature && (
                      <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>
                        · {item.prevalidation.ai_nature}
                      </span>
                    )}
                    {item.prevalidation.ai_summary && (
                      <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0", lineHeight: 1.4 }}>
                        {item.prevalidation.ai_summary.slice(0, 150)}
                        {item.prevalidation.ai_summary.length > 150 ? "…" : ""}
                      </p>
                    )}
                    {item.prevalidation.ai_error && (
                      <p style={{ fontSize: 12, color: "#dc2626", margin: "4px 0 0" }}>
                        {item.prevalidation.ai_error}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right", minWidth: 140 }}>
                    {item.instruments.length > 0 && (
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                        {item.instruments.map((i) => INSTRUMENT_LABELS[i] ?? i).join(", ")}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
                      {new Date(item.prevalidation.created_at).toLocaleDateString("pt-BR")}
                    </div>
                    {isManager && (
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button
                          className="er-btn er-small"
                          style={{ fontSize: 11, color: "#dc2626", padding: "2px 8px" }}
                          onClick={(e) => { e.stopPropagation(); void deletePrevalidation(item.prevalidation.id); }}
                        >🗑 Excluir</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mini barra de progresso */}
                {item.links.length > 0 && (
                  <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", marginTop: 8, background: "#f1f5f9" }}>
                    {item.approved_count > 0 && (
                      <div style={{ width: `${(item.approved_count / item.links.length) * 100}%`, background: "#16a34a" }} />
                    )}
                    {item.pending_count > 0 && (
                      <div style={{ width: `${(item.pending_count / item.links.length) * 100}%`, background: "#d97706" }} />
                    )}
                    {item.rejected_count > 0 && (
                      <div style={{ width: `${(item.rejected_count / item.links.length) * 100}%`, background: "#dc2626" }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
