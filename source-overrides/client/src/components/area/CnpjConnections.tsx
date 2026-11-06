import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import "./cnpj-connections.css";
type Mandato={id:string;code:string;target:string;relation:string};
type Context={institution:string;cnpj:string;matters:Mandato[];notice:string};
export default function CnpjConnections({institutionId}:{institutionId:string}){
 const [result,setResult]=useState<Context|null>(null),[error,setError]=useState("");
 useEffect(()=>{let alive=true;setResult(null);setError("");
  void supabase.rpc("vertice_cnpj_academic_context",{p_institution:institutionId}).then(({data,error})=>{
   if(!alive)return;if(error){setError("Vinculação por CNPJ indisponível para este perfil.");return;}
   setResult(data as Context);
  });return()=>{alive=false;};},[institutionId]);
 return <section className="vx-cnpj-connect" aria-label="Vínculos autorizados por CNPJ">
   <div><small>CADASTRO COMPARTILHADO · CNPJ</small><h3>Acadêmico e Aquisições / Incorporações</h3>
    <p>Os vínculos abaixo são filtrados por permissões. Compartilhamento de identificação institucional, sem abrir dados reservados de mandatos.</p>
   </div>
   {error?<p role="status">{error}</p>:!result?<p role="status">Conferindo vínculos autorizados…</p>:<>
    <p><b>{result.institution}</b> · CNPJ {result.cnpj||"Não informado"}</p>
    {!result.matters.length?<p>Nenhum mandato visível com instituição contratante ou raiz de CNPJ correspondente.</p>:
     <ul>{result.matters.map(m=><li key={m.id}>
      <span><b>{m.code}</b> · {m.target} · {m.relation==="raiz_do_alvo"?"Possível correspondência do alvo por raiz de CNPJ":"Instituição contratante — não confundir com o alvo"}</span>
      <a href={"/master/aquisicoes#"+new URLSearchParams({mandato:m.id,aba:"summary"})}>Abrir mandato autorizado ↗</a>
     </li>)}</ul>}
    <small>{result.notice}</small>
   </>}
 </section>;
}
