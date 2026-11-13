// AtividadesComplementares360.tsx — AC 360
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAcRules, fetchAcCategories, fetchAcSubmissions, fetchAcStudentBalance, fetchAcCourseSummary, fetchStudentRegistry, fetchProtocols, AC_STATUS_LABELS, PROTOCOL_STATUS_LABELS, minutesToHours, type AcRule, type AcCategory, type AcSubmission, type AcStudentBalance, type AcCourseSummary, type StudentRegistryEntry } from '@/lib/atividades-complementares';
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
          <header className="alumni-header">
            <h2>Base de Alunos</h2>
            <p className="alumni-subtitle">Estudantes com vínculo verificado para acesso sem senha</p>
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
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ fontSize: '.6875rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #059669', background: '#f0fdf4', color: '#059669', cursor: 'pointer' }}
                        onClick={async () => { await supabase.from('vertice_ac_submissions').update({ status: 'approved' }).eq('id', s.id); setSubmissions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'approved' } : x)); }}>✓ Deferir</button>
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
        </div>)}

        {section === 'config' && (<div>
          <header className="alumni-header"><h2>Configurações</h2></header>
          <div className="alumni-info-box">
            O módulo de Atividades Complementares requer a configuração do regulamento por curso e matriz (<strong>Regulamentos</strong>), a importação da base de alunos (<strong>Base de Alunos</strong>) e a definição das categorias com seus limites e conversões. A URL de acesso do estudante será disponibilizada após a ativação do módulo.
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
  useEffect(() => { if (open) fetchAcCategories(rule.id).then(setCategories); }, [open, rule.id]);
  return (
    <div className="alumni-finding-card" style={{ border: '1px solid var(--vx-border,#e2e8f0)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div><strong>{courseName}</strong><span style={{ fontSize: '.8125rem', color: 'var(--vx-muted)', marginLeft: 8 }}>Matriz {rule.curriculum_version} · {rule.rule_version}</span></div>
        <div><span className="alumni-tag" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{minutesToHours(rule.total_required_minutes)} exigidas</span> {open ? '▾' : '▸'}</div>
      </div>
      {open && categories.length > 0 && (
        <table className="alumni-table" style={{ marginTop: 8 }}>
          <thead><tr><th>Categoria</th><th>Máx/Item</th><th>Máx/Cat.</th><th>Conversão</th></tr></thead>
          <tbody>{categories.map(c => (
            <tr key={c.id}><td>{c.label}</td><td>{c.max_per_item_minutes ? minutesToHours(c.max_per_item_minutes) : '—'}</td><td>{c.max_category_minutes ? minutesToHours(c.max_category_minutes) : '—'}</td><td>{c.conversion_numerator}:{c.conversion_denominator}</td></tr>
          ))}</tbody>
        </table>
      )}
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

  const rule = rules.find(r => r.course_id === courseId);
  useEffect(() => { if (rule) fetchAcCategories(rule.id).then(setCats); else setCats([]); }, [rule?.id]);

  const courseStudents = students.filter(s => s.course_id === courseId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rule || !studentId || !categoryId || !title) return;
    setSaving(true);
    const { data, error } = await supabase.from('vertice_ac_submissions').insert({
      institution_id: institutionId, rule_id: rule.id, category_id: categoryId,
      student_id: studentId, title, issuer: issuer || null,
      documentary_minutes: docMinutes ? parseInt(docMinutes) * 60 : null,
      status: 'submitted',
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
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} className="alumni-btn-back">Cancelar</button>
        <button type="submit" disabled={saving || !studentId || !categoryId || !title} className="alumni-btn-export">{saving ? 'Salvando…' : 'Submeter'}</button>
      </div>
    </form>
  );
}

const sel: React.CSSProperties = { display: 'block', width: '100%', padding: '6px 10px', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 6, fontSize: '.8125rem', marginTop: 4 };

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
