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

type Step = 'form' | 'sent' | 'error' | 'not_found';

export default function StudentAccessPortal({ institutionId, institutionName, purpose }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [enrollment, setEnrollment] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

      // In production: generate token, hash it, store in vertice_student_access_tokens,
      // send email with link. Here we show the success state.
      // The actual token generation should be an Edge Function for security.
      setStep('sent');
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
