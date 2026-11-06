import {useCallback, useEffect, useState, type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import "./api-connector-setup.css";

type Connection = {
  configured: boolean;
  status: "nao_configurada" | "aguardando_chave" | "credencial_recebida" | "revogada";
  system_url: string;
  api_url: string;
  has_key: boolean;
  updated_at?: string;
};

const INITIAL: Connection = {
  configured: false, status: "nao_configurada", system_url: "", api_url: "", has_key: false
};

function validateUrl(raw: string, required: boolean): string | null {
  if (!raw.trim()) return required ? "Informe o endereço HTTPS do sistema." : null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search ||
        (url.port && url.port !== "443") || raw.trim().length > 1000) {
      return "Use um endereço HTTPS sem senha, parâmetros, fragmentos ou portas especiais.";
    }
    if (!/^[a-z0-9.-]+$/i.test(url.hostname)) return "Hostname inválido.";
    return null;
  } catch { return "Endereço inválido. Exemplo: https://sistema.faculdade.edu.br"; }
}

export default function ApiConnectorSetup({institutionId,institutionName}:{
  institutionId: string; institutionName: string;
}) {
  const [connection,setConnection] = useState<Connection>(INITIAL);
  const [systemUrl,setSystemUrl] = useState("");
  const [apiUrl,setApiUrl] = useState("");
  const [key,setKey] = useState("");
  const [showKey,setShowKey] = useState(false);
  const [advanced,setAdvanced] = useState(false);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");

  const load = useCallback(async () => {
    const {data,error:readError} = await supabase.rpc("vertice_api_connection_get",{
      p_institution:institutionId
    });
    if (readError) throw readError;
    const c = (data ?? INITIAL) as Connection;
    setConnection(c);
    setSystemUrl(c.system_url ?? "");
    setApiUrl(c.api_url ?? "");
  },[institutionId]);

  useEffect(()=>{
    let active=true;
    setLoading(true);
    void load().catch(()=>{
      if (active) setError("Conexão indisponível ou autenticação Master/MFA não confirmada.");
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;setKey("");};
  },[load]);

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    const badSystem=validateUrl(systemUrl,true),badApi=validateUrl(apiUrl,false);
    if(badSystem||badApi){setError(badSystem??badApi??"URL inválida");return;}
    if(key.trim() && (key.trim().length<8||key.trim().length>4096)){
      setError("Chave fora do formato aceito (8 a 4.096 caracteres).");return;
    }
    setBusy(true);setError("");setMessage("");
    try {
      const {data,error:saveError}=await supabase.rpc("vertice_api_connection_save",{
        p_institution:institutionId,
        p_system_url:systemUrl.trim(),
        p_api_url:apiUrl.trim(),
        p_key:key.trim()||null
      });
      if(saveError)throw saveError;
      const c=data as Connection;
      setConnection(c);setKey("");setShowKey(false);
      setMessage(c.has_key?
        "Chave recebida e protegida no Vault. Ainda não houve teste de API nem importação de dados.":
        "Endereço cadastrado. Aguardando a chave da instituição.");
    } catch (e) {
      setError((e as {message?:string})?.message??"Falha ao salvar a configuração.");
    } finally {setBusy(false);}
  }

  async function revoke() {
    if(busy||!connection.has_key ||
       !window.confirm("Revogar a chave desta instituição? A credencial será excluída do Vault e precisará ser cadastrada novamente."))return;
    setBusy(true);setError("");setMessage("");
    try {
      const {data,error:revokeError}=await supabase.rpc("vertice_api_connection_revoke",{
        p_institution:institutionId
      });
      if(revokeError)throw revokeError;
      setConnection(data as Connection);setKey("");
      setMessage("Chave revogada. Os dados acadêmicos existentes não foram alterados.");
    } catch(e) {
      setError((e as {message?:string})?.message??"Não foi possível revogar a chave.");
    } finally {setBusy(false);}
  }

  const status=connection.has_key?"Chave recebida · validação pendente":
    connection.status==="revogada"?"Chave revogada":"Aguardando chave";

  return <section className="vx-api" aria-label="Conexão institucional via API">
    <div className="vx-api-heading">
      <div>
        <span className="vx-api-eyebrow">VÉRTICE · INTEGRAÇÕES INSTITUCIONAIS</span>
        <h3>Conectar por chave de API</h3>
        <p>Cadastre o endereço do sistema da {institutionName} e, quando recebê-la, a chave fornecida pela instituição.</p>
      </div>
      <span className={"vx-api-status "+(connection.has_key?"vx-api-status-ready":"")} role="status">{loading?"Consultando…":status}</span>
    </div>
    {error&&<p role="alert" className="vx-api-alert">{error}</p>}
    {message&&<p role="status" className="vx-api-notice">{message}</p>}
    <form onSubmit={save} className="vx-api-form">
      <label>Endereço do sistema acadêmico
        <input type="url" value={systemUrl} onChange={e=>setSystemUrl(e.target.value)}
          placeholder="https://sistema.faculdade.edu.br" autoComplete="url"
          maxLength={1000} required disabled={busy||loading}/>
      </label>
      <label>Chave da API {connection.has_key?"(deixe em branco para manter a chave atual)":""}
        <span className="vx-api-secret">
          <input type={showKey?"text":"password"} value={key} onChange={e=>setKey(e.target.value)}
            placeholder={connection.has_key?"Chave já cadastrada; não é exibida":"Cole a chave recebida"} 
            autoComplete="new-password" minLength={8} maxLength={4096} disabled={busy||loading}/>
          <button type="button" onClick={()=>setShowKey(x=>!x)} disabled={!key||busy}>
            {showKey?"Ocultar":"Exibir"}
          </button>
        </span>
      </label>
      <button type="button" className="vx-api-advanced" onClick={()=>setAdvanced(a=>!a)}>
        {advanced?"Ocultar endereço técnico":"Tenho um endereço específico da API"}
      </button>
      {advanced&&<label>URL-base da API (opcional, caso seja diferente do sistema)
        <input type="url" value={apiUrl} onChange={e=>setApiUrl(e.target.value)}
          placeholder="https://api.fornecedor.com.br" maxLength={1000}
          disabled={busy||loading}/>
      </label>}
      <div className="vx-api-actions">
        <button type="submit" disabled={busy||loading}>{busy?"Salvando…":"Salvar conexão"}</button>
        {connection.has_key&&<button type="button" className="vx-api-danger"
          disabled={busy||loading} onClick={()=>void revoke()}>Revogar chave</button>}
      </div>
    </form>
    <div className="vx-api-readiness">
      <strong>Etapas de ativação</strong>
      <ol>
        <li>Cadastro do endereço e recebimento seguro da chave.</li>
        <li>Validação dos endpoints e permissões conforme documentação da API.</li>
        <li>Prévia dos dados, conferência por curso/semestre/grade e aprovação da importação.</li>
        <li>Agendamento da atualização automática somente após homologação.</li>
      </ol>
      <p>Esta tela não consulta a instituição, não importa alunos e não modifica o BI. A credencial nunca é exibida novamente; não envie a chave por chat.</p>
    </div>
  </section>;
}
