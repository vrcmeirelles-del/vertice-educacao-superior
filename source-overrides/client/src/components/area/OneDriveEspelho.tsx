import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";

type Resumo={instituicao:string;ok:number;sem_mudanca:number;vazio:number;muito_grande:number;erro:number;erros:{tabela:string;erro:string}[]};
const ERROS:Record<string,string>={
  invalid_request:"Esta instituição ainda não tem pasta configurada no OneDrive.",
  access_denied:"Seu perfil não tem permissão para sincronizar esta instituição.",
  authentication_required:"Sessão expirada. Entre novamente.",
  onedrive_credentials_unavailable:"Credencial do OneDrive indisponível.",
  onedrive_auth_failed:"Falha na autenticação com o OneDrive."
};

export default function OneDriveEspelho({institutionId,institutionName}:{institutionId:string;institutionName:string}){
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");
  const [resumo,setResumo]=useState<Resumo|null>(null);
  const [ultima,setUltima]=useState<string|null>(null);
  const [docs,setDocs]=useState<{ok:number;erro:number;restantes:number|null}|null>(null);

  const carregarUltima=async()=>{
    const {data}=await supabase.from("vertice_onedrive_espelho").select("created_at,status")
      .eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(1);
    setUltima(data?.[0]?.created_at??null);
  };
  useEffect(()=>{setResumo(null);setDocs(null);setMsg("");carregarUltima();},[institutionId]);

  const sincronizar=async()=>{
    setBusy(true);setMsg("");setResumo(null);
    const {data,error}=await supabase.functions.invoke("vertice-onedrive-espelho",{body:{institution_id:institutionId}});
    setBusy(false);
    if(error){
      let code="";
      try{code=(await (error as any).context?.json?.())?.error??"";}catch{}
      setMsg(ERROS[code]??"Não foi possível sincronizar agora. Tente novamente em instantes.");
      return;
    }
    setResumo((data as {resumo:Resumo[]}).resumo?.[0]??null);
    carregarUltima();
    // Documentos do repositório, em lotes, até acabar (ou até 80 lotes).
    setBusy(true);
    const acc={ok:0,erro:0,restantes:null as number|null};
    setDocs({...acc});
    for(let i=0;i<80;i++){
      const r=await supabase.functions.invoke("vertice-onedrive-documentos",{body:{institution_id:institutionId,limit:30}});
      if(r.error){setMsg("A cópia de documentos foi interrompida. Clique novamente para continuar de onde parou.");break;}
      const d=r.data as {ok:number;erro:number;restantes:number;processados:number};
      acc.ok+=d.ok;acc.erro+=d.erro;acc.restantes=d.restantes;setDocs({...acc});
      if(d.restantes<=0||d.processados===0)break;
    }
    setBusy(false);
  };

  return (
    <section className="vx-onedrive-espelho" aria-label="Espelhamento para o OneDrive" style={{margin:"16px 0",padding:16,border:"1px solid var(--line, #d9dde3)",borderRadius:12}}>
      <h3 style={{margin:"0 0 4px"}}>Espelho no OneDrive</h3>
      <p style={{margin:"0 0 12px"}}>
        Copia os dados das abas de {institutionName} para a pasta <strong>Portal Vértice</strong> no OneDrive (planilhas CSV por bloco e aba) e os documentos do repositório para as pastas de documentos do curso.
        Dados nominais de alunos e informações financeiras não são copiados.
      </p>
      <button type="button" onClick={sincronizar} disabled={busy}>{busy?"Sincronizando…":"Sincronizar com o OneDrive"}</button>
      {ultima&&<p style={{margin:"8px 0 0"}}>Última sincronização: {new Date(ultima).toLocaleString("pt-BR")}</p>}
      {msg&&<p role="alert" style={{margin:"8px 0 0"}}>{msg}</p>}
      {docs&&(
        <p role="status" style={{margin:"8px 0 0"}}>
          Documentos: {docs.ok} copiado(s){docs.erro>0&&<>, <strong>{docs.erro} com erro</strong></>}
          {docs.restantes!==null&&docs.restantes>0&&<>, {docs.restantes} na fila</>}.
        </p>
      )}
      {resumo&&(
        <p role="status" style={{margin:"8px 0 0"}}>
          {resumo.ok} arquivo(s) gravado(s), {resumo.sem_mudanca} sem mudança, {resumo.vazio} aba(s) ainda sem dados
          {resumo.erro>0&&<>, <strong>{resumo.erro} com erro</strong> ({resumo.erros.map(e=>e.tabela).join(", ")})</>}.
        </p>
      )}
    </section>
  );
}
