import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ExtensaoConvite() {
  const params = new URLSearchParams(window.location.search);
  const conviteId = params.get('convite') || '';
  const [status, setStatus] = useState<'loading' | 'presenting' | 'logging-in' | 'done' | 'error'>('loading');
  const [msg, setMsg] = useState('Verificando convite...');
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    if (!conviteId) { setStatus('presenting'); setMsg(''); return; }
    // Buscar email do convite e logar automaticamente
    (async () => {
      try {
        // Buscar o email do convite via RPC pública
        const { data: email } = await supabase.rpc('vertice_invite_lookup', { p_invite_id: conviteId });

        if (!email) {
          setStatus('presenting');
          setMsg('Convite não encontrado. Faça login manualmente.');
          return;
        }

        setInviteEmail(email);
        setMsg(`Entrando como ${email}...`);
        setStatus('logging-in');

        // Login automático com senha padrão
        const { error } = await supabase.auth.signInWithPassword({
          email: email,
          password: '123456'
        });

        if (error) {
          setStatus('presenting');
          setMsg(`Não foi possível entrar automaticamente para ${email}. Informe seu e-mail abaixo.`);
          return;
        }

        setStatus('done');
        setMsg('✅ Acesso liberado! Entrando na plataforma...');
        setTimeout(() => { window.location.href = '/master#instituicao=1f5fd5b4-93c6-4626-834d-136884915587'; }, 1200);
      } catch {
        setStatus('presenting');
        setMsg('Erro ao processar convite. Tente fazer login manualmente.');
      }
    })();
  }, [conviteId]);

  // Fallback manual login
  const [manualEmail, setManualEmail] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  async function manualLogin(e: React.FormEvent) {
    e.preventDefault();
    setManualBusy(true); setMsg('');
    try {
      const mail = manualEmail.trim().toLowerCase();
      // Tentar login direto
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password: '123456' });
      if (error) {
        // Se falhar, tentar criar via edge function e logar de novo
        await supabase.functions.invoke('vertice-convite-simples', {
          body: { email: mail, institution_id: '1f5fd5b4-93c6-4626-834d-136884915587', role: 'equipe' }
        }).catch(() => {});
        const { error: e2 } = await supabase.auth.signInWithPassword({ email: mail, password: '123456' });
        if (e2) throw e2;
      }
      setStatus('done');
      setMsg('✅ Acesso liberado! Entrando...');
      setTimeout(() => { window.location.href = '/master'; }, 1200);
    } catch (err) {
      setMsg(`Não foi possível acessar. Peça ao coordenador para enviar um novo convite.`);
    } finally { setManualBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfeff 50%, #f0f9ff 100%)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, background: '#0f766e', borderRadius: 10, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 18 }}>V</div>
        <div><strong style={{ fontSize: 15, color: '#0f172a' }}>Vértice Educação Superior</strong><br /><span style={{ fontSize: 11, color: '#64748b' }}>Plataforma de Gestão Acadêmica</span></div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #0f766e 60%, #0d9488 100%)', borderRadius: 20, padding: '36px 32px', color: '#fff', marginBottom: 28, boxShadow: '0 12px 32px rgba(15,118,110,.2)' }}>
          <span style={{ fontSize: 11, letterSpacing: '.1em', color: '#a7f3d0', fontWeight: 700 }}>CONVITE PARA EXTENSÃO UNIVERSITÁRIA</span>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 34px)', margin: '12px 0', fontWeight: 800, lineHeight: 1.2 }}>🤝 Bem-vindo à Extensão 360°</h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#d1fae5', maxWidth: 600 }}>
            Você foi convidado(a) para participar da plataforma de gestão de extensão universitária da sua instituição.
          </p>
        </div>

        {/* Status de login automático */}
        {(status === 'loading' || status === 'logging-in' || status === 'done') && (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 16, border: status === 'done' ? '2px solid #10b981' : '1px solid #e2e8f0', marginBottom: 24 }}>
            {status === 'done' ? (
              <p style={{ fontSize: 20, color: '#059669', fontWeight: 700 }}>{msg}</p>
            ) : (
              <>
                <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                <p style={{ fontSize: 15, color: '#334155' }}>{msg}</p>
              </>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Cards de apresentação */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { icon: '📋', title: 'Cadastre seus projetos', desc: 'Registre projetos de extensão com objetivos, ODS, eixos temáticos, carga horária e vínculos com cursos.' },
            { icon: '👥', title: 'Gerencie a equipe', desc: 'Adicione docentes, discentes e membros da comunidade. Controle participação e horas de cada envolvido.' },
            { icon: '📊', title: 'Acompanhe entregas', desc: 'Registre atividades, entregas, evidências e o progresso de cada projeto com linha do tempo.' },
            { icon: '📁', title: 'Dossiê regulatório', desc: 'Gere automaticamente evidências para o MEC/INEP: cobertura por curso, horas, ODS e conformidade com DCNs.' },
            { icon: '🎯', title: 'Competências e ODS', desc: 'Vincule projetos aos ODS da ONU e às competências do PPC. Avalie o desenvolvimento dos participantes.' },
            { icon: '✅', title: 'Revisão e governança', desc: 'Fluxo de aprovação em etapas: coordenação → acompanhamento → regulação. Tudo rastreável.' },
          ].map(item => (
            <div key={item.title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 18px', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
              <span style={{ fontSize: 28 }}>{item.icon}</span>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '10px 0 6px', color: '#0f172a' }}>{item.title}</h3>
              <p style={{ fontSize: 12, lineHeight: 1.6, color: '#64748b', margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Como funciona */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '24px 28px', marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>🚀 Como funciona</h2>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 10 }}>
            {[
              'Seu acesso é automático pelo link que você recebeu.',
              'Ao entrar, você terá acesso à área de Extensão 360° da sua instituição.',
              'Cadastre seus projetos de extensão: título, objetivos, eixo temático e carga horária.',
              'Adicione os participantes (alunos, comunidade) e registre as atividades.',
              'Envie evidências (fotos, relatórios, listas de presença) para cada projeto.',
              'Acompanhe o andamento, horas cumpridas e o status de revisão.',
            ].map((step, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: '#334155' }}>{step}</li>
            ))}
          </ol>
        </div>

        {/* Login manual (fallback) */}
        {status === 'presenting' && (
          <div style={{ background: '#fff', border: '2px solid #10b981', borderRadius: 16, padding: '28px', maxWidth: 420, margin: '0 auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#065f46', textAlign: 'center' }}>🔐 Entrar na plataforma</h2>
            <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', margin: '0 0 16px' }}>Informe o e-mail cadastrado pelo coordenador</p>
            {msg && <p style={{ fontSize: 12, color: '#dc2626', textAlign: 'center', margin: '0 0 12px', background: '#fef2f2', padding: 10, borderRadius: 8 }}>{msg}</p>}
            <form onSubmit={manualLogin} style={{ display: 'grid', gap: 12 }}>
              <input type="email" required value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="seu@email.com"
                style={{ padding: '11px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              <button type="submit" disabled={manualBusy}
                style={{ padding: '12px', background: '#059669', color: '#fff', border: 0, borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                {manualBusy ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 28 }}>
          Vértice Educação Superior · <a href="/" style={{ color: '#0f766e' }}>verticesuperior.com.br</a>
        </p>
      </main>
    </div>
  );
}
