import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tab = "diagnoses" | "interventions" | "briefings" | "goals";

type Diagnosis = {
  id: string; module: string; severity: string; summary: string;
  accuracy_rate: number; sample_size: number; sapiens_cycle: number;
  status: string; created_at: string; course_id: string;
};
type Intervention = {
  id: string; title: string; module: string; status: string;
  intervention_type: string; description: string; reviewed_by: string | null;
  reviewed_at: string | null; reviewer_notes: string | null;
  created_at: string; diagnosis_id: string;
};
type Briefing = {
  id: string; briefing_type: string; summary: string;
  active_risks: number; off_track_goals: number; pending_actions: number;
  pending_approvals: number; interventions_in_progress: number;
  generated_at: string; sections: Array<{ title: string; severity: string; items: Array<{ text: string; action_required: boolean }> }>;
};
type Goal = {
  id: string; title: string; category: string; trajectory: string;
  status: string; baseline_value: number | null; target_value: number;
  current_value: number | null; unit: string; due_at: string;
};
type ActionPlan = {
  id: string; what: string; status: string; planned_date: string | null;
  goal_id: string;
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626", warning: "#f59e0b", watch: "#3b82f6",
  adequate: "#22c55e", strong: "#059669",
};
const SEVERITY_LABELS: Record<string, string> = {
  critical: "Crítico", warning: "Atenção", watch: "Observação",
  adequate: "Adequado", strong: "Forte",
};
const STATUS_LABELS: Record<string, string> = {
  proposed: "Proposta", approved: "Aprovada", rejected: "Rejeitada",
  modified: "Modificada", sent: "Enviada ao F&O", completed: "Concluída",
  cancelled: "Cancelada",
};
const TRAJECTORY_LABELS: Record<string, string> = {
  on_track: "No rumo", attention: "Atenção", off_track: "Fora da trajetória",
  critical: "Crítico", achieved: "Alcançada", cancelled: "Cancelada",
};
const BRIEFING_LABELS: Record<string, string> = {
  morning: "☀️ Matinal (06h)", midday: "🌤️ Meio-dia (13h)",
  evening: "🌙 Encerramento (18h30)", weekly_audit: "📊 Auditoria Semanal",
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      fontSize: 11, fontWeight: 600, color: "#fff", background: color,
    }}>
      {label}
    </span>
  );
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
  catch { return v; }
}

interface Props { institutionId: string; role: string | null }

export default function SapiensPanel({ institutionId, role }: Props) {
  const [tab, setTab] = useState<Tab>("diagnoses");
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [actions, setActions] = useState<ActionPlan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedBriefing, setExpandedBriefing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [d, i, b, g, a] = await Promise.all([
        supabase.from("vertice_sapiens_diagnoses").select("*")
          .eq("institution_id", institutionId).order("created_at", { ascending: false }).limit(50),
        supabase.from("vertice_sapiens_interventions").select("*")
          .eq("institution_id", institutionId).order("created_at", { ascending: false }).limit(50),
        supabase.from("vertice_sapiens_briefings").select("*")
          .eq("institution_id", institutionId).order("generated_at", { ascending: false }).limit(20),
        supabase.from("vertice_sapiens_goals").select("*")
          .eq("institution_id", institutionId).order("created_at", { ascending: false }).limit(30),
        supabase.from("vertice_sapiens_action_plans").select("*")
          .eq("institution_id", institutionId).order("sort_order").limit(100),
      ]);
      if (d.data) setDiagnoses(d.data as Diagnosis[]);
      if (i.data) setInterventions(i.data as Intervention[]);
      if (b.data) setBriefings(b.data as Briefing[]);
      if (g.data) setGoals(g.data as Goal[]);
      if (a.data) setActions(a.data as ActionPlan[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const approveIntervention = async (id: string, approved: boolean) => {
    setBusy(true); setError(""); setSuccess("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada");
      const { error: err } = await supabase.from("vertice_sapiens_interventions").update({
        status: approved ? "approved" : "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (err) throw err;
      setSuccess(approved ? "Intervenção aprovada." : "Intervenção rejeitada.");
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "diagnoses", label: "Diagnósticos", count: diagnoses.filter(d => d.status !== "archived").length },
    { key: "interventions", label: "Intervenções", count: interventions.filter(i => i.status === "proposed").length },
    { key: "briefings", label: "Briefings", count: briefings.length },
    { key: "goals", label: "Metas & Ações", count: goals.filter(g => g.status === "active").length },
  ];

  return (
    <section className="corp-section" aria-label="Vértice Sapiens — Inteligência Institucional">
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>🧠 Vértice Sapiens</h2>
        <span style={{ fontSize: 12, color: "#64748b" }}>Inteligência Institucional</span>
        <button type="button" onClick={load} disabled={busy}
          style={{ marginLeft: "auto", fontSize: 12, padding: "4px 12px", borderRadius: 6,
            border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}>
          {busy ? "Carregando…" : "↻ Atualizar"}
        </button>
      </header>

      {error && <p role="alert" style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
      {success && <p role="status" style={{ color: "#059669", fontSize: 13 }}>{success}</p>}

      {/* Tabs */}
      <nav style={{ display: "flex", gap: 4, borderBottom: "2px solid #e2e8f0", marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              border: "none", borderBottom: tab === t.key ? "2px solid #2563eb" : "2px solid transparent",
              background: "none", cursor: "pointer", color: tab === t.key ? "#1e40af" : "#475569",
              marginBottom: -2,
            }}>
            {t.label}{t.count ? ` (${t.count})` : ""}
          </button>
        ))}
      </nav>

      {/* Diagnoses Tab */}
      {tab === "diagnoses" && (
        <div>
          {diagnoses.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13 }}>Nenhum diagnóstico gerado. Execute uma sincronização para iniciar.</p>}
          {diagnoses.map(d => (
            <article key={d.id} style={{
              border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 12,
              borderLeft: `4px solid ${SEVERITY_COLORS[d.severity] || "#94a3b8"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Badge label={SEVERITY_LABELS[d.severity] || d.severity} color={SEVERITY_COLORS[d.severity] || "#94a3b8"} />
                <strong style={{ fontSize: 14 }}>{d.module.toUpperCase()}</strong>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Ciclo #{d.sapiens_cycle}</span>
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>{fmtDate(d.created_at)}</span>
              </div>
              <p style={{ fontSize: 13, margin: "4px 0", lineHeight: 1.5 }}>{d.summary}</p>
              <div style={{ fontSize: 11, color: "#64748b", display: "flex", gap: 16 }}>
                <span>Acerto: {d.accuracy_rate != null ? (d.accuracy_rate * 100).toFixed(1) + "%" : "—"}</span>
                <span>Amostra: {d.sample_size} alunos</span>
                <span>Status: {d.status}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Interventions Tab */}
      {tab === "interventions" && (
        <div>
          {interventions.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13 }}>Nenhuma intervenção proposta.</p>}
          {interventions.map(iv => (
            <article key={iv.id} style={{
              border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Badge
                  label={STATUS_LABELS[iv.status] || iv.status}
                  color={iv.status === "proposed" ? "#f59e0b" : iv.status === "approved" ? "#22c55e" :
                    iv.status === "rejected" ? "#dc2626" : iv.status === "sent" ? "#2563eb" : "#94a3b8"}
                />
                <strong style={{ fontSize: 14 }}>{iv.title}</strong>
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>{fmtDate(iv.created_at)}</span>
              </div>
              <p style={{ fontSize: 13, margin: "4px 0", lineHeight: 1.5, color: "#475569" }}>{iv.description}</p>
              {iv.reviewer_notes && (
                <p style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
                  Nota do revisor: {iv.reviewer_notes}
                </p>
              )}
              {iv.status === "proposed" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button type="button" disabled={busy} onClick={() => approveIntervention(iv.id, true)}
                    style={{ padding: "6px 16px", fontSize: 13, borderRadius: 6, border: "none",
                      background: "#22c55e", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                    ✓ Aprovar
                  </button>
                  <button type="button" disabled={busy} onClick={() => approveIntervention(iv.id, false)}
                    style={{ padding: "6px 16px", fontSize: 13, borderRadius: 6,
                      border: "1px solid #dc2626", background: "#fff", color: "#dc2626", cursor: "pointer" }}>
                    ✗ Rejeitar
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Briefings Tab */}
      {tab === "briefings" && (
        <div>
          {briefings.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13 }}>Nenhum briefing gerado ainda.</p>}
          {briefings.map(b => (
            <article key={b.id} style={{
              border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
                onClick={() => setExpandedBriefing(expandedBriefing === b.id ? null : b.id)}>
                <span style={{ fontSize: 14 }}>{BRIEFING_LABELS[b.briefing_type] || b.briefing_type}</span>
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>{fmtDate(b.generated_at)}</span>
                <span style={{ fontSize: 14, color: "#94a3b8" }}>{expandedBriefing === b.id ? "▲" : "▼"}</span>
              </div>
              <div style={{ fontSize: 11, color: "#64748b", display: "flex", gap: 12, flexWrap: "wrap" }}>
                {b.active_risks > 0 && <span style={{ color: "#dc2626" }}>⚠ {b.active_risks} riscos</span>}
                {b.off_track_goals > 0 && <span style={{ color: "#f59e0b" }}>⊘ {b.off_track_goals} metas</span>}
                {b.pending_actions > 0 && <span>📋 {b.pending_actions} ações</span>}
                {b.pending_approvals > 0 && <span style={{ color: "#2563eb" }}>⏳ {b.pending_approvals} aprovações</span>}
              </div>
              {expandedBriefing === b.id && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 13, lineHeight: 1.6 }}>{b.summary}</p>
                  {b.sections?.map((s, i) => (
                    <div key={i} style={{ marginTop: 12, paddingLeft: 12, borderLeft: "3px solid #e2e8f0" }}>
                      <h4 style={{ fontSize: 13, margin: "0 0 4px", color: "#1e293b" }}>{s.title}</h4>
                      <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: "#475569" }}>
                        {s.items?.map((item, j) => (
                          <li key={j} style={{ marginBottom: 4, fontWeight: item.action_required ? 600 : 400 }}>
                            {item.action_required && <span style={{ color: "#dc2626" }}>⚡ </span>}
                            {item.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Goals & Action Plans Tab */}
      {tab === "goals" && (
        <div>
          {goals.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13 }}>Nenhuma meta cadastrada.</p>}
          {goals.map(g => {
            const goalActions = actions.filter(a => a.goal_id === g.id);
            const progress = g.target_value > 0 && g.current_value != null
              ? Math.min(100, Math.max(0, (g.current_value / g.target_value) * 100))
              : 0;
            return (
              <article key={g.id} style={{
                border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Badge
                    label={TRAJECTORY_LABELS[g.trajectory] || g.trajectory}
                    color={g.trajectory === "on_track" || g.trajectory === "achieved" ? "#22c55e" :
                      g.trajectory === "attention" ? "#f59e0b" : "#dc2626"}
                  />
                  <strong style={{ fontSize: 14 }}>{g.title}</strong>
                </div>
                {/* Progress bar */}
                <div style={{ background: "#e2e8f0", borderRadius: 4, height: 8, margin: "8px 0", overflow: "hidden" }}>
                  <div style={{
                    background: g.trajectory === "on_track" ? "#22c55e" : g.trajectory === "attention" ? "#f59e0b" : "#dc2626",
                    height: "100%", width: `${progress}%`, transition: "width 0.3s",
                  }} />
                </div>
                <div style={{ fontSize: 11, color: "#64748b", display: "flex", gap: 16 }}>
                  <span>Base: {g.baseline_value ?? "—"}{g.unit}</span>
                  <span>Atual: {g.current_value ?? "—"}{g.unit}</span>
                  <span>Meta: {g.target_value}{g.unit}</span>
                  <span>Prazo: {g.due_at || "—"}</span>
                </div>
                {goalActions.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <h4 style={{ fontSize: 12, color: "#475569", margin: "0 0 6px" }}>Plano de ação:</h4>
                    {goalActions.map(a => (
                      <div key={a.id} style={{ fontSize: 12, padding: "4px 0", display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: a.status === "completed" ? "#22c55e" : a.status === "blocked" ? "#dc2626" :
                            a.status === "in_progress" ? "#3b82f6" : "#cbd5e1",
                        }} />
                        <span style={{ color: a.status === "completed" ? "#64748b" : "#1e293b",
                          textDecoration: a.status === "completed" ? "line-through" : "none" }}>
                          {a.what}
                        </span>
                        {a.planned_date && <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>{a.planned_date}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
