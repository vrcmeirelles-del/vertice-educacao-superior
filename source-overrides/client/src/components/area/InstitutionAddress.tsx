import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
export default function InstitutionAddress({institutionId,manage}:{institutionId:string;manage:boolean}){
 const [slug,setSlug]=useState(''),[saved,setSaved]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;setSlug('');setSaved('');setMessage('');supabase.from('vertice_institution_addresses').select('slug').eq('institution_id',institutionId).maybeSingle().then(({data,error})=>{if(live){setSlug(data?.slug||'');setSaved(data?.slug||'');if(error)setMessage('Não foi possível consultar o endereço.');}});return()=>{live=false;};},[institutionId]);
 const url=saved?`${window.location.origin}/${saved}`:'';
 async function save(){setBusy(true);setMessage('');try{const {data,error}=await supabase.rpc('vertice_set_institution_address',{target:institutionId,new_slug:slug});if(error)throw error;setSaved(String(data));setMessage('Endereço atualizado. Compartilhe o novo link.');}catch{setMessage('Não foi possível salvar. Use 2 a 80 letras minúsculas, números e hífens, sem repetir um endereço existente ou reservado.');}finally{setBusy(false);}}
 return <section className="area-panel"><h2>Endereço da instituição</h2><p>Entrada exclusiva para IES e escolas. O login mantém as permissões de cada pessoa.</p>
  {url&&<p><a href={url} target="_blank" rel="noopener noreferrer">{url}</a> <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setMessage('Endereço copiado.');}catch{setMessage('Selecione e copie o endereço acima.');}}}>Copiar endereço</button></p>}
  {manage&&saved&&<div><label>Nome no endereço<input value={slug} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={e=>setSlug(e.target.value)} /></label><p>Alterar este nome substitui o endereço anterior.</p><button type="button" className="corp-button" disabled={busy||slug===saved} onClick={save}>{busy?'Salvando…':'Salvar endereço'}</button></div>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
