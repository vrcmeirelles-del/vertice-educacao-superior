import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import ResetPassword from './ResetPassword';

export default function Login() {
  const dashboard = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("destino") === "reitor" ? "/reitor/reservado" : "/master";
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [factor, setFactor] = useState('');
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({data, error}) => {
      if (!active) return;
      if (error || !data.user) {setSession(null); setChecking(false); return;}
      const {data: current} = await supabase.auth.getSession();
      if(active) {setSession(current.session); setChecking(false);}
    }).catch(() => {if(active) {setSession(null);setChecking(false);}});
    const {data} = supabase.auth.onAuthStateChange((_event, current) => {if(active) {setSession(current); if(_event === 'PASSWORD_RECOVERY') setResetting(true);}});
    return () => {active = false; data.subscription.unsubscribe();};
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (factor) {
        const {error} = await supabase.auth.mfa.challengeAndVerify({factorId: factor, code});
        if(error) throw error;
        setFactor(''); setCode(''); setMessage('Segundo fator confirmado. Você pode abrir seu painel.');
      } else if(recovery) {
        const {error} = await supabase.auth.resetPasswordForEmail(email.trim(), {redirectTo: 'https://www.verticesuperior.com.br/redefinir-senha'});
        if(error) throw error;
        setMessage('Se houver uma conta habilitada para este e-mail, você receberá as instruções de recuperação.');
      } else {
        const {error} = await supabase.auth.signInWithPassword({email: email.trim(), password});
        setPassword(''); if(error) throw error;
        const {data, error: mfaError} = await supabase.auth.mfa.listFactors();
        if(mfaError) throw mfaError;
        if(data.totp[0]) setFactor(data.totp[0].id);
      }
    } catch(error) {
      setMessage(recovery ? 'Não foi possível solicitar a recuperação. Tente novamente mais tarde.' : factor ? 'Código não validado. Confira o aplicativo autenticador.' : 'E-mail ou senha não validados. Tente novamente ou use Esqueci minha senha.');
    }
    finally {setBusy(false);}
  }
  if (resetting) return <ResetPassword />;
  return <section className="corp-section corp-login-section"><div className="corp-container corp-login-grid">
    <div className="corp-login-intro"><span className="corp-eyebrow">ÁREA RESTRITA</span><h1>Seu espaço<br/>de gestão.</h1><p>Acesse as instituições autorizadas para sua conta.</p><div className="corp-login-trust"><ShieldCheck size={24}/><p>A autenticação é feita pelo Supabase. O acesso aos dados depende das permissões da conta.</p></div><Link href="/demonstracao">Conhecer a demonstração</Link></div>
    <div className="corp-login-card"><LockKeyhole size={30}/><h2>{resetting ? 'Definir nova senha' : factor ? 'Confirme seu acesso' : recovery ? 'Recuperar acesso' : 'Entrar no Vértice'}</h2>
    {checking ? <p role="status">Verificando sessão…</p> : session && !factor && !resetting ? <><p>Conectado como <strong>{session.user.email}</strong>.</p><Link className="corp-button" href={dashboard}>Abrir minha área</Link><button className="corp-login-text-button" onClick={()=>{setMessage('');setResetting(true);setPassword('');}}>Definir ou alterar minha senha</button><button className="corp-login-text-button" onClick={async()=>{const {error}=await supabase.auth.signOut(); setMessage(error?'Não foi possível sair. Tente novamente.':'Sessão encerrada.');}}>Sair</button></> : <form onSubmit={submit} className="access-form">
    {factor ? <label>Código do autenticador<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label> : <>
    <label>E-mail<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
    {!recovery && <label>Senha<input type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
    <p><Link href="/privacidade.html">Política de Privacidade e Proteção de Dados</Link></p>
    {!recovery && <label className="access-check"><input type="checkbox" checked={privacyRead} onChange={e=>setPrivacyRead(e.target.checked)}/>Li o aviso de privacidade. Esta ciência não autoriza publicidade.</label>}
    </>}
    <button className="corp-button corp-login-submit" disabled={busy || (!factor && !recovery && !privacyRead)}>{busy?'Aguarde…':resetting?'Salvar nova senha':factor?'Validar código':recovery?'Enviar instruções':'Entrar'}</button>
    {!factor && !resetting && <button className="corp-login-text-button" type="button" onClick={()=>{setRecovery(!recovery);setMessage('');}}>{recovery?'Voltar ao login':'Esqueci minha senha'}</button>}
    </form>}
    {message && <p role="status">{message}</p>}
    <p className="corp-login-privacy">Acesso por convite. Cadastros públicos permanecem fechados durante a organização do serviço. A sessão é armazenada nesta aba. Use Sair ao concluir, especialmente em computadores compartilhados.</p>
    <Link href="/privacidade.html">Privacidade e uso dos dados</Link>
    </div></div></section>;
}
