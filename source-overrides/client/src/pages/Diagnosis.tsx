import { HelpLabel } from '@/components/ContextHelp';
import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  Info,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Filter } from "@/components/PilotLayout";
import { LevelBadge } from "@/components/PilotCharts";
import { usePilot, downloadFile } from "@/contexts/PilotContext";
import { useGestor } from "@/contexts/GestorContext";
import {
  calculateResults,
  dimensions,
  toCsv,
  type Criterion,
} from "@/lib/pilot";

const scale = [
  "Ausente",
  "Inicial",
  "Em desenvolvimento",
  "Estruturado",
  "Monitorado",
];
function queryParam(key: string) {
  return new URLSearchParams(window.location.search).get(key);
}
export default function Diagnosis() {
  const { state, setState } = usePilot();
  const { institution } = useGestor();
  const searchParams = useSearch();
  const target = new URLSearchParams(searchParams).get("criterio");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("");
  const criterionDimension = state.criteria.find(
    c => c.id === target
  )?.dimension;
  const [dimension, setDimension] = useState(
    criterionDimension ?? queryParam("dimensao") ?? dimensions[0].id
  );

  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    const fromQuery = new URLSearchParams(searchParams).get("dimensao");
    const fromCriterion = state.criteria.find(c => c.id === target)?.dimension;
    if (fromCriterion || fromQuery) setDimension(fromCriterion ?? fromQuery!);
    const timer = target
      ? setTimeout(
          () =>
            document
              .getElementById(target)
              ?.scrollIntoView({ behavior: "smooth", block: "center" }),
          100
        )
      : undefined;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchParams, target]);
  const selected = dimensions.find(d => d.id === dimension) ?? dimensions[0];

  // Mapeamento de setores para dimensões permitidas
  const sectorDimensions: Record<string, string[]> = {
    "gestao": ["governanca", "dados"],
    "academico": ["academico", "pesquisa_stricto_sensu"],
    "regulacao": ["governanca", "academico", "dados"],
    "evidencia": ["academico", "permanencia", "expansao"],
  };

  // Filtra critérios pela dimensão selecionada e pelo setor (se houver)
  const items = state.criteria.filter(c => {
    if (c.dimension !== selected.id) return false;
    if (selectedSector && sectorDimensions[selectedSector]) {
      return sectorDimensions[selectedSector].includes(c.dimension);
    }
    return true;
  });
  const result = calculateResults(state.criteria, selected.id);
  const update = (id: string, patch: Partial<Criterion>) =>
    setState(s => ({
      ...s,
      criteria: s.criteria.map(c => (c.id === id ? { ...c, ...patch } : c)),
    }));
  const addCriterion = () => {
    const id = `criterio-${crypto.randomUUID()}`;
    setState(s => ({
      ...s,
      criteria: [
        ...s.criteria,
        {
          id,
          dimension: selected.id,
          question: "Novo critério de exemplo — edite a pergunta",
          score: null,
          observation: "",
          evidence: "",
          recommendation:
            "Definir uma recomendação após analisar a resposta e a evidência.",
        },
      ],
    }));
    setEditing(id);
    toast.success("Critério adicionado à demonstração.");
  };
  return (
    <>
      <PageHeader
        eyebrow="INSTRUMENTO PILOTO"
        title="A experiência vira método."
        description="Avalie critérios de exemplo, registre observações e torne o raciocínio rastreável."
      >
        <Link href="/matriz" className="button secondary">
          Ver matriz de achados <ArrowUpRight size={16} />
        </Link>
      </PageHeader>
      <div className="notice-inline">
        <Info size={18} />
        <p>
          Questionário não validado. As respostas iniciais são fictícias.
          Registre apenas exemplos, sem dados pessoais ou documentos
          confidenciais.
        </p>
      </div>
      <div className="filter-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <select
          value={selectedCourse}
          onChange={e => setSelectedCourse(e.target.value)}
          aria-label="Selecionar curso"
          className="standalone-select"
        >
          <option value="">Todos os cursos</option>
          {institution.courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={selectedSector}
          onChange={e => setSelectedSector(e.target.value)}
          aria-label="Selecionar setor"
          className="standalone-select"
        >
          <option value="">Todos os setores</option>
          {institution.sectors.filter(s => s.canAnswer).map(s => (
            <option key={s.sectorId} value={s.sectorId}>{s.label}</option>
          ))}
        </select>
      </div>
      <div className="diagnosis-layout">
        <nav className="dimension-nav" aria-label="Dimensões do diagnóstico">
          <span className="nav-caption">DIMENSÕES ESTRATÉGICAS</span>
          {dimensions.map((d, i) => {
            const r = calculateResults(state.criteria, d.id);
            return (
              <button
                key={d.id}
                onClick={() => setDimension(d.id)}
                className={selected.id === d.id ? "selected" : ""}
              >
                <span className="dimension-nav-number">0{i + 1}</span>
                <span>
                  {d.name}
                  <small>
                    {r.answered} de {r.total} critérios
                  </small>
                </span>
                {r.answered === r.total && r.total > 0 && <Check size={15} />}
              </button>
            );
          })}
          <div className="dimension-nav-note">
            <ClipboardCheck size={20} />
            <p>
              Você pode adaptar as perguntas à sua metodologia antes da
              validação institucional.
            </p>
          </div>
        </nav>
        <section className="questionnaire">
          <div className="dimension-title">
            <div>
              <span className="eyebrow">
                DIMENSÃO{" "}
                {String(dimensions.indexOf(selected) + 1).padStart(2, "0")}
              </span>
              <h2>{selected.name}</h2>
              <p>{selected.description}</p>
            </div>
            <span className="completion-pill">
              {result.answered}/{result.total} preenchidos
            </span>
          </div>
          <div className="form-scale-note">
            Escala de estruturação: <strong>0</strong> ausente →{" "}
            <strong>4</strong> monitorado. Deixe em branco quando não houver
            avaliação.
          </div>
          {items.map((c, i) => (
            <article
              className={`question-card ${target === c.id ? "highlighted" : ""}`}
              key={c.id}
              id={c.id}
            >
              <div className="question-header">
                <span className="question-index">
                  CRITÉRIO {String(i + 1).padStart(2, "0")}
                </span>
                <button
                  className="text-link"
                  onClick={() => setEditing(editing === c.id ? null : c.id)}
                >
                  {editing === c.id ? (
                    <Check size={14} />
                  ) : (
                    <Pencil size={13} />
                  )}
                  {editing === c.id ? "Concluir edição" : "Editar critério"}
                </button>
              </div>
              {editing === c.id ? (
                <>
                  <HelpLabel className="field-label">
                    Pergunta do critério
                    <textarea
                      value={c.question}
                      onChange={e => update(c.id, { question: e.target.value })}
                      maxLength={1000}
                    />
                  </HelpLabel>
                  <HelpLabel className="field-label">
                    Recomendação preliminar
                    <textarea
                      value={c.recommendation}
                      onChange={e =>
                        update(c.id, { recommendation: e.target.value })
                      }
                      maxLength={2000}
                    />
                  </HelpLabel>
                </>
              ) : (
                <h3>{c.question}</h3>
              )}
              <fieldset className="scale-fieldset">
                <legend className="sr-only">Resposta para: {c.question}</legend>
                <div className="scale-options">
                  {scale.map((label, score) => (
                    <button
                      type="button"
                      aria-pressed={c.score === score}
                      key={score}
                      onClick={() => update(c.id, { score })}
                      className={c.score === score ? "chosen" : ""}
                    >
                      <strong>{score}</strong>
                      <span>{label}</span>
                      {c.score === score && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="question-fields">
                <HelpLabel className="field-label">
                  Observações
                  <textarea
                    value={c.observation}
                    onChange={e =>
                      update(c.id, { observation: e.target.value })
                    }
                    placeholder="Registre o achado ou o contexto de exemplo…"
                    maxLength={3000}
                  />
                </HelpLabel>
                <HelpLabel className="field-label">
                  Referência de evidência <span>(texto, sem anexos)</span>
                  <textarea
                    value={c.evidence}
                    onChange={e => update(c.id, { evidence: e.target.value })}
                    placeholder="Ex.: relatório institucional a validar"
                    maxLength={2000}
                  />
                </HelpLabel>
              </div>
              <div className="question-bottom">
                <LevelBadge score={c.score} />
                <button
                  className="text-link muted"
                  disabled={c.score === null}
                  onClick={() => update(c.id, { score: null })}
                >
                  <X size={13} />
                  Limpar resposta
                </button>
              </div>
            </article>
          ))}
          <button className="add-criterion" onClick={addCriterion}>
            <Plus size={17} />
            Adicionar critério de exemplo
          </button>
          <div className="form-finish">
            <span>
              <Check size={15} />
              Alterações mantidas neste navegador
            </span>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  const csvContent = toCsv(items);
                  downloadFile(
                    "﻿" + csvContent,
                    `diagnostico-${selected.id}-${new Date().toISOString().split("T")[0]}.csv`,
                    "text/csv;charset=utf-8"
                  );
                  toast.success("Relatório CSV exportado.");
                }}
              >
                <Download size={16} /> Exportar CSV
              </button>
              <Link href="/painel" className="button primary">
                Ver resultados <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
export function Matrix() {
  const { state } = usePilot();
  const [dimension, setDimension] = useState("all");
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const items = state.criteria.filter(
    c =>
      (dimension === "all" || c.dimension === dimension) &&
      (level === "all" ||
        (level === "attention"
          ? c.score !== null && c.score < 3
          : c.score === null)) &&
      `${c.question} ${c.observation}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR"))
  );
  return (
    <>
      <PageHeader
        eyebrow="RASTREABILIDADE DO DIAGNÓSTICO"
        title="Cada achado tem uma origem."
        description="Da resposta à recomendação: uma leitura organizada para discutir com a gestão."
      >
        <button
          className="button secondary"
          onClick={() => {
            downloadFile(
              "\uFEFF" + toCsv(items),
              "vertice-matriz-demonstrativa.csv",
              "text/csv;charset=utf-8"
            );
            toast.success("Matriz filtrada exportada em CSV.");
          }}
        >
          <Download size={16} />
          Exportar matriz
        </button>
      </PageHeader>
      <div className="filter-bar matrix-filters">
        <div className="input-with-icon">
          <Search size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar critério ou achado"
            aria-label="Buscar na matriz"
          />
        </div>
        <div className="filter-right">
          <Filter
            value={dimension}
            onChange={setDimension}
            options={dimensions}
          />
          <select
            className="standalone-select"
            value={level}
            onChange={e => setLevel(e.target.value)}
            aria-label="Filtrar nível de atenção"
          >
            <option value="all">Todos os níveis</option>
            <option value="attention">Pontos de atenção</option>
            <option value="empty">Sem avaliação</option>
          </select>
        </div>
      </div>
      <div className="panel matrix-panel">
        <div className="matrix-count">
          {items.length} critérios no recorte <span>• Cenário ilustrativo</span>
        </div>
        <div className="table-scroll">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Critério / dimensão</th>
                <th>Achado e evidência referenciada</th>
                <th>Nível de atenção</th>
                <th>Recomendação preliminar</th>
                <th>
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.question}</strong>
                    <small>
                      {dimensions.find(d => d.id === c.dimension)?.name}
                    </small>
                    <span className="criterion-code">{c.id}</span>
                  </td>
                  <td>
                    <p>{c.observation || "Sem observação registrada."}</p>
                    <div className="evidence-reference">
                      <FileText size={13} />
                      {c.evidence || "Evidência pendente de validação"}
                    </div>
                  </td>
                  <td>
                    <LevelBadge score={c.score} />
                    <small>
                      {c.score === null
                        ? "Sem resposta"
                        : `${c.score}/4 na escala`}
                    </small>
                  </td>
                  <td>
                    <p>{c.recommendation}</p>
                    <small>Revisão do consultor necessária</small>
                  </td>
                  <td>
                    <Link
                      href={`/diagnostico?criterio=${encodeURIComponent(c.id)}`}
                      className="round-arrow"
                      aria-label={`Editar critério: ${c.question}`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <div className="empty-state">
            <Search size={24} />
            <h3>Nenhum critério neste recorte.</h3>
            <p>Altere os filtros ou a busca para ver os achados.</p>
          </div>
        )}
      </div>
      <div className="notice-inline">
        <Info size={17} />
        <p>
          Referências textuais não comprovam a existência ou a validade de
          documentos. As recomendações são preliminares e não constituem
          auditoria certificada.
        </p>
      </div>
    </>
  );
}
