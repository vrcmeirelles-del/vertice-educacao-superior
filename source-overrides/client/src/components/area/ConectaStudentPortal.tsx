import {useEffect,useRef,useState,type FormEvent} from 'react';
import {supabase} from '@/lib/supabase';
import {HelpLabel} from '@/components/ContextHelp';
import {ConectaProfile} from './Conecta360';
import type {Detail} from '@/lib/conecta';
import './conecta360.css';
const storageKey='vx-conecta-session';
async function call<T>(body:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.functions.invoke('vertice-student-portal',{body:{...body,module:'conecta'}});
 if(error)throw new Error('Não foi possível concluir. Confira sua sessão e os dados informados; tente atualizar o acesso.');return data as T;
}
export default function ConectaStudentPortal({institutionId,institutionName,token}:{institutionId:string;institutionName:string;token:string|null}){
 const [session,setSession]=useState<string|null>(null),[detail,setDetail]=useState<Detail|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const dirty=useRef(false),redemption=useRef<{token:string;promise:Promise<{session:string;expires_at:string}>}|null>(null);
 useEffect(()=>{let active=true;setLoading(true);setDetail(null);setSession(null);setError('');
 (async()=>{let saved:{key:string;ies:string;expires:string}|null=null;
 if(token){if(redemption.current?.token!==token)redemption.current={token,promise:call({action:'redeem',token})};window.history.replaceState(null,'','/acesso-estudante?ies='+encodeURIComponent(institutionId)+'&mod=conecta');const r=await redemption.current.promise;saved={key:r.session,ies:institutionId,expires:r.expires_at};sessionStorage.setItem(storageKey,JSON.stringify(saved));}
 else{try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{}}
 if(!saved||saved.ies!==institutionId||Date.parse(saved.expires)<=Date.now())return;
 const r=await call<{data:Detail}>({action:'conecta',session:saved.key,operation:'detail'});if(active){setSession(saved.key);setDetail(r.data);}
 })().catch(e=>{if(active){setError(e.message);sessionStorage.removeItem(storageKey);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[institutionId,token]);
 useEffect(()=>{const leave=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[]);
 const requestLink=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);setError('');try{const r=await call<{message:string}>({action:'request',institution_id:institutionId,...values});setNotice(r.message);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const mutate=async(operation:string,payload:Record<string,unknown>)=>{if(!session)return;setBusy(true);setError('');setNotice('');try{const r=await call<{data:Detail}>({action:'conecta',session,operation,payload});dirty.current=false;setDetail(r.data);setNotice('Informações salvas.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <main className="conecta360" style={{maxWidth:1000,padding:20,margin:'24px auto'}}><header className="conecta-hero"><div><small>{institutionName}</small><h1>Meu Conecta 360°</h1><p>Carreira, currículo, oportunidades e relacionamento com sua instituição.</p></div>{session&&<button disabled={busy} onClick={async()=>{if(dirty.current&&!window.confirm('Descartar alterações não salvas?'))return;await call({action:'logout',session}).catch(()=>null);dirty.current=false;sessionStorage.removeItem(storageKey);setSession(null);setDetail(null);}}>Sair</button>}</header>{error&&<p role="alert" className="conecta-error">{error}</p>}{notice&&<p role="status" className="conecta-success">{notice}</p>}{loading&&<p role="status">Validando seu acesso…</p>}
 {!loading&&!session&&<form className="conecta-card" onSubmit={requestLink}><h2>Acessar meu perfil</h2><p>Use os dados cadastrados na instituição. O link pessoal é de uso único e expira em 30 minutos.</p><div className="conecta-fields"><HelpLabel help="Matrícula informada pela instituição, inclusive para egressos já registrados na base nominal.">Matrícula — obrigatório<input name="enrollment_code" required maxLength={40} autoComplete="off"/></HelpLabel><HelpLabel help="CPF usado para conferir o vínculo. Ele não aparecerá no currículo ou portfólio.">CPF — obrigatório<input name="cpf" required maxLength={20} autoComplete="off" inputMode="numeric"/></HelpLabel><HelpLabel help="E-mail já cadastrado na instituição. O link é enviado somente após conferir os dados.">E-mail cadastrado — obrigatório<input type="email" name="email" required maxLength={254}/></HelpLabel></div><button disabled={busy}>{busy?'Solicitando…':'Receber link de acesso'}</button></form>}
 {session&&detail&&<ConectaProfile key={detail.profile.id+':'+detail.profile.version} self detail={detail} busy={busy} mutate={mutate} onDirty={()=>{dirty.current=true;}}/>}</main>;
}
