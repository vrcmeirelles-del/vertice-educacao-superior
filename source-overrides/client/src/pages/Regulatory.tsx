import { ContextHelp } from '@/components/ContextHelp';
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/PilotLayout";

type Status = "conforme" | "atencao" | "critico" | "pendente";

type Requisito = {
  id: string;
  codigo: string;
  eixo: string;
  nome: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  status: Status;
  evidencia: string;
  versao: string;
};

const EIXOS = [
  "Organização Didático-Pedagógica",
  "Corpo Docente e Tutorial",
  "Infraestrutura",
];

const REQUISITOS: Requisito[] = [
  {
    id: "r1",
    codigo: "1.1",
    eixo: "Organização Didático-Pedagógica",
    nome: "Projeto Pedagógico do Curso",
    descricao:
      "PPC vigente, aprovado pelo colegiado, com perfil do egresso, matriz curricular e políticas de avaliação.",
    responsavel: "Coordenação de Direito",
    prazo: "2026-11-30",
    status: "conforme",
    evidencia: "PPC_Direito_2026_v3.pdf",
    versao: "3.0",
  },
  {
    id: "r2",
    codigo: "1.2",
    eixo: "Organização Didático-Pedagógica",
    nome: "Monitoria",
    descricao:
      "Edital, termo de compromisso, plano de trabalho e acompanhamento dos monitores.",
    responsavel: "Coordenação de Direito",
    prazo: "2026-10-31",
    status: "atencao",
    evidencia: "Edital_Monitoria_2026_2.pdf",
    versao: "1.0",
  },
  {
    id: "r3",
    codigo: "1.3",
    eixo: "Organização Didático-Pedagógica",
    nome: "Estágio supervisionado",
    descricao:
      "Convênios, planos de estágio, supervisão docente e relatórios de acompanhamento.",
    responsavel: "Núcleo de Prática Jurídica",
    prazo: "2026-12-15",
    status: "pendente",
    evidencia: "—",
    versao: "—",
  },
  {
    id: "r4",
    codigo: "1.4",
    eixo: "Organização Didático-Pedagógica",
    nome: "Extensão curricularizada",
    descricao:
      "Regulamento, carga horária extensionista e comprovação da participação discente.",
    responsavel: "Coordenação de Extensão",
    prazo: "2026-11-10",
    status: "critico",
    evidencia: "Regulamento_Extensao_2025.pdf",
    versao: "1.0",
  },
  {
    id: "r5",
    codigo: "2.1",
    eixo: "Corpo Docente e Tutorial",
    nome: "Núcleo Docente Estruturante",
    descricao:
      "Portaria de designação, atas de reunião e comprovação da atuação do NDE.",
    responsavel: "Coordenação de Direito",
    prazo: "2026-11-20",
    status: "conforme",
    evidencia: "Atas_NDE_2026.pdf",
    versao: "2.1",
  },
  {
    id: "r6",
    codigo: "2.2",
    eixo: "Corpo Docente e Tutorial",
    nome: "Adequação da titulação docente",
    descricao:
      "Ficha de análise de adequação entre formação, disciplina e experiência profissional.",
    responsavel: "Secretaria Acadêmica",
    prazo: "2026-10-28",
    status: "atencao",
    evidencia: "Ficha_Adequacao_2026_2.xlsx",
    versao: "1.2",
  },
  {
    id: "r7",
    codigo: "2.3",
    eixo: "Corpo Docente e Tutorial",
    nome: "Atuação do coordenador",
    descricao:
      "Portaria de nomeação, regime de trabalho e comprovação da dedicação à coordenação.",
    responsavel: "Reitoria",
    prazo: "2026-12-01",
    status: "conforme",
    evidencia: "Portaria_Coordenacao_2026.pdf",
    versao: "1.0",
  },
  {
    id: "r8",
    codigo: "3.1",
    eixo: "Infraestrutura",
    nome: "Laboratórios e recursos",
    descricao:
      "Monitoramento de usabilidade, relação de equipamentos e planos de manutenção.",
    responsavel: "Infraestrutura",
    prazo: "2026-11-05",
    status: "pendente",
    evidencia: "—",
    versao: "—",
  },
  {
    id: "r9",
    codigo: "3.2",
    eixo: "Infraestrutura",
    nome: "Bibliografia e acervo",
    descricao:
      "Relatório de adequação da bibliografia e comprovação de exemplares disponíveis.",
    responsavel: "Biblioteca",
    prazo: "2026-11-25",
    status: "critico",
    evidencia: "Relatorio_Bibliografia_2025.pdf",
    versao: "1.0",
  },
  {
    id: "r10",
    codigo: "3.3",
    eixo: "Infraestrutura",
    nome: "Núcleo de Práticas Jurídicas",
    descricao:
      "Planilha de atributos do NPJ, convênios e registros de atendimento à comunidade.",
    responsavel: "Núcleo de Prática Jurídica",
    prazo: "2026-12-10",
    status: "conforme",
    evidencia: "Atributos_NPJ_2026.xlsx",
    versao: "2.0",
  },
];

const STATUS_META: Record<Status, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  conforme: { label: "Conforme", className: "badge green", icon: CheckCircle2 },
  atencao: { label: "Atenção", className: "badge amber", icon: Clock },
  critico: { label: "Crítico", className: "badge red", icon: ShieldAlert },
  pendente: { label: "Pendente", className: "badge gray", icon: AlertTriangle },
};

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Regulatory() {
  const [eixo, setEixo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return REQUISITOS.filter(r => {
      const porEixo = eixo === "todos" || r.eixo === eixo;
      const porTermo =
        !termo ||
        r.nome.toLowerCase().includes(termo) ||
        r.codigo.includes(termo) ||
        r.responsavel.toLowerCase().includes(termo);
      return porEixo && porTermo;
    });
  }, [eixo, busca]);

  const resumo = useMemo(() => {
    const total = REQUISITOS.length;
    const conformes = REQUISITOS.filter(r => r.status === "conforme").length;
    const criticos = REQUISITOS.filter(r => r.status === "critico").length;
    const pendentes = REQUISITOS.filter(r => r.status === "pendente").length;
    return {
      total,
      conformes,
      criticos,
      pendentes,
      prontidao: Math.round((conformes / total) * 100),
    };
  }, []);

  const detalhe = REQUISITOS.find(r => r.id === selecionado) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="REGULAÇÃO E CONFORMIDADE"
        title="Cockpit regulatório"
        description="Curso de Direito — Centro Universitário UNITOP, Palmas/TO."
      />

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">
            Prontidão regulatória
            <span className="stat-icon">
              <ShieldCheck size={16} />
            </span>
          </div>
          <div className="stat-value">
            {resumo.prontidao}
            <span>%</span>
          </div>
          <p>{resumo.conformes} de {resumo.total} requisitos conformes.</p>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">
            Requisitos críticos
            <span className="stat-icon">
              <ShieldAlert size={16} />
            </span>
          </div>
          <div className="stat-value">{resumo.criticos}</div>
          <p>Exigem intervenção imediata da coordenação.</p>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">
            Sem evidência
            <span className="stat-icon">
              <FileText size={16} />
            </span>
          </div>
          <div className="stat-value">{resumo.pendentes}</div>
          <p>Processos ainda não iniciados.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Matriz de conformidade</h3>
            <p>Requisitos por eixo regulatório, com responsável e prazo.</p>
          </div>
          <div className="select-wrap">
            <select
              value={eixo}
              onChange={e => setEixo(e.target.value)}
              aria-label="Filtrar eixo"
            >
              <option value="todos">Todos os eixos</option>
              {EIXOS.map(nome => (
                <option value={nome} key={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ padding: "0 22px 12px" }}>
          <input
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por requisito, código ou responsável"
            aria-label="Buscar requisito"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 14,
            }}
          />
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Requisito</th>
                <th>Responsável<ContextHelp title="Responsável" /></th>
                <th>Prazo</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(r => {
                const meta = STATUS_META[r.status];
                const Icone = meta.icon;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelecionado(r.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{r.codigo}</td>
                    <td>{r.nome}</td>
                    <td>{r.responsavel}</td>
                    <td>{formatarData(r.prazo)}</td>
                    <td>
                      <span className={meta.className}>
                        <span />
                        <Icone size={12} />
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5}>Nenhum requisito encontrado com esse filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detalhe && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <div>
              <h3>
                {detalhe.codigo} — {detalhe.nome}
              </h3>
              <p>{detalhe.eixo}</p>
            </div>
            <button className="round-arrow" onClick={() => setSelecionado(null)}>
              ×
            </button>
          </div>
          <div style={{ padding: "0 22px 22px" }}>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#6b7784" }}>
              {detalhe.descricao}
            </p>
            <div className="stats-row" style={{ marginTop: 16, marginBottom: 0 }}>
              <div className="stat-card">
                <div className="stat-label">Responsável</div>
                <div style={{ marginTop: 8, fontSize: 14 }}>{detalhe.responsavel}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Prazo</div>
                <div style={{ marginTop: 8, fontSize: 14 }}>{formatarData(detalhe.prazo)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Evidência vinculada</div>
                <div style={{ marginTop: 8, fontSize: 14 }}>{detalhe.evidencia}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Versão</div>
                <div style={{ marginTop: 8, fontSize: 14 }}>{detalhe.versao}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="consulting-note">
        <ClipboardCheck size={16} />
        <div>
          <strong>Como este cockpit funciona</strong>
          <p>
            Cada exigência é tratada como processo: possui responsável, prazo,
            evidência vinculada, versão e situação. A prontidão é recalculada a
            partir dos requisitos conformes, permitindo acompanhar a preparação
            para avaliação do MEC antes da visita in loco.
          </p>
        </div>
      </div>
    </>
  );
}
