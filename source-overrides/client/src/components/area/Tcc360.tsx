// Tcc360.tsx — TCC e Produção Acadêmica 360
// Navegação interna: Visão Geral, Carteira, Projeto, Orientações, Atividades,
// Horas, Banca, Acervo, Evidências PPC/ODS, BI, Configurações
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  fetchWorks, fetchWorkTypes, fetchCourseSummary, fetchParticipants,
  fetchTasks, fetchSupervisions, fetchDefenses, fetchVersions,
  fetchHourDeclarations, fetchReferenceSets, fetchReferenceElements,
  fetchAlignmentSuggestions, fetchSdgLinks, fetchTransitions,
  createWork, createParticipant, createTask, createSupervision, createVersion,
  createDefense, createHourDeclaration, updateWork, updateTask, transitionWork,
  STAGE_LABELS, STAGE_COLORS, ACTIVITY_TYPE_LABELS, ROLE_LABELS, minutesToHours,
  type TccWork, type TccWorkType, type TccParticipant, type TccTask,
  type TccSupervision, type TccDefense, type TccVersion, type TccCourseSummary,
  type TccHourDeclaration, type TccReferenceSet, type TccReferenceElement,
} from '@/lib/tcc';
import './egressos360.css';

type Section = 'overview'|'portfolio'|'project'|'supervisions'|'tasks'|'hours'|'defense'|'repository'|'evidence'|'bi'|'config';

const TCC_NEXT_STAGE: Record<string, string> = {
  draft: 'submitted', submitted: 'under_review', under_review: 'project_approved',
  project_approved: 'in_execution', in_execution: 'final_submitted',
  final_submitted: 'defense_scheduled', defense_scheduled: 'assessed',
  assessed: 'post_defense_changes', post_defense_changes: 'final_validated',
  final_validated: 'deposited',
};

interface Props {
  institutionId: string;
  courses: { id: string; name: string; modality?: string }[];
  role: string;
  onNavigate?: (tab: string) => void;
}

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Visão Geral', icon: '◎' },
  { key: 'portfolio', label: 'Carteira', icon: '📋' },
  { key: 'project', label: 'Projetos', icon: '📝' },
  { key: 'supervisions', label: 'Orientações', icon: '🗣' },
  { key: 'tasks', label: 'Atividades', icon: '✅' },
  { key: 'hours', label: 'Horas', icon: '⏱' },
  { key: 'defense', label: 'Banca', icon: '⚖' },
  { key: 'repository', label: 'Acervo', icon: '📂' },
  { key: 'evidence', label: 'Evidências PPC/ODS', icon: '🎯' },
  { key: 'bi', label: 'BI 360', icon: '📊' },
  { key: 'config', label: 'Configurações', icon: '⚙' },
];

export default function Tcc360({ institutionId, courses, role, onNavigate }: Props) {
  const [section, setSection] = useState<Section>('overview');
  const [works, setWorks] = useState<TccWork[]>([]);
  const [workTypes, setWorkTypes] = useState<TccWorkType[]>([]);
  const [summary, setSummary] = useState<TccCourseSummary[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedWork, setSelectedWork] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchWorks(institutionId),
      fetchWorkTypes(institutionId),
      fetchCourseSummary(institutionId),
    ]).then(([w, wt, s]) => {
      setWorks(w); setWorkTypes(wt); setSummary(s);
    }).finally(() => setLoading(false));
  }, [institutionId]);

  const filtered = useMemo(() =>
    courseFilter ? works.filter(w => w.course_id === courseFilter) : works
  , [works, courseFilter]);

  const courseName = (id: string) => courses.find(c => c.id === id)?.name || '—';

  // KPIs globais
  const active = filtered.filter(w => !['cancelled','archived','suspended'].includes(w.stage));
  const overdue = active.filter(w => w.stage_deadline && new Date(w.stage_deadline) < new Date());
  const deposited = filtered.filter(w => w.stage === 'deposited');

  return (
    <div className="alumni-360">
      {/* Nav */}
      <nav className="alumni-nav" role="tablist">
        {NAV.map(n => (
          <button key={n.key} role="tab" aria-selected={section === n.key}
            className={`alumni-nav-btn${section === n.key ? ' alumni-nav-btn-active' : ''}`}
            onClick={() => { setSection(n.key); setSelectedWork(null); }}>
            <span className="alumni-nav-icon">{n.icon}</span> {n.label}
          </button>
        ))}
      </nav>

      {loading ? <p className="alumni-loading">Carregando TCC 360…</p> : (<>

        {/* ── VISÃO GERAL ── */}
        {section === 'overview' && (<div>
          <header className="alumni-header">
            <h2>TCC e Produção Acadêmica 360</h2>
            <p className="alumni-subtitle">Acompanhamento de projetos, orientações, bancas, acervo e evidências de formação</p>
          </header>

          <div className="alumni-kpis">
            <KPI label="Trabalhos Ativos" value={active.length} />
            <KPI label="Depositados" value={deposited.length} color="#059669" />
            <KPI label="Com Prazo Vencido" value={overdue.length} color={overdue.length > 0 ? '#ef4444' : undefined} />
            <KPI label="Cursos com TCC" value={summary.length} />
            <KPI label="Orientadores Ativos" value={summary.reduce((s,c) => s + c.advisors_active, 0)} />
          </div>

          {/* Distribuição por etapa */}
          <div className="alumni-section">
            <h3 className="alumni-section-title">Distribuição por Etapa</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(STAGE_LABELS).map(([k, v]) => {
                const count = filtered.filter(w => w.stage === k).length;
                if (count === 0) return null;
                return <span key={k} className="alumni-tag" style={{ background: STAGE_COLORS[k]+'22', color: STAGE_COLORS[k], border: `1px solid ${STAGE_COLORS[k]}44` }}>
                  {v}: {count}
                </span>;
              })}
            </div>
          </div>

          {/* Resumo por curso */}
          {summary.length > 0 && (
            <div className="alumni-section">
              <h3 className="alumni-section-title">Resumo por Curso</h3>
              <table className="alumni-table">
                <thead><tr>
                  <th>Curso</th><th>Ativos</th><th>Autores</th><th>Depositados</th><th>Atrasados</th><th>Horas Validadas</th>
                </tr></thead>
                <tbody>{summary.map(s => (
                  <tr key={s.course_id}>
                    <td><button className="alumni-link" onClick={() => { setCourseFilter(s.course_id); setSection('portfolio'); }}>{s.course_name}</button></td>
                    <td>{s.works_active}</td>
                    <td>{s.authors_distinct}</td>
                    <td>{s.works_deposited}</td>
                    <td style={{ color: s.works_overdue > 0 ? '#ef4444' : undefined }}>{s.works_overdue}</td>
                    <td>{minutesToHours(s.hours_validated_minutes)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* Alertas */}
          {overdue.length > 0 && (
            <div className="alumni-info-box alumni-info-box-warn">
              <strong>⚠ {overdue.length} trabalho(s) com prazo vencido.</strong> Verifique a carteira para detalhes.
            </div>
          )}

          {/* Conexões com outros módulos */}
          {onNavigate && (
            <div className="alumni-section" style={{ marginTop: '1rem' }}>
              <h3 className="alumni-section-title">Módulos Conectados</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('extensao')}>
                  <strong>🤝 Extensão 360°</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Projetos de extensão podem originar pesquisa/TCC. Horas não duplicam entre módulos.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('egressos')}>
                  <strong>🎓 Egressos 360°</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Trabalhos depositados alimentam o perfil do egresso e indicadores de produção.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('cpa-autoavaliacao')}>
                  <strong>📊 CPA</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Achados da CPA sobre TCC geram ações de melhoria vinculadas.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('governanca')}>
                  <strong>⚖ Governança</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>NDE revisa referenciais PPC e valida evidências dos trabalhos.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('raio-x-direito')}>
                  <strong>⌕ Raio-X do Curso</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Bloco TCC no raio-x com trabalhos ativos, depositados e atrasados por curso.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('repositorio')}>
                  <strong>📂 Repositório Documental</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Versões finais e PPC vinculados ao repositório de evidências regulatórias.</span>
                </button>
              </div>
            </div>
          )}
        </div>)}

        {/* ── CARTEIRA ── */}
        {section === 'portfolio' && (<div>
          <header className="alumni-header">
            <h2>Carteira de Trabalhos</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}
                style={{ padding: '.375rem .75rem', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 6, fontSize: '.8125rem' }}>
                <option value="">Todos os cursos</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => setShowCreateForm(!showCreateForm)} style={{ padding: '.375rem .75rem', background: 'var(--vx-accent,#2563eb)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '.8125rem', cursor: 'pointer' }}>
                + Novo trabalho
              </button>
            </div>
          </header>

          {showCreateForm && (
            <CreateWorkForm institutionId={institutionId} courses={courses} workTypes={workTypes} creating={creating}
              onSubmit={async (data) => {
                setCreating(true);
                try {
                  await createWork(data);
                  const w = await fetchWorks(institutionId);
                  setWorks(w);
                  setShowCreateForm(false);
                } catch (e) { alert('Erro ao criar trabalho: ' + (e as Error).message); }
                finally { setCreating(false); }
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          )}

          {filtered.length === 0 && !showCreateForm ? (
            <div className="alumni-info-box">Nenhum trabalho cadastrado{courseFilter ? ' neste curso' : ''}. Use o botão <strong>+ Novo trabalho</strong> para começar.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {filtered.map(w => (
                <div key={w.id} className="alumni-finding-card" style={{ cursor: 'pointer', border: '1px solid var(--vx-border,#e2e8f0)' }}
                  onClick={() => { setSelectedWork(w.id); setSection('project'); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <strong style={{ fontSize: '.9375rem' }}>{w.title}</strong>
                      <div style={{ fontSize: '.8125rem', color: 'var(--vx-muted,#64748b)', marginTop: 2 }}>
                        {courseName(w.course_id)} · {w.academic_term} · {(w as any).work_type?.label || '—'}
                      </div>
                    </div>
                    <span className="alumni-tag" style={{ background: STAGE_COLORS[w.stage]+'22', color: STAGE_COLORS[w.stage], border: `1px solid ${STAGE_COLORS[w.stage]}44`, whiteSpace: 'nowrap' }}>
                      {STAGE_LABELS[w.stage] || w.stage}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    {w.stage_deadline && new Date(w.stage_deadline) < new Date() && w.stage !== 'deposited' ? (
                      <span style={{ fontSize: '.75rem', color: '#ef4444' }}>⚠ Prazo vencido: {new Date(w.stage_deadline).toLocaleDateString('pt-BR')}</span>
                    ) : <span />}
                    {TCC_NEXT_STAGE[w.stage] && (
                      <button style={{ fontSize: '.6875rem', padding: '2px 10px', borderRadius: 4, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}
                        onClick={async (e) => { e.stopPropagation(); const next = TCC_NEXT_STAGE[w.stage]; await transitionWork(w.id, institutionId, next, 'Avanço pela coordenação', 'Coordenação', 'coordinator', w.version || 0); const refreshed = await fetchWorks(institutionId); setWorks(refreshed); }}>
                        → {STAGE_LABELS[TCC_NEXT_STAGE[w.stage]] || TCC_NEXT_STAGE[w.stage]}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>)}

        {/* ── PROJETO (detalhe) ── */}
        {section === 'project' && (<WorkDetail workId={selectedWork} institutionId={institutionId} courseName={courseName} onBack={() => { setSelectedWork(null); setSection('portfolio'); }} />)}

        {/* ── ORIENTAÇÕES ── */}
        {section === 'supervisions' && (<SupervisionsSection works={filtered} institutionId={institutionId} />)}

        {/* ── ATIVIDADES ── */}
        {section === 'tasks' && (<TasksSection works={filtered} institutionId={institutionId} />)}

        {/* ── HORAS ── */}
        {section === 'hours' && (<HoursSection works={filtered} institutionId={institutionId} />)}

        {/* ── BANCA ── */}
        {section === 'defense' && (<DefenseSection works={filtered} institutionId={institutionId} />)}

        {/* ── ACERVO ── */}
        {section === 'repository' && (<RepositorySection works={filtered} institutionId={institutionId} />)}

        {/* ── EVIDÊNCIAS PPC/ODS ── */}
        {section === 'evidence' && (<EvidenceSection works={filtered} institutionId={institutionId} courses={courses} />)}

        {/* ── BI ── */}
        {section === 'bi' && (<BiSection summary={summary} works={filtered} institutionId={institutionId} />)}

        {/* ── CONFIG ── */}
        {section === 'config' && (<ConfigSection institutionId={institutionId} workTypes={workTypes} />)}

      </>)}
    </div>
  );
}

// ═══════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════

function KPI({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="alumni-kpi" style={{ borderLeftColor: color || 'var(--vx-accent,#2563eb)' }}>
      <span className="alumni-kpi-value">{value}</span>
      <span className="alumni-kpi-label">{label}</span>
    </div>
  );
}

// ── Work Detail ──
function WorkDetail({ workId, institutionId, courseName, onBack }: { workId: string | null; institutionId: string; courseName: (id: string) => string; onBack: () => void }) {
  const [work, setWork] = useState<TccWork | null>(null);
  const [participants, setParticipants] = useState<TccParticipant[]>([]);
  const [versions, setVersions] = useState<TccVersion[]>([]);
  const [transitions, setTransitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetchWorks(institutionId).then(ws => ws.find(w => w.id === workId) || null),
      fetchParticipants(workId),
      fetchVersions(workId),
      fetchTransitions(workId),
    ]).then(([w, p, v, t]) => { setWork(w); setParticipants(p); setVersions(v); setTransitions(t); }).finally(() => setLoading(false));
  }, [workId, institutionId]);

  if (!workId) return <div className="alumni-info-box">Selecione um trabalho na Carteira para ver os detalhes.</div>;
  if (loading) return <p className="alumni-loading">Carregando projeto…</p>;
  if (!work) return <div className="alumni-info-box alumni-info-box-warn">Trabalho não encontrado.</div>;

  const authors = participants.filter(p => p.role === 'author' && !p.valid_until);
  const advisor = participants.find(p => p.role === 'advisor' && !p.valid_until);
  const coadvisors = participants.filter(p => p.role === 'coadvisor' && !p.valid_until);

  return (
    <div>
      <button onClick={onBack} className="alumni-btn-back">← Carteira</button>
      <header className="alumni-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: '4px 0' }}>{work.title}</h2>
            <p className="alumni-subtitle">{courseName(work.course_id)} · {work.academic_term} · {(work as any).work_type?.label || '—'}</p>
          </div>
          <span className="alumni-tag" style={{ background: STAGE_COLORS[work.stage]+'22', color: STAGE_COLORS[work.stage], fontSize: '.875rem', padding: '4px 12px' }}>
            {STAGE_LABELS[work.stage]}
          </span>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {/* Ficha */}
        <div className="alumni-section">
          <h3 className="alumni-section-title">Ficha do Trabalho</h3>
          {work.abstract && <p style={{ fontSize: '.8125rem', color: 'var(--vx-muted,#64748b)' }}><strong>Resumo:</strong> {work.abstract}</p>}
          {work.general_objective && <p style={{ fontSize: '.8125rem' }}><strong>Objetivo geral:</strong> {work.general_objective}</p>}
          {work.research_line && <p style={{ fontSize: '.8125rem' }}><strong>Linha de pesquisa:</strong> {work.research_line}</p>}
          {work.keywords && work.keywords.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {work.keywords.map((kw, i) => <span key={i} className="alumni-tag">{kw}</span>)}
            </div>
          )}
        </div>

        {/* Participantes */}
        <div className="alumni-section">
          <h3 className="alumni-section-title">Participantes</h3>
          {advisor && <div style={{ marginBottom: 8 }}>
            <span className="alumni-tag" style={{ background: '#dbeafe', color: '#1d4ed8' }}>Orientador(a)</span>
            <strong style={{ marginLeft: 6 }}>{advisor.person_name}</strong>
            {advisor.person_email && <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)' }}> · {advisor.person_email}</span>}
          </div>}
          {coadvisors.map(co => (
            <div key={co.id} style={{ marginBottom: 4 }}>
              <span className="alumni-tag" style={{ background: '#e0e7ff', color: '#4338ca' }}>Coorientador(a)</span>
              <span style={{ marginLeft: 6 }}>{co.person_name}</span>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <strong>Autores ({authors.length})</strong>
            {authors.map(a => (
              <div key={a.id} style={{ fontSize: '.8125rem', marginTop: 2 }}>
                {a.person_name} {a.enrollment_id ? `(${a.enrollment_id})` : ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Versões */}
      {versions.length > 0 && (
        <div className="alumni-section" style={{ marginTop: '1rem' }}>
          <h3 className="alumni-section-title">Versões ({versions.length})</h3>
          <table className="alumni-table">
            <thead><tr><th>Nº</th><th>Tipo</th><th>Data</th><th>Modo</th><th>Visibilidade</th></tr></thead>
            <tbody>{versions.map(v => (
              <tr key={v.id}>
                <td>{v.version_number}</td>
                <td>{v.version_type}</td>
                <td>{new Date(v.submitted_at).toLocaleDateString('pt-BR')}</td>
                <td>{v.source_mode === 'pdf' ? '📄 PDF' : v.source_mode === 'external_link' ? '🔗 Link' : '📄+🔗'}</td>
                <td>{v.visibility}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Histórico de transições */}
      {transitions.length > 0 && (
        <div className="alumni-section" style={{ marginTop: '1rem' }}>
          <h3 className="alumni-section-title">Histórico de Etapas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transitions.map((t: any) => (
              <div key={t.id} style={{ fontSize: '.8125rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--vx-muted)', minWidth: 80 }}>{new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                <span>{STAGE_LABELS[t.from_stage] || t.from_stage} → <strong>{STAGE_LABELS[t.to_stage] || t.to_stage}</strong></span>
                {t.reason && <span style={{ color: 'var(--vx-muted)' }}>— {t.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Supervisões ──
function SupervisionsSection({ works, institutionId }: { works: TccWork[]; institutionId: string }) {
  const [supervisions, setSupervisions] = useState<(TccSupervision & { work_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all(works.slice(0, 50).map(w =>
      fetchSupervisions(w.id).then(ss => ss.map(s => ({ ...s, work_title: w.title })))
    )).then(all => setSupervisions(all.flat().sort((a, b) => (b.scheduled_at || '').localeCompare(a.scheduled_at || ''))))
      .finally(() => setLoading(false));
  }, [works]);

  return (
    <div>
      <header className="alumni-header"><h2>Orientações e Reuniões</h2></header>
      {loading ? <p className="alumni-loading">Carregando…</p> : supervisions.length === 0 ? (
        <div className="alumni-info-box">Nenhuma orientação registrada.</div>
      ) : (
        <div style={{ display: 'grid', gap: '.75rem' }}>
          {supervisions.map(s => (
            <div key={s.id} className="alumni-finding-card" style={{ border: '1px solid var(--vx-border,#e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <strong style={{ fontSize: '.875rem' }}>{s.work_title}</strong>
                <span className="alumni-tag">{s.status === 'held' ? '✓ Realizada' : s.status === 'validated' ? '✓✓ Validada' : s.status === 'cancelled' ? '✕ Cancelada' : '◷ Agendada'}</span>
              </div>
              <div style={{ fontSize: '.8125rem', color: 'var(--vx-muted,#64748b)', marginTop: 4 }}>
                {s.scheduled_at && `${new Date(s.scheduled_at).toLocaleDateString('pt-BR')} · `}
                {s.modality} · {s.supervision_type}
                {s.duration_minutes ? ` · ${s.duration_minutes}min` : ''}
              </div>
              {s.decisions && <p style={{ fontSize: '.8125rem', marginTop: 4 }}><strong>Decisões:</strong> {s.decisions}</p>}
              {s.pending_items && <p style={{ fontSize: '.8125rem' }}><strong>Pendências:</strong> {s.pending_items}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tarefas ──
function TasksSection({ works, institutionId }: { works: TccWork[]; institutionId: string }) {
  const [tasks, setTasks] = useState<(TccTask & { work_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all(works.slice(0, 50).map(w =>
      fetchTasks(w.id).then(ts => ts.map(t => ({ ...t, work_title: w.title })))
    )).then(all => setTasks(all.flat().sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))))
      .finally(() => setLoading(false));
  }, [works]);

  const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed' && t.status !== 'cancelled');

  return (
    <div>
      <header className="alumni-header"><h2>Atividades e Cronograma</h2></header>
      {loading ? <p className="alumni-loading">Carregando…</p> : tasks.length === 0 ? (
        <div className="alumni-info-box">Nenhuma atividade registrada.</div>
      ) : (<>
        {overdue.length > 0 && <div className="alumni-info-box alumni-info-box-warn"><strong>⚠ {overdue.length} atividade(s) vencida(s)</strong></div>}
        <table className="alumni-table">
          <thead><tr><th>Trabalho</th><th>Tarefa</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
          <tbody>{tasks.map(t => (
            <tr key={t.id} style={t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed' ? { background: '#fef2f2' } : undefined}>
              <td style={{ fontSize: '.75rem' }}>{t.work_title}</td>
              <td>{t.title}</td>
              <td>{t.responsible}</td>
              <td>{t.deadline ? new Date(t.deadline).toLocaleDateString('pt-BR') : '—'}</td>
              <td><span className="alumni-tag">{t.status === 'completed' ? '✓' : t.status === 'overdue' ? '⚠' : t.status === 'in_progress' ? '◷' : '○'} {t.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </>)}
    </div>
  );
}

// ── Horas ──
function HoursSection({ works, institutionId }: { works: TccWork[]; institutionId: string }) {
  const [hours, setHours] = useState<(TccHourDeclaration & { work_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all(works.slice(0, 50).map(w =>
      fetchHourDeclarations(w.id).then(hs => hs.map(h => ({ ...h, work_title: w.title })))
    )).then(all => setHours(all.flat())).finally(() => setLoading(false));
  }, [works]);

  const validated = hours.filter(h => h.status === 'validated');
  const pending = hours.filter(h => h.status === 'submitted');
  const totalMin = validated.reduce((s, h) => s + h.declared_minutes, 0);

  return (
    <div>
      <header className="alumni-header"><h2>Horas e Livro Razão</h2></header>
      <div className="alumni-kpis">
        <KPI label="Total Validado" value={minutesToHours(totalMin)} color="#059669" />
        <KPI label="Aguardando Validação" value={pending.length} color="#f59e0b" />
        <KPI label="Declarações" value={hours.length} />
      </div>
      {hours.length > 0 && (
        <table className="alumni-table" style={{ marginTop: '1rem' }}>
          <thead><tr><th>Data</th><th>Pessoa</th><th>Tipo</th><th>Minutos</th><th>Status</th><th>Trabalho</th></tr></thead>
          <tbody>{hours.slice(0, 100).map(h => (
            <tr key={h.id}>
              <td>{new Date(h.activity_date).toLocaleDateString('pt-BR')}</td>
              <td>{h.person_name}</td>
              <td>{ACTIVITY_TYPE_LABELS[h.activity_type] || h.activity_type}</td>
              <td>{h.declared_minutes}</td>
              <td><span className="alumni-tag">{h.status}</span></td>
              <td style={{ fontSize: '.75rem' }}>{h.work_title}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

// ── Banca ──
function DefenseSection({ works, institutionId }: { works: TccWork[]; institutionId: string }) {
  const [defenses, setDefenses] = useState<(TccDefense & { work_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all(works.slice(0, 50).map(w =>
      fetchDefenses(w.id).then(ds => ds.map(d => ({ ...d, work_title: w.title })))
    )).then(all => setDefenses(all.flat())).finally(() => setLoading(false));
  }, [works]);

  return (
    <div>
      <header className="alumni-header"><h2>Bancas e Avaliações</h2></header>
      {loading ? <p className="alumni-loading">Carregando…</p> : defenses.length === 0 ? (
        <div className="alumni-info-box">Nenhuma banca registrada.</div>
      ) : (
        <div style={{ display: 'grid', gap: '.75rem' }}>
          {defenses.map(d => (
            <div key={d.id} className="alumni-finding-card" style={{ border: '1px solid var(--vx-border,#e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                <strong>{d.work_title}</strong>
                <span className="alumni-tag">{d.defense_type === 'qualification' ? 'Qualificação' : 'Defesa Final'}</span>
              </div>
              <div style={{ fontSize: '.8125rem', color: 'var(--vx-muted)', marginTop: 4 }}>
                {d.scheduled_at ? new Date(d.scheduled_at).toLocaleDateString('pt-BR') : 'Sem data'} · {d.status}
                {d.result && ` · ${d.result === 'approved' ? '✓ Aprovado' : d.result === 'approved_with_changes' ? '✓ Aprovado com ressalvas' : d.result === 'reproved' ? '✕ Reprovado' : 'Não avaliado'}`}
                {d.final_grade != null && ` · Nota: ${d.final_grade}`}
              </div>
              {d.members && d.members.length > 0 && (
                <div style={{ marginTop: 6, fontSize: '.8125rem' }}>
                  <strong>Banca:</strong> {d.members.map(m => `${m.member_name} (${ROLE_LABELS[m.role] || m.role}${m.is_external ? ', externo' : ''})`).join('; ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Acervo ──
function RepositorySection({ works, institutionId }: { works: TccWork[]; institutionId: string }) {
  const [versions, setVersions] = useState<(TccVersion & { work_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all(works.filter(w => w.stage === 'deposited' || w.stage === 'final_validated').slice(0, 50).map(w =>
      fetchVersions(w.id).then(vs => vs.filter(v => v.version_type === 'final' || v.version_type === 'post_defense').map(v => ({ ...v, work_title: w.title })))
    )).then(all => setVersions(all.flat())).finally(() => setLoading(false));
  }, [works]);

  const byVisibility = { private: 0, institutional: 0, embargoed: 0, public_authorized: 0 };
  versions.forEach(v => { if (v.visibility in byVisibility) byVisibility[v.visibility as keyof typeof byVisibility]++; });

  return (
    <div>
      <header className="alumni-header"><h2>Acervo e Publicações</h2></header>
      <div className="alumni-kpis">
        <KPI label="No Acervo" value={versions.length} />
        <KPI label="PDF" value={versions.filter(v => v.source_mode === 'pdf' || v.source_mode === 'both').length} />
        <KPI label="Link Externo" value={versions.filter(v => v.source_mode === 'external_link' || v.source_mode === 'both').length} />
        <KPI label="Público" value={byVisibility.public_authorized} color="#059669" />
      </div>
      {versions.length > 0 && (
        <table className="alumni-table" style={{ marginTop: '1rem' }}>
          <thead><tr><th>Trabalho</th><th>Tipo</th><th>Modo</th><th>Visibilidade</th><th>DOI</th></tr></thead>
          <tbody>{versions.map(v => (
            <tr key={v.id}>
              <td>{v.work_title}</td>
              <td>{v.version_type}</td>
              <td>{v.source_mode === 'pdf' ? '📄' : v.source_mode === 'external_link' ? '🔗' : '📄+🔗'}</td>
              <td>{v.visibility}</td>
              <td>{v.doi || '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

// ── Evidências PPC/ODS ──
function EvidenceSection({ works, institutionId, courses }: { works: TccWork[]; institutionId: string; courses: { id: string; name: string }[] }) {
  const [refSets, setRefSets] = useState<TccReferenceSet[]>([]);
  const [elements, setElements] = useState<TccReferenceElement[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedRef, setSelectedRef] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCourse) { setRefSets([]); return; }
    setLoading(true);
    fetchReferenceSets(institutionId, selectedCourse).then(setRefSets).finally(() => setLoading(false));
  }, [institutionId, selectedCourse]);

  useEffect(() => {
    if (!selectedRef) { setElements([]); return; }
    fetchReferenceElements(selectedRef).then(setElements);
  }, [selectedRef]);

  const applicable = elements.filter(e => e.applicability === 'applicable');

  return (
    <div>
      <header className="alumni-header">
        <h2>Evidências PPC/ODS</h2>
        <p className="alumni-subtitle">Referenciais versionados, elementos extraídos e cobertura documental</p>
      </header>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <select value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setSelectedRef(''); }}
          style={{ padding: '.375rem .75rem', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 6, fontSize: '.8125rem' }}>
          <option value="">Selecione o curso</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {refSets.length > 0 && (
          <select value={selectedRef} onChange={e => setSelectedRef(e.target.value)}
            style={{ padding: '.375rem .75rem', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 6, fontSize: '.8125rem' }}>
            <option value="">Selecione o referencial</option>
            {refSets.map(r => <option key={r.id} value={r.id}>{r.title} ({r.version_label}) — {r.reference_type}</option>)}
          </select>
        )}
      </div>

      {loading ? <p className="alumni-loading">Carregando…</p> : selectedRef && elements.length > 0 ? (<>
        <div className="alumni-kpis">
          <KPI label="Elementos" value={elements.length} />
          <KPI label="Aplicáveis" value={applicable.length} color="#2563eb" />
          <KPI label="Pendentes de Revisão" value={elements.filter(e => e.applicability === 'pending_review').length} color="#f59e0b" />
        </div>
        <table className="alumni-table" style={{ marginTop: '1rem' }}>
          <thead><tr><th>Tipo</th><th>Código</th><th>Texto</th><th>Aplicabilidade</th></tr></thead>
          <tbody>{elements.map(e => (
            <tr key={e.id}>
              <td style={{ fontSize: '.75rem' }}>{e.kind.replace(/_/g, ' ')}</td>
              <td>{e.code || '—'}</td>
              <td style={{ fontSize: '.8125rem', maxWidth: 400 }}>{e.text.length > 120 ? e.text.slice(0, 120) + '…' : e.text}</td>
              <td><span className="alumni-tag" style={{
                background: e.applicability === 'applicable' ? '#dcfce7' : e.applicability === 'not_applicable' ? '#fee2e2' : '#fef3c7',
                color: e.applicability === 'applicable' ? '#166534' : e.applicability === 'not_applicable' ? '#991b1b' : '#92400e',
              }}>{e.applicability === 'applicable' ? '✓ Aplicável' : e.applicability === 'not_applicable' ? '✕ N/A' : '◷ Pendente'}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </>) : selectedCourse && refSets.length === 0 ? (
        <div className="alumni-info-box">Nenhum referencial cadastrado para este curso. Cadastre o PPC para começar a rastrear evidências.</div>
      ) : !selectedCourse ? (
        <div className="alumni-info-box">Selecione um curso para visualizar os referenciais e evidências.</div>
      ) : null}
    </div>
  );
}

// ── BI ──
function BiSection({ summary, works, institutionId }: { summary: TccCourseSummary[]; works: TccWork[]; institutionId: string }) {
  const totals = {
    works: summary.reduce((s, c) => s + c.works_active, 0),
    authors: summary.reduce((s, c) => s + c.authors_distinct, 0),
    deposited: summary.reduce((s, c) => s + c.works_deposited, 0),
    overdue: summary.reduce((s, c) => s + c.works_overdue, 0),
    hours: summary.reduce((s, c) => s + c.hours_validated_minutes, 0),
    advisors: summary.reduce((s, c) => s + c.advisors_active, 0),
    validatedEvidence: summary.reduce((s, c) => s + c.alignments_validated, 0),
  };

  return (
    <div>
      <header className="alumni-header"><h2>BI — Produção Acadêmica</h2></header>
      <div className="alumni-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <KPI label="Trabalhos Ativos" value={totals.works} />
        <KPI label="Autores Distintos" value={totals.authors} />
        <KPI label="Depositados" value={totals.deposited} color="#059669" />
        <KPI label="Atrasados" value={totals.overdue} color={totals.overdue > 0 ? '#ef4444' : undefined} />
        <KPI label="Horas Validadas" value={minutesToHours(totals.hours)} color="#7c3aed" />
        <KPI label="Orientadores" value={totals.advisors} />
        <KPI label="Evidências Validadas" value={totals.validatedEvidence} color="#2563eb" />
      </div>

      {/* Gráfico de distribuição por etapa */}
      {works.length > 0 && (() => {
        const stages = Object.entries(STAGE_LABELS).filter(([k]) => !['suspended','cancelled','archived'].includes(k));
        const counts = stages.map(([k, l]) => ({ key: k, label: l, count: works.filter(w => w.stage === k).length })).filter(s => s.count > 0);
        const max = Math.max(...counts.map(c => c.count), 1);
        return (
          <div className="alumni-section" style={{ marginTop: '1rem' }}>
            <h3 className="alumni-section-title">Distribuição por Etapa</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {counts.map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '.75rem', width: 140, textAlign: 'right', flexShrink: 0, color: 'var(--vx-muted)' }}>{s.label}</span>
                  <div style={{ flex: 1, height: 20, background: 'var(--vx-border,#e2e8f0)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(s.count / max) * 100}%`, height: '100%', background: STAGE_COLORS[s.key] || '#94a3b8', borderRadius: 4, transition: 'width .3s' }} />
                  </div>
                  <span style={{ fontSize: '.75rem', fontWeight: 600, width: 24, textAlign: 'center' }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {summary.length > 0 && (
        <div className="alumni-section" style={{ marginTop: '1rem' }}>
          <h3 className="alumni-section-title">Detalhamento por Curso</h3>
          <table className="alumni-table">
            <thead><tr><th>Curso</th><th>Ativos</th><th>Autores</th><th>Revisão</th><th>Execução</th><th>Final</th><th>Depositados</th><th>Atrasados</th></tr></thead>
            <tbody>{summary.map(s => (
              <tr key={s.course_id}>
                <td>{s.course_name}</td>
                <td>{s.works_active}</td>
                <td>{s.authors_distinct}</td>
                <td>{s.works_in_review}</td>
                <td>{s.works_in_execution}</td>
                <td>{s.works_final_phase}</td>
                <td>{s.works_deposited}</td>
                <td style={{ color: s.works_overdue > 0 ? '#ef4444' : undefined }}>{s.works_overdue}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Config ──
function ConfigSection({ institutionId, workTypes }: { institutionId: string; workTypes: TccWorkType[] }) {
  const [types, setTypes] = useState(workTypes);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [defense, setDefense] = useState(false);
  const [qual, setQual] = useState(false);
  const [saving, setSaving] = useState(false);

  async function addType(e: React.FormEvent) {
    e.preventDefault();
    if (!label) return;
    setSaving(true);
    const { data, error } = await supabase.from('vertice_tcc_work_types').insert({
      institution_id: institutionId, label, description: desc || null,
      requires_defense: defense, requires_qualification: qual,
    }).select().single();
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setTypes(prev => [...prev, data as TccWorkType]);
    setShowAdd(false); setLabel(''); setDesc('');
  }

  return (
    <div>
      <header className="alumni-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Configurações do Módulo</h2>
        <button className="alumni-btn-export" onClick={() => setShowAdd(v => !v)}>+ Novo tipo de trabalho</button>
      </header>
      {showAdd && (
        <form onSubmit={addType} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto auto auto', gap: 8, alignItems: 'end', marginBottom: 12, padding: 12, background: 'var(--vx-surface,#fff)', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 8 }}>
          <label style={{ fontSize: '.6875rem' }}>Nome *<input value={label} onChange={e => setLabel(e.target.value)} style={cfgSel} required placeholder="Monografia" /></label>
          <label style={{ fontSize: '.6875rem' }}>Descrição<input value={desc} onChange={e => setDesc(e.target.value)} style={cfgSel} placeholder="Trabalho final de curso" /></label>
          <label style={{ fontSize: '.6875rem', display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={defense} onChange={e => setDefense(e.target.checked)} /> Defesa</label>
          <label style={{ fontSize: '.6875rem', display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={qual} onChange={e => setQual(e.target.checked)} /> Qualif.</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="submit" disabled={saving || !label} className="alumni-btn-export" style={{ fontSize: '.6875rem', padding: '4px 10px' }}>{saving ? '…' : '✓'}</button>
            <button type="button" onClick={() => setShowAdd(false)} style={{ fontSize: '.6875rem', padding: '4px 8px', border: '1px solid var(--vx-border)', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}>✕</button>
          </div>
        </form>
      )}
      <div className="alumni-section">
        <h3 className="alumni-section-title">Tipos de Trabalho Habilitados ({types.length})</h3>
        <table className="alumni-table">
          <thead><tr><th>Tipo</th><th>Descrição</th><th>Defesa</th><th>Qualificação</th></tr></thead>
          <tbody>{types.map(wt => (
            <tr key={wt.id}>
              <td><strong>{wt.label}</strong></td>
              <td style={{ fontSize: '.8125rem' }}>{wt.description}</td>
              <td>{wt.requires_defense ? '✓' : '—'}</td>
              <td>{wt.requires_qualification ? '✓' : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="alumni-info-box" style={{ marginTop: '1rem' }}>
        Configurações avançadas (limites de arquivo, fluxo de aprovação de horas, análise IA) podem ser ajustadas por curso na tabela <code>vertice_tcc_config</code>.
      </div>
    </div>
  );
}
const cfgSel: React.CSSProperties = { display: 'block', width: '100%', padding: '6px 10px', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 6, fontSize: '.8125rem', marginTop: 4 };

// ── Formulário de criação de trabalho ──
function CreateWorkForm({ institutionId, courses, workTypes, creating, onSubmit, onCancel }: {
  institutionId: string; courses: { id: string; name: string }[]; workTypes: TccWorkType[];
  creating: boolean; onSubmit: (data: any) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ course_id: '', work_type_id: '', title: '', academic_term: '2026.2', research_line: '', general_objective: '', keywords: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.course_id && form.work_type_id && form.title.trim();
  return (
    <div className="alumni-section" style={{ border: '2px solid var(--vx-accent,#2563eb)', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
      <h3 className="alumni-section-title">Novo Trabalho</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>Curso *
          <select value={form.course_id} onChange={e => set('course_id', e.target.value)} style={{ display: 'block', width: '100%', padding: '.375rem', border: '1px solid var(--vx-border)', borderRadius: 6, fontSize: '.8125rem', marginTop: 2 }}>
            <option value="">Selecione</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>Tipo *
          <select value={form.work_type_id} onChange={e => set('work_type_id', e.target.value)} style={{ display: 'block', width: '100%', padding: '.375rem', border: '1px solid var(--vx-border)', borderRadius: 6, fontSize: '.8125rem', marginTop: 2 }}>
            <option value="">Selecione</option>{workTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>Semestre
          <input value={form.academic_term} onChange={e => set('academic_term', e.target.value)} style={{ display: 'block', width: '100%', padding: '.375rem', border: '1px solid var(--vx-border)', borderRadius: 6, fontSize: '.8125rem', marginTop: 2 }} />
        </label>
      </div>
      <label style={{ fontSize: '.8125rem', fontWeight: 600, display: 'block', marginTop: 10 }}>Título *
        <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Título do trabalho" style={{ display: 'block', width: '100%', padding: '.375rem', border: '1px solid var(--vx-border)', borderRadius: 6, fontSize: '.8125rem', marginTop: 2 }} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>Linha de pesquisa
          <input value={form.research_line} onChange={e => set('research_line', e.target.value)} style={{ display: 'block', width: '100%', padding: '.375rem', border: '1px solid var(--vx-border)', borderRadius: 6, fontSize: '.8125rem', marginTop: 2 }} />
        </label>
        <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>Palavras-chave (separadas por vírgula)
          <input value={form.keywords} onChange={e => set('keywords', e.target.value)} style={{ display: 'block', width: '100%', padding: '.375rem', border: '1px solid var(--vx-border)', borderRadius: 6, fontSize: '.8125rem', marginTop: 2 }} />
        </label>
      </div>
      <label style={{ fontSize: '.8125rem', fontWeight: 600, display: 'block', marginTop: 10 }}>Objetivo geral
        <textarea value={form.general_objective} onChange={e => set('general_objective', e.target.value)} rows={2} style={{ display: 'block', width: '100%', padding: '.375rem', border: '1px solid var(--vx-border)', borderRadius: 6, fontSize: '.8125rem', marginTop: 2, resize: 'vertical' }} />
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button disabled={!valid || creating} onClick={() => onSubmit({ institution_id: institutionId, course_id: form.course_id, work_type_id: form.work_type_id, title: form.title.trim(), academic_term: form.academic_term, research_line: form.research_line || undefined, general_objective: form.general_objective || undefined, keywords: form.keywords ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined })}
          style={{ padding: '.5rem 1.25rem', background: valid && !creating ? 'var(--vx-accent,#2563eb)' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.8125rem', cursor: valid && !creating ? 'pointer' : 'not-allowed' }}>
          {creating ? 'Criando…' : 'Criar trabalho'}
        </button>
        <button onClick={onCancel} style={{ padding: '.5rem 1.25rem', background: 'transparent', border: '1px solid var(--vx-border)', borderRadius: 8, fontSize: '.8125rem', cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
}
