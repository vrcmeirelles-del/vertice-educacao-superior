import { HelpLabel } from '@/components/ContextHelp';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { LockKeyhole } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PasswordMfa, {usePasswordMfa} from '@/components/PasswordMfa';
import {passwordChangeError} from '@/lib/passwordMfa';

export default function ResetPassword() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mfa=usePasswordMfa();
  const [email,setEmail]=useState('');
  const [account,setAccount]=useState('');
  const [sent,setSent]=useState(false);
  const [visible,setVisible]=useState(false);
  useEffect(() => {
    let active = true;
    async function validate() {
      try {
        const {data,error}=await supabase.auth.getUser();
        if (!active) return;
        if(error || !data.user) {setStatus('invalid');return;}
        setAccount(data.user.email || '');
        // Resolve MFA before requesting a new password, never bypass an enrolled factor.
        await mfa.check();
        if(active)setStatus('ready');
      } catch {if(active){setStatus('invalid');}}
    }
    void validate();
    const {data:sub}=supabase.auth.onAuthStateChange((event,current)=>{
      if(event==='SIGNED_OUT' && active)setStatus('invalid');
      if(event==='PASSWORD_RECOVERY' && current)void validate();
    });
    return () => {active=false;sub.subscription.unsubscribe();};
  }, []);
  async function requestLink(event:FormEvent) {
    event.preventDefault();setBusy(true);setMessage('');
    try {
      const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:'https://www.verticesuperior.com.br/redefinir-senha'});
      if(error)throw error;
      setSent(true);
    }catch(error){
      setMessage((error as {status?:number}).status===429?'Muitas solicitações. Aguarde alguns minutos e tente novamente.':'Não foi possível enviar o link. Tente novamente em instantes.');
    }finally{setBusy(false);}
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 12) { setMessage('A senha precisa ter pelo menos 12 caracteres.'); return; }
    if (password !== confirmation) { setMessage('As senhas não coincidem.'); return; }
    setBusy(true); setMessage('');
    try{
    if(await mfa.check())return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { if(error.code==='insufficient_aal'||error.message.toLowerCase().includes('aal2'))await mfa.check(); setMessage(passwordChangeError(error)); return; }
    setPassword(''); setConfirmation('');
    setStatus('done');
    }catch(error){setMessage(passwordChangeError(error as {code?:string;message?:string;status?:number}));}
    finally{setBusy(false);}
  }
  return <section className="corp-section corp-login-section"><div className="corp-container corp-login-grid">
    <div className="corp-login-intro"><span className="corp-eyebrow">ÁREA RESTRITA</span><h1>Defina sua senha.</h1><p>Crie ou altere sua senha em uma única página. Se não estiver conectado, solicite o link pelo seu e-mail.</p></div>
    <div className="corp-login-card"><LockKeyhole size={30}/><h2>Definir nova senha</h2>
      {status === 'checking' && <p role="status">Verificando seu acesso…</p>}
      {status === 'invalid' && <>
        <p>Para definir a senha, confirme seu acesso pelo e-mail. Links expirados ou já utilizados precisam ser substituídos.</p>
        {sent ? <p role="status">Se este e-mail tiver uma conta, as instruções serão enviadas. Abra o e-mail mais recente e clique no link para definir a senha.</p> : <form className="access-form" onSubmit={requestLink}>
          <HelpLabel>E-mail da sua conta<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></HelpLabel>
          <button className="corp-button" disabled={busy}>{busy?'Enviando…':'Receber link para definir senha'}</button>
        </form>}
        {message && <p role="alert">{message}</p>}
        <Link href="/entrar">Voltar para entrar</Link>
      </>}
      {status === 'done' && <><p role="status">Senha atualizada. Use sua nova senha nos próximos acessos.</p><a href="/entrar" className="corp-button">Ir para o acesso</a></>}
      {status === 'ready' && <p>Você está definindo a senha de <strong>{account}</strong>.</p>}
      {status === 'ready' && <form className="access-form" onSubmit={submit}>
        <PasswordMfa flow={mfa}/>
        {!mfa.factorId && <fieldset disabled={busy}><legend>Escolha sua nova senha</legend>
        <HelpLabel>Nova senha<input type={visible?"text":"password"} autoComplete="new-password" minLength={12} maxLength={256} required value={password} onChange={e => setPassword(e.target.value)}/></HelpLabel>
        <HelpLabel>Confirme a nova senha<input type={visible?"text":"password"} autoComplete="new-password" minLength={12} maxLength={256} required value={confirmation} onChange={e => setConfirmation(e.target.value)}/></HelpLabel>
        <button type="button" className="corp-login-text-button" onClick={()=>setVisible(!visible)}>{visible?'Ocultar senha':'Mostrar senha'}</button>
        <p>Use pelo menos 12 caracteres.</p><button className="corp-button corp-login-submit" disabled={busy||Boolean(mfa.factorId)}>{busy ? 'Validando…' : 'Salvar nova senha'}</button></fieldset>}
        {message && <p role="alert">{message}</p>}
        <a href="/entrar">Voltar para entrar</a>
      </form>}
    </div></div></section>;
}
