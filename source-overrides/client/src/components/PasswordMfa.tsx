import { HelpLabel } from '@/components/ContextHelp';
import {useState} from 'react';
import {supabase} from '@/lib/supabase';
import {passwordMfaFactor} from '@/lib/passwordMfa';

export function usePasswordMfa(){
 const [factorId,setFactorId]=useState<string|null>(null);
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function check(){const id=await passwordMfaFactor(supabase.auth);setFactorId(id);return Boolean(id);}
 async function verify(){
  if(!factorId)return;
  if(!/^\d{6}$/.test(code)){setMessage('Informe os seis dígitos do aplicativo autenticador.');return;}
  setBusy(true);setMessage('');
  try{
   const {error}=await supabase.auth.mfa.challengeAndVerify({factorId,code});
   if(error)throw error;
   setFactorId(null);setCode('');setMessage('Segundo fator confirmado. Agora salve a nova senha.');
  }catch{setMessage('Código não validado. Confira o aplicativo autenticador e tente novamente.');}
  finally{setBusy(false);}
 }
 return {factorId,code,setCode,busy,message,check,verify};
}

export default function PasswordMfa({flow}:{flow:ReturnType<typeof usePasswordMfa>}){
 return <>{flow.factorId&&<fieldset><legend>Confirme sua identidade</legend><p>Sua conta usa autenticação em dois fatores. Digite o código do aplicativo autenticador para autorizar a troca de senha.</p><HelpLabel>Código do autenticador<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={flow.code} onChange={e=>flow.setCode(e.target.value.replace(/\D/g,''))}/></HelpLabel><button className="corp-button" type="button" disabled={flow.busy} onClick={flow.verify}>{flow.busy?'Validando…':'Validar segundo fator'}</button></fieldset>}{flow.message&&<p role="status">{flow.message}</p>}</>;
}
