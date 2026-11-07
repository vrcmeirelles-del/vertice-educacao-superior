import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./direito-raio-x.css";

interface Props { institutionId: string }

export default function DireitoRaioX({ institutionId }: Props) {
  const [semData, setSemData] = useState<any[]>([]);
  const [turmaData, setTurmaData] = useState<any[]>([]);
  const [profData, setProfData] = useState<any>(null);
  const [quantGeral, setQuantGeral] = useState<any>(null);
  const [docenteEvo, setDocenteEvo] = useState<any>(null);
  const [serieReal, setSerieReal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 1. Course semester stats (evolução semestral)
      const { data: css } = await supabase
        .from("vertice_course_semester_stats")
        .select("*")
        .ilike("curso", "%DIREITO%")
        .order("semestre");
      if (css) setSemData(css);

      // 2. Turma stats
      const { data: ts } = await supabase
        .from("vertice_turma_stats")
        .select("*")
        .ilike("curso", "%DIREITO%")
        .order("semestre");
      if (ts) setTurmaData(ts);

      // 3. Raio-X data from new table
      const { data: rx } = await supabase
        .from("vertice_eorbit_direito_raio_x")
        .select("*")
        .order("created_at");
      if (rx) {
        const qg = rx.find(r => r.tipo === "quantitativo_geral");
        if (qg) setQuantGeral(qg.dados);
        const pe = rx.find(r => r.tipo === "professor_disciplina");
        if (pe) setProfData(pe.dados);
        const de = rx.find(r => r.tipo === "corpo_docente_evolucao");
        if (de) setDocenteEvo(de.dados);
        const sr = rx.find(r => r.tipo === "serie_historica_real");
        if (sr) setSerieReal(sr.dados);
      }

      setLoading(false);
    })();
  }, [institutionId]);

  if (loading) return <p style={{padding:24,color:"var(--muted-foreground)"}}>Carregando Raio-X do Direito…</p>;

  // Compute KPIs
  const latest = semData.length > 0 ? semData[semData.length - 1] : null;
  const prev = semData.length > 1 ? semData[semData.length - 2] : null;
  const matriculadosAtual = latest?.matriculados || 0;
  const matriculadosPrev = prev?.matriculados || 0;
  const crescimento = matriculadosPrev > 0 ? (((matriculadosAtual - matriculadosPrev) / matriculadosPrev) * 100).toFixed(1) : "—";
  const taxaEvasao = latest ? parseFloat(latest.taxa_evasao) : 0;
  const totalGeral = quantGeral?.total_geral || 0;
  const trancados = quantGeral?.status?.TRANCADO || 0;
  const cancelados = quantGeral?.status?.CANCELADO || 0;
  const profCount = docenteEvo?.evolucao?.["2026/01"]?.professores || profData?.professores?.length || 0;

  // Semestres from 2023+
  const semFiltered = semData.filter(s => s.semestre >= "2023/01");

  return (
    <div className="drx">
      {/* Header */}
      <div className="drx-header">
        <div>
          <p className="drx-eyebrow">Raio-X Estratégico</p>
          <h3>Curso de Direito — UNITOP</h3>
          <p className="drx-sub">Dados reais extraídos do e-ORBIT · Atualizado em {new Date().toLocaleDateString("pt-BR")}</p>
        </div>
        <div className="drx-badge">
          <span className="drx-badge-icon">⚖️</span>
          <span>Presencial</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="drx-kpis">
        <div className="drx-kpi" style={{borderLeftColor:"var(--primary)"}}>
          <small>Matriculados (atual)</small>
          <strong>{matriculadosAtual}</strong>
          <span>{crescimento !== "—" ? `${Number(crescimento) > 0 ? "+" : ""}${crescimento}% vs anterior` : "—"}</span>
        </div>
        <div className="drx-kpi" style={{borderLeftColor:"var(--success)"}}>
          <small>Total Histórico</small>
          <strong>{totalGeral}</strong>
          <span>vínculos desde 2023</span>
        </div>
        <div className="drx-kpi" style={{borderLeftColor: taxaEvasao > 50 ? "var(--danger)" : taxaEvasao > 20 ? "var(--warning)" : "var(--success)"}}>
          <small>Taxa de Evasão</small>
          <strong>{taxaEvasao.toFixed(1)}%</strong>
          <span>{taxaEvasao <= 20 ? "✓ Saudável" : taxaEvasao <= 50 ? "⚠ Atenção" : "🔴 Crítica"}</span>
        </div>
        <div className="drx-kpi" style={{borderLeftColor:"#7c3aed"}}>
          <small>Corpo Docente</small>
          <strong>{profCount}</strong>
          <span>professores em 2026/01</span>
        </div>
        <div className="drx-kpi" style={{borderLeftColor:"var(--warning)"}}>
          <small>Trancados</small>
          <strong>{trancados}</strong>
          <span>{totalGeral > 0 ? `${((trancados/totalGeral)*100).toFixed(0)}% do total` : ""}</span>
        </div>
        <div className="drx-kpi" style={{borderLeftColor:"var(--danger)"}}>
          <small>Cancelados</small>
          <strong>{cancelados}</strong>
          <span>{totalGeral > 0 ? `${((cancelados/totalGeral)*100).toFixed(0)}% do total` : ""}</span>
        </div>
      </div>

      {/* Série Histórica REAL vs Snapshot */}
      {serieReal && serieReal.ingressantes_1o_periodo && (
        <div className="drx-section">
          <h4>🎯 Série Histórica Real — Ingressantes 1º Período</h4>
          <p className="drx-sub">Alunos que efetivamente cursaram vs. snapshot atual do sistema. Fonte: Cadastro de Notas e-ORBIT.</p>
          <div className="drx-table-wrap">
            <table className="drx-table">
              <thead>
                <tr>
                  <th>Semestre</th>
                  <th>Turmas</th>
                  <th>Alunos Reais</th>
                  <th>Snapshot Atual</th>
                  <th>Diferença</th>
                  <th>Aprovados</th>
                  <th>Reprov. Falta</th>
                  <th>Reprov. Nota</th>
                  <th>Transferidos</th>
                  <th>Cancelados/Aband.</th>
                </tr>
              </thead>
              <tbody>
                {serieReal.ingressantes_1o_periodo.map((s: any, i: number) => {
                  const total = s.total_real || s.total_real_parcial || 0;
                  const snap = s.snapshot_atual || 0;
                  const diff = total - snap;
                  const sits = s.situacoes || {};
                  const ad = (sits.AD || 0) + (sits.AF || 0);
                  const rf = sits.RF || 0;
                  const rn = (sits.RN || 0) + (sits.RA || 0);
                  const tr = sits.TR || 0;
                  const ca = (sits.CA || 0) + (sits.AC || 0) + (sits.AB || 0) + (sits.CR || 0);
                  // For 2026/01 which has combined data
                  const sits1a = s.situacoes_1a || {};
                  const sits1b = s.situacoes_1b || {};
                  const adComb = s.situacoes_1a ? (sits1a.AD||0)+(sits1a.AF||0)+(sits1b.AD||0)+(sits1b.AF||0) : ad;
                  const rfComb = s.situacoes_1a ? (sits1a.RF||0)+(sits1b.RF||0) : rf;
                  const rnComb = s.situacoes_1a ? (sits1a.RN||0)+(sits1a.RA||0)+(sits1b.RN||0)+(sits1b.RA||0) : rn;
                  const trComb = s.situacoes_1a ? (sits1a.TR||0)+(sits1b.TR||0) : tr;
                  const caComb = s.situacoes_1a ? (sits1a.CA||0)+(sits1a.AC||0)+(sits1b.CA||0)+(sits1b.AC||0)+(sits1b.CR||0) : ca;
                  return (
                    <tr key={i}>
                      <td><strong>{s.semestre}</strong></td>
                      <td>{(s.turmas || []).join(", ")}</td>
                      <td><strong style={{fontSize:16}}>{total}{s.total_real_parcial ? "*" : ""}</strong></td>
                      <td style={{color:"var(--muted-foreground)"}}>{snap}</td>
                      <td><span className="drx-trend-down">-{diff} ({total > 0 ? ((diff/total)*100).toFixed(0) : 0}%)</span></td>
                      <td><span style={{color:"var(--success)", fontWeight:600}}>{adComb}</span></td>
                      <td>{rfComb > 0 ? <span style={{color:"var(--danger)"}}>{rfComb}</span> : "—"}</td>
                      <td>{rnComb > 0 ? <span style={{color:"var(--warning)"}}>{rnComb}</span> : "—"}</td>
                      <td>{trComb > 0 ? trComb : "—"}</td>
                      <td>{caComb > 0 ? <span style={{color:"var(--danger)"}}>{caComb}</span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="drx-footer" style={{marginTop:8}}>
            * Parcial — apenas uma turma extraída.<br/>
            <strong>Legenda:</strong> AD = Aprovado Direto · AF = Aprovado Final · RF = Reprovado por Falta · RN = Reprovado por Nota · RA = Reprovado por Ambos · TR = Transferido · CA = Cancelado · AC = Abandonou · CR = Cancelado Rematrícula
          </p>
        </div>
      )}

      {/* Evolução Semestral */}
      <div className="drx-section">
        <h4>📈 Evolução Semestral</h4>
        <p className="drx-sub">Matriculados, evasão e ocupação por semestre — dados reais do e-ORBIT</p>
        <div className="drx-table-wrap">
          <table className="drx-table">
            <thead>
              <tr>
                <th>Semestre</th>
                <th>Matric.</th>
                <th>Trancados</th>
                <th>Cancelados</th>
                <th>Transf.</th>
                <th>Vagas</th>
                <th>Ocupação</th>
                <th>Evasão</th>
                <th>Tendência</th>
              </tr>
            </thead>
            <tbody>
              {semFiltered.map((s, i) => {
                const prevMat = i > 0 ? semFiltered[i-1].matriculados : 0;
                const diff = s.matriculados - prevMat;
                return (
                  <tr key={s.semestre}>
                    <td><strong>{s.semestre}</strong></td>
                    <td>{s.matriculados}</td>
                    <td>{s.trancado}</td>
                    <td>{s.cancelado}</td>
                    <td>{s.transferido}</td>
                    <td>{s.vagas}</td>
                    <td>
                      <div className="drx-bar-wrap">
                        <div className="drx-bar" style={{width: `${Math.min(100, parseFloat(s.taxa_ocupacao))}%`, background: parseFloat(s.taxa_ocupacao) > 30 ? "var(--success)" : parseFloat(s.taxa_ocupacao) > 15 ? "var(--warning)" : "var(--danger)"}} />
                        <span>{parseFloat(s.taxa_ocupacao).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`drx-chip ${parseFloat(s.taxa_evasao) > 50 ? "drx-chip-red" : parseFloat(s.taxa_evasao) > 20 ? "drx-chip-yellow" : "drx-chip-green"}`}>
                        {parseFloat(s.taxa_evasao).toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      {i === 0 ? "—" : diff > 0 ? <span className="drx-trend-up">▲ +{diff}</span> : diff < 0 ? <span className="drx-trend-down">▼ {diff}</span> : <span>→</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Corpo Docente */}
      {profData && (
        <div className="drx-section">
          <h4>👨‍🏫 Corpo Docente — 2026/01</h4>
          <p className="drx-sub">{profData.professores?.length || 0} professores atuantes no curso de Direito</p>
          <div className="drx-table-wrap">
            <table className="drx-table">
              <thead>
                <tr>
                  <th>Professor</th>
                  <th>Disciplinas</th>
                </tr>
              </thead>
              <tbody>
                {(profData.professores || []).map((p: any, i: number) => (
                  <tr key={i}>
                    <td><strong>{p.nome}</strong></td>
                    <td>{(p.disciplinas || []).join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evolução do Corpo Docente */}
      {docenteEvo && (
        <div className="drx-section">
          <h4>📊 Evolução do Corpo Docente</h4>
          <div className="drx-docente-grid">
            {Object.entries(docenteEvo.evolucao || {}).map(([sem, data]: [string, any]) => (
              <div key={sem} className="drx-docente-card">
                <span className="drx-docente-sem">{sem}</span>
                <strong className="drx-docente-num">{data.professores}</strong>
                <span className="drx-docente-label">professores</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Turmas Detalhadas */}
      {turmaData.length > 0 && (
        <div className="drx-section">
          <h4>🏫 Turmas por Semestre</h4>
          <p className="drx-sub">Distribuição de matriculados por turma/período</p>
          <div className="drx-table-wrap">
            <table className="drx-table">
              <thead>
                <tr>
                  <th>Semestre</th>
                  <th>Turma</th>
                  <th>Série</th>
                  <th>Matriculados</th>
                </tr>
              </thead>
              <tbody>
                {turmaData.filter(t => t.semestre >= "2023/01").map((t, i) => (
                  <tr key={i}>
                    <td>{t.semestre}</td>
                    <td><strong>{t.turma}</strong></td>
                    <td>{t.serie}º</td>
                    <td>{t.matriculados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status Geral */}
      {quantGeral && (
        <div className="drx-section">
          <h4>📋 Distribuição por Status (Acumulado)</h4>
          <div className="drx-status-grid">
            {Object.entries(quantGeral.status || {}).map(([key, val]: [string, any]) => (
              <div key={key} className={`drx-status-item ${val > 0 ? "" : "drx-status-zero"}`}>
                <span className="drx-status-label">{key.replace(/_/g, " ")}</span>
                <strong>{val}</strong>
                <span className="drx-status-pct">{totalGeral > 0 ? `${((val/totalGeral)*100).toFixed(1)}%` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="drx-footer">
        Dados extraídos do e-ORBIT (itop.eorbit.com.br) em {new Date().toLocaleDateString("pt-BR")} · Processado pela Vértice Educação Superior
      </div>
    </div>
  );
}
