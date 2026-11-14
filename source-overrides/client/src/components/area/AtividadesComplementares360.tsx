// AtividadesComplementares360.tsx — AC 360
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { submitAcWithAttachment, AcSubmissionPendingError } from '@/lib/ac-submission';
import { fetchAcRules, fetchAcCategories, fetchAcSubmissions, fetchAcStudentBalance, fetchAcCourseSummary, fetchStudentRegistry, fetchProtocols, approveAcSubmission, AC_STATUS_LABELS, PROTOCOL_STATUS_LABELS, minutesToHours, type AcRule, type AcCategory, type AcSubmission, type AcStudentBalance, type AcCourseSummary, type StudentRegistryEntry } from '@/lib/atividades-complementares';
import './egressos360.css';

type Section = 'overview'|'rules'|'students'|'submissions'|'balance'|'protocols'|'fraud'|'bi'|'config';
interface Props { institutionId: string; courses: { id: string; name: string }[]; role: string; onNavigate?: (tab: string) => void; }

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Visão Geral', icon: '◎' },
  { key: 'rules', label: 'Regulamentos', icon: '📜' },
  { key: 'students', label: 'Base de Alunos', icon: '👤' },
  { key: 'submissions', label: 'Solicitações', icon: '📋' },
  { key: 'balance', label: 'Extrato / Saldo', icon: '⏱' },
  { key: 'protocols', label: 'Secretaria', icon: '📨' },
  { key: 'fraud', label: 'Integridade', icon: '🛡' },
  { key: 'bi', label: 'BI 360', icon: '📊' },
  { key: 'config', label: 'Configurações', icon: '⚙' },
];

export default function AtividadesComplementares360({ institutionId, courses, role, onNavigate }: Props) {
  const [section, setSection] = useState<Section>('overview');
  const [rules, setRules] = useState<AcRule[]>([]);
  const [summary, setSummary] = useState<AcCourseSummary[]>([]);
  const [submissions, setSubmissions] = useState<AcSubmission[]>([]);
  const [balances, setBalances] = useState<AcStudentBalance[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<any[]>([]);
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
      supabase.from('vertice_ac_fraud_alerts').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }).then(r => r.data || []),
    ]).then(([r, s, sub, b, st, p, fa]) => {
      setRules(r); setSummary(s); setSubmissions(sub); setBalances(b); setStudents(st); setProtocols(p); setFraudAlerts(fa as any[]);
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
                <RuleCard key={r.id} rule={r} courseName={courseName(r.course_id)} onRuleUpdated={(updated) => setRules(prev => prev.map(x => x.id === updated.id ? updated : x))} />
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

        {section === 'fraud' && (<div>
          <header className="alumni-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><h2>🛡 Integridade Acadêmica</h2><p className="alumni-subtitle">Alertas de fraude detectados pela IA — visíveis à coordenação e instância superior</p></div>
          </header>

          {/* KPIs */}
          <div className="alumni-kpis">
            <KPI label="Alertas abertos" value={fraudAlerts.filter(a => a.status === 'open').length} color="#dc2626" />
            <KPI label="Em análise" value={fraudAlerts.filter(a => a.status === 'under_review').length} color="#f59e0b" />
            <KPI label="Fraude confirmada" value={fraudAlerts.filter(a => a.status === 'confirmed_fraud').length} color="#7c3aed" />
            <KPI label="Arquivados" value={fraudAlerts.filter(a => a.status === 'dismissed').length} />
          </div>

          {fraudAlerts.length === 0 ? <div className="alumni-info-box">Nenhum alerta de fraude detectado. A IA monitora automaticamente certificados duplicados e editados.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {fraudAlerts.map(a => {
                const sevColor: Record<string, string> = { critical: '#dc2626', high: '#f59e0b', medium: '#2563eb', low: '#64748b' };
                const statusLabel: Record<string, string> = { open: '🔴 Aberto', under_review: '🟡 Em análise', confirmed_fraud: '🟣 Fraude confirmada', dismissed: '⚪ Arquivado' };
                const typeLabel: Record<string, string> = { duplicate_certificate: '📋 Certificado duplicado', edited_document: '✏️ Documento editado', suspicious_pattern: '🔍 Padrão suspeito' };
                return (
                  <div key={a.id} style={{ padding: 14, borderRadius: 10, background: a.status === 'open' ? '#fef2f2' : a.status === 'confirmed_fraud' ? '#f5f3ff' : '#f8fafc', border: `1px solid ${a.status === 'open' ? '#fecaca' : '#e2e8f0'}`, borderLeft: `4px solid ${sevColor[a.severity] || '#64748b'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '.7rem', padding: '2px 8px', borderRadius: 12, background: sevColor[a.severity] || '#64748b', color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>{a.severity}</span>
                          <span style={{ fontSize: '.75rem', color: '#64748b' }}>{typeLabel[a.alert_type] || a.alert_type}</span>
                          <span style={{ fontSize: '.75rem' }}>{statusLabel[a.status] || a.status}</span>
                        </div>
                        <strong style={{ fontSize: '.9rem' }}>{a.title}</strong>
                        <p style={{ fontSize: '.8rem', color: '#475569', margin: '4px 0' }}>{a.description}</p>
                        {a.evidence_json?.names_found && (
                          <p style={{ fontSize: '.75rem', color: '#7c3aed', margin: '2px 0' }}>👤 Nomes encontrados: {a.evidence_json.names_found.join(', ')}</p>
                        )}
                        <div style={{ fontSize: '.7rem', color: '#94a3b8', marginTop: 4 }}>
                          {a.students_involved?.length || 0} aluno(s) envolvido(s) · {a.submissions_involved?.length || 0} submissão(ões) · Detectado em {new Date(a.created_at).toLocaleDateString('pt-BR')}
                          {a.escalated_to && <strong style={{ color: '#7c3aed' }}> · Escalado para {a.escalated_to}</strong>}
                        </div>
                      </div>
                      {a.status === 'open' && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #f59e0b', background: '#fffbeb', color: '#b45309', cursor: 'pointer', fontWeight: 600 }}
                            onClick={async () => { await supabase.from('vertice_ac_fraud_alerts').update({ status: 'under_review' }).eq('id', a.id); setFraudAlerts(prev => prev.map(x => x.id === a.id ? { ...x, status: 'under_review' } : x)); }}>Analisar</button>
                          <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer', fontWeight: 600 }}
                            onClick={async () => { await supabase.from('vertice_ac_fraud_alerts').update({ status: 'confirmed_fraud', escalated_to: 'direcao', escalated_at: new Date().toISOString() }).eq('id', a.id); setFraudAlerts(prev => prev.map(x => x.id === a.id ? { ...x, status: 'confirmed_fraud', escalated_to: 'direcao' } : x)); alert('Fraude confirmada e escalada para a Direção.'); }}>Confirmar fraude</button>
                          <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #94a3b8', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}
                            onClick={async () => { await supabase.from('vertice_ac_fraud_alerts').update({ status: 'dismissed', resolution: 'Verificado e descartado pelo coordenador', resolved_at: new Date().toISOString() }).eq('id', a.id); setFraudAlerts(prev => prev.map(x => x.id === a.id ? { ...x, status: 'dismissed' } : x)); }}>Arquivar</button>
                        </div>
                      )}
                      {a.status === 'under_review' && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer', fontWeight: 600 }}
                            onClick={async () => { await supabase.from('vertice_ac_fraud_alerts').update({ status: 'confirmed_fraud', escalated_to: 'direcao', escalated_at: new Date().toISOString() }).eq('id', a.id); setFraudAlerts(prev => prev.map(x => x.id === a.id ? { ...x, status: 'confirmed_fraud', escalated_to: 'direcao' } : x)); alert('Fraude confirmada e escalada para a Direção.'); }}>Confirmar fraude → Direção</button>
                          <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #94a3b8', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}
                            onClick={async () => { await supabase.from('vertice_ac_fraud_alerts').update({ status: 'dismissed', resolution: 'Descartado após análise', resolved_at: new Date().toISOString() }).eq('id', a.id); setFraudAlerts(prev => prev.map(x => x.id === a.id ? { ...x, status: 'dismissed' } : x)); }}>Arquivar</button>
                        </div>
                      )}
                    </div>
                    {a.resolution && <div style={{ marginTop: 8, padding: 8, background: '#f1f5f9', borderRadius: 6, fontSize: '.75rem', color: '#475569' }}><strong>Resolução:</strong> {a.resolution}</div>}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 16, padding: 12, background: '#f0f9ff', borderRadius: 10, fontSize: '.8rem', color: '#1e40af' }}>
            🤖 <strong>Como funciona:</strong> A IA analisa cada certificado e compara com todos os outros da instituição. Se encontrar o mesmo evento com nomes diferentes (edição de documento) ou certificados idênticos entre alunos distintos, gera um alerta automático. Alertas confirmados são escalados para a Direção e ficam visíveis à instância superior.
          </div>
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

function RuleCard({ rule, courseName, onRuleUpdated }: { rule: AcRule; courseName: string; onRuleUpdated?: (r: AcRule) => void }) {
  const [categories, setCategories] = useState<AcCategory[]>([]);
  const [open, setOpen] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [uploadingReg, setUploadingReg] = useState(false);
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
        {/* Regulamento PDF */}
        <div style={{ marginTop: 10, padding: 10, background: rule.regulation_file_path ? '#ecfdf5' : '#fffbeb', border: `1px solid ${rule.regulation_file_path ? '#10b981' : '#f59e0b'}`, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: '.8125rem' }}>{rule.regulation_file_path ? '✅ Regulamento anexado' : '⚠️ Regulamento não anexado'}</strong>
              <p style={{ fontSize: '.75rem', color: '#6b7280', margin: '2px 0 0' }}>
                {rule.regulation_file_path ? 'O regulamento do PPC está disponível para consulta.' : 'Anexe o regulamento de atividades complementares extraído do PPC.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {rule.regulation_file_path && (
                <button type="button" onClick={async () => {
                  const { data } = await supabase.storage.from('vertice-documents').createSignedUrl(rule.regulation_file_path!, 3600);
                  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                }} style={{ fontSize: '.75rem', padding: '4px 10px', border: '1px solid #10b981', borderRadius: 6, background: '#fff', color: '#047857', cursor: 'pointer', fontWeight: 600 }}>📄 Ver PDF</button>
              )}
              <label style={{ fontSize: '.75rem', padding: '4px 10px', border: `1px dashed ${rule.regulation_file_path ? '#6b7280' : '#3b82f6'}`, borderRadius: 6, background: '#fff', color: rule.regulation_file_path ? '#374151' : '#2563eb', cursor: 'pointer', fontWeight: 600, opacity: uploadingReg ? .5 : 1 }}>
                {uploadingReg ? 'Enviando…' : (rule.regulation_file_path ? '🔄 Substituir' : '📎 Anexar regulamento')}
                <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={uploadingReg} onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploadingReg(true);
                  try {
                    const path = `ac-regulations/${rule.institution_id}/${rule.course_id}/${rule.id}_regulamento.pdf`;
                    const { error: upErr } = await supabase.storage.from('vertice-documents').upload(path, f, { upsert: true, contentType: 'application/pdf' });
                    if (upErr) throw upErr;
                    const { error: dbErr } = await supabase.from('vertice_ac_rules').update({ regulation_file_path: path }).eq('id', rule.id);
                    if (dbErr) throw dbErr;
                    rule.regulation_file_path = path;
                    onRuleUpdated?.({ ...rule, regulation_file_path: path });
                    alert('Regulamento anexado com sucesso!');
                  } catch (err) { alert('Erro ao enviar: ' + (err as Error).message); }
                  finally { setUploadingReg(false); e.target.value = ''; }
                }} />
              </label>
            </div>
          </div>
        </div>

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

  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rule || !studentId || !categoryId || !title || saving || pendingConfirmation) return;
    setSaving(true);
    try {
      const data = await submitAcWithAttachment({
        institution_id: institutionId, rule_id: rule.id, category_id: categoryId,
        student_id: studentId, title, issuer: issuer || null,
        documentary_minutes: docMinutes ? parseInt(docMinutes) * 60 : null,
        status: 'submitted',
      }, file);
      onCreated(data);
    } catch (error) {
      if (error instanceof AcSubmissionPendingError) setPendingConfirmation(true);
      alert((error as Error).message);
    } finally { setSaving(false); }
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
        <button type="submit" disabled={saving || pendingConfirmation || !studentId || !categoryId || !title} className="alumni-btn-export">{pendingConfirmation ? 'Envio pendente de conferência' : saving ? 'Salvando…' : 'Submeter'}</button>
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

const STATUS_MAP: Record<string,string> = {
  'matriculado':'active','ativo':'active','active':'active',
  'trancado':'locked','locked':'locked',
  'concluido':'graduated','graduado':'graduated','graduated':'graduated',
  'cancelado':'cancelled','cancelled':'cancelled',
  'transferido':'transferred','transferred':'transferred',
};
const STATUS_LABELS: Record<string,string> = { active:'Matriculado', locked:'Trancado', graduated:'Concluído', cancelled:'Cancelado', transferred:'Transferido' };

function CsvImportButton({ institutionId, courses, onImported }: { institutionId: string; courses: { id: string; name: string }[]; onImported: (count: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [preview, setPreview] = useState<{rows:any[];skipped:number;errors:string[]}|null>(null);
  const [defaultStatus, setDefaultStatus] = useState('active');
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id || '');

  function norm(s:string){return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/"/g,'');}

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setPreview(null);
    setProgress('📂 Lendo arquivo...');
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { setProgress('❌ CSV vazio ou sem cabeçalho.'); setImporting(false); return; }
      const sep = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map(norm);
      setProgress(`📋 Colunas: ${headers.join(', ')}`);
      const find = (opts:string[]) => headers.findIndex(h => opts.includes(h));
      const nameIdx = find(['nome','full_name','name','aluno','nome_completo','nome completo']);
      const enrollIdx = find(['matricula','enrollment_code','enrollment','mat','codigo_matricula','ra']);
      const emailIdx = find(['email','e-mail','e_mail']);
      const cpfIdx = find(['cpf','cpf_hash','documento']);
      const courseIdx = find(['curso','course','course_name','nome_curso']);
      const statusIdx = find(['situacao','status','academic_status','situacao_academica']);
      const phoneIdx = find(['telefone','phone','celular','tel']);
      const periodIdx = find(['periodo','period','semestre']);
      if (nameIdx < 0 || enrollIdx < 0) {
        setProgress(`❌ Colunas obrigatórias não encontradas. Precisa: "nome" (${nameIdx>=0?'✅':'❌'}) e "matricula" (${enrollIdx>=0?'✅':'❌'}). Colunas: ${headers.join(', ')}`);
        setImporting(false); return;
      }

      const rows: any[] = [], errors: string[] = [];
      let skipped = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        const name = cols[nameIdx]?.trim();
        const enrollment = cols[enrollIdx]?.trim();
        if (!name || !enrollment) { skipped++; continue; }
        const courseName = courseIdx >= 0 ? cols[courseIdx] : '';
        const course = courseName ? courses.find(c => c.name.toLowerCase().includes(courseName.toLowerCase())) : null;
        // CPF: preservar zeros à esquerda, hashear
        let rawCpf = cpfIdx >= 0 ? cols[cpfIdx]?.replace(/\D/g, '') : '';
        let cpfHash = '';
        if (rawCpf && rawCpf.length === 11) {
          const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawCpf));
          cpfHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
        } else if (rawCpf && rawCpf.length > 0) { errors.push(`Linha ${i+1}: CPF "${cols[cpfIdx]}" inválido (${rawCpf.length} dígitos)`); }
        // Status
        let status = 'active';
        if (statusIdx >= 0 && cols[statusIdx]) {
          const mapped = STATUS_MAP[norm(cols[statusIdx])];
          if (mapped) { status = mapped; }
          else { errors.push(`Linha ${i+1}: situação "${cols[statusIdx]}" não reconhecida`); status = ''; }
        }
        rows.push({
          institution_id: institutionId,
          course_id: course?.id || selectedCourse,
          full_name: name,
          enrollment_code: enrollment,
          email: emailIdx >= 0 ? cols[emailIdx]?.trim() || null : null,
          cpf_hash: cpfHash || null,
          academic_status: status || defaultStatus,
          verified: false,
        });
      }
      setPreview({ rows, skipped, errors });
      setProgress(`📋 ${rows.length} alunos prontos para importar. ${skipped} linhas ignoradas. ${errors.length} avisos.`);
      setImporting(false);
    } catch (err) { setProgress(`❌ Erro ao processar: ${(err as Error).message}`); setImporting(false); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  async function confirmImport() {
    if (!preview) return;
    setImporting(true);
    const rows = preview.rows.map(r => ({ ...r, academic_status: r.academic_status || defaultStatus }));
    const batchSize = 100;
    let imported = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      setProgress(`📤 Lote ${Math.floor(i/batchSize)+1} de ${Math.ceil(rows.length/batchSize)}... (${imported} importados)`);
      const { error } = await supabase.from('vertice_student_registry').upsert(batch, { onConflict: 'institution_id,enrollment_code' });
      if (error) {
        setProgress(`❌ Erro no lote ${Math.floor(i/batchSize)+1}: ${error.message}. ${imported} importados antes do erro.`);
        setImporting(false); return;
      }
      imported += batch.length;
    }
    setProgress(`✅ Importação concluída! ${imported} alunos importados.`);
    setPreview(null);
    setImporting(false);
    onImported(imported);
  }

  const courseName = courses.find(c => c.id === selectedCourse)?.name || 'Nenhum';

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />
      {!preview && <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap',marginBottom:8}}>
        <label style={{display:'grid',gap:4,fontSize:12,fontWeight:600}}>Curso destino
          <select value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} style={{padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13}}>
            {courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={{display:'grid',gap:4,fontSize:12,fontWeight:600}}>Situação padrão
          <select value={defaultStatus} onChange={e=>setDefaultStatus(e.target.value)} style={{padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13}}>
            {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button className="alumni-btn-export" onClick={() => fileRef.current?.click()} disabled={importing} style={{fontSize:13,padding:'8px 16px'}}>
          {importing ? '⏳ Processando…' : '📥 Importar CSV'}
        </button>
      </div>}
      <p style={{ fontSize: '.75rem', color: 'var(--vx-muted)', margin: '0 0 6px' }}>
        Colunas: <strong>nome</strong>, <strong>matricula</strong>. Opcionais: email, cpf, telefone, periodo, curso, situacao.
      </p>
      {progress && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, fontSize: '.8rem', lineHeight: 1.6,
        background: progress.startsWith('✅') ? '#f0fdf4' : progress.startsWith('❌') ? '#fef2f2' : '#eff6ff',
        border: '1px solid ' + (progress.startsWith('✅') ? '#86efac' : progress.startsWith('❌') ? '#fecaca' : '#93c5fd'),
        color: progress.startsWith('✅') ? '#065f46' : progress.startsWith('❌') ? '#991b1b' : '#1e40af'
      }}>{progress}</div>}
      {preview && !importing && <div style={{marginTop:12,padding:16,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10}}>
        <strong style={{fontSize:14,color:'#92400e'}}>📋 Prévia da importação</strong>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8,margin:'10px 0'}}>
          <div style={{padding:10,background:'#fff',borderRadius:8,border:'1px solid #e5e7eb'}}><strong style={{fontSize:20}}>{preview.rows.length}</strong><br/><span style={{fontSize:11,color:'#6b7280'}}>Alunos a importar</span></div>
          <div style={{padding:10,background:'#fff',borderRadius:8,border:'1px solid #e5e7eb'}}><strong style={{fontSize:20}}>{preview.skipped}</strong><br/><span style={{fontSize:11,color:'#6b7280'}}>Linhas ignoradas</span></div>
          <div style={{padding:10,background:'#fff',borderRadius:8,border:'1px solid #e5e7eb'}}><strong style={{fontSize:20}}>{preview.errors.length}</strong><br/><span style={{fontSize:11,color:'#6b7280'}}>Avisos</span></div>
        </div>
        <p style={{fontSize:12,color:'#78350f'}}>Instituição: <strong>UNITOP</strong> · Curso: <strong>{courseName}</strong> · Situação: <strong>{STATUS_LABELS[defaultStatus]}</strong></p>
        {preview.errors.length > 0 && <details style={{fontSize:12,margin:'8px 0'}}><summary style={{cursor:'pointer',color:'#92400e'}}>⚠️ {preview.errors.length} avisos</summary><ul style={{margin:'6px 0',paddingLeft:18}}>{preview.errors.slice(0,20).map((e,i)=><li key={i}>{e}</li>)}{preview.errors.length>20&&<li>...e mais {preview.errors.length-20}</li>}</ul></details>}
        <div style={{display:'flex',gap:8,marginTop:10}}>
          <button onClick={confirmImport} style={{padding:'9px 18px',background:'#059669',color:'#fff',border:0,borderRadius:6,fontSize:13,fontWeight:700,cursor:'pointer'}}>✅ Confirmar importação</button>
          <button onClick={()=>{setPreview(null);setProgress('');}} style={{padding:'9px 18px',background:'#fff',color:'#64748b',border:'1px solid #d1d5db',borderRadius:6,fontSize:13,cursor:'pointer'}}>Cancelar</button>
        </div>
      </div>}
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
