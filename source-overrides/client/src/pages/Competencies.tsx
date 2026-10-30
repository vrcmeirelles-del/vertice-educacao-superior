import { useMemo, useState } from "react";
import { BookOpen, Check, Download, Target, TriangleAlert, Users } from "lucide-react";
import { Filter, PageHeader } from "@/components/PilotLayout";
import { downloadFile } from "@/contexts/PilotContext";
import {
  assessments,
  bandColor,
  bandDistribution,
  bandOrder,
  competencyGaps,
  competencySummary,
  developmentPlans,
  findCompetency,
  findPerson,
  formatScore,
  personReadiness,
  planProgress,
  readinessCuts,
  readinessGrid,
  type AssessmentStatus,
  type ReviewStatus,
} from "@/lib/competencies";

function Dots({ value, total = 5 }: { value: number; total?: number }) {
  return (
    <div className="cp-dots" aria-label={`${value} de ${total} etapas concluídas`}>
      {Array.from({ length: total }).map((_, i) => (
        <span className={`cp-dot ${i < value ? "on" : ""}`} key={i} />
      ))}
    </div>
  );
}

function ReviewBadge({ value }: { value: ReviewStatus }) {
  const tone =
    value === "Concluída"
      ? "green"
      : value === "Prioritária"
        ? "red"
        : value === "Agendada"
          ? "amber"
          : "gray";
  return <span className={`badge ${tone}`}>{value}</span>;
}

function StatusBadge({ value }: { value: AssessmentStatus }) {
  const tone =
    value === "Calibrado"
      ? "green"
      : value === "Fora da faixa"
        ? "red"
        : value === "Em calibragem"
          ? "amber"
          : "gray";
  return <span className={`badge ${tone}`}>{value}</span>;
}

const toDots = (score: number | null) =>
  score === null ? 0 : Math.round((score / 5) * 5);

const boxTitles = [
  ["Apoio necessário", "Consolidado", "Referência"],
  ["Apoio necessário", "Em desenvolvimento", "Consolidado"],
  ["Apoio necessário", "Atenção", "Em desenvolvimento"],
];

const gapColors = ["#c0a877", "#c7b183", "#8c9baa", "#4f7fa0"];

export default function Competencies() {
  const [unit, setUnit] = useState("all");
  const units = useMemo(
    () =>
      Array.from(new Set(assessments.map(p => p.unit))).map(u => ({
        id: u,
        name: u,
      })),
    []
  );
  const people = useMemo(
    () => assessments.filter(p => unit === "all" || p.unit === unit),
    [unit]
  );
  const gaps = competencyGaps(people);
  const distribution = bandDistribution(people);
  const grid = readinessGrid(people);
  const summary = competencySummary(people);

  const exportCsv = () => {
    const header = [
      "pessoa",
      "unidade",
      "autoavaliacao",
      "pares",
      "lideranca",
      "calibrado",
      "estado",
      "devolutiva",
      "faixa",
    ];
    const rows = people.map(p => {
      const r = personReadiness(p);
      return [
        p.label,
        p.unit,
        formatScore(p.selfScore),
        formatScore(p.peerScore),
        formatScore(p.leaderScore),
        formatScore(p.calibrated),
        p.status,
        p.review,
        r?.band ?? "sem leitura",
      ]
        .map(v => `"${String(v).replaceAll('"', '""')}"`)
        .join(";");
    });
    downloadFile(
      ["﻿" + header.join(";"), ...rows].join("\r\n"),
      "vertice-competencias-demonstrativo.csv",
      "text/csv;charset=utf-8"
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="PESSOAS E COMPETÊNCIAS"
        title="Quem sustenta a execução."
        description="Avaliação de competências, leitura de prontidão e plano de desenvolvimento individual ligados às metas da instituição."
      >
        <button className="button secondary" onClick={exportCsv}>
          <Download size={16} />
          Exportar CSV
        </button>
      </PageHeader>

      <div className="mg-local-banner" role="note">
        <TriangleAlert size={17} aria-hidden="true" />
        <div>
          <strong>Simulação local com pessoas fictícias</strong>
          <p>
            Iniciais, notas e planos são inventados para demonstrar o
            funcionamento. Nenhuma pessoa real é avaliada, nenhum dado sai do
            seu navegador, e esta tela não guarda avaliação em servidor.
          </p>
        </div>
      </div>

      <div className="mg-summary-grid cp-summary">
        <article className="mg-summary-card">
          <span className="mg-summary-icon">
            <Users size={17} />
          </span>
          <div>
            <small>Resultado calibrado</small>
            <strong>
              {summary.calibrated} <em>de {summary.peopleExpected}</em>
            </strong>
          </div>
          <p>
            {summary.peopleInCycle} pessoas com leitura fechada. As demais
            seguem em avaliação.
          </p>
        </article>
        <article className="mg-summary-card">
          <span className="mg-summary-icon">
            <Check size={17} />
          </span>
          <div>
            <small>Ciclo calibrado</small>
            <strong>{summary.calibratedPercent}%</strong>
          </div>
          <p>{summary.pendingReview} devolutivas ainda sem registro.</p>
        </article>
        <article className="mg-summary-card">
          <span className="mg-summary-icon">
            <Target size={17} />
          </span>
          <div>
            <small>Lacuna prioritária</small>
            <strong className="cp-word">
              {summary.priorityGap?.name ?? "—"}
            </strong>
          </div>
          <p>
            {summary.priorityGap
              ? `Distância média de ${formatScore(summary.priorityGap.gap)} pontos até a referência de 5.`
              : "Sem competências medidas."}
          </p>
        </article>
        <article className="mg-summary-card">
          <span className="mg-summary-icon">
            <BookOpen size={17} />
          </span>
          <div>
            <small>PDIs ativos</small>
            <strong>
              {summary.activePlans}
              {summary.plansAtRisk > 0 && (
                <em> · {summary.plansAtRisk} parado</em>
              )}
            </strong>
          </div>
          <p>Planos com responsável, revisão e ações combinadas.</p>
        </article>
      </div>

      <div className="mg-filter-row">
        <p className="mg-helper">
          A matriz posiciona cada pessoa por resultado calibrado e aderência às
          competências críticas. Nenhuma faixa bloqueia promoção ou demissão.
        </p>
        <Filter value={unit} onChange={setUnit} options={units} />
      </div>

      <div className="cp-matrix-wrap">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Prontidão para a próxima etapa</h3>
              <p>
                Resultado calibrado (linha) por aderência às competências
                críticas (coluna). Serve para decidir onde investir apoio.
              </p>
            </div>
          </div>
          <div className="cp-matrix-body">
            <div className="cp-axis-label cp-axis-y">Resultado calibrado</div>
            <div className="cp-box-grid">
              {grid.map(cell => {
                const inCell = cell.people.filter(
                  p => unit === "all" || p.unit === unit
                );
                return (
                  <div
                    className={`cp-box cp-b-${3 - cell.row}-${cell.column}`}
                    key={`${cell.row}-${cell.column}`}
                  >
                    <span className="cp-box-title">
                      {boxTitles[cell.row][cell.column]}
                    </span>
                    <div className="cp-chips">
                      {inCell.map(p => (
                        <span
                          className="cp-chip"
                          style={{
                            background:
                              bandColor[personReadiness(p)?.band ?? "Consolidado"],
                          }}
                          title={`${p.label} · ${p.unit}`}
                          key={p.id}
                        >
                          {p.initials}
                        </span>
                      ))}
                    </div>
                    <span className="cp-box-count">
                      {inCell.length} pessoa{inCell.length === 1 ? "" : "s"}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="cp-axis-label cp-axis-x">
              Aderência às competências críticas
            </div>
          </div>
          <p className="cp-note">
            Uma unidade inteira cair em "apoio necessário" costuma indicar
            instrumento descalibrado, não equipe fraca. O método trata isso como
            pergunta a investigar, nunca como sentença sobre pessoas.
          </p>
        </section>

        <div>
          <section className="panel cp-side">
            <div className="panel-heading">
              <div>
                <h3>Distribuição por faixa</h3>
                <p>
                  Leitura das {assessments.length} pessoas do ciclo
                  demonstrativo.
                </p>
              </div>
            </div>
            <ul className="cp-legend">
              {bandOrder.map(band => (
                <li key={band}>
                  <span
                    className="cp-swatch"
                    style={{ background: bandColor[band] }}
                  />
                  {band}
                  <b>{distribution[band]}</b>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel cp-side">
            <div className="panel-heading">
              <div>
                <h3>Lacunas por competência</h3>
                <p>Distância entre o observado e a referência de 5.</p>
              </div>
            </div>
            <div className="cp-gaps">
              {gaps.slice(0, 4).map((g, i) => (
                <div className="cp-gap-row" key={g.competency.id}>
                  <div className="cp-gap-top">
                    <span>{g.competency.name}</span>
                    <b>{formatScore(g.gap)}</b>
                  </div>
                  <div className="cp-gap-track">
                    <span
                      style={{
                        width: `${Math.min(100, (g.gap / 3) * 100)}%`,
                        background: gapColors[i] ?? gapColors[3],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="cp-scale-note">
              A referência de 5 é a âncora da escala do ciclo, não uma nota
              esperada de todas as pessoas.
            </p>
          </section>
        </div>
      </div>

      <section className="panel cp-table-panel">
        <div className="panel-heading">
          <div>
            <h3>Avaliações do ciclo</h3>
            <p>
              Quem avaliou, o que a leitura calibrada permite afirmar — e o que
              ainda não permite.
            </p>
          </div>
        </div>
        <div className="cp-table-scroll">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Autoavaliação</th>
                <th>Pares</th>
                <th>Liderança</th>
                <th>Calibrado</th>
                <th>Faixa de leitura</th>
                <th>Estado</th>
                <th>Devolutiva</th>
              </tr>
            </thead>
            <tbody>
              {people.map(p => {
                const r = personReadiness(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="cp-name">
                        <span
                          className="cp-chip cp-chip-static"
                          style={{
                            background: bandColor[r?.band ?? "Consolidado"],
                          }}
                        >
                          {p.initials}
                        </span>
                        <div>
                          <strong>{p.label}</strong>
                          <small>{p.unit}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Dots value={toDots(p.selfScore)} />
                    </td>
                    <td>
                      <Dots value={toDots(p.peerScore)} />
                    </td>
                    <td>
                      <Dots value={toDots(p.leaderScore)} />
                    </td>
                    <td className="cp-num">{formatScore(p.calibrated)}</td>
                    <td>
                      {r ? (
                        <span className="badge gray cp-band" title={r.reason}>
                          {r.band}
                        </span>
                      ) : (
                        <span className="badge gray">Sem leitura</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge value={p.status} />
                    </td>
                    <td>
                      <ReviewBadge value={p.review} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="cp-note cp-note-table">
          Autoavaliação, pares e liderança são perspectivas distintas do mesmo
          ciclo. Divergência entre elas é informação para a calibragem, não erro
          a corrigir.
        </p>
      </section>

      <div className="cp-pdi-grid">
        {developmentPlans.map(plan => {
          const person = findPerson(plan.personId);
          const competency = findCompetency(plan.competencyId);
          const progress = planProgress(plan);
          const tone =
            plan.state === "Em dia"
              ? "green"
              : plan.state === "Parado"
                ? "red"
                : "amber";
          return (
            <section className="panel cp-pdi" key={plan.id}>
              <div className="cp-pdi-head">
                <div className="cp-pdi-who">
                  <span className="cp-chip cp-chip-lg">
                    {person?.initials ?? "—"}
                  </span>
                  <div>
                    <strong>{person?.label ?? "Pessoa removida"}</strong>
                    <small>
                      {competency?.name ?? "Competência removida"} ·{" "}
                      {person?.unit ?? "—"}
                    </small>
                  </div>
                </div>
                <span className={`badge ${tone}`}>{plan.state}</span>
              </div>
              <div className="cp-pdi-meta">
                <div>
                  <small>Início</small>
                  <b>{plan.start}</b>
                </div>
                <div>
                  <small>Próxima revisão</small>
                  <b>{plan.nextReview}</b>
                </div>
                <div>
                  <small>Responsável</small>
                  <b>{plan.owner}</b>
                </div>
                <div>
                  <small>Ações</small>
                  <b>
                    {progress.done}/{progress.total}
                  </b>
                </div>
              </div>
              <div className="cp-pdi-scale">
                <div className="cp-gap-top">
                  <span>{competency?.name ?? "Competência"}</span>
                  <b>
                    {formatScore(plan.from)} → {formatScore(plan.to)}
                  </b>
                </div>
                <div className="cp-gap-track">
                  <span
                    className={plan.state === "Parado" ? "cp-warn" : ""}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
              <ul className="cp-actions">
                {plan.actions.map(a => (
                  <li className={a.done ? "done" : ""} key={a.id}>
                    <span className="cp-action-mark">
                      {a.done ? <Check size={11} /> : null}
                    </span>
                    {a.title}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="cp-method-note">
        <h3>Por que esta tela existe no método da Vértice</h3>
        <p>
          A Vértice não vende avaliação de desempenho. O ponto de partida é que
          toda meta depende de alguém capaz de executá-la. Quando o diagnóstico
          mostra uma lacuna de gestão, esta tela responde à pergunta seguinte:
          <em> quem precisa de apoio, em que competência e até quando</em>.
        </p>
        <p>
          Três limites ficam explícitos. Nota calibrada é leitura orientada por
          critério ({readinessCuts.middle.toLocaleString("pt-BR")} e{" "}
          {readinessCuts.high.toLocaleString("pt-BR")} como cortes da matriz),
          não veredito sobre a pessoa. PDI é combinado com responsável e
          revisão, não lista de desejo. E nenhuma avaliação é armazenada sem
          base legal e consentimento registrados — iniciais, nota e plano são
          dado pessoal e exigiriam avaliação de base legal antes de uso real.
        </p>
      </section>
    </>
  );
}
