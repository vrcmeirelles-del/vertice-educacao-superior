import {lazy,Suspense,useEffect,useState} from 'react';
import {flushSync} from 'react-dom';
import {Link} from 'wouter';
import {supabase} from '@/lib/supabase';
import {LockKeyhole} from 'lucide-react';
import '../components/integracao/integracao.css';
const Central=lazy(()=>import('../components/integracao/central'));
export default function IntegracaoPage(){
 const [access,setAccess]=useState<'checking'|'denied'|'ready'>('checking');
 const [scope,setScope]=useState('');
 useEffect(()=>{
  let active=true,revision=0;const timers=new Set<ReturnType<typeof setTimeout>>();
  async function check(){const own=++revision;setAccess('checking');setScope('');try{
   const {data,error}=await supabase.auth.getUser();if(error||!data.user?.email_confirmed_at)throw Error();
   const userId=data.user.id;
   const assurance=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error||assurance.data?.currentLevel!=='aal2')throw Error();
   const admin=await supabase.from('vertice_admins').select('user_id').eq('user_id',userId).limit(1);
   if(admin.error||!admin.data?.some(row=>row.user_id===userId))throw Error();
   if(active&&own===revision){setScope(userId);setAccess('ready');}
  }catch{if(active&&own===revision){setScope('');setAccess('denied');}}}
  void check();
  const {data}=supabase.auth.onAuthStateChange(event=>{
   // Do not call Auth inside its callback lock; invalidate the view first.
   ++revision;setScope('');setAccess(event==='SIGNED_OUT'?'denied':'checking');
   if(event!=='SIGNED_OUT'){const timer=setTimeout(()=>{timers.delete(timer);if(active)void check();},0);timers.add(timer);}
  });
  const focus=()=>{void check();};
  const hide=()=>{++revision;flushSync(()=>{setScope('');setAccess('checking');});};
  const show=(event:PageTransitionEvent)=>{if(event.persisted)void check();};
  window.addEventListener('focus',focus);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
  return()=>{active=false;++revision;timers.forEach(clearTimeout);data.subscription.unsubscribe();window.removeEventListener('focus',focus);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);};
 },[]);
 if(access==='checking')return <main className="ix-app" style={{padding:'50px 24px'}} role="status"><h1>Verificando acesso à integração…</h1></main>;
 if(access!=='ready')return <main className="ix-app" style={{padding:'60px 24px',minHeight:'100vh'}}><section className="ix-panel" style={{maxWidth:760,margin:'auto'}}><LockKeyhole size={30}/><span className="ix-eyebrow">VÉRTICE · INTEGRAÇÃO FATO & ORDEM</span><h1 style={{fontSize:30,margin:'18px 0'}}>Acesso restrito ao Master</h1><p>Entre com sua conta Vértice, confirme o segundo fator e utilize uma conta autorizada como Master. Se a verificação estiver indisponível, o painel permanece fechado.</p><div className="ix-reference-links"><Link href="/entrar?destino=integracao" className="ix-button dark">Entrar ou confirmar segundo fator</Link><Link href="/master" className="ix-button secondary">Voltar ao Master</Link></div><p className="ix-note">Nenhum dado acadêmico real é exibido nesta área de acompanhamento.</p></section></main>;
 return <Suspense fallback={<main role="status">Abrindo acompanhamento da integração…</main>}><Central key={scope} storageScope={scope}/></Suspense>;
}
