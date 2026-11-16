import { useState } from "react";
import { createRoot } from "react-dom/client";
import SapiensPlanning from "../../../client/src/components/area/SapiensPlanning";
import { setViewer } from "./mock";
function App() {
  const [role, roleState] = useState("alta_gestao"),
    [mobile, setMobile] = useState(false);
  return (
    <main
      style={{
        maxWidth: mobile ? 390 : 1180,
        margin: "auto",
        padding: mobile ? 8 : 24,
      }}
    >
      <div
        style={{
          background: "#17324c",
          color: "white",
          padding: 18,
          borderRadius: 12,
        }}
      >
        <p style={{ fontSize: 12, letterSpacing: 1 }}>
          VÉRTICE · REVISÃO FUNCIONAL
        </p>
        <h1 style={{ fontSize: 24, margin: "8px 0" }}>
          Planejamento que conversa com os resultados
        </h1>
        <p>
          Dados fictícios · Sem conexão com produção · Proposta pendente de
          autorização
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>
            Visão de teste{" "}
            <select
              aria-label="Perfil de teste"
              value={role}
              onChange={(e) => {
                setViewer(e.target.value);
                roleState(e.target.value);
              }}
            >
              <option value="alta_gestao">Alta gestão</option>
              <option value="direcao">Direção acadêmica</option>
              <option value="coordenacao">Coordenação</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={mobile}
              onChange={(e) => setMobile(e.target.checked)}
            />{" "}
            Visualizar em largura de celular (390 px)
          </label>
        </div>
      </div>
      <SapiensPlanning
        key={role}
        institutionId="institution-demo"
        courseId="course-demo"
        semester="2026/2"
      />
    </main>
  );
}
document.body.style.cssText =
  "margin:0;background:#eef3f7;font-family:Arial,sans-serif;color:#17324c";
createRoot(document.getElementById("root")!).render(<App />);
