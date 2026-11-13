// AtividadesComplementares360.tsx — AC 360
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAcRules, fetchAcCategories, fetchAcSubmissions, fetchAcStudentBalance, fetchAcCourseSummary, fetchStudentRegistry, fetchProtocols, approveAcSubmission, AC_STATUS_LABELS, PROTOCOL_STATUS_LABELS, minutesToHours, type AcRule, type AcCategory, type AcSubmission, type AcStudentBalance, type AcCourseSummary, type StudentRegistryEntry } from '@/lib/atividades-complementares';
import './egressos360.css';

type Section = 'overview'|'rules'|'students'|'submissions'|'balance'|'protocols'|'bi'|'config';
interface Props { institutionId: string; courses: { id: string; name: string }[]; role: string; onNavigate?: (tab: string) => void; }

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Visão Geral', icon: '◎' },
  { key: 'rules', label: 'Regulamentos', icon: '📜' },
  { key: 'students', label: 'Base de Alunos', icon: '👤' },
  { key: 'submissions', label: 'Solicitações', icon: '📋' },
  { key: 'balance', label: 'Extrato / Saldo', icon: '⏱' },
  { key: 'protocols', label: 'Secretaria', icon: '📨' },
  { key: 'bi', label: 'BI 360', icon: '📊' },
  { key: 'config', label: 'Configurações', icon: '⚙' },
];

export default function AtividadesComplementares360({ institutionId, courses, role, onNavigate }: Props) {
  const [section, setSection] = useState<Section>('overview');
  const [rules, setRules] = useState<AcRule[]>([]);
  const [summary, setSummary] = useState<AcCourseSummary[]>([]);
  const [submissions, setSubmissions] = useState<AcSubmission[]>([]);
  const [balances, setBalances] = useState<AcStudentBalance[]>([]);
  const [students, setStudents] = useState<StudentRegistryEntry[]>([]);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState('');
  const [showAcForm, setShowAcForm] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAcRules(institutionId),
      fetchAcCourseSummary(institutionId),
      fetchAcSubmissions(institutionId),
      fetchAcStudentBalance(institutionId),
      fetchStudentRegistry(institutionId),
      fetchProtocols(institutionId, 'complementary_activities'),
    ]).then(([r, s, sub, b, st, p]) => {
      setRules(r); setSummary(s); setSubmissions(sub); setBalances(b); setStudents(st); setProtocols(p);
    }).finally(() => setLoading(false));
  }, [institutionId]);

  const courseName = (id: string) => courses.find(c => c.id === id)?.name || '—';
  const pending = submissions.filter(s => ['submitted','extracting','suggestion_ready','under_review'].includes(s.status));
  const approved = submissions.filter(s => ['approved','partially_approved','credited'].includes(s.status));
  const totalCredited = balances.reduce((s, b) => s + b.credited_minutes, 0);

  return (
    <div className="alumni-360">
      <nav className="alumni-nav" role="tablist">
        {NAV.map(n => (
          <button key={n.key} role="tab" aria-selected={section === n.key}
            className={`alumni-nav-btn${section === n.key ? ' alumni-nav-btn-active' : ''}`}
            onClick={() => setSection(n.key)}>
            <span className="alumni-nav-icon">{n.icon}</span> {n.label}
          </button>
        ))}
      </nav>

      {loading ? <p className="alumni-loading">Carregando AC 360…</p> : (<>

        {section === 'overview' && (<div>
          <header className="alumni-header">
            <h2>Atividades Complementares 360</h2>
            <p className="alumni-subtitle">Recebimento, análise, validação e contabilização de atividades complementares</p>
          </header>
          <div className="alumni-kpis">
            <KPI label="Solicitações" value={submissions.length} />
            <KPI label="Pendentes" value={pending.length} color={pending.length > 0 ? '#f59e0b' : undefined} />
            <KPI label="Aprovadas" value={approved.length} color="#059669" />
            <KPI label="Horas Creditadas" value={minutesToHours(totalCredited)} color="#2563eb" />
            <KPI label="Alunos na Base" value={students.length} />
            <KPI label="Cursos com Regulamento" value={rules.length} />
          </div>
          {summary.length > 0 && (
            <div className="alumni-section">
              <h3 className="alumni-section-title">Resumo por Curso</h3>
              <table className="alumni-table">
                <thead><tr><th>Curso</th><th>Alunos</th><th>Com Envio</th><th>Pendentes</th><th>Aprovados</th><th>Horas Creditadas</th></tr></thead>
                <tbody>{summary.map(s => (
                  <tr key={s.course_id}>
                    <td>{s.course_name}</td><td>{s.students_with_rule}</td><td>{s.students_with_submissions}</td>
                    <td style={{ color: s.submissions_pending > 0 ? '#f59e0b' : undefined }}>{s.submissions_pending}</td>
                    <td>{s.submissions_approved}</td><td>{minutesToHours(s.total_credited_minutes)}</td>
                  </tr>
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
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Atividades de extensão podem ser reconhecidas como AC quando o regulamento permitir.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('tcc')}>
                  <strong>📝 TCC e Pesquisa</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Participação em pesquisa/monitoria pode gerar AC. Horas não duplicam entre módulos.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('estagio')}>
                  <strong>🏢 Estágio</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Estágio não obrigatório pode ser apresentado como AC conforme regulamento.</span>
                </button>
                <button className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border,#e2e8f0)' }} onClick={() => onNavigate('raio-x-direito')}>
                  <strong>⌕ Raio-X do Curso</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--vx-muted)', display: 'block' }}>Bloco AC no raio-x com solicitações pendentes e horas creditadas por curso.</span>
                </button>
              </div>
            </div>
          )}
        </div>)}

        {section === 'rules' && (<div>
          <header className="alumni-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Regulamentos por Curso</h2>
            <button className="alumni-btn-export" onClick={() => setShowRuleForm(v => !v)}>+ Novo Regulamento</button>
          </header>
          {showRuleForm && <CreateAcRuleForm institutionId={institutionId} courses={courses} onCreated={(r) => { setRules(prev => [r, ...prev]); setShowRuleForm(false); }} onCancel={() => setShowRuleForm(false)} />}
          {rules.length === 0 && !showRuleForm ? <div className="alumni-info-box">Nenhum regulamento cadastrado. Configure as regras de AC por curso e matriz.</div> : (
            <div style={{ display: 'grid', gap: '.75rem' }}>
              {rules.map(r => (
                <RuleCard key={r.id} rule={r} courseName={courseName(r.course_id)} />
              ))}
            </div>
          )}
        </div>)}

        {section === 'students' && (<div>
          <header className="alumni-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div><h2>Base de Alunos</h2><p className="alumni-subtitle">Estudantes com vínculo verificado para acesso sem senha</p></div>
            <CsvImportButton institutionId={institutionId} courses={courses} onImported={(count) => { fetchStudentRegistry(institutionId).then(setStudents); alert(`${count} aluno(s) importado(s).`); }} />
          </header>
          <div className="alumni-kpis">
            <KPI label="Total" value={students.length} />
            <KPI label="Verificados" value={students.filter(s => s.verified).length} color="#059669" />
            <KPI label="Pendentes" value={students.filter(s => !s.verified).length} color="#f59e0b" />
          </div>
          {students.length > 0 && (
            <table className="alumni-table" style={{ marginTop: '1rem' }}>
              <thead><tr><th>Nome</th><th>Matrícula</th><th>Curso</th><th>Status</th><th>Verificado</th></tr></thead>
              <tbody>{students.slice(0, 100).map(s => (
                <tr key={s.id}>
                  <td>{s.full_name}</td><td>{s.enrollment_code}</td><td>{courseName(s.course_id)}</td>
                  <td><span className="alumni-tag">{s.academic_status}</span></td>
                  <td>{s.verified ? '✓' : '◷'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>)}

        {section === 'submissions' && (<div>
          <header className="alumni-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Solicitações</h2>
            <button className="alumni-btn-export" onClick={() => setShowAcForm(v => !v)}>+ Nova Submissão</button>
          </header>
          {showAcForm && <CreateAcSubmissionForm institutionId={institutionId} courses={courses} rules={rules} students={students} onCreated={(s) => { setSubmissions(prev => [s, ...prev]); setShowAcForm(false); }} onCancel={() => setShowAcForm(false)} />}
          {submissions.length === 0 && !showAcForm ? <div className="alumni-info-box">Nenhuma solicitação recebida.</div> : (
            <table className="alumni-table">
              <thead><tr><th>Título</th><th>Emissor</th><th>Carga Doc.</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
              <tbody>{submissions.slice(0, 100).map(s => (
                <tr key={s.id}>
                  <td>{s.title}</td><td>{s.issuer || '—'}</td>
                  <td>{s.documentary_minutes ? minutesToHours(s.documentary_minutes) : '—'}</td>
                  <td><span className="alumni-tag">{AC_STATUS_LABELS[s.status] || s.status}</span></td>
                  <td>{new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>{['submitted','under_review','suggestion_ready'].includes(s.status) && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {s.status === 'submitted' && (
                        <button style={{ fontSize: '.6875rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer' }}
                          onClick={async () => { setSubmissions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'extracting' } : x)); try { await supabase.functions.invoke('vertice-ac-extract', { body: { submission_id: s.id, institution_id: institutionId } }); setSubmissions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'suggestion_ready' } : x)); } catch { setSubmissions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'submitted' } : x)); alert('Erro na extração IA.'); } }}>🤖 Extrair IA</button>
                      )}
                      <button style={{ fontSize: '.6875rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #059669', background: '#f0fdf4', color: '#059669', cursor: 'pointer' }}
                        onClick={async () => { try { const r = await approveAcSubmission(s, 'Coordenação'); setSubmissions(prev => prev.map(x => x.id === s.id ? { ...x, status: r.awarded > 0 ? 'credited' : 'approved' } : x)); alert(`Deferido: ${minutesToHours(r.awarded)} creditadas${r.capped ? ` (teto: ${r.limits.join(', ')})` : ''}`); } catch (e) { alert('Erro: ' + (e as Error).message); } }}>✓ Deferir</button>
                      <button style={{ fontSize: '.6875rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #ef4444', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}
                        onClick={async () => { await supabase.from('vertice_ac_submissions').update({ status: 'rejected' }).eq('id', s.id); setSubmissions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'rejected' } : x)); }}>✕ Indeferir</button>
                    </div>
                  )}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>)}

        {section === 'balance' && (<div>
          <header className="alumni-header"><h2>Extrato e Saldo por Aluno</h2></header>
          {balances.length === 0 ? <div className="alumni-info-box">Nenhum saldo registrado.</div> : (
            <table className="alumni-table">
              <thead><tr><th>Aluno</th><th>Matrícula</th><th>Exigido</th><th>Creditado</th><th>Restante</th><th>Solicitações</th></tr></thead>
              <tbody>{balances.slice(0, 100).map(b => (
                <tr key={b.student_id} style={b.remaining_minutes <= 0 ? { background: '#f0fdf4' } : undefined}>
                  <td>{b.full_name}</td><td>{b.enrollment_code}</td>
                  <td>{minutesToHours(b.total_required_minutes)}</td>
                  <td>{minutesToHours(b.credited_minutes)}</td>
                  <td style={{ color: b.remaining_minutes <= 0 ? '#059669' : '#f59e0b', fontWeight: 600 }}>{b.remaining_minutes <= 0 ? '✓ Cumprido' : minutesToHours(b.remaining_minutes)}</td>
                  <td>{b.submissions_total} ({b.submissions_pending} pendentes)</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>)}

        {section === 'protocols' && (<div>
          <header className="alumni-header"><h2>Protocolos — Secretaria</h2></header>
          {protocols.length === 0 ? <div className="alumni-info-box">Nenhum protocolo gerado.</div> : (
            <table className="alumni-table">
              <thead><tr><th>Relatório</th><th>Estado</th><th>Assinado</th><th>Enviado</th><th>Lançado</th></tr></thead>
              <tbody>{protocols.map((p: any) => (
                <tr key={p.id}>
                  <td>v{p.report_version} · {new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                  <td><span className="alumni-tag">{PROTOCOL_STATUS_LABELS[p.state] || p.state}</span></td>
                  <td>{p.signed_at ? new Date(p.signed_at).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{p.sent_at ? new Date(p.sent_at).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{p.confirmed_posted_at ? '✓ ' + new Date(p.confirmed_posted_at).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>)}

        {section === 'bi' && (<div>
          <header className="alumni-header"><h2>BI — Atividades Complementares</h2></header>
          <div className="alumni-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <KPI label="Total Solicitações" value={submissions.length} />
            <KPI label="Pendentes" value={pending.length} color="#f59e0b" />
            <KPI label="Aprovadas" value={approved.length} color="#059669" />
            <KPI label="Horas Creditadas" value={minutesToHours(totalCredited)} color="#2563eb" />
            <KPI label="Alunos Aptos" value={balances.filter(b => b.remaining_minutes <= 0).length} color="#059669" />
            <KPI label="Protocolos Pendentes" value={protocols.filter((p: any) => !p.confirmed_posted_at).length} color="#f59e0b" />
          </div>

          {/* Distribuição por status */}
          {submissions.length > 0 && (() => {
            const statusCounts = Object.entries(AC_STATUS_LABELS).map(([k, l]) => ({ key: k, label: l, count: submissions.filter(s => s.status === k).length })).filter(s => s.count > 0);
            const max = Math.max(...statusCounts.map(c => c.count), 1);
            const colors: Record<string,string> = { submitted: '#3b82f6', extracting: '#8b5cf6', suggestion_ready: '#6366f1', under_review: '#f59e0b', approved: '#10b981', partially_approved: '#0891b2', denied: '#ef4444', credited: '#059669', report_sent: '#14b8a6', posting_confirmed: '#22c55e' };
            return (
              <div className="alumni-section" style={{ marginTop: '1rem' }}>
                <h3 className="alumni-section-title">Distribuição por Status</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {statusCounts.map(s => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '.75rem', width: 140, textAlign: 'right', flexShrink: 0, color: 'var(--vx-muted)' }}>{s.label}</span>
                      <div style={{ flex: 1, height: 20, background: 'var(--vx-border,#e2e8f0)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(s.count / max) * 100}%`, height: '100%', background: colors[s.key] || '#94a3b8', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: '.75rem', fontWeight: 600, width: 24, textAlign: 'center' }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Resumo por curso */}
          {summary.length > 0 && (
            <div className="alumni-section" style={{ marginTop: '1rem' }}>
              <h3 className="alumni-section-title">Resumo por Curso</h3>
              <table className="alumni-table">
                <thead><tr><th>Curso</th><th>Alunos</th><th>Submissões</th><th>Pendentes</th><th>Aprovadas</th><th>Horas Creditadas</th></tr></thead>
                <tbody>{summary.map(s => (
                  <tr key={s.course_id}>
                    <td>{s.course_name}</td><td>{s.students_with_rule}</td><td>{s.submissions_total}</td>
                    <td style={{ color: s.submissions_pending > 0 ? '#f59e0b' : undefined }}>{s.submissions_pending}</td>
                    <td>{s.submissions_approved}</td><td style={{ color: '#059669', fontWeight: 600 }}>{minutesToHours(s.total_credited_minutes)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* Alunos com carga cumprida */}
          {balances.filter(b => b.remaining_minutes <= 0).length > 0 && (
            <div className="alumni-section" style={{ marginTop: '1rem' }}>
              <h3 className="alumni-section-title">Alunos com Carga Cumprida ✓</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {balances.filter(b => b.remaining_minutes <= 0).map(b => (
                  <span key={b.student_id} className="alumni-tag" style={{ background: '#f0fdf4', color: '#059669' }}>{b.full_name} — {minutesToHours(b.credited_minutes)}</span>
                ))}
              </div>
            </div>
          )}
        </div>)}

        {section === 'config' && (<div>
          <header className="alumni-header"><h2>Configurações</h2></header>
          <div className="alumni-section" style={{ marginBottom: '1rem' }}>
            <h3 className="alumni-section-title">URL de Acesso do Estudante</h3>
            <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: '.875rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {window.location.origin}/acesso-estudante?ies={institutionId}&mod=ac
            </div>
            <p style={{ fontSize: '.75rem', color: 'var(--vx-muted)', marginTop: 6 }}>Compartilhe este link com os alunos para acesso sem senha via magic link. O aluno informa matrícula, CPF e e-mail institucional.</p>
          </div>
          <div className="alumni-section" style={{ marginBottom: '1rem' }}>
            <h3 className="alumni-section-title">Checklist de Ativação</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <ConfigCheck label="Regulamento cadastrado por curso" ok={rules.length > 0} action={() => setSection('rules')} />
              <ConfigCheck label="Categorias definidas com limites e conversão" ok={rules.length > 0} action={() => setSection('rules')} />
              <ConfigCheck label="Base de alunos importada" ok={students.length > 0} action={() => setSection('students')} />
              <ConfigCheck label="Módulo ativado para a IES" ok={true} />
            </div>
          </div>
          <div className="alumni-info-box">
            <strong>Motor de cálculo:</strong> conversão → teto por item → saldo categoria → teto global. Arredondamento: floor. Estorno por lançamento negativo referenciado. Livro razão imutável com lock transacional.
          </div>
        </div>)}
      </>)}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: number|string; color?: string }) {
  return <div className="alumni-kpi" style={{ borderLeftColor: color || 'var(--vx-accent,#2563eb)' }}><span className="alumni-kpi-value">{value}</span><span className="alumni-kpi-label">{label}</span></div>;
}

// ── Motor de cálculo determinístico (conforme Anexo 2 do prompt) ──
export function calculateComplementaryAward(input: {
  documentaryMinutes: number | null;
  conversionNumerator: number;
  conversionDenominator: number;
  maxPerItemMinutes: number | null;
  categoryRemainingMinutes: number;
  totalRemainingMinutes: number;
}): { state: 'manual_review'; reason: string } | { state: 'calculated'; convertedMinutes: number; awardedMinutes: number; capped: boolean; appliedLimits: string[] } {
  const nonNegativeInt = (n: number) => Number.isSafeInteger(n) && n >= 0;
  if (input.documentaryMinutes === null) return { state: 'manual_review', reason: 'Carga documental não comprovada.' };
  const values = [input.documentaryMinutes, input.categoryRemainingMinutes, input.totalRemainingMinutes];
  if (!values.every(nonNegativeInt) || input.conversionNumerator <= 0 || input.conversionDenominator <= 0 ||
      (input.maxPerItemMinutes !== null && !nonNegativeInt(input.maxPerItemMinutes)))
    throw new Error('Entrada de cálculo inválida.');
  const product = input.documentaryMinutes * input.conversionNumerator;
  if (!Number.isSafeInteger(product)) throw new Error('Conversão excede limite numérico.');
  const convertedMinutes = Math.floor(product / input.conversionDenominator);
  const limits: [string, number][] = [
    ['item', input.maxPerItemMinutes ?? convertedMinutes],
    ['category', input.categoryRemainingMinutes],
    ['total', input.totalRemainingMinutes],
  ];
  const awardedMinutes = Math.min(convertedMinutes, ...limits.map(([, n]) => n));
  return { state: 'calculated', convertedMinutes, awardedMinutes, capped: awardedMinutes < convertedMinutes,
    appliedLimits: limits.filter(([, n]) => n < convertedMinutes).map(([name]) => name) };
}

function RuleCard({ rule, courseName }: { rule: AcRule; courseName: string }) {
  const [categories, setCategories] = useState<AcCategory[]>([]);
  const [open, setOpen] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [catLabel, setCatLabel] = useState('');
  const [catMaxItem, setCatMaxItem] = useState('');
  const [catMaxCat, setCatMaxCat] = useState('');
  const [catConvNum, setCatConvNum] = useState('1');
  const [catConvDen, setCatConvDen] = useState('1');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) fetchAcCategories(rule.id).then(setCategories); }, [open, rule.id]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catLabel) return;
    setSaving(true);
    const { data, error } = await supabase.from('vertice_ac_categories').insert({
      rule_id: rule.id, institution_id: rule.institution_id,
      label: catLabel, sort_order: categories.length + 1,
      max_per_item_minutes: catMaxItem ? parseInt(catMaxItem) * 60 : null,
      max_category_minutes: catMaxCat ? parseInt(catMaxCat) * 60 : null,
      conversion_numerator: parseInt(catConvNum) || 1,
      conversion_denominator: parseInt(catConvDen) || 1,
    }).select().single();
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setCategories(prev => [...prev, data as AcCategory]);
    setShowCatForm(false); setCatLabel(''); setCatMaxItem(''); setCatMaxCat(''); setCatConvNum('1'); setCatConvDen('1');
  }

  return (
    <div className="alumni-finding-card" style={{ border: '1px solid var(--vx-border,#e2e8f0)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div><strong>{courseName}</strong><span style={{ fontSize: '.8125rem', color: 'var(--vx-muted)', marginLeft: 8 }}>Matriz {rule.curriculum_version} · {rule.rule_version}</span></div>
        <div><span className="alumni-tag" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{minutesToHours(rule.total_required_minutes)} exigidas</span> {open ? '▾' : '▸'}</div>
      </div>
      {open && (<>
        {categories.length > 0 && (
          <table className="alumni-table" style={{ marginTop: 8 }}>
            <thead><tr><th>Categoria</th><th>Máx/Item</th><th>Máx/Cat.</th><th>Conversão</th></tr></thead>
            <tbody>{categories.map(c => (
              <tr key={c.id}><td>{c.label}</td><td>{c.max_per_item_minutes ? minutesToHours(c.max_per_item_minutes) : '—'}</td><td>{c.max_category_minutes ? minutesToHours(c.max_category_minutes) : '—'}</td><td>{c.conversion_numerator}:{c.conversion_denominator}</td></tr>
            ))}</tbody>
          </table>
        )}
        {!showCatForm ? (
          <button style={{ fontSize: '.75rem', marginTop: 8, padding: '4px 12px', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }} onClick={() => setShowCatForm(true)}>+ Adicionar categoria</button>
        ) : (
          <form onSubmit={addCategory} style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
            <label style={{ fontSize: '.6875rem' }}>Nome<input value={catLabel} onChange={e => setCatLabel(e.target.value)} style={sel} required placeholder="Eventos acadêmicos" /></label>
            <label style={{ fontSize: '.6875rem' }}>Máx/Item (h)<input type="number" value={catMaxItem} onChange={e => setCatMaxItem(e.target.value)} style={sel} min="0" /></label>
            <label style={{ fontSize: '.6875rem' }}>Máx/Cat. (h)<input type="number" value={catMaxCat} onChange={e => setCatMaxCat(e.target.value)} style={sel} min="0" /></label>
            <label style={{ fontSize: '.6875rem' }}>Conv. Num<input type="number" value={catConvNum} onChange={e => setCatConvNum(e.target.value)} style={sel} min="1" /></label>
            <label style={{ fontSize: '.6875rem' }}>Conv. Den<input type="number" value={catConvDen} onChange={e => setCatConvDen(e.target.value)} style={sel} min="1" /></label>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="submit" disabled={saving || !catLabel} className="alumni-btn-export" style={{ fontSize: '.6875rem', padding: '4px 10px' }}>{saving ? '…' : '✓'}</button>
              <button type="button" onClick={() => setShowCatForm(false)} style={{ fontSize: '.6875rem', padding: '4px 8px', border: '1px solid var(--vx-border)', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}>✕</button>
            </div>
          </form>
        )}
      </>)}
    </div>
  );
}

function CreateAcSubmissionForm({ institutionId, courses, rules, students, onCreated, onCancel }: {
  institutionId: string; courses: { id: string; name: string }[]; rules: AcRule[]; students: StudentRegistryEntry[];
  onCreated: (s: AcSubmission) => void; onCancel: () => void;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [studentId, setStudentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [docMinutes, setDocMinutes] = useState('');
  const [cats, setCats] = useState<AcCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const rule = rules.find(r => r.course_id === courseId);
  useEffect(() => { if (rule) fetchAcCategories(rule.id).then(setCats); else setCats([]); }, [rule?.id]);

  const courseStudents = students.filter(s => s.course_id === courseId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rule || !studentId || !categoryId || !title) return;
    setSaving(true);

    // Upload file if present
    let fileUrl: string | null = null;
    if (file) {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `ac/${institutionId}/${studentId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('vertice-documents').upload(path, file, { contentType: file.type });
      if (uploadErr) { alert('Erro no upload: ' + uploadErr.message); setSaving(false); return; }
      fileUrl = path;
    }

    const { data, error } = await supabase.from('vertice_ac_submissions').insert({
      institution_id: institutionId, rule_id: rule.id, category_id: categoryId,
      student_id: studentId, title, issuer: issuer || null,
      documentary_minutes: docMinutes ? parseInt(docMinutes) * 60 : null,
      status: 'submitted',
      ...(fileUrl ? { external_url: fileUrl } : {}),
    }).select().single();
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    onCreated(data as AcSubmission);
  }

  return (
    <form onSubmit={handleSubmit} className="alumni-info-box" style={{ background: 'var(--vx-surface,#fff)', border: '1px solid var(--vx-border,#e2e8f0)', marginBottom: '1rem' }}>
      <strong style={{ display: 'block', marginBottom: 12 }}>Nova Submissão de Atividade Complementar</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>Curso<select value={courseId} onChange={e => setCourseId(e.target.value)} style={sel}>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Aluno<select value={studentId} onChange={e => setStudentId(e.target.value)} style={sel}><option value="">Selecione…</option>{courseStudents.map(s => <option key={s.id} value={s.id}>{s.full_name} — {s.enrollment_code}</option>)}</select></label>
        <label>Categoria<select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={sel}><option value="">Selecione…</option>{cats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>Título da Atividade<input value={title} onChange={e => setTitle(e.target.value)} style={sel} placeholder="Nome do curso, evento, projeto…" /></label>
        <label>Emissor<input value={issuer} onChange={e => setIssuer(e.target.value)} style={sel} placeholder="Instituição emissora" /></label>
        <label>Carga Horária (h)<input type="number" value={docMinutes} onChange={e => setDocMinutes(e.target.value)} style={sel} placeholder="Horas no certificado" min="0" /></label>
        <label>Comprovante (PDF/imagem)<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} style={{ ...sel, padding: '4px' }} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} className="alumni-btn-back">Cancelar</button>
        <button type="submit" disabled={saving || !studentId || !categoryId || !title} className="alumni-btn-export">{saving ? 'Salvando…' : 'Submeter'}</button>
      </div>
    </form>
  );
}

const sel: React.CSSProperties = { display: 'block', width: '100%', padding: '6px 10px', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 6, fontSize: '.8125rem', marginTop: 4 };

function ConfigCheck({ label, ok, action }: { label: string; ok: boolean; action?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: ok ? '#f0fdf4' : '#fef2f2', borderRadius: 6, border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}` }}>
      <span style={{ fontSize: '1rem' }}>{ok ? '✓' : '○'}</span>
      <span style={{ flex: 1, fontSize: '.8125rem' }}>{label}</span>
      {!ok && action && <button onClick={action} style={{ fontSize: '.6875rem', padding: '2px 10px', border: '1px solid var(--vx-border)', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}>Configurar →</button>}
    </div>
  );
}

function CsvImportButton({ institutionId, courses, onImported }: { institutionId: string; courses: { id: string; name: string }[]; onImported: (count: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setProgress('📂 Lendo arquivo...');
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { setProgress('❌ CSV vazio ou sem cabeçalho.'); setImporting(false); return; }
      // Parse header
      const sep = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, '').normalize('NFD').replace(/[̀-ͯ]/g, ''));
      setProgress(`📋 Colunas encontradas: ${headers.join(', ')}`);
      const nameIdx = headers.findIndex(h => ['nome','full_name','name','aluno','nome_completo','nome completo'].includes(h));
      const enrollIdx = headers.findIndex(h => ['matricula','enrollment_code','enrollment','mat','codigo_matricula','ra'].includes(h));
      const emailIdx = headers.findIndex(h => ['email','e-mail','e_mail'].includes(h));
      const cpfIdx = headers.findIndex(h => ['cpf','cpf_hash','documento'].includes(h));
      const courseIdx = headers.findIndex(h => ['curso','course','course_name','nome_curso'].includes(h));
      if (nameIdx < 0 || enrollIdx < 0) {
        setProgress(`❌ Colunas obrigatórias não encontradas. Precisa ter "nome" (encontrado: ${nameIdx >= 0 ? '✅' : '❌'}) e "matricula" (encontrado: ${enrollIdx >= 0 ? '✅' : '❌'}). Colunas do arquivo: ${headers.join(', ')}`);
        setImporting(false); return;
      }
      setProgress(`✅ Colunas mapeadas: nome=${headers[nameIdx]}, matrícula=${headers[enrollIdx]}${cpfIdx >= 0 ? ', cpf=' + headers[cpfIdx] : ''}${emailIdx >= 0 ? ', email=' + headers[emailIdx] : ''}. Processando ${lines.length - 1} linhas...`);

      const rows: any[] = [];
      let skipped = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        const name = cols[nameIdx];
        const enrollment = cols[enrollIdx];
        if (!name || !enrollment) { skipped++; continue; }
        // Match course by name
        const courseName = courseIdx >= 0 ? cols[courseIdx] : '';
        const course = courseName ? courses.find(c => c.name.toLowerCase().includes(courseName.toLowerCase())) : courses[0];
        // Hash CPF if provided as plain digits
        let cpfHash = cpfIdx >= 0 ? cols[cpfIdx]?.replace(/\D/g, '') : '';
        if (cpfHash && cpfHash.length === 11) {
          const enc = new TextEncoder().encode(cpfHash);
          const buf = await crypto.subtle.digest('SHA-256', enc);
          cpfHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } else if (cpfHash && cpfHash.length !== 11) { cpfHash = ''; }

        rows.push({
          institution_id: institutionId,
          course_id: course?.id || courses[0]?.id,
          full_name: name,
          enrollment_code: enrollment,
          email: emailIdx >= 0 ? cols[emailIdx] || '' : '',
          cpf_hash: cpfHash || null,
          academic_status: 'matriculado',
          verified: false,
        });
      }

      if (rows.length === 0) { setProgress(`❌ Nenhum registro válido. ${skipped} linhas ignoradas (sem nome ou matrícula).`); setImporting(false); return; }
      setProgress(`📤 Enviando ${rows.length} alunos para o banco... (${skipped} linhas ignoradas)`);

      // Batch upsert
      const batchSize = 100;
      let imported = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        setProgress(`📤 Enviando lote ${Math.floor(i/batchSize)+1} de ${Math.ceil(rows.length/batchSize)}... (${imported} importados)`);
        const { error } = await supabase.from('vertice_student_registry').upsert(batch, { onConflict: 'institution_id,enrollment_code' });
        if (error) {
          setProgress(`❌ Erro no lote ${Math.floor(i/batchSize)+1}: ${error.message}. ${imported} alunos importados antes do erro.`);
          setImporting(false); return;
        }
        imported += batch.length;
      }
      setProgress(`✅ Importação concluída! ${imported} alunos importados com sucesso.`);
      onImported(imported);
    } catch (err) { setProgress(`❌ Erro ao processar: ${(err as Error).message}`); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" onChange={handleFile} style={{ display: 'none' }} />
      <button className="alumni-btn-export" onClick={() => fileRef.current?.click()} disabled={importing} style={{fontSize:13,padding:'8px 16px'}}>
        {importing ? '⏳ Importando…' : '📥 Importar CSV'}
      </button>
      <p style={{ fontSize: '.75rem', color: 'var(--vx-muted)', margin: '6px 0 0' }}>
        Colunas obrigatórias: <strong>nome</strong> e <strong>matricula</strong>. Opcionais: email, cpf, curso.
      </p>
      {progress && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, fontSize: '.8rem', lineHeight: 1.6,
        background: progress.startsWith('✅') ? '#f0fdf4' : progress.startsWith('❌') ? '#fef2f2' : '#eff6ff',
        border: '1px solid ' + (progress.startsWith('✅') ? '#86efac' : progress.startsWith('❌') ? '#fecaca' : '#93c5fd'),
        color: progress.startsWith('✅') ? '#065f46' : progress.startsWith('❌') ? '#991b1b' : '#1e40af'
      }}>{progress}</div>}
    </div>
  );
}

function CreateAcRuleForm({ institutionId, courses, onCreated, onCancel }: {
  institutionId: string; courses: { id: string; name: string }[];
  onCreated: (r: AcRule) => void; onCancel: () => void;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [currVersion, setCurrVersion] = useState('2024');
  const [ruleVersion, setRuleVersion] = useState('v1.0');
  const [totalHours, setTotalHours] = useState('200');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId || !totalHours) return;
    setSaving(true);
    const { data, error } = await supabase.from('vertice_ac_rules').insert({
      institution_id: institutionId, course_id: courseId,
      curriculum_version: currVersion, rule_version: ruleVersion,
      total_required_minutes: parseInt(totalHours) * 60,
      active: true,
    }).select().single();
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    onCreated(data as AcRule);
  }

  return (
    <form onSubmit={handleSubmit} className="alumni-info-box" style={{ background: 'var(--vx-surface,#fff)', border: '1px solid var(--vx-border,#e2e8f0)', marginBottom: '1rem' }}>
      <strong style={{ display: 'block', marginBottom: 12 }}>Novo Regulamento de Atividades Complementares</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>Curso *<select value={courseId} onChange={e => setCourseId(e.target.value)} style={sel}>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Versão da Matriz<input value={currVersion} onChange={e => setCurrVersion(e.target.value)} style={sel} placeholder="Ex: 2024" /></label>
        <label>Versão do Regulamento<input value={ruleVersion} onChange={e => setRuleVersion(e.target.value)} style={sel} placeholder="Ex: v1.0" /></label>
        <label>Carga Total Exigida (h) *<input type="number" value={totalHours} onChange={e => setTotalHours(e.target.value)} style={sel} min="1" required /></label>
      </div>
      <p style={{ fontSize: '.75rem', color: 'var(--vx-muted)', margin: '8px 0 0' }}>Após criar o regulamento, adicione as categorias com limites e conversões clicando no regulamento na lista.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} className="alumni-btn-back">Cancelar</button>
        <button type="submit" disabled={saving || !courseId || !totalHours} className="alumni-btn-export">{saving ? 'Salvando…' : 'Criar Regulamento'}</button>
      </div>
    </form>
  );
}
