import ConexoesDados from "./ConexoesDados";
import "./integration-settings.css";

// Institutional connections use vertice-conexao, not the marketing connectors table.
// Keep the same management boundary as the existing ConexoesDados workspace tab.
export default function IntegrationSettings({
  institutionId,
  institutionName,
  role,
}: {
  institutionId: string;
  institutionName: string;
  role: string | null;
}) {
  if (role !== "master" && role !== "gestor") {
    return <p>As conexões de dados são restritas à gestão da IES.</p>;
  }

  return (
    <div className="int-settings">
      <div className="int-header">
        <div>
          <p className="int-eyebrow">INTEGRAÇÃO · {institutionName.toUpperCase()}</p>
          <h2>Configuração de Dados</h2>
          <p className="int-subtitle">Gerencie as conexões institucionais no fluxo de autorização, teste e sincronização.</p>
        </div>
      </div>
      <p role="note" className="int-info-box">
        Salvar ou testar uma conexão não confirma a importação de dados nem a atualização dos BIs.
        Confira o resultado da sincronização e a origem dos dados carregados abaixo.
        A leitura contínua depende do conector disponível para cada sistema.
      </p>
      <ConexoesDados
        key={institutionId + ":" + role}
        institutionId={institutionId}
        institutionName={institutionName}
        role={role}
      />
    </div>
  );
}
