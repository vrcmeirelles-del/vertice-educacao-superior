import {lazy,Suspense,useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import Login from './Login';
const OwnerDashboard = lazy(() => import('../OwnerDashboard'));
type Address={institution_id:string;slug:string;display_name:string;tier:string;logo_url:string|null};
export default function InstitutionEntry({slug,section}:{slug:string;section?:string}){
 const [address,setAddress]=useState<Address|null>(null);
 const [state,setState]=useState<'loading'|'ready'|'missing'|'error'>('loading');
 useEffect(()=>{
  let live=true;setState('loading');setAddress(null);
  supabase.from('vertice_institution_addresses').select('institution_id,slug,display_name,tier,logo_url').eq('slug',slug).eq('active',true).maybeSingle().then(({data,error})=>{
   if(!live)return;
   if(error){setState('error');return;}
   setAddress(data);setState(data?'ready':'missing');
   if(data)document.title=`${data.display_name} | Vértice`;
  });
  return()=>{live=false;};
 },[slug]);
 if(state==='loading')return <main className="corp-container corp-section" role="status">Localizando instituição…</main>;
 if(!address)return <main className="corp-container corp-section"><h1>{state==='error'?'Não foi possível consultar este endereço.':'Endereço institucional indisponível.'}</h1><p>{state==='error'?'Tente novamente em instantes.':'Confira o endereço com a instituição.'}</p><a className="corp-button" href="/entrar">Acesso geral</a></main>;
 const path = '/' + slug + (section ? '/' + section : '');
 if (window.location.pathname !== path) {
  window.history.replaceState(null, '', path + window.location.search + window.location.hash);
 }
 return <><header className="corp-container corp-section" style={{paddingBottom:0}}>
  {address.logo_url?.startsWith('https://')&&<img src={address.logo_url} alt={`Logo ${address.display_name}`} style={{maxWidth:180,maxHeight:80,objectFit:'contain'}}/>}
  <p className="corp-eyebrow">{address.tier==='escolas'?'VÉRTICE ESCOLAS':'VÉRTICE EDUCAÇÃO SUPERIOR'}</p>
  <h1>{address.display_name}</h1><p>Bem-vindo ao portal da sua instituição. Entre com sua conta para acessar as áreas autorizadas.</p>
 </header><Suspense fallback={<p role="status">Verificando acesso…</p>}><OwnerDashboard institutionId={address.institution_id} institutionPath={path} login={<Login institutionPath={path}/>} /></Suspense></>;
}
