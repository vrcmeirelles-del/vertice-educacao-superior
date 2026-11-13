import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const INST_ID = '1f5fd5b4-93c6-4626-834d-136884915587';

type Student = { student_id: string; name: string; enrollment_code: string; course_id: string; course_name: string };
type Submission = { id: string; title: string; issuer: string; documentary_minutes: number; status: string; created_at: string; category: string; content_hash: string };
type Category = { id: string; code: string; label: string; description: string };

export default function AcPortalAluno() {
  const [step, setStep] = useState<'login'|'portal'>('login');
  const [matricula, setMatricula] = useState('');
  const [cpf, setCpf] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [student, setStudent] = useState<Student|null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [view, setView] = useState<'extrato'|'nova'>('extrato');

  // Form
  const [catId, setCatId] = useState('');
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [hours, setHours] = useState('');
  const [file, setFile] = useState<File|null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) { setMsg('CPF deve ter 11 dígitos.'); setBusy(false); return; }
    const { data } = await supabase.rpc('vertice_ac_student_login', { p_matricula: matricula.trim(), p_cpf: cleanCpf });
    if (!data?.ok) { setMsg(data?.error || 'Matrícula ou CPF não encontrado.'); setBusy(false); return; }
    setStudent(data as Student);
    // Carregar categorias e submissões
    const [cats, subs] = await Promise.all([
      supabase.rpc('vertice_ac_public_categories', { p_institution_id: INST_ID }),
      supabase.rpc('vertice_ac_student_submissions', { p_student_id: data.student_id, p_institution_id: INST_ID }),
    ]);
    setCategories((cats.data || []) as Category[]);
    setSubmissions((subs.data || []) as Submission[]);
    setStep('portal');
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setMsg('');
    if (!student) return;
    // Hash do arquivo para detecção de duplicidade
    let contentHash: string|null = null;
    if (file) {
      const buffer = await file.arrayBuffer();
      const hash = await crypto.subtle.digest('SHA-256', buffer);
      contentHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
    }
    const minutes = Math.round(parseFloat(hours) * 60);
    const { data } = await supabase.rpc('vertice_ac_student_submit', {
      p_student_id: student.student_id,
      p_institution_id: INST_ID,
      p_category_id: catId,
      p_title: title,
      p_issuer: issuer,
      p_documentary_minutes: minutes,
      p_content_hash: contentHash,
    });
    if (!data?.ok) {
      setMsg(data?.duplicate ? '⚠️ Este documento já foi enviado anteriormente.' : (data?.error || 'Erro ao enviar.'));
      setSubmitting(false); return;
    }
    // Upload do arquivo (se houver) — por ora armazena referência
    // TODO: integrar Supabase Storage quando bucket estiver configurado
    setMsg('✅ Documento enviado com sucesso! Aguarde a validação do coordenador.');
    setTitle(''); setIssuer(''); setHours(''); setCatId(''); setFile(null);
    // Recarregar submissões
    const { data: subs } = await supabase.rpc('vertice_ac_student_submissions', { p_student_id: student.student_id, p_institution_id: INST_ID });
    setSubmissions((subs || []) as Submission[]);
    setView('extrato');
    setSubmitting(false);
  }

  const totalApproved = submissions.filter(s => s.status === 'approved').reduce((sum, s) => sum + (s.documentary_minutes || 0), 0);
  const totalPending = submissions.filter(s => s.status === 'pending').reduce((sum, s) => sum + (s.documentary_minutes || 0), 0);

  const statusLabel: Record<string,string> = { pending: '⏳ Em análise', approved: '✅ Aprovado', rejected: '❌ Indeferido', review: '🔍 Em revisão' };
  const statusColor: Record<string,string> = { pending: '#f59e0b', approved: '#059669', rejected: '#dc2626', review: '#3b82f6' };

  if (step === 'login') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #eff6ff 0%, #f0fdf4 50%, #fefce8 100%)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, background: '#1e40af', borderRadius: 10, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 18 }}>V</div>
        <div><strong style={{ fontSize: 15, color: '#0f172a' }}>Vértice Educação Superior</strong><br/><span style={{ fontSize: 11, color: '#64748b' }}>Portal do Aluno · Atividades Complementares</span></div>
      </header>
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%)', borderRadius: 20, padding: '32px 28px', color: '#fff', marginBottom: 28, boxShadow: '0 12px 32px rgba(30,64,175,.2)' }}>
          <span style={{ fontSize: 11, letterSpacing: '.1em', color: '#93c5fd', fontWeight: 700 }}>PORTAL DO ALUNO</span>
          <h1 style={{ fontSize: 24, margin: '10px 0', fontWeight: 800 }}>📜 Atividades Complementares</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#bfdbfe' }}>Envie seus certificados e acompanhe suas horas complementares.</p>
        </div>
        <div style={{ background: '#fff', border: '2px solid #3b82f6', borderRadius: 16, padding: '28px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#1e3a8a', textAlign: 'center' }}>🔐 Identificação</h2>
          <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', margin: '0 0 18px' }}>Informe sua matrícula e CPF</p>
          {msg && <p style={{ fontSize: 12, color: '#dc2626', textAlign: 'center', background: '#fef2f2', padding: 10, borderRadius: 8, margin: '0 0 12px' }}>{msg}</p>}
          <form onSubmit={login} style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
              Matrícula
              <input required value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="Ex: 2023010001"
                style={{ padding: '11px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 }} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
              CPF
              <input required value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric"
                style={{ padding: '11px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 }} />
            </label>
            <button type="submit" disabled={busy}
              style={{ padding: '13px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {busy ? 'Verificando…' : 'Entrar'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 20 }}>
          Vértice Educação Superior · <a href="/" style={{ color: '#2563eb' }}>verticesuperior.com.br</a>
        </p>
      </main>
    </div>
  );

  // PORTAL
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ background: '#1e3a8a', color: '#fff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: '#fff', borderRadius: 8, display: 'grid', placeItems: 'center', color: '#1e3a8a', fontWeight: 900, fontSize: 16 }}>V</div>
          <div><strong style={{ fontSize: 14 }}>{student?.name}</strong><br/><span style={{ fontSize: 11, color: '#93c5fd' }}>{student?.course_name} · Matrícula {student?.enrollment_code}</span></div>
        </div>
        <button onClick={() => { setStep('login'); setStudent(null); }} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Sair</button>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '20px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', borderLeft: '4px solid #2563eb' }}>
            <strong style={{ fontSize: 28, color: '#1e3a8a' }}>{submissions.length}</strong>
            <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>Total enviados</span>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', borderLeft: '4px solid #f59e0b' }}>
            <strong style={{ fontSize: 28, color: '#d97706' }}>{Math.round(totalPending / 60)}h</strong>
            <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>Em análise</span>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', borderLeft: '4px solid #059669' }}>
            <strong style={{ fontSize: 28, color: '#059669' }}>{Math.round(totalApproved / 60)}h</strong>
            <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>Aprovadas</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setView('extrato')} style={{ padding: '10px 18px', borderRadius: 8, border: view === 'extrato' ? '2px solid #2563eb' : '1px solid #d1d5db', background: view === 'extrato' ? '#eff6ff' : '#fff', color: view === 'extrato' ? '#1e40af' : '#334155', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>📋 Meu Extrato</button>
          <button onClick={() => setView('nova')} style={{ padding: '10px 18px', borderRadius: 8, border: view === 'nova' ? '2px solid #059669' : '1px solid #d1d5db', background: view === 'nova' ? '#f0fdf4' : '#fff', color: view === 'nova' ? '#065f46' : '#334155', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>📤 Nova Submissão</button>
        </div>

        {msg && <p style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: msg.startsWith('✅') ? '#f0fdf4' : msg.startsWith('⚠') ? '#fffbeb' : '#fef2f2', color: msg.startsWith('✅') ? '#065f46' : msg.startsWith('⚠') ? '#92400e' : '#991b1b', border: '1px solid ' + (msg.startsWith('✅') ? '#86efac' : msg.startsWith('⚠') ? '#fde68a' : '#fecaca') }}>{msg}</p>}

        {view === 'extrato' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <strong style={{ fontSize: 15, color: '#0f172a' }}>Extrato de Atividades Complementares</strong>
            </div>
            {!submissions.length ? (
              <p style={{ padding: 20, color: '#64748b', fontSize: 13 }}>Nenhuma atividade enviada ainda. Clique em "Nova Submissão" para começar.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Atividade</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Categoria</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Emissor</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Horas</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>Status</th>
                  </tr></thead>
                  <tbody>{submissions.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.title}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.category || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.issuer || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{Math.round((s.documentary_minutes || 0) / 60)}h</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: (statusColor[s.status] || '#888') + '15', color: statusColor[s.status] || '#888', fontWeight: 600 }}>{statusLabel[s.status] || s.status}</span>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'nova' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '24px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>📤 Nova Submissão de Atividade Complementar</h3>
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Categoria *
                <select required value={catId} onChange={e => setCatId(e.target.value)}
                  style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, background: '#fff' }}>
                  <option value="">Selecione a categoria</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Título da atividade *
                <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Curso de Mediação e Arbitragem"
                  style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Quem emitiu o certificado *
                <input required value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="Ex: OAB/TO, Escola Superior da Magistratura"
                  style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Carga horária do certificado (em horas) *
                <input required type="number" min="0.5" step="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="Ex: 40"
                  style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Comprovante (certificado em PDF ou imagem) *
                <input required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)}
                  style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#f8fafc' }} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Formatos aceitos: PDF, JPG, PNG · Máx. 10 MB</span>
              </label>
              <button type="submit" disabled={submitting}
                style={{ padding: '13px', background: '#059669', color: '#fff', border: 0, borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                {submitting ? 'Enviando…' : '📤 Enviar certificado'}
              </button>
            </form>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 24 }}>
          Vértice Educação Superior · Atividades Complementares · <a href="/" style={{ color: '#2563eb' }}>verticesuperior.com.br</a>
        </p>
      </main>
    </div>
  );
}
