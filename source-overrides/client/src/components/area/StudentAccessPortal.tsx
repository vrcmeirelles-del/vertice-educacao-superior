// StudentAccessPortal.tsx — Acesso do estudante sem senha (Atividades Complementares / Estágio)
//
// Fluxo: o estudante informa matrícula, CPF e e-mail → recebe um link pessoal por e-mail →
// o link (token de uso único, 30 min) abre uma sessão própria → saldo, solicitações e envio de atividades.
// Toda leitura e escrita passa pela Edge Function vertice-student-portal; o navegador não consulta
// tabelas de estudantes diretamente.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import './egressos360.css';

type Purpose = 'complementary_activities' | 'mandatory_internship';

interface Props {
  institutionId: string;
  institutionName: string;
  purpose: Purpose;
  token?: string | null;
}

interface Category { id: string; code: string; label: string; description?: string | null; max_per_item_minutes?: number | null; accepted_documents?: string[] | null }
interface Submission { id: string; title: string; issuer: string | null; documentary_minutes: number | null; status: string; created_at: string; category_id: string | null }
interface Placement { id: string; lifecycle: string; starts_at: string | null; ends_at: string | null; advisor_name: string | null }
interface Dashboard {
  student: { full_name: string; enrollment_code: string; course_name: string | null };
  rule: { id: string; rule_version: string; total_required_minutes: number } | null;
  credited_minutes: number;
  categories: Category[];
  submissions: Submission[];
  placements: Placement[];
}

const SESSION_KEY = 'vx-student-session';
const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho', submitted: 'Enviada', extracting: 'Em leitura', suggestion_ready: 'Em análise', under_review: 'Em análise',
  adjustments_requested: 'Ajustes solicitados', approved: 'Aprovada', partially_approved: 'Aprovada parcialmente',
  denied: 'Indeferida', rejected: 'Indeferida', credited: 'Horas creditadas', report_sent: 'Enviada à secretaria', posting_confirmed: 'Lançada no histórico',
};
const ERROR_LABEL: Record<string, string> = {
  link_invalid: 'Este link é inválido, já foi usado ou expirou. Solicite um novo acesso abaixo.',
  session_invalid: 'Sua sessão expirou. Solicite um novo link de acesso.',
  file_type: 'Envie o comprovante em PDF, JPG, PNG ou WEBP.',
  file_size: 'O arquivo deve ter no máximo 10 MB.',
  file_missing: 'Não foi possível confirmar o envio do arquivo. Tente novamente.',
  invalid_submission: 'Preencha título, categoria e carga horária (em horas).',
  invalid_category: 'Categoria indisponível para o seu regulamento.',
  no_rule: 'O regulamento do seu curso ainda não foi cadastrado pela coordenação.',
  too_many: 'Limite diário de envios atingido. Tente novamente amanhã.',
};

const box: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 8, background: 'var(--vx-surface,#fff)', marginBottom: 8 };
const input: React.CSSProperties = { display: 'block', width: '100%', padding: '.5rem .75rem', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 6, fontSize: '.875rem', marginTop: 4 };
const primary: React.CSSProperties = { padding: '.625rem', background: 'var(--vx-accent,#1e3a8a)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.875rem', fontWeight: 600, cursor: 'pointer' };
const ghost: React.CSSProperties = { padding: '.5rem 1.25rem', background: 'transparent', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 8, fontSize: '.8125rem', cursor: 'pointer' };
const label: React.CSSProperties = { fontSize: '.8125rem', fontWeight: 600 };
const small: React.CSSProperties = { fontSize: '.75rem', color: 'var(--vx-muted,#64748b)' };

const moduleParam = (p: Purpose) => (p === 'mandatory_internship' ? 'estagio' : 'ac');

function minutesToH(m: number | null | undefined): string {
  if (!m || m <= 0) return '0h';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min}min` : `${h}h`;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('vertice-student-portal', { body });
  if (error) {
    let code = 'unavailable';
    try { const ctx = (error as { context?: Response }).context; if (ctx) code = ((await ctx.json()) as { error?: string }).error || code; } catch { /* mantém genérico */ }
    throw new Error(code);
  }
  return data as T;
}

function readSession(institutionId: string): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as { key: string; ies: string; exp: string };
    if (s.ies !== institutionId || new Date(s.exp).getTime() <= Date.now()) { sessionStorage.removeItem(SESSION_KEY); return null; }
    return s.key;
  } catch { return null; }
}
function saveSession(key: string, ies: string, exp: string) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ key, ies, exp })); } catch { /* navegação privada */ }
}
function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ } }

export default function StudentAccessPortal({ institutionId, institutionName, purpose, token }: Props) {
  const [step, setStep] = useState<'loading' | 'form' | 'sent' | 'dashboard'>(token ? 'loading' : 'form');
  const [session, setSession] = useState<string | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [notice, setNotice] = useState('');
  const purposeLabel = purpose === 'mandatory_internship' ? 'Estágio Obrigatório' : 'Atividades Complementares';
  const mod = moduleParam(purpose);

  // 1) Link do e-mail: troca o token por sessão e remove o token da barra de endereços.
  // 2) Sem token: retoma sessão existente desta aba, se ainda válida.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (token) {
        try { window.history.replaceState(null, '', `/acesso-estudante?ies=${encodeURIComponent(institutionId)}&mod=${mod}`); } catch { /* noop */ }
        try {
          const r = await call<{ session: string; expires_at: string; data: Dashboard }>({ action: 'redeem', token, module: mod });
          if (!alive) return;
          saveSession(r.session, institutionId, r.expires_at);
          setSession(r.session); setData(r.data); setStep('dashboard');
        } catch (e) {
          if (!alive) return;
          setNotice(ERROR_LABEL[(e as Error).message] || ERROR_LABEL.link_invalid);
          setStep('form');
        }
        return;
      }
      const saved = readSession(institutionId);
      if (!saved) return;
      setStep('loading');
      try {
        const r = await call<{ data: Dashboard }>({ action: 'dashboard', session: saved, module: mod });
        if (!alive) return;
        setSession(saved); setData(r.data); setStep('dashboard');
      } catch {
        clearSession();
        if (alive) setStep('form');
      }
    })();
    return () => { alive = false; };
  }, [token, institutionId, mod]);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const r = await call<{ data: Dashboard }>({ action: 'dashboard', session, module: mod });
      setData(r.data);
    } catch (e) {
      if ((e as Error).message === 'session_invalid') { clearSession(); setSession(null); setData(null); setNotice(ERROR_LABEL.session_invalid); setStep('form'); }
    }
  }, [session, mod]);

  const logout = async () => {
    if (session) await call({ action: 'logout', session }).catch(() => undefined);
    clearSession(); setSession(null); setData(null); setNotice(''); setStep('form');
  };

  return (
    <div style={{ maxWidth: step === 'dashboard' ? 760 : 480, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ background: 'var(--vx-surface,#fff)', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 12, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--vx-text,#1e293b)' }}>VÉRTICE</div>
          <div style={{ fontSize: '.8125rem', color: 'var(--vx-muted,#64748b)', marginTop: 4 }}>{institutionName}</div>
          <h2 style={{ fontSize: '1.125rem', margin: '1rem 0 .25rem', color: 'var(--vx-text)' }}>{purposeLabel}</h2>
          {step !== 'dashboard' && <p style={{ fontSize: '.8125rem', color: 'var(--vx-muted)' }}>Acesse para enviar comprovantes e acompanhar suas solicitações.</p>}
        </div>

        {step === 'loading' && <p role="status" style={{ textAlign: 'center', ...small }}>Abrindo seu acesso…</p>}
        {step === 'form' && <RequestForm institutionId={institutionId} module={mod} notice={notice} onLogin={(s, d) => { setSession(s); setData(d); setStep('dashboard'); }} />}
        {step === 'sent' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }} aria-hidden="true">✅</div>
            <h3 style={{ margin: '0 0 8px' }}>Acesso verificado</h3>
            <p style={{ fontSize: '.875rem', color: 'var(--vx-muted)', lineHeight: 1.5 }}>Carregando seus dados…</p>
          </div>
        )}
        {step === 'dashboard' && data && session && (
          <StudentDashboard data={data} session={session} purpose={purpose} onLogout={logout} onChanged={refresh} />
        )}
      </div>
      <p style={{ fontSize: '.6875rem', color: 'var(--vx-muted,#94a3b8)', textAlign: 'center', marginTop: 16 }}>
        Plataforma Vértice Educação Superior · Acesso restrito a estudantes com vínculo ativo
      </p>
    </div>
  );
}

function RequestForm({ institutionId, module, notice, onLogin }: { institutionId: string; module: string; notice: string; onLogin: (session: string, data: Dashboard) => void }) {
  const [enrollment, setEnrollment] = useState('');
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatCpf = (value: string) => {
    const c = value.replace(/\D/g, '').slice(0, 11);
    if (c.length <= 3) return c;
    if (c.length <= 6) return `${c.slice(0, 3)}.${c.slice(3)}`;
    if (c.length <= 9) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6)}`;
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) { setError('CPF deve conter 11 dígitos.'); return; }
    setLoading(true);
    try {
      // Validar CPF + matrícula via RPC (sem email, sem magic link)
      const { data: loginResult } = await supabase.rpc('vertice_ac_student_login', { p_matricula: enrollment.trim(), p_cpf: cleanCpf, p_institution_id: institutionId });
      if (!loginResult?.ok) { setError(loginResult?.error || 'Matrícula ou CPF não encontrado na base de alunos.'); setLoading(false); return; }
      // Criar sessão local com student_id
      const sessionKey = `student:${loginResult.student_id}`;
      saveSession(sessionKey, institutionId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      // Carregar dashboard via edge function
      try {
        const dashboard = await call<Dashboard>({ action: 'dashboard', session: sessionKey, module });
        onLogin(sessionKey, dashboard);
      } catch {
        // Se edge function falhar, montar dashboard mínimo dos dados da RPC
        onLogin(sessionKey, {
          student: { full_name: loginResult.name, enrollment_code: loginResult.enrollment_code, course_name: loginResult.course_name },
          rule: null, credited_minutes: 0, categories: [], submissions: [], placements: [],
        });
      }
    } catch {
      setError('Não foi possível verificar. Tente novamente.');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {notice && <p role="alert" style={{ color: '#b45309', fontSize: '.8125rem', margin: 0 }}>{notice}</p>}
      <label style={label}>Matrícula
        <input type="text" value={enrollment} onChange={e => setEnrollment(e.target.value)} placeholder="Ex.: 2024001234" required autoComplete="off" style={input} />
      </label>
      <label style={label}>CPF
        <input type="text" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" required autoComplete="off" inputMode="numeric" style={input} />
      </label>
      {error && <p role="alert" style={{ color: '#dc2626', fontSize: '.8125rem', margin: 0 }}>{error}</p>}
      <button type="submit" disabled={loading} style={{ ...primary, marginTop: 4, opacity: loading ? .7 : 1, cursor: loading ? 'wait' : 'pointer' }}>
        {loading ? 'Verificando…' : 'Acessar'}
      </button>
      <p style={{ ...small, textAlign: 'center', margin: '8px 0 0' }}>Informe sua matrícula e CPF. Não é preciso criar senha.</p>
    </form>
  );
}

function StudentDashboard({ data, session, purpose, onLogout, onChanged }: { data: Dashboard; session: string; purpose: Purpose; onLogout: () => void; onChanged: () => Promise<void> }) {
  const required = data.rule?.total_required_minutes ?? 0;
  const remaining = Math.max(0, required - data.credited_minutes);
  const pending = data.submissions.filter(s => ['submitted', 'extracting', 'suggestion_ready', 'under_review'].includes(s.status)).length;
  const catLabel = (id: string | null) => data.categories.find(c => c.id === id)?.label ?? '—';
  const stat: React.CSSProperties = { ...box, marginBottom: 0 };
  const statLabel: React.CSSProperties = { fontSize: '.6875rem', color: 'var(--vx-muted,#64748b)', textTransform: 'uppercase', letterSpacing: '.04em' };
  const statValue: React.CSSProperties = { fontSize: '1.25rem', fontWeight: 700 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <strong>{data.student.full_name}</strong>
          <div style={small}>Matrícula {data.student.enrollment_code}{data.student.course_name ? ` · ${data.student.course_name}` : ''}</div>
        </div>
        <button type="button" onClick={onLogout} style={ghost}>Sair</button>
      </div>

      {purpose === 'complementary_activities' && (
        <>
          {data.rule ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginBottom: 20 }}>
              <div style={stat}><div style={statLabel}>Exigido</div><div style={statValue}>{minutesToH(required)}</div></div>
              <div style={stat}><div style={statLabel}>Creditado</div><div style={{ ...statValue, color: '#059669' }}>{minutesToH(data.credited_minutes)}</div></div>
              <div style={stat}><div style={statLabel}>Restante</div><div style={{ ...statValue, color: remaining <= 0 ? '#059669' : '#b45309' }}>{remaining <= 0 ? 'Concluído' : minutesToH(remaining)}</div></div>
              <div style={stat}><div style={statLabel}>Em análise</div><div style={statValue}>{pending}</div></div>
            </div>
          ) : (
            <p role="status" style={{ ...box, background: '#eff6ff' }}>O regulamento do curso ainda não foi publicado. Você já pode enviar seus certificados — a validação será feita após a publicação do regulamento.</p>
          )}

          <SubmitActivity session={session} categories={data.categories} onDone={onChanged} />

          <h3 style={{ fontSize: '.9375rem', margin: '20px 0 8px' }}>Suas solicitações</h3>
          {data.submissions.length === 0 ? <p style={small}>Nenhuma atividade enviada ainda.</p> : data.submissions.map(s => (
            <div key={s.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '.8125rem' }}>{s.title}</strong>
                <div style={small}>{catLabel(s.category_id)} · {s.issuer || 'Emissor não informado'} · {minutesToH(s.documentary_minutes)} declaradas · {new Date(s.created_at).toLocaleDateString('pt-BR')}</div>
              </div>
              <span style={{ fontSize: '.75rem', padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', whiteSpace: 'nowrap' }}>{STATUS_LABEL[s.status] ?? s.status}</span>
            </div>
          ))}
          <p style={{ ...small, marginTop: 12 }}>As horas declaradas são conferidas pela coordenação conforme o regulamento. Só contam no saldo depois de creditadas.</p>
        </>
      )}

      {purpose === 'mandatory_internship' && (
        <>
          <h3 style={{ fontSize: '.9375rem', margin: '0 0 8px' }}>Estágio Obrigatório</h3>
          {data.placements.length === 0 ? <p style={small}>Nenhum estágio vinculado à sua matrícula.</p> : data.placements.map(p => (
            <div key={p.id} style={box}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontSize: '.8125rem' }}>Estágio</strong><span style={{ fontSize: '.75rem' }}>{p.lifecycle}</span></div>
              <div style={small}>{p.starts_at ? `Início ${new Date(p.starts_at).toLocaleDateString('pt-BR')}` : ''}{p.ends_at ? ` · Término ${new Date(p.ends_at).toLocaleDateString('pt-BR')}` : ''}{p.advisor_name ? ` · Orientação: ${p.advisor_name}` : ''}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function SubmitActivity({ session, categories, onDone }: { session: string; categories: Category[]; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [hours, setHours] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reset = () => { setTitle(''); setIssuer(''); setCategoryId(''); setHours(''); setStart(''); setEnd(''); setFile(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!file) { setMsg({ ok: false, text: 'Anexe o comprovante.' }); return; }
    setSaving(true);
    try {
      const up = await call<{ path: string; token: string }>({ action: 'upload_url', session, content_type: file.type, size: file.size });
      const { error: upErr } = await supabase.storage.from('vertice-documents').uploadToSignedUrl(up.path, up.token, file, { contentType: file.type });
      if (upErr) throw new Error('file_missing');
      await call({ action: 'submit', session, title: title.trim(), issuer: issuer.trim(), category_id: categoryId || null, hours: Number(hours.replace(',', '.')), start_date: start, end_date: end, path: up.path });
      reset();
      setOpen(false);
      setMsg({ ok: true, text: 'Atividade enviada. Ela aparece abaixo como "Enviada" até a análise da coordenação.' });
      await onDone();
    } catch (err) {
      setMsg({ ok: false, text: ERROR_LABEL[(err as Error).message] || 'Não foi possível enviar agora. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return (
    <div>
      {msg && <p role="status" style={{ fontSize: '.8125rem', color: msg.ok ? '#047857' : '#dc2626' }}>{msg.text}</p>}
      <button type="button" onClick={() => { setMsg(null); setOpen(true); }} style={{ ...primary, width: '100%' }}>+ Enviar nova atividade</button>
    </div>
  );

  const cat = categories.find(c => c.id === categoryId);
  return (
    <form onSubmit={submit} style={{ ...box, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <strong>Nova atividade complementar</strong>
      {categories.length > 0 ? (
        <>
          <label style={label}>Categoria
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={input}>
              <option value="">Selecione…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          {cat?.description && <p style={{ ...small, margin: 0 }}>{cat.description}</p>}
          {cat?.max_per_item_minutes ? <p style={{ ...small, margin: 0 }}>Limite por atividade nesta categoria: {minutesToH(cat.max_per_item_minutes)}.</p> : null}
        </>
      ) : (
        <p style={{ ...small, margin: 0, color: '#6b7280' }}>As categorias ainda não foram cadastradas. Envie o certificado e a coordenação classificará a atividade.</p>
      )}
      <label style={label}>Título da atividade
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required placeholder="Ex.: Congresso de Direito Constitucional" style={input} />
      </label>
      <label style={label}>Instituição emissora do certificado
        <input value={issuer} onChange={e => setIssuer(e.target.value)} maxLength={200} placeholder="Ex.: OAB/TO" style={input} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
        <label style={label}>Carga horária (horas)
          <input value={hours} onChange={e => setHours(e.target.value)} inputMode="decimal" required placeholder="Ex.: 8" style={input} />
        </label>
        <label style={label}>Início<input type="date" value={start} onChange={e => setStart(e.target.value)} style={input} /></label>
        <label style={label}>Término<input type="date" value={end} onChange={e => setEnd(e.target.value)} style={input} /></label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ ...label, marginBottom: 0 }}>Comprovante (PDF ou imagem, até 10 MB)</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: file ? '#ecfdf5' : '#eff6ff', border: file ? '2px solid #10b981' : '2px dashed #3b82f6', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: file ? '#047857' : '#2563eb', fontSize: '.875rem', transition: 'all .2s' }}>
          <span style={{ fontSize: '1.25rem' }}>{file ? '✅' : '📎'}</span>
          {file ? file.name : 'Clique aqui para anexar o certificado'}
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} required style={{ display: 'none' }} />
        </label>
      </div>
      {msg && !msg.ok && <p role="alert" style={{ color: '#dc2626', fontSize: '.8125rem', margin: 0 }}>{msg.text}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => { reset(); setOpen(false); }} style={ghost}>Cancelar</button>
        <button type="submit" disabled={saving} style={{ ...primary, opacity: saving ? .7 : 1 }}>{saving ? 'Enviando…' : 'Enviar atividade'}</button>
      </div>
    </form>
  );
}
