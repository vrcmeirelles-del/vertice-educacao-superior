import { useEffect, useState } from "react";
import {
  fetchEorbitSemestres, fetchEorbitQuantitativo, fetchEorbitCompliance,
  fetchEorbitDiarioClasse, fetchEorbitEnade, fetchEorbitProfessores,
  fetchEorbitVestibularCursos, fetchEorbitBibliotecaCDD, fetchEorbitBibliotecaDecada,
  fetchEorbitBibliotecaResumo, fetchEorbitFrequenciaConteudo,
  groupBy, conceitoColor, titulacaoLabel, regimeLabel,
  type EorbitSemestre, type EorbitQuantitativo, type ComplianceNota,
  type DiarioClasse, type EnadeRegistro, type Professor,
  type VestibularCurso, type BibliotecaCDD, type BibliotecaDecada,
  type BibliotecaResumo, type FrequenciaConteudo,
} from "@/lib/eorbit";
import "./eorbit.css";

const fmt = new Intl.NumberFormat("pt-BR");
const fmtPct = (v: number) => v.toFixed(1) + "%";
const COLORS = ["#2678a8", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6", "#45b7d1", "#96c93d"];

type SubTab = "quantitativo" | "compliance" | "diario" | "enade" | "docentes" | "vestibular" | "biblioteca";
const SUB_TABS: [SubTab, string][] = [
  ["quantitativo", "Quantitativo"],
  ["compliance", "Compliance"],
  ["diario", "DiÃ¡rio de Classe"],
  ["enade", "ENADE"],
  ["docentes", "Corpo Docente"],
  ["vestibular", "Vestibular"],
  ["biblioteca", "Biblioteca"],
];

export default function PainelEorbit({ institutionId }: { institutionId: string }) {
  const [sub, setSub] = useState<SubTab>("quantitativo");
  const [semestres, setSemestres] = useState<EorbitSemestre[]>([]);
  const [semestre, setSemestre] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEorbitSemestres(institutionId).then(s => {
      setSemestres(s);
      if (s.length) setSemestre(s[s.length - 1].semestre);
      setLoading(false);
    });
  }, [institutionId]);

  const semOpts = semestres.map(s => s.semestre).filter((v, i, a) => a.indexOf(v) === i).sort();

  if (loading) return <div className="eorbit-loading">Carregando dados do e-ORBITâ¦</div>;

  return (
    <div className="eorbit-root">
      <div className="eorbit-header">
        <div>
          <h2>Painel e-ORBIT</h2>
          <p>Dados acadÃªmicos extraÃ­dos do sistema e-ORBIT da instituiÃ§Ã£o</p>
        </div>
      </div>

      <div role="tablist" className="eorbit-subtabs">
        {SUB_TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={sub === key} className="eorbit-subtab" onClick={() => setSub(key)}>
            {label}
          </button>
        ))}
      </div>

      {sub !== "enade" && sub !== "biblioteca" && (
        <div className="eorbit-filters">
          <label>Semestre:</label>
          <select value={semestre} onChange={e => setSemestre(e.target.value)}>
            <option value="">Todos</option>
            {semOpts.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {sub === "quantitativo" && <QuantitativoTab institutionId={institutionId} semestre={semestre} />}
      {sub === "compliance" && <ComplianceTab institutionId={institutionId} semestre={semestre} />}
      {sub === "diario" && <DiarioTab institutionId={institutionId} semestre={semestre} />}
      {sub === "enade" && <EnadeTab institutionId={institutionId} />}
      {sub === "docentes" && <DocentesTab institutionId={institutionId} semestre={semestre} />}
      {sub === "vestibular" && <VestibularTab institutionId={institutionId} semestre={semestre} />}
      {sub === "biblioteca" && <BibliotecaTab institutionId={institutionId} />}
    </div>
  );
}

// ================================================================ Quantitativo
function QuantitativoTab({ institutionId, semestre }: { institutionId: string; semestre: string }) {
  const [data, setData] = useState<EorbitQuantitativo[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); fetchEorbitQuantitativo(institutionId, semestre || undefined).then(d => { setData(d); setLoading(false); }); }, [institutionId, semestre]);

  if (loading) return <div className="eorbit-loading">Carregandoâ¦</div>;
  if (!data.length) return <div className="eorbit-empty">Nenhum dado de quantitativo encontrado.</div>;

  const totalMat = data.reduce((s, d) => s + d.matriculados, 0);
  const totalCap = data.reduce((s, d) => s + d.capacidade, 0);
  const totalVagas = data.reduce((s, d) => s + d.vagas_disponiveis, 0);
  const ocupacao = totalCap > 0 ? (totalMat / totalCap) * 100 : 0;

  const byCurso = groupBy(data, "curso");
  const cursoTotals = Object.entries(byCurso).map(([curso, rows]) => ({
    curso,
    matriculados: rows.reduce((s, r) => s + r.matriculados, 0),
    capacidade: rows.reduce((s, r) => s + r.capacidade, 0),
    vagas: rows.reduce((s, r) => s + r.vagas_disponiveis, 0),
  })).sort((a, b) => b.matriculados - a.matriculados);

  const maxMat = Math.max(...cursoTotals.map(c => c.capacidade), 1);

  return (
    <>
      <div className="eorbit-kpis">
        <KPI label="Matriculados" value={fmt.format(totalMat)} />
        <KPI label="Capacidade" value={fmt.format(totalCap)} />
        <KPI label="Vagas DisponÃ­veis" value={fmt.format(totalVagas)} />
        <KPI label="Taxa de OcupaÃ§Ã£o" value={fmtPct(ocupacao)} sub={ocupacao >= 80 ? "Bom" : ocupacao >= 60 ? "Regular" : "AtenÃ§Ã£o"} />
      </div>

      <div className="eorbit-grid">
        <article className="eorbit-card eorbit-card-wide">
          <h3>Matriculados Ã Capacidade por Curso</h3>
          <svg viewBox={`0 0 600 ${cursoTotals.length * 36 + 20}`} className="eorbit-line-chart" style={{ maxHeight: Math.max(cursoTotals.length * 36 + 20, 120) }}>
            {cursoTotals.map((c, i) => {
              const y = i * 36 + 10;
              const wCap = (c.capacidade / maxMat) * 420;
              const wMat = (c.matriculados / maxMat) * 420;
              return (
                <g key={c.curso}>
                  <text x="0" y={y + 14} fontSize="11" fill="#757a80" textAnchor="start">{c.curso.length > 18 ? c.curso.slice(0, 18) + "â¦" : c.curso}</text>
                  <rect x="140" y={y} width={wCap} height="12" rx="3" fill="#e1e4e8" />
                  <rect x="140" y={y} width={wMat} height="12" rx="3" fill={COLORS[i % COLORS.length]} />
                  <text x={140 + Math.max(wCap, wMat) + 6} y={y + 11} fontSize="10" fill="#243653" fontWeight="600">
                    {fmt.format(c.matriculados)}/{fmt.format(c.capacidade)}
                  </text>
                  <rect x="140" y={y + 16} width={wCap} height="4" rx="2" fill="#f0f2f5" />
                  <rect x="140" y={y + 16} width={(c.matriculados / Math.max(c.capacidade, 1)) * wCap} height="4" rx="2"
                    fill={c.matriculados / Math.max(c.capacidade, 1) >= 0.8 ? "#1baf7a" : c.matriculados / Math.max(c.capacidade, 1) >= 0.5 ? "#eda100" : "#eb6834"} />
                </g>
              );
            })}
          </svg>
        </article>

        <article className="eorbit-card">
          <h3>Detalhamento por Turma</h3>
          <div className="eorbit-table-wrap">
            <table className="eorbit-table">
              <thead><tr><th>Turma</th><th>Curso</th><th>Mat.</th><th>Cap.</th><th>Vagas</th><th>Ocup.</th></tr></thead>
              <tbody>
                {data.slice(0, 30).map(d => (
                  <tr key={d.id}>
                    <td>{d.turma}</td>
                    <td>{d.curso}</td>
                    <td>{fmt.format(d.matriculados)}</td>
                    <td>{fmt.format(d.capacidade)}</td>
                    <td>{fmt.format(d.vagas_disponiveis)}</td>
                    <td>{d.capacidade > 0 ? fmtPct((d.matriculados / d.capacidade) * 100) : "â"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 30 && <p className="eorbit-kpi-sub" style={{ marginTop: 8 }}>Exibindo 30 de {data.length} registros</p>}
          </div>
        </article>
      </div>
    </>
  );
}

// ================================================================ Compliance
function ComplianceTab({ institutionId, semestre }: { institutionId: string; semestre: string }) {
  const [data, setData] = useState<ComplianceNota[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); fetchEorbitCompliance(institutionId, semestre || undefined).then(d => { setData(d); setLoading(false); }); }, [institutionId, semestre]);

  if (loading) return <div className="eorbit-loading">Carregandoâ¦</div>;
  if (!data.length) return <div className="eorbit-empty">Nenhum dado de compliance encontrado.</div>;

  const media = data.reduce((s, d) => s + d.nota, 0) / data.length;
  const byConceito = groupBy(data, "conceito");
  const conceitoCount = Object.entries(byConceito).map(([c, rows]) => ({ conceito: c, count: rows.length })).sort((a, b) => a.conceito.localeCompare(b.conceito));
  const byDimensao = data[0]?.dimensao ? groupBy(data, "dimensao") : null;

  return (
    <>
      <div className="eorbit-kpis">
        <KPI label="Indicadores Avaliados" value={String(data.length)} />
        <KPI label="Nota MÃ©dia" value={media.toFixed(2)} />
        {conceitoCount.map(c => (
          <KPI key={c.conceito} label={`Conceito ${c.conceito}`} value={String(c.count)} />
        ))}
      </div>

      <div className="eorbit-grid">
        <article className="eorbit-card eorbit-card-wide">
          <h3>Indicadores de Compliance</h3>
          <div className="eorbit-table-wrap">
            <table className="eorbit-table">
              <thead><tr><th>Indicador</th>{data[0]?.dimensao && <th>DimensÃ£o</th>}<th>Nota</th><th>Conceito</th><th style={{ minWidth: 120 }}>Barra</th></tr></thead>
              <tbody>
                {data.sort((a, b) => b.nota - a.nota).map(d => (
                  <tr key={d.id}>
                    <td>{d.indicador}</td>
                    {d.dimensao !== undefined && <td>{d.dimensao}</td>}
                    <td>{d.nota.toFixed(2)}</td>
                    <td><span className="eorbit-conceito" style={{ background: conceitoColor(d.conceito) }}>{d.conceito}</span></td>
                    <td>
                      <div className="eorbit-progress">
                        <div className="eorbit-progress-fill" style={{ width: (d.nota / 5) * 100 + "%", background: conceitoColor(d.conceito) }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {byDimensao && (
          <article className="eorbit-card">
            <h3>MÃ©dia por DimensÃ£o</h3>
            <div className="eorbit-hbars">
              {Object.entries(byDimensao).map(([dim, rows], i) => {
                const avg = rows.reduce((s, r) => s + r.nota, 0) / rows.length;
                return (
                  <div className="eorbit-hbar-row" key={dim}>
                    <span className="eorbit-hbar-label">{dim}</span>
                    <div className="eorbit-hbar-track">
                      <div className="eorbit-hbar-fill" style={{ width: (avg / 5) * 100 + "%", background: COLORS[i % COLORS.length] }} />
                    </div>
                    <span className="eorbit-hbar-value">{avg.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </article>
        )}

        <article className="eorbit-card">
          <h3>DistribuiÃ§Ã£o de Conceitos</h3>
          <DonutChart data={conceitoCount.map(c => ({ label: `Conceito ${c.conceito}`, value: c.count, color: conceitoColor(c.conceito) }))} />
        </article>
      </div>
    </>
  );
}

// ================================================================ DiÃ¡rio de Classe
function DiarioTab({ institutionId, semestre }: { institutionId: string; semestre: string }) {
  const [data, setData] = useState<DiarioClasse[]>([]);
  const [freq, setFreq] = useState<FrequenciaConteudo[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchEorbitDiarioClasse(institutionId, semestre || undefined),
      fetchEorbitFrequenciaConteudo(institutionId, semestre || undefined),
    ]).then(([d, f]) => { setData(d); setFreq(f); setLoading(false); });
  }, [institutionId, semestre]);

  if (loading) return <div className="eorbit-loading">Carregandoâ¦</div>;
  if (!data.length && !freq.length) return <div className="eorbit-empty">Nenhum dado de diÃ¡rio de classe encontrado.</div>;

  const avgPreen = data.length ? data.reduce((s, d) => s + d.percentual_preenchimento, 0) / data.length : 0;
  const totalAulasPrev = data.reduce((s, d) => s + d.aulas_previstas, 0);
  const totalAulasReg = data.reduce((s, d) => s + d.aulas_registradas, 0);

  return (
    <>
      <div className="eorbit-kpis">
        <KPI label="Disciplinas" value={String(data.length)} />
        <KPI label="Preenchimento MÃ©dio" value={fmtPct(avgPreen)} sub={avgPreen >= 80 ? "Bom" : avgPreen >= 60 ? "Regular" : "Baixo"} />
        <KPI label="Aulas Previstas" value={fmt.format(totalAulasPrev)} />
        <KPI label="Aulas Registradas" value={fmt.format(totalAulasReg)} />
      </div>

      <div className="eorbit-grid">
        <article className="eorbit-card eorbit-card-wide">
          <h3>Preenchimento por Disciplina</h3>
          <div className="eorbit-table-wrap">
            <table className="eorbit-table">
              <thead><tr><th>Disciplina</th><th>Professor</th><th>Curso</th><th>Previstas</th><th>Registradas</th><th>Preenchi.</th><th style={{ minWidth: 80 }}>Barra</th></tr></thead>
              <tbody>
                {data.sort((a, b) => a.percentual_preenchimento - b.percentual_preenchimento).map(d => (
                  <tr key={d.id}>
                    <td>{d.disciplina}</td>
                    <td>{d.professor}</td>
                    <td>{d.curso}</td>
                    <td>{d.aulas_previstas}</td>
                    <td>{d.aulas_registradas}</td>
                    <td style={{ fontWeight: 600, color: d.percentual_preenchimento >= 80 ? "#1baf7a" : d.percentual_preenchimento >= 60 ? "#eda100" : "#eb6834" }}>
                      {fmtPct(d.percentual_preenchimento)}
                    </td>
                    <td>
                      <div className="eorbit-progress">
                        <div className="eorbit-progress-fill" style={{ width: Math.min(d.percentual_preenchimento, 100) + "%",
                          background: d.percentual_preenchimento >= 80 ? "#1baf7a" : d.percentual_preenchimento >= 60 ? "#eda100" : "#eb6834" }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {freq.length > 0 && (
          <article className="eorbit-card eorbit-card-wide">
            <h3>ConteÃºdo ProgramÃ¡tico â ExecuÃ§Ã£o</h3>
            <div className="eorbit-table-wrap">
              <table className="eorbit-table">
                <thead><tr><th>Disciplina</th><th>Curso</th><th>Previsto</th><th>Ministrado</th><th>% ExecuÃ§Ã£o</th></tr></thead>
                <tbody>
                  {freq.sort((a, b) => a.percentual - b.percentual).slice(0, 20).map(f => (
                    <tr key={f.id}>
                      <td>{f.disciplina}</td>
                      <td>{f.curso}</td>
                      <td>{f.conteudo_previsto}</td>
                      <td>{f.conteudo_ministrado}</td>
                      <td style={{ fontWeight: 600, color: f.percentual >= 80 ? "#1baf7a" : f.percentual >= 60 ? "#eda100" : "#eb6834" }}>
                        {fmtPct(f.percentual)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )}
      </div>
    </>
  );
}

// ================================================================ ENADE
function EnadeTab({ institutionId }: { institutionId: string }) {
  const [data, setData] = useState<EnadeRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); fetchEorbitEnade(institutionId).then(d => { setData(d); setLoading(false); }); }, [institutionId]);

  if (loading) return <div className="eorbit-loading">Carregandoâ¦</div>;
  if (!data.length) return <div className="eorbit-empty">Nenhum dado do ENADE encontrado.</div>;

  const byCurso = groupBy(data, "curso");
  const cursos = Object.keys(byCurso).sort();
  const anos = [...new Set(data.map(d => d.ano))].sort();
  const ultimoAno = anos[anos.length - 1];
  const ultimosDados = data.filter(d => d.ano === ultimoAno);
  const mediaConceito = ultimosDados.length ? ultimosDados.reduce((s, d) => s + (d.conceito_enade ?? 0), 0) / ultimosDados.length : 0;

  // Line chart
  const w = 560, h = 200, px = 50, py = 20;
  const maxY = 5;
  const xStep = anos.length > 1 ? (w - px * 2) / (anos.length - 1) : 0;
  const toX = (i: number) => px + i * xStep;
  const toY = (v: number) => py + (h - py * 2) * (1 - v / maxY);

  return (
    <>
      <div className="eorbit-kpis">
        <KPI label="Cursos Avaliados" value={String(cursos.length)} />
        <KPI label="Ãltimo Ciclo" value={String(ultimoAno)} />
        <KPI label="Conceito MÃ©dio" value={mediaConceito.toFixed(1)} sub={`Ciclo ${ultimoAno}`} />
        <KPI label="Total de Registros" value={String(data.length)} />
      </div>

      <div className="eorbit-grid">
        <article className="eorbit-card eorbit-card-wide">
          <h3>EvoluÃ§Ã£o do Conceito ENADE por Curso</h3>
          <div className="eorbit-legend">
            {cursos.map((c, i) => (
              <span key={c} className="eorbit-legend-item"><i style={{ background: COLORS[i % COLORS.length] }} />{c}</span>
            ))}
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="eorbit-line-chart">
            {[1, 2, 3, 4, 5].map(v => (
              <g key={v}>
                <line x1={px} y1={toY(v)} x2={w - px} y2={toY(v)} stroke="#e1e4e8" strokeWidth="1" />
                <text x={px - 8} y={toY(v) + 4} fontSize="10" fill="#757a80" textAnchor="end">{v}</text>
              </g>
            ))}
            {anos.map((a, i) => (
              <text key={a} x={toX(i)} y={h - 2} fontSize="10" fill="#757a80" textAnchor="middle">{a}</text>
            ))}
            {cursos.map((curso, ci) => {
              const rows = byCurso[curso].sort((a, b) => a.ano - b.ano);
              const points = rows.map(r => {
                const xi = anos.indexOf(r.ano);
                return `${toX(xi)},${toY(r.conceito_enade ?? 0)}`;
              }).join(" ");
              return (
                <g key={curso}>
                  <polyline points={points} fill="none" stroke={COLORS[ci % COLORS.length]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {rows.map(r => {
                    const xi = anos.indexOf(r.ano);
                    return <circle key={r.id} cx={toX(xi)} cy={toY(r.conceito_enade ?? 0)} r="4" fill={COLORS[ci % COLORS.length]} stroke="white" strokeWidth="2" />;
                  })}
                </g>
              );
            })}
          </svg>
        </article>

        <article className="eorbit-card">
          <h3>Dados por Curso â Ãltimo Ciclo ({ultimoAno})</h3>
          <div className="eorbit-table-wrap">
            <table className="eorbit-table">
              <thead><tr><th>Curso</th><th>Conceito</th><th>ContÃ­nuo</th><th>Participantes</th></tr></thead>
              <tbody>
                {ultimosDados.sort((a, b) => (b.conceito_enade ?? 0) - (a.conceito_enade ?? 0)).map(d => (
                  <tr key={d.id}>
                    <td>{d.curso}</td>
                    <td><span className="eorbit-conceito" style={{ background: d.conceito_enade ? ["#d43d51", "#eb6834", "#eda100", "#2678a8", "#1baf7a"][Math.min(d.conceito_enade - 1, 4)] : "#757a80" }}>{d.conceito_enade ?? "â"}</span></td>
                    <td>{d.conceito_continuo?.toFixed(3) ?? "â"}</td>
                    <td>{d.num_participantes ?? "â"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </>
  );
}

// ================================================================ Corpo Docente
function DocentesTab({ institutionId, semestre }: { institutionId: string; semestre: string }) {
  const [data, setData] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); fetchEorbitProfessores(institutionId, semestre || undefined).then(d => { setData(d); setLoading(false); }); }, [institutionId, semestre]);

  if (loading) return <div className="eorbit-loading">Carregandoâ¦</div>;
  if (!data.length) return <div className="eorbit-empty">Nenhum dado de corpo docente encontrado.</div>;

  const byTitulacao = groupBy(data, "titulacao");
  const byRegime = groupBy(data, "regime");
  const titCounts = Object.entries(byTitulacao).map(([t, rows]) => ({ label: titulacaoLabel(t), value: rows.length })).sort((a, b) => b.value - a.value);
  const regCounts = Object.entries(byRegime).map(([r, rows]) => ({ label: regimeLabel(r), value: rows.length })).sort((a, b) => b.value - a.value);

  // IDD-like qualification index: doutor=5, mestre=3, especialista=1, graduado=0
  const qualScore: Record<string, number> = { doutor: 5, doutorado: 5, mestre: 3, mestrado: 3, especialista: 1, especializacao: 1, graduado: 0, graduacao: 0 };
  const totalScore = data.reduce((s, d) => s + (qualScore[d.titulacao?.toLowerCase()] ?? 0), 0);
  const iqcd = data.length ? totalScore / data.length : 0;

  return (
    <>
      <div className="eorbit-kpis">
        <KPI label="Total de Docentes" value={String(data.length)} />
        <KPI label="IQCD" value={iqcd.toFixed(2)} sub="Ãndice de qualificaÃ§Ã£o" />
        {titCounts.slice(0, 3).map(t => <KPI key={t.label} label={t.label + "s"} value={String(t.value)} />)}
      </div>

      <div className="eorbit-grid">
        <article className="eorbit-card">
          <h3>TitulaÃ§Ã£o</h3>
          <DonutChart data={titCounts.map((t, i) => ({ label: t.label, value: t.value, color: COLORS[i % COLORS.length] }))} />
        </article>

        <article className="eorbit-card">
          <h3>Regime de Trabalho</h3>
          <DonutChart data={regCounts.map((r, i) => ({ label: r.label, value: r.value, color: COLORS[(i + 3) % COLORS.length] }))} />
        </article>

        <article className="eorbit-card eorbit-card-wide">
          <h3>Lista de Docentes</h3>
          <div className="eorbit-table-wrap">
            <table className="eorbit-table">
              <thead><tr><th>Nome</th><th>TitulaÃ§Ã£o</th><th>Regime</th><th>Curso</th></tr></thead>
              <tbody>
                {data.sort((a, b) => a.nome.localeCompare(b.nome)).map(d => (
                  <tr key={d.id}>
                    <td>{d.nome}</td>
                    <td>{titulacaoLabel(d.titulacao)}</td>
                    <td>{regimeLabel(d.regime)}</td>
                    <td>{d.curso ?? "â"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </>
  );
}

// ================================================================ Vestibular
function VestibularTab({ institutionId, semestre }: { institutionId: string; semestre: string }) {
  const [data, setData] = useState<VestibularCurso[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); fetchEorbitVestibularCursos(institutionId, semestre || undefined).then(d => { setData(d); setLoading(false); }); }, [institutionId, semestre]);

  if (loading) return <div className="eorbit-loading">Carregandoâ¦</div>;
  if (!data.length) return <div className="eorbit-empty">Nenhum dado de vestibular encontrado.</div>;

  const totalInscritos = data.reduce((s, d) => s + d.inscritos, 0);
  const totalVagas = data.reduce((s, d) => s + d.vagas_ofertadas, 0);
  const totalMat = data.reduce((s, d) => s + (d.matriculados ?? 0), 0);
  const concorrencia = totalVagas > 0 ? totalInscritos / totalVagas : 0;

  const byCurso = groupBy(data, "curso");
  const cursoTotals = Object.entries(byCurso).map(([curso, rows]) => ({
    curso,
    inscritos: rows.reduce((s, r) => s + r.inscritos, 0),
    vagas: rows.reduce((s, r) => s + r.vagas_ofertadas, 0),
    matriculados: rows.reduce((s, r) => s + (r.matriculados ?? 0), 0),
  })).sort((a, b) => b.inscritos - a.inscritos);

  const maxIns = Math.max(...cursoTotals.map(c => c.inscritos), 1);

  return (
    <>
      <div className="eorbit-kpis">
        <KPI label="Total de Inscritos" value={fmt.format(totalInscritos)} />
        <KPI label="Vagas Ofertadas" value={fmt.format(totalVagas)} />
        <KPI label="ConcorrÃªncia" value={concorrencia.toFixed(2) + ":1"} />
        <KPI label="Matriculados" value={fmt.format(totalMat)} />
      </div>

      <div className="eorbit-grid">
        <article className="eorbit-card eorbit-card-wide">
          <h3>Inscritos por Curso</h3>
          <div className="eorbit-hbars">
            {cursoTotals.map((c, i) => (
              <div className="eorbit-hbar-row" key={c.curso}>
                <span className="eorbit-hbar-label">{c.curso}</span>
                <div className="eorbit-hbar-track">
                  <div className="eorbit-hbar-fill" style={{ width: (c.inscritos / maxIns) * 100 + "%", background: COLORS[i % COLORS.length] }} />
                </div>
                <span className="eorbit-hbar-value">{fmt.format(c.inscritos)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="eorbit-card">
          <h3>Detalhamento</h3>
          <div className="eorbit-table-wrap">
            <table className="eorbit-table">
              <thead><tr><th>Curso</th><th>Semestre</th><th>Vagas</th><th>Inscritos</th><th>Conc.</th><th>Mat.</th></tr></thead>
              <tbody>
                {data.sort((a, b) => b.inscritos - a.inscritos).map(d => (
                  <tr key={d.id}>
                    <td>{d.curso}</td>
                    <td>{d.semestre}</td>
                    <td>{fmt.format(d.vagas_ofertadas)}</td>
                    <td>{fmt.format(d.inscritos)}</td>
                    <td>{d.vagas_ofertadas > 0 ? (d.inscritos / d.vagas_ofertadas).toFixed(2) : "â"}</td>
                    <td>{d.matriculados != null ? fmt.format(d.matriculados) : "â"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </>
  );
}

// ================================================================ Biblioteca
function BibliotecaTab({ institutionId }: { institutionId: string }) {
  const [cdd, setCdd] = useState<BibliotecaCDD[]>([]);
  const [decada, setDecada] = useState<BibliotecaDecada[]>([]);
  const [resumo, setResumo] = useState<BibliotecaResumo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchEorbitBibliotecaCDD(institutionId),
      fetchEorbitBibliotecaDecada(institutionId),
      fetchEorbitBibliotecaResumo(institutionId),
    ]).then(([c, d, r]) => { setCdd(c); setDecada(d); setResumo(r); setLoading(false); });
  }, [institutionId]);

  if (loading) return <div className="eorbit-loading">Carregandoâ¦</div>;
  if (!cdd.length && !decada.length && !resumo.length) return <div className="eorbit-empty">Nenhum dado de biblioteca encontrado.</div>;

  const r = resumo[0];
  const totalCDD = cdd.reduce((s, c) => s + c.quantidade, 0);
  const maxCDD = Math.max(...cdd.map(c => c.quantidade), 1);

  // Decade bar chart
  const sortedDecada = [...decada].sort((a, b) => a.decada.localeCompare(b.decada));
  const maxDec = Math.max(...sortedDecada.map(d => d.quantidade), 1);
  const barW = 560, barH = 180, barPx = 50, barPy = 20;
  const barStep = sortedDecada.length > 1 ? (barW - barPx * 2) / sortedDecada.length : barW - barPx * 2;
  const barColW = barStep * 0.7;

  return (
    <>
      <div className="eorbit-kpis">
        {r && <KPI label="Total de TÃ­tulos" value={fmt.format(r.total_titulos)} />}
        {r && <KPI label="Total de Exemplares" value={fmt.format(r.total_exemplares)} />}
        {r?.acervo_digital != null && <KPI label="Acervo Digital" value={fmt.format(r.acervo_digital)} />}
        <KPI label="Classes CDD" value={String(cdd.length)} />
      </div>

      <div className="eorbit-grid">
        <article className="eorbit-card">
          <h3>Acervo por Classe CDD</h3>
          <div className="eorbit-hbars">
            {cdd.sort((a, b) => b.quantidade - a.quantidade).slice(0, 12).map((c, i) => (
              <div className="eorbit-hbar-row" key={c.id}>
                <span className="eorbit-hbar-label" title={c.descricao}>{c.classe_cdd} â {c.descricao.length > 20 ? c.descricao.slice(0, 20) + "â¦" : c.descricao}</span>
                <div className="eorbit-hbar-track">
                  <div className="eorbit-hbar-fill" style={{ width: (c.quantidade / maxCDD) * 100 + "%", background: COLORS[i % COLORS.length] }} />
                </div>
                <span className="eorbit-hbar-value">{fmt.format(c.quantidade)}</span>
              </div>
            ))}
          </div>
        </article>

        {sortedDecada.length > 0 && (
          <article className="eorbit-card">
            <h3>Acervo por DÃ©cada de PublicaÃ§Ã£o</h3>
            <svg viewBox={`0 0 ${barW} ${barH}`} className="eorbit-line-chart">
              {sortedDecada.map((d, i) => {
                const x = barPx + i * barStep + (barStep - barColW) / 2;
                const barHeight = (d.quantidade / maxDec) * (barH - barPy * 2);
                const y = barH - barPy - barHeight;
                return (
                  <g key={d.id}>
                    <rect x={x} y={y} width={barColW} height={barHeight} rx="3" fill={COLORS[i % COLORS.length]} />
                    <text x={x + barColW / 2} y={barH - 4} fontSize="9" fill="#757a80" textAnchor="middle">{d.decada}</text>
                    <text x={x + barColW / 2} y={y - 4} fontSize="9" fill="#243653" textAnchor="middle" fontWeight="600">{fmt.format(d.quantidade)}</text>
                  </g>
                );
              })}
            </svg>
          </article>
        )}
      </div>
    </>
  );
}

// ================================================================ Shared components
function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <article className="eorbit-kpi">
      <span className="eorbit-kpi-label">{label}</span>
      <strong className="eorbit-kpi-value">{value}</strong>
      {sub && <span className="eorbit-kpi-sub">{sub}</span>}
    </article>
  );
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const r = 50, cx = 60, cy = 60, strokeW = 18;
  let angle = -90;

  return (
    <div className="eorbit-donut-wrap">
      <svg viewBox="0 0 120 120" width="120" height="120">
        {data.map(d => {
          const pct = d.value / total;
          const arc = pct * 360;
          const startAngle = angle;
          angle += arc;
          const endAngle = angle;
          const largeArc = arc > 180 ? 1 : 0;
          const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
          const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
          const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
          const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
          if (pct < 0.01) return null;
          return (
            <path key={d.label}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none" stroke={d.color} strokeWidth={strokeW} />
          );
        })}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="16" fontWeight="700" fill="#172e46">{total}</text>
      </svg>
      <div className="eorbit-donut-legend">
        {data.map(d => (
          <span key={d.label} className="eorbit-donut-legend-item">
            <i style={{ background: d.color }} />{d.label}: {d.value} ({total > 0 ? ((d.value / total) * 100).toFixed(0) + "%" : "â"})
          </span>
        ))}
      </div>
    </div>
  );
}
