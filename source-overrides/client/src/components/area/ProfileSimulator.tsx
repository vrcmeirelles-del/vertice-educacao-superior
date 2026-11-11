import { useState } from "react";
import {
  ROLE_LABEL, ROLE_DESCRIPTION, visibleTabs,
  type Role, type Tab,
} from "@/lib/area";

const TAB_LABELS: Record<Tab, string> = {
  backups: "Backups Acadêmicos",
  fontes: "Importar dados de sites",
  conexoes: "Conexões de dados",
  auditoria: "BI · Reprovações de Todos os Cursos",
  avaliacao: "Recredenciamento Institucional",
  enade: "ENADE 360°",
  aprendizagem: "Aprendizagem Conectada",
  novo_instrumento: "Novo Instrumento",
  simulador: "Simulador de Custo",
  "raio-x-direito": "Raio-X de Direito",
  "resultado-curso": "Resultado por Curso",
  base: "Base da organização",
  ia: "Análise Documental",
  geral: "Visão geral",
  analise: "Análise gerencial",
  visao: "Matrículas",
  cadastro: "Cadastro e cursos",
  emec: "e-MEC · Regulação",
  metas: "Metas e indicadores",
  repositorio: "Reconhecimento de Curso",
  biblioteca: "Biblioteca INEP",
  reitor: "Área da Direção · EBITDA",
  eorbit: "e-ORBIT",
  plano: "Plano de ação 5W2H",
  diagnostico: "Diagnóstico",
  equipe: "Equipe",
  egressos: "Egressos 360°",
  governanca: "Governança 360°",
  inclusao: "Inclusão 360° · PEI",
  "acompanhamento-especial": "Acompanhamento Especial",
  sync: "Sincronização",
  aquisicoes: "Aquisições",
  billing: "Painel Financeiro",
  contrato: "Meu Contrato",
  modulos: "Gerenciar Módulos",
  catalogo: "Catálogo de Módulos",
  documentos: "Gestão Documental",
  conta: "Minha Conta",
  "escola-enem": "ENEM & Vestibular",
  "escola-egressos": "Egressos Escolar",
};

const ALL_TABS: Tab[] = [
  "base", "ia", "geral", "analise", "visao", "cadastro",
  "emec", "metas", "repositorio", "biblioteca", "reitor",
  "plano", "diagnostico", "equipe", "auditoria", "avaliacao",
  "enade", "aprendizagem", "novo_instrumento", "simulador",
];

/** Perfis disponíveis para demonstração (exclui master e legados internos). */
const DEMO_ROLES: Role[] = [
  "reitor",
  "diretor_geral",
  "diretor_pedagogico",
  "procurador",
  "cpa",
  "coordenador",
  "nde",
];

const SCOPE_LABEL: Record<string, string> = {
  reitor: "Instituição completa",
  diretor_geral: "Instituição completa",
  diretor_pedagogico: "Instituição completa",
  procurador: "Instituição completa",
  cpa: "Institucional (todos os cursos, sem gestão financeira)",
  coordenador: "Curso(s) vinculado(s)",
  nde: "Curso(s) vinculado(s)",
};

const VALIDATION_NOTE: Record<string, string> = {
  coordenador: "Documentos postados por este perfil precisam de validação pela instância superior (Direção ou Procurador).",
  nde: "Documentos postados por este perfil precisam de validação pela instância superior.",
  cpa: "Documentos postados por este perfil precisam de validação pela instância superior.",
};

export default function ProfileSimulator() {
  const [selected, setSelected] = useState<Role>("reitor");
  const tabs = visibleTabs(selected);

  return (
    <section className="profile-simulator" aria-label="Simulador de perfis de acesso">
      <style>{`
        .profile-simulator { background: #f8f9fc; border-radius: 16px; padding: clamp(16px, 3vw, 32px); }
        @media (prefers-color-scheme: dark) { .profile-simulator { background: #1a1d2e; } }
        .ps-header { margin: 0 0 24px; }
        .ps-header h3 { margin: 0 0 8px; font-size: 22px; }
        .ps-header p { margin: 0; color: #6b7280; font-size: 14px; }
        .ps-roles { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
        .ps-roles button { padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 8px; background: white; color: #374151; font-size: 13px; cursor: pointer; transition: all 0.15s; }
        @media (prefers-color-scheme: dark) { .ps-roles button { background: #252838; border-color: #3d4155; color: #d1d5db; } }
        .ps-roles button.active { background: #4338ca; border-color: #4338ca; color: white; font-weight: 600; }
        .ps-card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
        @media (prefers-color-scheme: dark) { .ps-card { background: #252838; border-color: #3d4155; } }
        .ps-card h4 { margin: 0 0 6px; font-size: 18px; }
        .ps-card .ps-scope { display: inline-block; background: #ede9fe; color: #5b21b6; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
        @media (prefers-color-scheme: dark) { .ps-card .ps-scope { background: #312e81; color: #c4b5fd; } }
        .ps-card p { margin: 0 0 12px; color: #6b7280; font-size: 14px; line-height: 1.5; }
        .ps-validation { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #92400e; margin-top: 12px; }
        @media (prefers-color-scheme: dark) { .ps-validation { background: #422006; border-color: #78350f; color: #fcd34d; } }
        .ps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
        .ps-tab { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; font-size: 13px; }
        .ps-tab.allowed { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
        .ps-tab.blocked { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; text-decoration: line-through; opacity: 0.7; }
        @media (prefers-color-scheme: dark) { .ps-tab.allowed { background: #064e3b; color: #6ee7b7; border-color: #065f46; } .ps-tab.blocked { background: #450a0a; color: #fca5a5; border-color: #7f1d1d; } }
        .ps-tab .ps-icon { flex-shrink: 0; width: 18px; text-align: center; }
        .ps-matrix { margin-top: 32px; }
        .ps-matrix h4 { margin: 0 0 12px; font-size: 16px; }
        .ps-matrix-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .ps-matrix-table th, .ps-matrix-table td { padding: 8px 6px; border: 1px solid #e5e7eb; text-align: center; }
        @media (prefers-color-scheme: dark) { .ps-matrix-table th, .ps-matrix-table td { border-color: #3d4155; } }
        .ps-matrix-table th { background: #f3f4f6; font-weight: 600; position: sticky; top: 0; }
        @media (prefers-color-scheme: dark) { .ps-matrix-table th { background: #1e2030; } }
        .ps-matrix-table th:first-child { text-align: left; min-width: 140px; }
        .ps-matrix-table td:first-child { text-align: left; font-weight: 500; }
        .ps-matrix-scroll { overflow-x: auto; border-radius: 8px; border: 1px solid #e5e7eb; }
        @media (prefers-color-scheme: dark) { .ps-matrix-scroll { border-color: #3d4155; } }
      `}</style>

      <div className="ps-header">
        <h3>Simulador de Perfis de Acesso</h3>
        <p>
          Selecione um perfil para visualizar quais abas e funcionalidades estarão
          disponíveis para esse tipo de usuário dentro da instituição.
        </p>
      </div>

      <div className="ps-roles" role="radiogroup" aria-label="Selecionar perfil">
        {DEMO_ROLES.map((role) => (
          <button
            key={role}
            role="radio"
            aria-checked={selected === role}
            className={selected === role ? "active" : ""}
            onClick={() => setSelected(role)}
          >
            {ROLE_LABEL[role]}
          </button>
        ))}
      </div>

      <div className="ps-card">
        <h4>{ROLE_LABEL[selected]}</h4>
        <span className="ps-scope">{SCOPE_LABEL[selected]}</span>
        <p>{ROLE_DESCRIPTION[selected]}</p>

        <h4 style={{ marginTop: 16, marginBottom: 12 }}>Abas visíveis neste perfil</h4>
        <div className="ps-grid">
          {ALL_TABS.map((t) => {
            const allowed = tabs.includes(t);
            return (
              <div key={t} className={`ps-tab ${allowed ? "allowed" : "blocked"}`}>
                <span className="ps-icon">{allowed ? "✓" : "✗"}</span>
                {TAB_LABELS[t]}
              </div>
            );
          })}
        </div>

        {VALIDATION_NOTE[selected] && (
          <div className="ps-validation">
            <strong>Validação de documentos:</strong> {VALIDATION_NOTE[selected]}
          </div>
        )}
      </div>

      {/* Matriz comparativa completa */}
      <div className="ps-matrix">
        <h4>Matriz comparativa de acesso</h4>
        <div className="ps-matrix-scroll">
          <table className="ps-matrix-table">
            <thead>
              <tr>
                <th>Módulo / Aba</th>
                {DEMO_ROLES.map((r) => (
                  <th key={r}>{ROLE_LABEL[r].replace("Diretor ", "Dir. ").replace("Procurador Institucional", "PI").replace("Membro do ", "")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_TABS.map((t) => (
                <tr key={t}>
                  <td>{TAB_LABELS[t]}</td>
                  {DEMO_ROLES.map((r) => {
                    const has = visibleTabs(r).includes(t);
                    return (
                      <td key={r} style={{ color: has ? "#059669" : "#dc2626" }}>
                        {has ? "✓" : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td><em>Escopo dos dados</em></td>
                {DEMO_ROLES.map((r) => (
                  <td key={r} style={{ fontSize: 11 }}>
                    {["coordenador", "nde"].includes(r) ? "Curso" : "IES"}
                  </td>
                ))}
              </tr>
              <tr>
                <td><em>Docs precisam validação?</em></td>
                {DEMO_ROLES.map((r) => (
                  <td key={r} style={{ color: VALIDATION_NOTE[r] ? "#d97706" : "#059669" }}>
                    {VALIDATION_NOTE[r] ? "Sim" : "Nao"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
