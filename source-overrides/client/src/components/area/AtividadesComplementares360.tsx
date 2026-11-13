// AtividadesComplementares360.tsx — AC 360
import { useState, useEffect } from 'react';
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
          <header className="alumni-header"><h2>Regulamentos por Curso</h2></header>
          {rules.length === 0 ? <div className="alumni-info-box">Nenhum regulamento cadastrado. Configure as regras de AC por curso e matriz.</div> : (
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
          <header className="alumni-header"><h2>Solicitações</h2></header>
          {submissions.length === 0 ? <div className="alumni-info-box">Nenhuma solicitação recebida.</div> : (
            <table className="alumni-table">
              <thead><tr><th>Título</th><th>Emissor</th><th>Carga Doc.</th><th>Status</th><th>Data</th></tr></thead>
              <tbody>{submissions.slice(0, 100).map(s => (
                <tr key={s.id}>
                  <td>{s.title}</td><td>{s.issuer || '—'}</td>
                  <td>{s.documentary_minutes ? minutesToHours(s.documentary_minutes) : '—'}</td>
                  <td><span className="alumni-tag">{AC_STATUS_LABELS[s.status] || s.status}</span></td>
                  <td>{new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
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
