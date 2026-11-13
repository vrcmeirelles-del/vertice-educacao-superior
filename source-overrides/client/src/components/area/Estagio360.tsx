// Estagio360.tsx — Estágio Obrigatório 360 (Interno e Externo)
import { useState, useEffect } from 'react';
import { fetchOrganizations, fetchFields, fetchInternshipRules, fetchPlacements, fetchAttendance, fetchReports, fetchInternshipCourseSummary, LIFECYCLE_LABELS, LIFECYCLE_COLORS, minutesToHours, type InternshipOrg, type InternshipField, type InternshipRule, type InternshipPlacement, type InternshipAttendance, type InternshipReport, type InternshipCourseSummary } from '@/lib/estagio';
import { fetchProtocols, PROTOCOL_STATUS_LABELS } from '@/lib/atividades-complementares';
import './egressos360.css';

type Section = 'overview'|'organizations'|'fields'|'placements'|'attendance'|'reports'|'protocols'|'bi'|'config';
interface Props { institutionId: string; courses: { id: string; name: string }[]; role: string; }

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Visão Geral', icon: '◎' },
  { key: 'organizations', label: 'Concedentes', icon: '🏢' },
  { key: 'fields', label: 'Campos', icon: '📍' },
  { key: 'placements', label: 'Estágios', icon: '📋' },
  { key: 'attendance', label: 'Frequência', icon: '⏱' },
  { key: 'reports', label: 'Relatórios', icon: '📝' },
  { key: 'protocols', label: 'Secretaria', icon: '📨' },
  { key: 'bi', label: 'BI 360', icon: '📊' },
  { key: 'config', label: 'Configurações', icon: '⚙' },
];

export default function Estagio360({ institutionId, courses, role }: Props) {
  const [section, setSection] = useState<Section>('overview');
  const [orgs, setOrgs] = useState<InternshipOrg[]>([]);
  const [fields, setFields] = useState<InternshipField[]>([]);
  const [rules, setRules] = useState<InternshipRule[]>([]);
  const [placements, setPlacements] = useState<InternshipPlacement[]>([]);
  const [summary, setSummary] = useState<InternshipCourseSummary[]>([]);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlacement, setSelectedPlacement] = useState<string|null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchOrganizations(institutionId),
      fetchFields(institutionId),
      fetchInternshipRules(institutionId),
      fetchPlacements(institutionId),
      fetchInternshipCourseSummary(institutionId),
      fetchProtocols(institutionId, 'mandatory_internship'),
    ]).then(([o, f, r, p, s, pr]) => {
      setOrgs(o); setFields(f); setRules(r); setPlacements(p); setSummary(s); setProtocols(pr);
    }).finally(() => setLoading(false));
  }, [institutionId]);

  const courseName = (id: string) => courses.find(c => c.id === id)?.name || '—';
  const orgName = (id: string) => orgs.find(o => o.id === id)?.name || '—';
  const fieldName = (id: string) => fields.find(f => f.id === id)?.name || '—';
  const active = placements.filter(p => p.lifecycle === 'active');
  const completed = placements.filter(p => ['academic_approved','sent_to_secretariat','posting_confirmed'].includes(p.lifecycle));

  return (
    <div className="alumni-360">
      <nav className="alumni-nav" role="tablist">
        {NAV.map(n => (
          <button key={n.key} role="tab" aria-selected={section === n.key}
            className={`alumni-nav-btn${section === n.key ? ' alumni-nav-btn-active' : ''}`}
            onClick={() => { setSection(n.key); setSelectedPlacement(null); }}>
            <span className="alumni-nav-icon">{n.icon}</span> {n.label}
          </button>
        ))}
      </nav>

      {loading ? <p className="alumni-loading">Carregando Estágio 360…</p> : (<>

        {section === 'overview' && (<div>
          <header className="alumni-header">
            <h2>Estágio Obrigatório 360</h2>
            <p className="alumni-subtitle">Campos internos e externos, acompanhamento, frequência, avaliação e secretaria</p>
          </header>
          <div className="alumni-kpis">
            <KPI label="Estágios Ativos" value={active.length} color="#0891b2" />
            <KPI label="Concluídos" value={completed.length} color="#059669" />
            <KPI label="Concedentes" value={orgs.length} />
            <KPI label="Campos" value={fields.length} />
            <KPI label="Internos" value={placements.filter(p => p.location_type === 'internal').length} />
            <KPI label="Externos" value={placements.filter(p => p.location_type === 'external').length} />
          </div>
          {/* Distribuição por ciclo */}
          <div className="alumni-section">
            <h3 className="alumni-section-title">Distribuição por Ciclo</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(LIFECYCLE_LABELS).map(([k, v]) => {
                const count = placements.filter(p => p.lifecycle === k).length;
                if (count === 0) return null;
                return <span key={k} className="alumni-tag" style={{ background: (LIFECYCLE_COLORS[k]||'#94a3b8')+'22', color: LIFECYCLE_COLORS[k]||'#94a3b8', border: `1px solid ${(LIFECYCLE_COLORS[k]||'#94a3b8')}44` }}>{v}: {count}</span>;
              })}
            </div>
          </div>
          {summary.length > 0 && (
            <div className="alumni-section">
              <h3 className="alumni-section-title">Resumo por Curso</h3>
              <table className="alumni-table">
                <thead><tr><th>Curso</th><th>Estágios</th><th>Ativos</th><th>Internos</th><th>Externos</th><th>Alunos</th><th>Concluídos</th><th>Horas Validadas</th></tr></thead>
                <tbody>{summary.map(s => (
                  <tr key={s.course_id}><td>{s.course_name}</td><td>{s.placements_total}</td><td>{s.placements_active}</td><td>{s.internal_count}</td><td>{s.external_count}</td><td>{s.students_distinct}</td><td>{s.completed}</td><td>{minutesToHours(s.hours_validated_minutes)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>)}

        {section === 'organizations' && (<div>
          <header className="alumni-header"><h2>Organizações Concedentes</h2></header>
          {orgs.length === 0 ? <div className="alumni-info-box">Nenhuma organização cadastrada.</div> : (
            <table className="alumni-table">
              <thead><tr><th>Nome</th><th>CNPJ</th><th>Cidade</th><th>Status</th><th>Campos</th></tr></thead>
              <tbody>{orgs.map(o => (
                <tr key={o.id}><td><strong>{o.name}</strong>{o.trade_name ? <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)' }}> ({o.trade_name})</span> : null}</td><td>{o.identifier || '—'}</td><td>{o.city || '—'}</td><td><span className="alumni-tag">{o.status}</span></td><td>{fields.filter(f => f.organization_id === o.id).length}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>)}

        {section === 'fields' && (<div>
          <header className="alumni-header"><h2>Campos de Estágio</h2></header>
          {fields.length === 0 ? <div className="alumni-info-box">Nenhum campo cadastrado.</div> : (
            <table className="alumni-table">
              <thead><tr><th>Campo</th><th>Concedente</th><th>Tipo</th><th>Área</th><th>Capacidade</th><th>Status</th></tr></thead>
              <tbody>{fields.map(f => (
                <tr key={f.id}><td><strong>{f.name}</strong></td><td>{orgName(f.organization_id)}</td><td>{f.location_type === 'internal' ? '🏫 Interno' : '🏢 Externo'}</td><td>{f.area_of_practice || '—'}</td><td>{f.capacity || '—'}</td><td><span className="alumni-tag">{f.status}</span></td></tr>
              ))}</tbody>
            </table>
          )}
        </div>)}

        {section === 'placements' && (<div>
          <header className="alumni-header"><h2>Estágios</h2></header>
          {placements.length === 0 ? <div className="alumni-info-box">Nenhum estágio registrado.</div> : (
            <div style={{ display: 'grid', gap: '.75rem' }}>
              {placements.map(p => (
                <div key={p.id} className="alumni-finding-card" style={{ border: '1px solid var(--vx-border,#e2e8f0)', cursor: 'pointer' }}
                  onClick={() => { setSelectedPlacement(p.id); setSection('attendance'); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{courseName(p.course_id)}</strong>
                      <div style={{ fontSize: '.8125rem', color: 'var(--vx-muted)', marginTop: 2 }}>
                        {p.location_type === 'internal' ? '🏫' : '🏢'} {orgName(p.organization_id)} · {fieldName(p.field_id)}
                      </div>
                      <div style={{ fontSize: '.75rem', color: 'var(--vx-muted)' }}>
                        {p.advisor_name && `Orientador: ${p.advisor_name}`}{p.supervisor_name && ` · Supervisor: ${p.supervisor_name}`}
                      </div>
                    </div>
                    <span className="alumni-tag" style={{ background: (LIFECYCLE_COLORS[p.lifecycle]||'#94a3b8')+'22', color: LIFECYCLE_COLORS[p.lifecycle]||'#94a3b8' }}>
                      {LIFECYCLE_LABELS[p.lifecycle] || p.lifecycle}
                    </span>
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--vx-muted)', marginTop: 4 }}>
                    {p.starts_at && `Início: ${new Date(p.starts_at).toLocaleDateString('pt-BR')}`}
                    {p.ends_at && ` · Fim: ${new Date(p.ends_at).toLocaleDateString('pt-BR')}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>)}

        {section === 'attendance' && (<PlacementAttendance placementId={selectedPlacement} placements={placements} onBack={() => { setSelectedPlacement(null); setSection('placements'); }} />)}

        {section === 'reports' && (<div>
          <header className="alumni-header"><h2>Relatórios Periódicos e Finais</h2></header>
          <div className="alumni-info-box">Selecione um estágio na aba "Estágios" para ver relatórios e frequência detalhada.</div>
        </div>)}

        {section === 'protocols' && (<div>
          <header className="alumni-header"><h2>Protocolos — Secretaria</h2></header>
          {protocols.length === 0 ? <div className="alumni-info-box">Nenhum protocolo gerado.</div> : (
            <table className="alumni-table">
              <thead><tr><th>Relatório</th><th>Estado</th><th>Assinado</th><th>Enviado</th><th>Lançado</th></tr></thead>
              <tbody>{protocols.map((p: any) => (
                <tr key={p.id}><td>v{p.report_version} · {new Date(p.created_at).toLocaleDateString('pt-BR')}</td><td><span className="alumni-tag">{PROTOCOL_STATUS_LABELS[p.state] || p.state}</span></td><td>{p.signed_at ? new Date(p.signed_at).toLocaleDateString('pt-BR') : '—'}</td><td>{p.sent_at ? new Date(p.sent_at).toLocaleDateString('pt-BR') : '—'}</td><td>{p.confirmed_posted_at ? '✓' : '—'}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>)}

        {section === 'bi' && (<div>
          <header className="alumni-header"><h2>BI — Estágio Obrigatório</h2></header>
          <div className="alumni-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <KPI label="Total Estágios" value={placements.length} />
            <KPI label="Ativos" value={active.length} color="#0891b2" />
            <KPI label="Concluídos" value={completed.length} color="#059669" />
            <KPI label="Alunos Distintos" value={new Set(placements.map(p => p.student_id)).size} />
            <KPI label="Concedentes" value={orgs.filter(o => o.status === 'active').length} />
            <KPI label="Campos Aprovados" value={fields.filter(f => f.status === 'approved' || f.status === 'active').length} />
            <KPI label="Internos" value={placements.filter(p => p.location_type === 'internal').length} />
            <KPI label="Externos" value={placements.filter(p => p.location_type === 'external').length} />
          </div>
          {summary.length > 0 && (
            <div className="alumni-section" style={{ marginTop: '1rem' }}>
              <h3 className="alumni-section-title">Detalhamento por Curso</h3>
              <table className="alumni-table">
                <thead><tr><th>Curso</th><th>Estágios</th><th>Ativos</th><th>Int.</th><th>Ext.</th><th>Alunos</th><th>Concluídos</th><th>Horas</th><th>Concedentes</th></tr></thead>
                <tbody>{summary.map(s => (
                  <tr key={s.course_id}><td>{s.course_name}</td><td>{s.placements_total}</td><td>{s.placements_active}</td><td>{s.internal_count}</td><td>{s.external_count}</td><td>{s.students_distinct}</td><td>{s.completed}</td><td>{minutesToHours(s.hours_validated_minutes)}</td><td>{s.organizations_count}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>)}

        {section === 'config' && (<div>
          <header className="alumni-header"><h2>Configurações</h2></header>
          <div className="alumni-section">
            <h3 className="alumni-section-title">Regras por Componente</h3>
            {rules.length === 0 ? <div className="alumni-info-box">Nenhuma regra configurada. Cadastre os componentes de estágio por curso e matriz.</div> : (
              <table className="alumni-table">
                <thead><tr><th>Curso</th><th>Componente</th><th>Matriz</th><th>Carga Exigida</th><th>Jornada Diária</th></tr></thead>
                <tbody>{rules.map(r => (
                  <tr key={r.id}><td>{courseName(r.course_id)}</td><td><strong>{r.component_name}</strong></td><td>{r.curriculum_version}</td><td>{minutesToHours(r.total_required_minutes)}</td><td>{r.max_daily_minutes ? minutesToHours(r.max_daily_minutes) : '—'}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>)}
      </>)}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: number|string; color?: string }) {
  return <div className="alumni-kpi" style={{ borderLeftColor: color || 'var(--vx-accent,#2563eb)' }}><span className="alumni-kpi-value">{value}</span><span className="alumni-kpi-label">{label}</span></div>;
}

function PlacementAttendance({ placementId, placements, onBack }: { placementId: string|null; placements: InternshipPlacement[]; onBack: () => void }) {
  const [attendance, setAttendance] = useState<InternshipAttendance[]>([]);
  const [reports, setReports] = useState<InternshipReport[]>([]);
  const [loading, setLoading] = useState(true);
  const placement = placements.find(p => p.id === placementId);

  useEffect(() => {
    if (!placementId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([fetchAttendance(placementId), fetchReports(placementId)])
      .then(([a, r]) => { setAttendance(a); setReports(r); }).finally(() => setLoading(false));
  }, [placementId]);

  if (!placementId || !placement) return <div className="alumni-info-box">Selecione um estágio na aba anterior.</div>;
  const totalMin = attendance.filter(a => a.academic_decision === 'validated').reduce((s, a) => s + a.net_minutes, 0);

  return (
    <div>
      <button onClick={onBack} className="alumni-btn-back">← Estágios</button>
      <header className="alumni-header"><h2>Frequência e Relatórios</h2><p className="alumni-subtitle">{LIFECYCLE_LABELS[placement.lifecycle]}</p></header>
      <div className="alumni-kpis">
        <KPI label="Registros" value={attendance.length} />
        <KPI label="Horas Validadas" value={minutesToHours(totalMin)} color="#059669" />
        <KPI label="Pendentes" value={attendance.filter(a => !a.academic_decision || a.academic_decision === 'pending').length} color="#f59e0b" />
        <KPI label="Relatórios" value={reports.length} />
      </div>
      {loading ? <p className="alumni-loading">Carregando…</p> : (<>
        {attendance.length > 0 && (
          <table className="alumni-table" style={{ marginTop: '1rem' }}>
            <thead><tr><th>Data</th><th>Entrada</th><th>Saída</th><th>Intervalo</th><th>Líquido</th><th>Campo</th><th>Acadêmico</th></tr></thead>
            <tbody>{attendance.slice(0, 60).map(a => (
              <tr key={a.id}><td>{new Date(a.activity_date).toLocaleDateString('pt-BR')}</td><td>{new Date(a.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td><td>{new Date(a.ended_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td><td>{a.break_minutes}min</td><td>{a.net_minutes}min</td><td>{a.field_confirmed_by ? '✓' : '◷'}</td><td><span className="alumni-tag">{a.academic_decision === 'validated' ? '✓' : a.academic_decision === 'rejected' ? '✕' : '◷'}</span></td></tr>
            ))}</tbody>
          </table>
        )}
        {reports.length > 0 && (
          <div className="alumni-section" style={{ marginTop: '1rem' }}>
            <h3 className="alumni-section-title">Relatórios</h3>
            <table className="alumni-table">
              <thead><tr><th>Tipo</th><th>Período</th><th>Status</th><th>Vencimento</th></tr></thead>
              <tbody>{reports.map(r => (
                <tr key={r.id} style={r.due_date && new Date(r.due_date) < new Date() && r.status !== 'approved' ? { background: '#fef2f2' } : undefined}><td>{r.report_type === 'final' ? 'Final' : r.report_type === 'incident' ? 'Incidente' : 'Periódico'}</td><td>{r.period_start && r.period_end ? `${new Date(r.period_start).toLocaleDateString('pt-BR')} – ${new Date(r.period_end).toLocaleDateString('pt-BR')}` : '—'}</td><td><span className="alumni-tag">{r.status}</span></td><td>{r.due_date ? new Date(r.due_date).toLocaleDateString('pt-BR') : '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </>)}
    </div>
  );
}
