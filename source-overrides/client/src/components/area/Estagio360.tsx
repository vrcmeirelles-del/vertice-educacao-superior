// Estagio360.tsx — Estágio Obrigatório 360 (Interno e Externo)
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchOrganizations, fetchFields, fetchInternshipRules, fetchPlacements, fetchAttendance, fetchReports, fetchInternshipCourseSummary, LIFECYCLE_LABELS, LIFECYCLE_COLORS, minutesToHours, type InternshipOrg, type InternshipField, type InternshipRule, type InternshipPlacement, type InternshipAttendance, type InternshipReport, type InternshipCourseSummary } from '@/lib/estagio';
import { fetchStudentRegistry, type StudentRegistryEntry } from '@/lib/atividades-complementares';
import { fetchProtocols, PROTOCOL_STATUS_LABELS } from '@/lib/atividades-complementares';
import './egressos360.css';
import EstagioFormularios from './EstagioFormularios';

type Section = 'forms'|'overview'|'organizations'|'fields'|'placements'|'attendance'|'reports'|'protocols'|'bi'|'config';
interface Props { institutionId: string; courses: { id: string; name: string }[]; role: string; onNavigate?: (tab: string) => void; }

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: 'forms', label: 'Modelos e PDF', icon: '📄' },
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

export default function Estagio360({ institutionId, courses, role, onNavigate }: Props) {
  const [formsVisited,setFormsVisited]=useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [orgs, setOrgs] = useState<InternshipOrg[]>([]);
  const [fields, setFields] = useState<InternshipField[]>([]);
  const [rules, setRules] = useState<InternshipRule[]>([]);
  const [placements, setPlacements] = useState<InternshipPlacement[]>([]);
  const [summary, setSummary] = useState<InternshipCourseSummary[]>([]);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [students, setStudents] = useState<StudentRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlacement, setSelectedPlacement] = useState<string|null>(null);
  const [showForm, setShowForm] = useState<false|'placement'|'org'|'field'>(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchOrganizations(institutionId),
      fetchFields(institutionId),
      fetchInternshipRules(institutionId),
      fetchPlacements(institutionId),
      fetchInternshipCourseSummary(institutionId),
      fetchProtocols(institutionId, 'mandatory_internship'),
      fetchStudentRegistry(institutionId),
    ]).then(([o, f, r, p, s, pr, st]) => {
      setOrgs(o); setFields(f); setRules(r); setPlacements(p); setSummary(s); setProtocols(pr); setStudents(st);
    }).finally(() => setLoading(false));
  }, [institutionId]);

  const LIFECYCLE_ORDER: Record<string, string> = {
    draft: 'preparing', preparing: 'under_review', under_review: 'authorized',
    authorized: 'active', active: 'operationally_closed',
    operationally_closed: 'final_assessment', final_assessment: 'academic_approved',
    academic_approved: 'sent_to_secretariat', sent_to_secretariat: 'posting_confirmed',
  };
  const nextLifecycle = (current: string): string | null => LIFECYCLE_ORDER[current] || null;

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
            onClick={() => { setSection(n.key); if(n.key==='forms')setFormsVisited(true); setSelectedPlacement(null); }}>
            <span className="alumni-nav-icon">{n.icon}</span> {n.label}
          </button>
        ))}
      </nav>

      {(formsVisited||section==='forms')&&<div hidden={section!=='forms'}><EstagioFormularios key={institutionId} institutionId={institutionId} role={role} courses={courses} placements={placements} students={students} rules={rules} onChanged={()=>{}} /></div>}
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

          {/* Conexões com outros módulos */}
          {onNavigate && (
            <div className="alumni-section" style={{ marginTop: '1rem' }}>
              <h3 className="alumni-section-title">Módulos Conectados</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('extensao')}>
                  <strong>🤝 Extensão 360°</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Atividade de extensão pode originar estágio. Horas não duplicam entre módulos.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('tcc')}>
                  <strong>📝 TCC e Pesquisa</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Estágio pode gerar material para TCC. Créditos registrados separadamente.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('atividades-complementares')}>
                  <strong>📜 Atividades Complementares</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Estágio não obrigatório pode ser apresentado como AC conforme regulamento.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('governanca')}>
                  <strong>⚖ Governança</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Colegiado delibera sobre aproveitamento e campos de estágio.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('raio-x-direito')}>
                  <strong>⌕ Raio-X do Curso</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Bloco Estágio no raio-x com vínculos ativos e concluídos por curso.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('inclusao')}>
                  <strong>♿ Inclusão / PEI</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Alunos com PEI podem ter adaptações no plano de estágio.</span>
                </button>
              </div>
            </div>
          )}
        </div>)}

        {section === 'organizations' && (<div>
          <header className="alumni-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Organizações Concedentes</h2>
            <button className="alumni-btn-export" onClick={() => setShowForm(v => v === 'org' ? false : 'org' as any)}>+ Nova Organização</button>
          </header>
          {showForm === 'org' && <CreateOrgForm institutionId={institutionId} onCreated={(o) => { setOrgs(prev => [o, ...prev]); setShowForm(false); }} onCancel={() => setShowForm(false)} />}
          {orgs.length === 0 && showForm !== 'org' ? <div className="alumni-info-box">Nenhuma organização cadastrada.</div> : (
            <table className="alumni-table">
              <thead><tr><th>Nome</th><th>CNPJ</th><th>Cidade</th><th>Status</th><th>Campos</th></tr></thead>
              <tbody>{orgs.map(o => (
                <tr key={o.id}><td><strong>{o.name}</strong>{o.trade_name ? <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)' }}> ({o.trade_name})</span> : null}</td><td>{o.identifier || '—'}</td><td>{o.city || '—'}</td><td><span className="alumni-tag">{o.status}</span></td><td>{fields.filter(f => f.organization_id === o.id).length}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>)}

        {section === 'fields' && (<div>
          <header className="alumni-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Campos de Estágio</h2>
            <button className="alumni-btn-export" onClick={() => setShowForm(v => v === 'field' ? false : 'field' as any)}>+ Novo Campo</button>
          </header>
          {showForm === 'field' && <CreateFieldForm institutionId={institutionId} courses={courses} orgs={orgs} onCreated={(f) => { setFields(prev => [f, ...prev]); setShowForm(false); }} onCancel={() => setShowForm(false)} />}
          {fields.length === 0 && showForm !== 'field' ? <div className="alumni-info-box">Nenhum campo cadastrado.</div> : (
            <table className="alumni-table">
              <thead><tr><th>Campo</th><th>Concedente</th><th>Tipo</th><th>Área</th><th>Capacidade</th><th>Status</th></tr></thead>
              <tbody>{fields.map(f => (
                <tr key={f.id}><td><strong>{f.name}</strong></td><td>{orgName(f.organization_id)}</td><td>{f.location_type === 'internal' ? '🏫 Interno' : '🏢 Externo'}</td><td>{f.area_of_practice || '—'}</td><td>{f.capacity || '—'}</td><td><span className="alumni-tag">{f.status}</span></td></tr>
              ))}</tbody>
            </table>
          )}
        </div>)}

        {section === 'placements' && (<div>
          <header className="alumni-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Estágios</h2>
            <button className="alumni-btn-export" onClick={() => setShowForm(v => v === 'placement' ? false : 'placement')}>+ Novo Estágio</button>
          </header>
          {showForm === 'placement' && <CreatePlacementForm institutionId={institutionId} courses={courses} orgs={orgs} fields={fields} students={students} rules={rules} onCreated={(p) => { setPlacements(prev => [p, ...prev]); setShowForm(false); }} onCancel={() => setShowForm(false)} />}
          {placements.length === 0 && !showForm ? <div className="alumni-info-box">Nenhum estágio registrado.</div> : (
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)' }}>
                      {p.starts_at && `Início: ${new Date(p.starts_at).toLocaleDateString('pt-BR')}`}
                      {p.ends_at && ` · Fim: ${new Date(p.ends_at).toLocaleDateString('pt-BR')}`}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!p.supervisor_name && (
                        <button style={{ fontSize: '.6875rem', padding: '2px 10px', borderRadius: 4, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer' }}
                          onClick={async (e) => { e.stopPropagation(); const email = prompt('E-mail do supervisor externo:'); if (!email) return; const name = prompt('Nome do supervisor:') || ''; const token = crypto.randomUUID(); const enc = new TextEncoder().encode(token); const buf = await crypto.subtle.digest('SHA-256', enc); const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''); await supabase.from('vertice_internship_supervisor_invites').insert({ institution_id: institutionId, placement_id: p.id, supervisor_email: email, supervisor_name: name, token_hash: hash, purpose: 'evaluation', expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString() }); await supabase.from('vertice_internship_placements').update({ supervisor_name: name }).eq('id', p.id); setPlacements(prev => prev.map(x => x.id === p.id ? { ...x, supervisor_name: name } : x)); alert(`Convite criado para ${email}. Token: ${token.slice(0,8)}…`); }}>📧 Convidar supervisor</button>
                      )}
                      {nextLifecycle(p.lifecycle) && (
                        <button style={{ fontSize: '.6875rem', padding: '2px 10px', borderRadius: 4, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}
                          onClick={async (e) => { e.stopPropagation(); const next = nextLifecycle(p.lifecycle)!; await supabase.from('vertice_internship_placements').update({ lifecycle: next }).eq('id', p.id); setPlacements(prev => prev.map(x => x.id === p.id ? { ...x, lifecycle: next } : x)); }}>
                          → {LIFECYCLE_LABELS[nextLifecycle(p.lifecycle)!] || nextLifecycle(p.lifecycle)}
                        </button>
                      )}
                    </div>
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
          {/* Distribuição por ciclo de vida */}
          {placements.length > 0 && (() => {
            const lcCounts = Object.entries(LIFECYCLE_LABELS).map(([k, l]) => ({ key: k, label: l, count: placements.filter(p => p.lifecycle === k).length })).filter(s => s.count > 0);
            const max = Math.max(...lcCounts.map(c => c.count), 1);
            return (
              <div className="alumni-section" style={{ marginTop: '1rem' }}>
                <h3 className="alumni-section-title">Distribuição por Ciclo de Vida</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lcCounts.map(s => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '.75rem', width: 160, textAlign: 'right', flexShrink: 0, color: 'var(--vx-muted)' }}>{s.label}</span>
                      <div style={{ flex: 1, height: 20, background: 'var(--vx-border,#e2e8f0)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(s.count / max) * 100}%`, height: '100%', background: LIFECYCLE_COLORS[s.key] || '#94a3b8', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: '.75rem', fontWeight: 600, width: 24, textAlign: 'center' }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Interno vs Externo */}
          {placements.length > 0 && (() => {
            const int = placements.filter(p => p.location_type === 'internal').length;
            const ext = placements.filter(p => p.location_type === 'external').length;
            const total = int + ext;
            return (
              <div className="alumni-section" style={{ marginTop: '1rem' }}>
                <h3 className="alumni-section-title">Interno vs Externo</h3>
                <div style={{ display: 'flex', gap: 8, height: 28, borderRadius: 6, overflow: 'hidden' }}>
                  {int > 0 && <div style={{ width: `${(int/total)*100}%`, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '.75rem', fontWeight: 600 }}>🏫 {int}</div>}
                  {ext > 0 && <div style={{ width: `${(ext/total)*100}%`, background: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '.75rem', fontWeight: 600 }}>🏢 {ext}</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.6875rem', color: 'var(--vx-muted)', marginTop: 4 }}>
                  <span>Interno: {int} ({total > 0 ? Math.round(100*int/total) : 0}%)</span>
                  <span>Externo: {ext} ({total > 0 ? Math.round(100*ext/total) : 0}%)</span>
                </div>
              </div>
            );
          })()}

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

          {/* Concedentes ativas */}
          {orgs.filter(o => o.status === 'active').length > 0 && (
            <div className="alumni-section" style={{ marginTop: '1rem' }}>
              <h3 className="alumni-section-title">Concedentes Ativas</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {orgs.filter(o => o.status === 'active').map(o => {
                  const count = placements.filter(p => p.organization_id === o.id).length;
                  return <span key={o.id} className="alumni-tag" style={{ background: count > 0 ? '#eff6ff' : '#f8fafc', color: count > 0 ? '#2563eb' : '#94a3b8' }}>{o.trade_name || o.name} ({count})</span>;
                })}
              </div>
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
          <div className="alumni-section" style={{ marginTop: '1rem' }}>
            <h3 className="alumni-section-title">Checklist de Ativação</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Regras/componentes configurados por curso', ok: rules.length > 0 },
                { label: 'Organizações concedentes cadastradas', ok: orgs.length > 0 },
                { label: 'Campos de estágio cadastrados', ok: fields.length > 0 },
                { label: 'Base de alunos importada', ok: students.length > 0 },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: c.ok ? '#f0fdf4' : '#fef2f2', borderRadius: 6, border: `1px solid ${c.ok ? '#bbf7d0' : '#fecaca'}` }}>
                  <span>{c.ok ? '✓' : '○'}</span><span style={{ flex: 1, fontSize: '.8125rem' }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="alumni-info-box" style={{ marginTop: '1rem' }}>
            <strong>Lei 11.788/2008:</strong> Jornada máx. 6h/dia (educação superior). Supervisor acessa via convite com token de uso único. Plano previsto ≠ frequência. Convênio ≠ termo individual.
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

const fld: React.CSSProperties = { display: 'block', width: '100%', padding: '6px 10px', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 6, fontSize: '.8125rem', marginTop: 4 };

function CreatePlacementForm({ institutionId, courses, orgs, fields, students, rules, onCreated, onCancel }: {
  institutionId: string; courses: { id: string; name: string }[]; orgs: InternshipOrg[]; fields: InternshipField[]; students: StudentRegistryEntry[]; rules: InternshipRule[];
  onCreated: (p: InternshipPlacement) => void; onCancel: () => void;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [studentId, setStudentId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [locType, setLocType] = useState<'internal'|'external'>('external');
  const [advisor, setAdvisor] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);

  const courseStudents = students.filter(s => s.course_id === courseId);
  const courseRule = rules.find(r => r.course_id === courseId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !orgId || !fieldId) return;
    setSaving(true);
    const { data, error } = await supabase.from('vertice_internship_placements').insert({
      institution_id: institutionId, course_id: courseId, student_id: studentId,
      organization_id: orgId, field_id: fieldId, location_type: locType,
      rule_id: courseRule?.id || null,
      advisor_name: advisor || null,
      starts_at: startsAt || null, ends_at: endsAt || null,
      lifecycle: 'draft',
    }).select().single();
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    onCreated(data as InternshipPlacement);
  }

  return (
    <form onSubmit={handleSubmit} className="alumni-info-box" style={{ background: 'var(--vx-surface,#fff)', border: '1px solid var(--vx-border,#e2e8f0)', marginBottom: '1rem' }}>
      <strong style={{ display: 'block', marginBottom: 12 }}>Novo Vínculo de Estágio</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>Curso<select value={courseId} onChange={e => setCourseId(e.target.value)} style={fld}>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Aluno<select value={studentId} onChange={e => setStudentId(e.target.value)} style={fld}><option value="">Selecione…</option>{courseStudents.map(s => <option key={s.id} value={s.id}>{s.full_name} — {s.enrollment_code}</option>)}</select></label>
        <label>Tipo<select value={locType} onChange={e => setLocType(e.target.value as any)} style={fld}><option value="internal">Interno</option><option value="external">Externo</option></select></label>
        <label>Concedente<select value={orgId} onChange={e => setOrgId(e.target.value)} style={fld}><option value="">Selecione…</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.trade_name || o.name}</option>)}</select></label>
        <label>Campo<select value={fieldId} onChange={e => setFieldId(e.target.value)} style={fld}><option value="">Selecione…</option>{fields.filter(f => !orgId || f.organization_id === orgId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label>Orientador<input value={advisor} onChange={e => setAdvisor(e.target.value)} style={fld} placeholder="Nome do orientador" /></label>
        <label>Início<input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} style={fld} /></label>
        <label>Término<input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={fld} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} className="alumni-btn-back">Cancelar</button>
        <button type="submit" disabled={saving || !studentId || !orgId || !fieldId} className="alumni-btn-export">{saving ? 'Salvando…' : 'Criar Estágio'}</button>
      </div>
    </form>
  );
}

function CreateOrgForm({ institutionId, onCreated, onCancel }: { institutionId: string; onCreated: (o: InternshipOrg) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [city, setCity] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    const { data, error } = await supabase.from('vertice_internship_organizations').insert({
      institution_id: institutionId, name, trade_name: tradeName || null,
      identifier: identifier || null, city: city || null,
      contact_name: contactName || null, contact_email: contactEmail || null,
      status: 'active',
    }).select().single();
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    onCreated(data as InternshipOrg);
  }

  return (
    <form onSubmit={handleSubmit} className="alumni-info-box" style={{ background: 'var(--vx-surface,#fff)', border: '1px solid var(--vx-border,#e2e8f0)', marginBottom: '1rem' }}>
      <strong style={{ display: 'block', marginBottom: 12 }}>Nova Organização Concedente</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>Razão Social *<input value={name} onChange={e => setName(e.target.value)} style={fld} placeholder="Nome completo da organização" required /></label>
        <label>Nome Fantasia<input value={tradeName} onChange={e => setTradeName(e.target.value)} style={fld} placeholder="Opcional" /></label>
        <label>CNPJ<input value={identifier} onChange={e => setIdentifier(e.target.value)} style={fld} placeholder="00.000.000/0000-00" /></label>
        <label>Cidade<input value={city} onChange={e => setCity(e.target.value)} style={fld} placeholder="Cidade/UF" /></label>
        <label>Contato (nome)<input value={contactName} onChange={e => setContactName(e.target.value)} style={fld} placeholder="Responsável pelo convênio" /></label>
        <label>Contato (e-mail)<input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={fld} placeholder="email@empresa.com" /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} className="alumni-btn-back">Cancelar</button>
        <button type="submit" disabled={saving || !name} className="alumni-btn-export">{saving ? 'Salvando…' : 'Cadastrar'}</button>
      </div>
    </form>
  );
}

function CreateFieldForm({ institutionId, courses, orgs, onCreated, onCancel }: {
  institutionId: string; courses: { id: string; name: string }[]; orgs: InternshipOrg[];
  onCreated: (f: InternshipField) => void; onCancel: () => void;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [orgId, setOrgId] = useState('');
  const [name, setName] = useState('');
  const [locType, setLocType] = useState<'internal'|'external'>('external');
  const [area, setArea] = useState('');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !orgId) return;
    setSaving(true);
    const { data, error } = await supabase.from('vertice_internship_fields').insert({
      institution_id: institutionId, organization_id: orgId,
      name, location_type: locType, area_of_practice: area || null,
      capacity: capacity ? parseInt(capacity) : null, status: 'active',
    }).select().single();
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    onCreated(data as InternshipField);
  }

  return (
    <form onSubmit={handleSubmit} className="alumni-info-box" style={{ background: 'var(--vx-surface,#fff)', border: '1px solid var(--vx-border,#e2e8f0)', marginBottom: '1rem' }}>
      <strong style={{ display: 'block', marginBottom: 12 }}>Novo Campo de Estágio</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>Nome do Campo *<input value={name} onChange={e => setName(e.target.value)} style={fld} placeholder="Ex: Setor jurídico — DPE/TO" required /></label>
        <label>Concedente *<select value={orgId} onChange={e => setOrgId(e.target.value)} style={fld}><option value="">Selecione…</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.trade_name || o.name}</option>)}</select></label>
        <label>Curso<select value={courseId} onChange={e => setCourseId(e.target.value)} style={fld}>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Tipo<select value={locType} onChange={e => setLocType(e.target.value as any)} style={fld}><option value="internal">Interno</option><option value="external">Externo</option></select></label>
        <label>Área de prática<input value={area} onChange={e => setArea(e.target.value)} style={fld} placeholder="Direito civil, administrativo…" /></label>
        <label>Capacidade (vagas)<input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} style={fld} min="1" /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} className="alumni-btn-back">Cancelar</button>
        <button type="submit" disabled={saving || !name || !orgId} className="alumni-btn-export">{saving ? 'Salvando…' : 'Cadastrar Campo'}</button>
      </div>
    </form>
  );
}
