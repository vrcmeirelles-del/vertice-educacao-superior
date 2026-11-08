import {useEffect,useState} from "react";
import {syncInstitutionDirectory} from "@/lib/institution-directory";
export default function InstitutionDirectoryNotice(){
 const [result,setResult]=useState<{institutionId:string;ok:boolean}|null>(null);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const onResult=(event:Event)=>setResult((event as CustomEvent).detail);
  window.addEventListener("vertice:institution-directory",onResult);
  return()=>window.removeEventListener("vertice:institution-directory",onResult);
 },[]);
 if(!result)return null;
 return <aside role="status" className="corp-container" style={{padding:16,border:"1px solid #789",borderRadius:12,marginTop:12}}>
  <strong>{result.ok?"Cadastro sincronizado com o Fato & Ordem.":"IES salva na Vértice. Sincronização com o Fato & Ordem pendente."}</strong>
  {!result.ok&&<p>Confira nome, município e UF no cadastro. Se os campos estão preenchidos, tente novamente.</p>}
  {!result.ok&&<button className="corp-button small" disabled={busy} onClick={async()=>{setBusy(true);try{await syncInstitutionDirectory(result.institutionId);}finally{setBusy(false);}}}>{busy?"Sincronizando…":"Tentar sincronizar"}</button>}
  <button className="corp-login-text-button" onClick={()=>setResult(null)}>Fechar</button>
 </aside>;
}
