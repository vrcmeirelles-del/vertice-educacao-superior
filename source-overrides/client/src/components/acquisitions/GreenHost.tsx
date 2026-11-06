import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
export default function GreenHost(){
 const frame=useRef<HTMLIFrameElement>(null),[error,setError]=useState('');
 useEffect(()=>{
  let alive=true,refreshing:Promise<any>|null=null;
  const send=async(refresh=false)=>{try{
   const current=refresh?await(refreshing??=(supabase.auth.refreshSession().finally(()=>{refreshing=null;}))):await supabase.auth.getSession();
   const {data:assurance,error:aError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
   if(aError||!current.data.session||assurance.currentLevel!=='aal2')throw new Error('Entre e valide o segundo fator no painel master.');
   if(alive)frame.current?.contentWindow?.postMessage({type:'green-session',session:current.data.session},location.origin);
  }catch(e){if(alive)setError((e as Error).message);}};
  const receive=(e:MessageEvent)=>{if(e.origin!==location.origin||e.source!==frame.current?.contentWindow)return;
   if(e.data?.type==='green-location'&&typeof e.data.hash==='string'){const p=new URLSearchParams(e.data.hash),m=p.get('mandato'),t=p.get('aba');if(e.data.hash===''||(m&&/^[a-f0-9-]{36}$/i.test(m)&&['summary','base','emec','requirements','scope','review','ebitda','valuation','opinion','findings','documents','agent','members'].includes(t||'')))history.replaceState(null,'',location.pathname+location.search+(e.data.hash?'#'+p.toString():''));}
   if(e.data?.type==='green-request-session')void send();
   if(e.data?.type==='green-refresh-session')void send(true);
   if(e.data?.type==='green-logout')void supabase.auth.signOut().then(()=>location.assign('/entrar'));
  };
  window.addEventListener('message',receive);
  const loaded=()=>{void send();};const child=frame.current;child?.addEventListener('load',loaded);
  const {data}=supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.assign('/entrar');if(event==='TOKEN_REFRESHED')void send();});
  return()=>{alive=false;window.removeEventListener('message',receive);child?.removeEventListener('load',loaded);data.subscription.unsubscribe();};
 },[]);
 return <>{error&&<p role="alert" style={{padding:20}}>{error} <a href="/master">Voltar ao master</a></p>}<iframe ref={frame} title="Vértice Aquisições — modelo aprovado" src={'/aquisicoes-app/index.html?v=20261106-cnpj-sugestoes-v2'+location.hash} style={{display:'block',width:'100%',height:'100dvh',border:0,background:'#f6f7f3'}} allow="clipboard-write"/></>;
}
