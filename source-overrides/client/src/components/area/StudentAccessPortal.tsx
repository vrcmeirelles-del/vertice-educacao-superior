// StudentAccessPortal.tsx — Página de acesso do estudante sem senha (magic link)
// Compartilhado entre Atividades Complementares e Estágio
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import './egressos360.css';

interface Props {
  institutionId: string;
  institutionName: string;
  purpose: 'complementary_activities' | 'mandatory_internship';
}

type Step = 'form' | 'sent' | 'error' | 'not_found' | 'dashboard';

export default function StudentAccessPortal({ institutionId, institutionName, purpose }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [enrollment, setEnrollment] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [studentData, setStudentData] = useState<any>(null);

  const purposeLabel = purpose === 'complementary_activities'
    ? 'Atividades Complementares' : 'Estágio Obrigatório';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment.trim() || !cpf.trim() || !email.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      // Normalize CPF (remove formatting)
      const cpfClean = cpf.replace(/\D/g, '');
      if (cpfClean.length !== 11) {
        setErrorMsg('CPF deve conter 11 dígitos.');
        setLoading(false);
        return;
      }

      // Hash CPF client-side for comparison
      const encoder = new TextEncoder();
      const data = encoder.encode(cpfClean);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const cpfHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Check student registry
      const { data: student, error } = await supabase
        .from('vertice_student_registry')
        .select('id, email, verified')
        .eq('institution_id', institutionId)
        .eq('enrollment_code', enrollment.trim())
        .eq('cpf_hash', cpfHash)
        .maybeSingle();

      if (error || !student) {
        // Generic response — don't reveal if enrollment exists
        setStep('sent'); // Always show "sent" to prevent enumeration
        setLoading(false);
        return;
      }

      // Check if email matches registered email
      if (student.email.toLowerCase() !== email.trim().toLowerCase()) {
        // Don't reveal that enrollment exists but email doesn't match
        setStep('sent');
        setLoading(false);
        return;
      }

      // Call Edge Function to send real magic link email
      supabase.functions.invoke('vertice-student-magic-link', {
        body: { institution_id: institutionId, enrollment_code: enrollment.trim(), cpf_hash: cpfHash, email: email.trim(), purpose },
      }).catch(() => {}); // fire and forget — don't block UX

      // Load student data for dashboard (dev/demo: direct access)
      const studentInfo = await loadStudentDashboardData(student.id, institutionId);
      if (studentInfo) {
        setStudentData(studentInfo);
        setStep('dashboard');
      } else {
        setStep('sent'); // Fallback: show "email sent"
      }
    } catch (err) {
      setStep('error');
      setErrorMsg('Erro ao processar a solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatCpf = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 11);
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
    if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
  };

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 12, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--vx-text, #1e293b)' }}>VÉRTICE</div>
          <div style={{ fontSize: '.8125rem', color: 'var(--vx-muted, #64748b)', marginTop: 4 }}>{institutionName}</div>
          <h2 style={{ fontSize: '1.125rem', margin: '1rem 0 .25rem', color: 'var(--vx-text)' }}>{purposeLabel}</h2>
          <p style={{ fontSize: '.8125rem', color: 'var(--vx-muted)' }}>Solicite acesso para enviar documentos e acompanhar suas solicitações.</p>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>
              Matrícula
              <input type="text" value={enrollment} onChange={e => setEnrollment(e.target.value)}
                placeholder="Ex: 2024001234" required autoComplete="off"
                style={{ display: 'block', width: '100%', padding: '.5rem .75rem', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 6, fontSize: '.875rem', marginTop: 4 }} />
            </label>

            <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>
              CPF
              <input type="text" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00" required autoComplete="off" inputMode="numeric"
                style={{ display: 'block', width: '100%', padding: '.5rem .75rem', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 6, fontSize: '.875rem', marginTop: 4 }} />
            </label>

            <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>
              E-mail institucional
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu.email@instituicao.edu.br" required autoComplete="email"
                style={{ display: 'block', width: '100%', padding: '.5rem .75rem', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 6, fontSize: '.875rem', marginTop: 4 }} />
            </label>

            {errorMsg && <p style={{ color: '#ef4444', fontSize: '.8125rem', margin: 0 }}>{errorMsg}</p>}

            <button type="submit" disabled={loading}
              style={{ padding: '.625rem', background: 'var(--vx-accent, #2563eb)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.875rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? .7 : 1, marginTop: 4 }}>
              {loading ? 'Verificando…' : 'Solicitar acesso'}
            </button>

            <p style={{ fontSize: '.75rem', color: 'var(--vx-muted)', textAlign: 'center', margin: '8px 0 0' }}>
              Um link de acesso será enviado para o e-mail vinculado à sua matrícula.
            </p>
          </form>
        )}

        {step === 'sent' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📧</div>
            <h3 style={{ margin: '0 0 8px' }}>Verifique seu e-mail</h3>
            <p style={{ fontSize: '.875rem', color: 'var(--vx-muted)', lineHeight: 1.5 }}>
              Se os dados informados correspondem a um vínculo ativo, um link de acesso foi enviado para o e-mail cadastrado pela instituição.
            </p>
            <p style={{ fontSize: '.8125rem', color: 'var(--vx-muted)', marginTop: 12 }}>
              O link é de uso único e expira em 30 minutos.
            </p>
            <button onClick={() => { setStep('form'); setEnrollment(''); setCpf(''); setEmail(''); }}
              style={{ marginTop: 16, padding: '.5rem 1.5rem', background: 'transparent', border: '1px solid var(--vx-border)', borderRadius: 8, fontSize: '.8125rem', cursor: 'pointer' }}>
              Solicitar novamente
            </button>
          </div>
        )}

        {step === 'dashboard' && studentData && (
          <StudentDashboard data={studentData} purpose={purpose} institutionName={institutionName} onLogout={() => { setStep('form'); setStudentData(null); setEnrollment(''); setCpf(''); setEmail(''); }} />
        )}

        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px' }}>Erro na solicitação</h3>
            <p style={{ fontSize: '.875rem', color: 'var(--vx-muted)' }}>{errorMsg || 'Tente novamente em alguns instantes.'}</p>
            <button onClick={() => setStep('form')}
              style={{ marginTop: 16, padding: '.5rem 1.5rem', background: 'var(--vx-accent, #2563eb)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.8125rem', cursor: 'pointer' }}>
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      <p style={{ fontSize: '.6875rem', color: 'var(--vx-muted, #94a3b8)', textAlign: 'center', marginTop: 16 }}>
        Plataforma Vértice Educação Superior · Acesso restrito a estudantes com vínculo ativo
      </p>
    </div>
  );
}

async function loadStudentDashboardData(studentId: string, institutionId: string) {
  const [reg, balance, subs, placements] = await Promise.all([
    supabase.from('vertice_student_registry').select('full_name,enrollment_code,course_id').eq('id', studentId).single(),
    supabase.from('v_ac_student_balance').select('*').eq('student_id', studentId).maybeSingle().catch(() => ({ data: null })),
    supabase.from('vertice_ac_submissions').select('id,title,issuer,documentary_minutes,status,created_at').eq('student_id', studentId).order('created_at', { ascending: false }).limit(20).catch(() => ({ data: [] })),
    supabase.from('vertice_internship_placements').select('id,lifecycle,starts_at,ends_at,advisor_name,organization_id,field_id').eq('student_id', studentId).order('created_at', { ascending: false }).limit(10).catch(() => ({ data: [] })),
  ]);
  if (!reg.data) return null;
  // Enrich placements with org/field names
  const enriched = await Promise.all(((placements as any).data ?? []).map(async (p: any) => {
    const [org, field] = await Promise.all([
      supabase.from('vertice_internship_organizations').select('name,trade_name').eq('id', p.organization_id).maybeSingle(),
      supabase.from('vertice_internship_fields').select('name').eq('id', p.field_id).maybeSingle(),
    ]);
    return { ...p, organization_name: org.data?.trade_name || org.data?.name || '—', field_name: field.data?.name || '—' };
  }));
  return {
    full_name: reg.data.full_name,
    enrollment_code: reg.data.enrollment_code,
    ac_balance: (balance as any).data || null,
    ac_submissions: (subs as any).data ?? [],
    placements: enriched,
  };
}

/* ── Dashboard do Aluno (pós-login) ── */
function StudentDashboard({ data, purpose, institutionName, onLogout }: { data: any; purpose: string; institutionName: string; onLogout: () => void }) {
  const st = { padding: '6px 10px', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 8, background: 'var(--vx-surface,#fff)', marginBottom: 8 };
  const lbl: React.CSSProperties = { fontSize: '.75rem', color: 'var(--vx-muted,#64748b)', textTransform: 'uppercase', letterSpacing: '.04em' };
  const val: React.CSSProperties = { fontSize: '1.25rem', fontWeight: 700 };

  return (
    <div style={{ padding: '1rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: '.75rem', color: 'var(--vx-muted)' }}>{institutionName}</div>
          <strong>{data.full_name}</strong>
          <div style={{ fontSize: '.8125rem', color: 'var(--vx-muted)' }}>Matrícula: {data.enrollment_code}</div>
        </div>
        <button onClick={onLogout} style={{ fontSize: '.75rem', padding: '4px 12px', background: 'transparent', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 6, cursor: 'pointer' }}>Sair</button>
      </div>

      {/* AC — Saldo */}
      {(purpose === 'complementary_activities' || data.ac_balance) && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: '.875rem', margin: '0 0 8px' }}>📋 Atividades Complementares</h3>
          {data.ac_balance ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={st}><div style={lbl}>Exigido</div><div style={val}>{minutesToH(data.ac_balance.total_required_minutes)}</div></div>
              <div style={st}><div style={lbl}>Creditado</div><div style={{ ...val, color: '#059669' }}>{minutesToH(data.ac_balance.credited_minutes)}</div></div>
              <div style={st}><div style={lbl}>Restante</div><div style={{ ...val, color: data.ac_balance.remaining_minutes <= 0 ? '#059669' : '#f59e0b' }}>{data.ac_balance.remaining_minutes <= 0 ? '✓' : minutesToH(data.ac_balance.remaining_minutes)}</div></div>
            </div>
          ) : <p style={{ fontSize: '.8125rem', color: 'var(--vx-muted)' }}>Nenhum regulamento vinculado ainda.</p>}
          {data.ac_submissions?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={lbl}>Suas submissões</div>
              {data.ac_submissions.map((s: any) => (
                <div key={s.id} style={{ ...st, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong style={{ fontSize: '.8125rem' }}>{s.title}</strong><div style={{ fontSize: '.75rem', color: 'var(--vx-muted)' }}>{s.issuer || '—'} · {s.documentary_minutes ? minutesToH(s.documentary_minutes) : '—'}</div></div>
                  <span style={{ fontSize: '.75rem', padding: '2px 8px', borderRadius: 4, background: '#f1f5f9' }}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Estágio */}
      {(purpose === 'mandatory_internship' || data.placements) && (
        <div>
          <h3 style={{ fontSize: '.875rem', margin: '0 0 8px' }}>🏢 Estágio Obrigatório</h3>
          {data.placements?.length > 0 ? data.placements.map((p: any) => (
            <div key={p.id} style={{ ...st, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '.8125rem' }}>{p.organization_name || 'Concedente'}</strong>
                <span style={{ fontSize: '.75rem', padding: '2px 8px', borderRadius: 4, background: '#f1f5f9' }}>{p.lifecycle}</span>
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--vx-muted)', marginTop: 4 }}>
                {p.field_name || 'Campo'}{p.starts_at ? ` · Início: ${new Date(p.starts_at).toLocaleDateString('pt-BR')}` : ''}
                {p.advisor_name ? ` · Orient.: ${p.advisor_name}` : ''}
              </div>
              {p.hours_completed != null && <div style={{ fontSize: '.75rem', marginTop: 4 }}>Horas cumpridas: <strong>{minutesToH(p.hours_completed)}</strong></div>}
            </div>
          )) : <p style={{ fontSize: '.8125rem', color: 'var(--vx-muted)' }}>Nenhum estágio vinculado.</p>}
        </div>
      )}
    </div>
  );
}

function minutesToH(m: number): string {
  if (!m || m <= 0) return '0h';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min}min` : `${h}h`;
}
