/**
 * ExtensaoGovernanca — Painel de governança de extensão
 * Política, plano, calendário e indicadores
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Policy {
  id: string; title: string; resolution_number: string;
  approved_by_body: string; approved_at: string;
  effective_from: string; effective_until: string | null;
  min_extension_pct: number; regulatory_basis: string;
  regulatory_basis_verified: boolean; status: string;
}

interface Plan {
  id: string; policy_id: string | null; title: string;
  period_start: string; period_end: string; status: string;
  budget_total: number; target_projects_count: number;
  target_students_count: number; target_hours_per_student: number;
  priority_sdg_goals: number[];
}

interface CalendarEvent {
  id: string; plan_id: string | null; title: string;
  event_type: string; scheduled_date: string; end_date: string | null;
  responsible: string; completed: boolean; completed_at: string | null;
}

interface Dashboard {
  total_projects: number; active_projects: number; completed_projects: number;
  total_students: number; total_faculty: number; community_reach: number;
  planned_hours: number; completed_student_hours: number;
  courses_with_extension: number; total_courses: number;
  sdg_targets_linked: number; policy_min_pct: number | null;
  total_deliverables: number; recent_imports: number; published_reports: number;
}

const EVENT_ICONS: Record<string, string> = {
  marco: '🏁', edital: '📋', selecao: '🎯', relatorio: '📄',
  avaliacao: '✅', capacitacao: '🎓', evento_institucional: '🎪', prestacao_contas: '💰',
};

const STATUS_COLORS: Record<string, string> = {
  vigente: '#22c55e', rascunho: '#6b7280', em_aprovacao: '#f59e0b',
  revogada: '#ef4444', substituida: '#9ca3af',
  aprovado: '#3b82f6', em_execucao: '#8b5cf6', concluido: '#22c55e',
};

export default function ExtensaoGovernanca({
  institutionId, canEdit,
}: {
  institutionId: string;
  canEdit: boolean;
}) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'painel' | 'politica' | 'plano' | 'calendario'>('painel');

  const load = useCallback(async () => {
    setLoading(true);
    const [polRes, planRes, calRes, dashRes] = await Promise.all([
      supabase.from('vertice_extension_policies').select('*').eq('institution_id', institutionId).order('effective_from', { ascending: false }),
      supabase.from('vertice_extension_plans').select('*').eq('institution_id', institutionId).order('period_start', { ascending: false }),
      supabase.from('vertice_extension_calendar').select('*').eq('institution_id', institutionId).gte('scheduled_date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).order('scheduled_date'),
      supabase.from('v_extension_dashboard').select('*').eq('institution_id', institutionId).single(),
    ]);
    setPolicies(polRes.data || []);
    setPlans(planRes.data || []);
    setCalendar(calRes.data || []);
    setDashboard(dashRes.data || null);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtPct = (n: number | null) => n != null ? `${n}%` : '—';
  const fmtNum = (n: number) => n.toLocaleString('pt-BR');

  if (loading) return <p>Carregando governança...</p>;

  return (
    <div className="ext-section">
      {/* Sub-abas */}
      <div className="ext-tabs" style={{ marginBottom: '1.5rem' }}>
        {(['painel', 'politica', 'plano', 'calendario'] as const).map(t => (
          <button key={t} className={`ext-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'painel' ? '📊 Painel' : t === 'politica' ? '📜 Política' : t === 'plano' ? '📋 Plano' : '📅 Calendário'}
          </button>
        ))}
      </div>

      {/* ===== PAINEL ===== */}
      {tab === 'painel' && dashboard && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
            <StatCard label="Projetos ativos" value={dashboard.active_projects} total={dashboard.total_projects} color="#8b5cf6" />
            <StatCard label="Estudantes" value={dashboard.total_students} color="#3b82f6" />
            <StatCard label="Docentes" value={dashboard.total_faculty} color="#0ea5e9" />
            <StatCard label="Comunidade" value={dashboard.community_reach} color="#22c55e" />
            <StatCard label="Horas cumpridas" value={dashboard.completed_student_hours} total={dashboard.planned_hours} suffix="h" color="#f59e0b" />
            <StatCard label="Cursos com extensão" value={dashboard.courses_with_extension} total={dashboard.total_courses} color="#ef4444" />
            <StatCard label="Metas ODS" value={dashboard.sdg_targets_linked} color="#0a97d9" />
            <StatCard label="% mínimo (DCN)" value={dashboard.policy_min_pct || 10} suffix="%" color="#c5192d" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '.75rem' }}>
            <div className="ext-stat-card">
              <span className="ext-stat-value">{dashboard.total_deliverables}</span>
              <span className="ext-stat-label">Entregas registradas</span>
            </div>
            <div className="ext-stat-card">
              <span className="ext-stat-value">{dashboard.recent_imports}</span>
              <span className="ext-stat-label">Importações (90 dias)</span>
            </div>
            <div className="ext-stat-card">
              <span className="ext-stat-value">{dashboard.published_reports}</span>
              <span className="ext-stat-label">Relatórios publicados</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== POLÍTICA ===== */}
      {tab === 'politica' && (
        <div>
          {policies.length === 0 ? (
            <p className="ext-empty">Nenhuma política de extensão cadastrada.</p>
          ) : policies.map(pol => (
            <div key={pol.id} className="ext-project-card" style={{ cursor: 'default', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0 }}>{pol.title}</h4>
                <span style={{ padding: '.2rem .6rem', borderRadius: '.25rem', fontSize: '.8rem', background: (STATUS_COLORS[pol.status] || '#888') + '18', color: STATUS_COLORS[pol.status] || '#888' }}>
                  {pol.status}
                </span>
              </div>
              {pol.resolution_number && <p style={{ margin: '.25rem 0', fontSize: '.85rem', color: 'var(--text-secondary,#6b7280)' }}>Resolução {pol.resolution_number} — {pol.approved_by_body}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.5rem', marginTop: '.5rem', fontSize: '.85rem' }}>
                <div>📅 Vigência: {fmtDate(pol.effective_from)} — {pol.effective_until ? fmtDate(pol.effective_until) : 'indeterminada'}</div>
                <div>📏 Mínimo: <strong>{fmtPct(pol.min_extension_pct)}</strong></div>
                <div>📐 Base: {pol.regulatory_basis} {pol.regulatory_basis_verified ? '✅' : '⚠️ não verificada'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== PLANO ===== */}
      {tab === 'plano' && (
        <div>
          {plans.length === 0 ? (
            <p className="ext-empty">Nenhum plano de extensão cadastrado.</p>
          ) : plans.map(pln => (
            <div key={pln.id} className="ext-project-card" style={{ cursor: 'default', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0 }}>{pln.title}</h4>
                <span style={{ padding: '.2rem .6rem', borderRadius: '.25rem', fontSize: '.8rem', background: (STATUS_COLORS[pln.status] || '#888') + '18', color: STATUS_COLORS[pln.status] || '#888' }}>
                  {pln.status}
                </span>
              </div>
              <p style={{ margin: '.25rem 0', fontSize: '.85rem', color: 'var(--text-secondary,#6b7280)' }}>
                {fmtDate(pln.period_start)} — {fmtDate(pln.period_end)}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '.5rem', marginTop: '.5rem', fontSize: '.85rem' }}>
                <div>💰 Orçamento: R$ {fmtNum(pln.budget_total)}</div>
                <div>🎯 Meta projetos: {pln.target_projects_count || '—'}</div>
                <div>🎓 Meta estudantes: {pln.target_students_count || '—'}</div>
                <div>⏱ Meta horas/aluno: {pln.target_hours_per_student || '—'}h</div>
              </div>
              {pln.priority_sdg_goals?.length > 0 && (
                <div style={{ marginTop: '.5rem' }}>
                  ODS prioritários: {pln.priority_sdg_goals.map(g => (
                    <span key={g} style={{ display: 'inline-block', padding: '.1rem .4rem', margin: '.1rem', borderRadius: '.25rem', fontSize: '.8rem', background: '#0a97d920', color: '#0a97d9', fontWeight: 600 }}>
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== CALENDÁRIO ===== */}
      {tab === 'calendario' && (
        <div>
          {calendar.length === 0 ? (
            <p className="ext-empty">Nenhum evento nos próximos 30 dias.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {calendar.map(evt => {
                const isPast = new Date(evt.scheduled_date) < new Date();
                return (
                  <div key={evt.id} style={{
                    padding: '.75rem 1rem', borderRadius: '.5rem',
                    background: evt.completed ? '#22c55e10' : isPast ? '#ef444410' : 'var(--bg-secondary, #f9fafb)',
                    borderLeft: `3px solid ${evt.completed ? '#22c55e' : isPast ? '#ef4444' : '#3b82f6'}`,
                    opacity: evt.completed ? 0.7 : 1,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        {EVENT_ICONS[evt.event_type] || '📌'} <strong>{evt.title}</strong>
                      </span>
                      <span style={{ fontSize: '.82rem', color: 'var(--text-secondary,#6b7280)' }}>
                        {fmtDate(evt.scheduled_date)}{evt.end_date ? ` — ${fmtDate(evt.end_date)}` : ''}
                      </span>
                    </div>
                    {evt.responsible && <p style={{ margin: '.2rem 0 0', fontSize: '.82rem' }}>👤 {evt.responsible}</p>}
                    {evt.completed && <span style={{ fontSize: '.75rem', color: '#22c55e' }}>✅ Concluído em {fmtDate(evt.completed_at!)}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, total, suffix, color }: {
  label: string; value: number; total?: number; suffix?: string; color: string;
}) {
  return (
    <div className="ext-stat-card">
      <span className="ext-stat-value" style={{ color }}>
        {value.toLocaleString('pt-BR')}{suffix || ''}{total ? <span style={{ fontSize: '.65em', opacity: 0.6 }}>/{total.toLocaleString('pt-BR')}</span> : ''}
      </span>
      <span className="ext-stat-label">{label}</span>
    </div>
  );
}
