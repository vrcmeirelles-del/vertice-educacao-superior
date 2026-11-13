import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ExtensaoConvite() {
  const params = new URLSearchParams(window.location.search);
  const conviteId = params.get('convite') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123456');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      if (conviteId) try { localStorage.setItem('vertice_pending_invite', conviteId); } catch {}
      setDone(true);
      setMsg('✅ Login realizado! Redirecionando...');
      setTimeout(() => { window.location.href = '/master'; }, 1500);
    } catch (err) {
      setMsg((err as Error).message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos. Se é seu primeiro acesso, use a senha 123456.'
        : `Erro: ${(err as Error).message}`);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfeff 50%, #f0f9ff 100%)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, background: '#0f766e', borderRadius: 10, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 18 }}>V</div>
        <div><strong style={{ fontSize: 15, color: '#0f172a' }}>Vértice Educação Superior</strong><br /><span style={{ fontSize: 11, color: '#64748b' }}>Plataforma de Gestão Acadêmica</span></div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #0f766e 60%, #0d9488 100%)', borderRadius: 20, padding: '36px 32px', color: '#fff', marginBottom: 28, boxShadow: '0 12px 32px rgba(15,118,110,.2)' }}>
          <span style={{ fontSize: 11, letterSpacing: '.1em', color: '#a7f3d0', fontWeight: 700 }}>CONVITE PARA EXTENSÃO UNIVERSITÁRIA</span>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 34px)', margin: '12px 0', fontWeight: 800, lineHeight: 1.2 }}>
            🤝 Bem-vindo à Extensão 360°
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#d1fae5', maxWidth: 600 }}>
            Você foi convidado(a) para participar da plataforma de gestão de extensão universitária da sua instituição.
          </p>
        </div>

        {/* O que é */}
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
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '24px 28px', marginBottom: 28, boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>🚀 Como funciona</h2>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 12 }}>
            {[
              'Faça login com o e-mail informado ao coordenador e a senha padrão (123456).',
              'Ao entrar, você já terá acesso à área de Extensão 360° da sua instituição.',
              'Cadastre seus projetos de extensão: título, objetivos, eixo temático, cursos envolvidos e carga horária.',
              'Adicione os participantes (alunos, comunidade) e registre as atividades realizadas.',
              'Envie evidências (fotos, relatórios, listas de presença) para cada projeto.',
              'Acompanhe o andamento, horas cumpridas e o status de revisão do seu projeto.',
              'Recomendamos alterar sua senha após o primeiro acesso em Minha Conta.',
            ].map((step, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: '#334155' }}>
                <strong style={{ color: '#0f766e' }}>{step.split('.')[0]}.</strong>
                {step.includes('.') ? step.slice(step.indexOf('.') + 1) : ''}
              </li>
            ))}
          </ol>
        </div>

        {/* Login */}
        <div style={{ background: '#fff', border: '2px solid #10b981', borderRadius: 16, padding: '28px', maxWidth: 420, margin: '0 auto', boxShadow: '0 8px 24px rgba(16,185,129,.12)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#065f46', textAlign: 'center' }}>🔐 Acesse a plataforma</h2>
          <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', margin: '0 0 18px' }}>Use o e-mail informado ao coordenador · senha padrão: <strong>123456</strong></p>
          {done ? (
            <p style={{ textAlign: 'center', fontSize: 15, color: '#059669', fontWeight: 700 }}>{msg}</p>
          ) : (
            <form onSubmit={login} style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                E-mail
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Senha
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              </label>
              <button type="submit" disabled={busy}
                style={{ padding: '12px', background: '#059669', color: '#fff', border: 0, borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                {busy ? 'Entrando…' : 'Entrar na Extensão 360°'}
              </button>
              {msg && <p style={{ fontSize: 12, color: msg.startsWith('✅') ? '#059669' : '#dc2626', textAlign: 'center', margin: 0 }}>{msg}</p>}
            </form>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 28 }}>
          Vértice Educação Superior · Plataforma de gestão acadêmica integrada · <a href="/" style={{ color: '#0f766e' }}>verticesuperior.com.br</a>
        </p>
      </main>
    </div>
  );
}
