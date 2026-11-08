import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import "./direito-raio-x.css";

interface Props { institutionId: string }

const UNITOP_ID = "1f5fd5b4-93c6-4626-834d-136884915587";
const SEM_IDS: Record<string,number> = {"2023/01":41,"2023/02":42,"2024/01":43,"2024/02":44,"2025/01":45,"2025/02":46,"2026/01":47};
const GHOST_SITS = new Set(["CA","RF","AC","AB","TR"]);
const SIT_LABELS: Record<string,string> = {AD:"Aprovado Direto",AF:"Aprovado Final",RF:"Reprov. Falta",RN:"Reprov. Nota",RA:"Reprov. Ambos",TR:"Transferido",CA:"Cancelado",AC:"Abandono",CR:"Concluído c/ Ressalva",AB:"Abandono"};

export default function DireitoRaioX({ institutionId }: Props) {
  const [semData, setSemData] = useState<any[]>([]);
  const [turmaData, setTurmaData] = useState<any[]>([]);
  const [profData, setProfData] = useState<any>(null);
  const [quantGeral, setQuantGeral] = useState<any>(null);
  const [docenteEvo, setDocenteEvo] = useState<any>(null);
  const [serieReal, setSerieReal] = useState<any>(null);
  const [sourceStatus, setSourceStatus] = useState<"ready"|"pending_mapping"|"error">("pending_mapping");
  const [sourceDate, setSourceDate] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);

  // Accordion state
  const [openSem, setOpenSem] = useState<string|null>(null);
  const [openTurma, setOpenTurma] = useState<string|null>(null);
  const [turmaAlunos, setTurmaAlunos] = useState<Record<string, any[]>>({});
  const [loadingTurma, setLoadingTurma] = useState<string|null>(null);

  useEffect(() => {
    let active = true;
    setSemData([]); setTurmaData([]); setProfData(null); setQuantGeral(null);
    setDocenteEvo(null); setSerieReal(null); setSourceStatus("pending_mapping");
    setSourceDate(null); setLoading(true);
    if (institutionId !== UNITOP_ID) { setLoading(false); return () => { active = false; }; }
    (async () => {
      try {
        const [courseStats, classStats, source] = await Promise.all([
          supabase.from("vertice_course_semester_stats").select("*").eq("institution_id", institutionId).ilike("curso", "%DIREITO%").order("semestre"),
          supabase.from("vertice_turma_stats").select("*").eq("institution_id", institutionId).ilike("curso", "%DIREITO%").order("semestre"),
          supabase.from("vertice_eorbit_direito_raio_x").select("tipo,dados,data_extracao,created_at").eq("institution_id", institutionId).order("created_at"),
        ]);
        if (!active) return;
        if (courseStats.error || classStats.error || source.error) { setSourceStatus("error"); return; }
        setSemData(courseStats.data ?? []);
        setTurmaData(classStats.data ?? []);
        const rx = source.data ?? [];
        if (rx.length === 0) { setSourceStatus("pending_mapping"); return; }
        setSourceStatus("ready");
        const dates = rx.map(r => r.data_extracao).filter(Boolean).sort();
        setSourceDate(dates.length ? new Date(dates[dates.length - 1] + "T12:00:00").toLocaleDateString("pt-BR") : null);
        const qg = rx.find(r => r.tipo === "quantitativo_geral"); if (qg) setQuantGeral(qg.dados);
        const pe = rx.find(r => r.tipo === "professor_disciplina"); if (pe) setProfData(pe.dados);
        const de = rx.find(r => r.tipo === "corpo_docente_evolucao"); if (de) setDocenteEvo(de.dados);
        const sr = rx.find(r => r.tipo === "serie_historica_real"); if (sr) setSerieReal(sr.dados);
      } catch { if (active) setSourceStatus("error"); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [institutionId]);

  const toggleSem = useCallback((sem: string) => {
    setOpenSem(prev => prev === sem ? null : sem);
    setOpenTurma(null);
  }, []);

  const toggleTurma = useCallback(async (sem: string, turma: string) => {
    const key = `${sem}|${turma}`;
    if (openTurma === key) { setOpenTurma(null); return; }
    setOpenTurma(key);
    if (turmaAlunos[key]) return;
    const semId = SEM_IDS[sem];
    if (!semId) return;
    setLoadingTurma(key);
    try {
      const { data } = await supabase.from("vertice_eorbit_alunos")
        .select("nome_aluno,matricula,situacao")
        .eq("semestre_id", semId).eq("curso_id", 46).eq("turma_nome", turma)
        .order("nome_aluno");
      if (data) setTurmaAlunos(prev => ({...prev, [key]: data}));
    } finally { setLoadingTurma(null); }
  }, [openTurma, turmaAlunos]);

  if (loading) return <div className="drx"><div className="drx-loading"><div className="drx-spinner"/>Carregando Raio-X…</div></div>;
  if (institutionId !== UNITOP_ID) return <section className="drx" style={{padding:24}}><h3>Raio-X do Direito — acesso institucional</h3><p>Este painel utiliza dados do e-ORBIT da UNITOP e não está disponível para outras instituições.</p></section>;
  if (sourceStatus !== "ready") return <section className="drx" style={{padding:24}}><h3>Raio-X do Direito — UNITOP</h3><p>{sourceStatus === "error" ? "Não foi possível validar o acesso aos dados do e-ORBIT." : "Os registros do e-ORBIT estão preservados, mas o identificador institucional legado precisa ser conciliado com o cadastro UNITOP."}</p></section>;

  const latest = semData.length > 0 ? semData[semData.length - 1] : null;
  const prev = semData.length > 1 ? semData[semData.length - 2] : null;
  const matriculadosAtual = latest?.matriculados || 0;
  const matriculadosPrev = prev?.matriculados || 0;
  const crescimento = matriculadosPrev > 0 ? (((matriculadosAtual - matriculadosPrev) / matriculadosPrev) * 100).toFixed(1) : "—";
  const totalGeral = quantGeral?.total_geral || 0;
  const trancados = quantGeral?.status?.TRANCADO || 0;
  const cancelados = quantGeral?.status?.CANCELADO || 0;
  const profCount = docenteEvo?.evolucao?.["2026/01"]?.professores || profData?.professores?.length || 0;
  const semFiltered = semData.filter(s => s.semestre >= "2023/01");

  // Evasão por coorte de entrada. Cada linha de semData é a situação ATUAL da turma
  // que entrou naquele semestre, não o fluxo ocorrido durante o semestre.
  // Taxa correta = evadidos / (ativos + evadidos). A coluna taxa_evasao do banco
  // divide pelos que ficaram, o que produz valores acima de 100%.
  const coortes = semFiltered.map((s) => {
    const evadidos = (s.trancado||0)+(s.abandono||0)+(s.cancelado||0)+(s.transferido||0)+(s.troca_curso||0);
    const ativos = s.matriculados||0;
    const concluintes = (s.concluido||0)+(s.graduado||0);
    // Coorte inteira: ativos + pre-matriculados + concluintes + evadidos.
    // Mesma base da coluna taxa_evasao do banco. Concluir curso nao e evadir.
    const base = ativos + (s.pre_matriculado||0) + concluintes + evadidos;
    return {
      semestre: String(s.semestre), ano: String(s.semestre).slice(0,4),
      vinculos: base, ativos, evadidos, concluintes,
      trancado: s.trancado||0, cancelado: s.cancelado||0, transferido: s.transferido||0,
      vagas: s.vagas||0, ocupacao: parseFloat(s.taxa_ocupacao)||0,
      taxa: base>0 ? (evadidos/base)*100 : 0,
    };
  }).filter(c => c.vinculos > 0);

  // Evasão acumulada do curso, a partir do quantitativo geral do e-ORBIT.
  const statusGeral = quantGeral?.status ?? {};
  const ativosAcum = (statusGeral.MATRICULADO||0) + (statusGeral.PRE_MATRICULADO||0);
  const evadidosAcum = (statusGeral.TRANCADO||0) + (statusGeral.CANCELADO||0) + (statusGeral.TRANSFERIDO||0) + (statusGeral.ABANDONO||0) + (statusGeral.TROCA_DE_CURSO||0);
  const concluidosAcum = (statusGeral.GRADUADO||0) + (statusGeral.CONCLUIDO||0);
  const baseAcum = totalGeral || (ativosAcum + evadidosAcum + concluidosAcum);
  const taxaAcumulada = baseAcum > 0 ? (evadidosAcum/baseAcum)*100 : 0;

  // Comparação por ano de entrada.
  const anos = [...new Set(coortes.map(c => c.ano))].sort().map((ano) => {
    const rows = coortes.filter(c => c.ano === ano);
    const vinculos = rows.reduce((a,c)=>a+c.vinculos,0);
    const evadidos = rows.reduce((a,c)=>a+c.evadidos,0);
    const ativos = rows.reduce((a,c)=>a+c.ativos,0);
    const concluintes = rows.reduce((a,c)=>a+c.concluintes,0);
    return { ano, vinculos, ativos, evadidos, concluintes, taxa: vinculos>0 ? (evadidos/vinculos)*100 : 0 };
  });

  const corTaxa = (t: number) => t > 40 ? "var(--danger)" : t > 25 ? "var(--warning)" : "var(--success)";
  const chipTaxa = (t: number) => t > 40 ? "drx-chip-red" : t > 25 ? "drx-chip-yellow" : "drx-chip-green";
  const pp = (v: number) => `${v>0?"+":""}${v.toFixed(1)} p.p.`;

  return (
    <div className="drx">
      {/* ── Header ── */}
      <header className="drx-header">
        <div className="drx-header-left">
          <span className="drx-eyebrow">Raio-X Estratégico</span>
          <h2 className="drx-title">Curso de Direito</h2>
          <p className="drx-subtitle">Centro Universitário ITOP — UNITOP · Extração: {sourceDate ?? "—"}</p>
        </div>
        <div className="drx-header-right">
          <div className="drx-badge"><span className="drx-badge-icon">⚖️</span> Presencial · Bacharelado</div>
          <div className="drx-badge drx-badge-accent">{matriculadosAtual} matriculados</div>
        </div>
      </header>

      {/* ── KPIs ── */}
      <div className="drx-kpis">
        {[
          {label:"Matriculados",value:matriculadosAtual,sub:crescimento !== "—" ? `${Number(crescimento)>0?"+":""}${crescimento}%` : "—",color:"var(--primary)",icon:"📊"},
          {label:"Vínculos Totais",value:totalGeral,sub:"desde 2023/01",color:"#6366f1",icon:"📋"},
          {label:"Evasão acumulada",value:`${taxaAcumulada.toFixed(1)}%`,sub:`${evadidosAcum} de ${baseAcum} vínculos encerrados`,color:corTaxa(taxaAcumulada),icon:taxaAcumulada>40?"⚠️":taxaAcumulada>25?"⚠️":"✅"},
          {label:"Evasão da turma nova",value:`${(coortes[coortes.length-1]?.taxa ?? 0).toFixed(1)}%`,sub:`turma ${coortes[coortes.length-1]?.semestre ?? "—"} · menos tempo de exposição`,color:"#6366f1",icon:"🆕"},
          {label:"Corpo Docente",value:profCount,sub:"professores 2026/01",color:"#7c3aed",icon:"👨‍🏫"},
          {label:"Trancados",value:trancados,sub:totalGeral>0?`${((trancados/totalGeral)*100).toFixed(0)}% do total`:"",color:"var(--warning)",icon:"⏸️"},
          {label:"Cancelados",value:cancelados,sub:totalGeral>0?`${((cancelados/totalGeral)*100).toFixed(0)}% do total`:"",color:"var(--danger)",icon:"❌"},
        ].map((kpi,i) => (
          <div key={i} className="drx-kpi" style={{"--kpi-color":kpi.color} as React.CSSProperties}>
            <div className="drx-kpi-icon">{kpi.icon}</div>
            <small>{kpi.label}</small>
            <strong>{kpi.value}</strong>
            <span>{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Série Histórica Real — Accordion ── */}
      {serieReal?.semestres && (
        <div className="drx-section">
          <div className="drx-section-header">
            <h4>Série Histórica Real — Turmas</h4>
            <p className="drx-sub">Clique no semestre para expandir. Clique na turma para ver alunos nominais.</p>
          </div>
          <div className="drx-accordion">
            {Object.entries(serieReal.semestres).map(([sem, sd]: [string, any]) => {
              const isSemOpen = openSem === sem;
              const turmas = sd.turmas || [];
              const pctFantasma = sd.total_alunos > 0 ? ((sd.total_fantasmas / sd.total_alunos) * 100).toFixed(0) : "0";
              return (
                <div key={sem} className={`drx-acc-item ${isSemOpen ? "drx-acc-open" : ""}`}>
                  <button className="drx-acc-trigger" onClick={() => toggleSem(sem)} type="button">
                    <span className="drx-acc-arrow">{isSemOpen ? "▾" : "▸"}</span>
                    <strong className="drx-acc-sem">{sem}</strong>
                    <span className="drx-chip drx-chip-blue">{turmas.length} turma{turmas.length !== 1 ? "s" : ""}</span>
                    <span className="drx-chip drx-chip-green">{sd.total_alunos} alunos</span>
                    {sd.total_fantasmas > 0 && <span className="drx-chip drx-chip-red">{sd.total_fantasmas} fantasmas · {pctFantasma}%</span>}
                    {sd.nota && <span className="drx-acc-note">{sd.nota}</span>}
                  </button>
                  {isSemOpen && (
                    <div className="drx-acc-body">
                      {turmas.map((t: any, ti: number) => {
                        const s = t.situacoes || {};
                        const turmaKey = `${sem}|${t.turma}`;
                        const isTurmaOpen = openTurma === turmaKey;
                        const alunos = turmaAlunos[turmaKey] || [];
                        const isLoading = loadingTurma === turmaKey;
                        const aprovados = (s.AD||0)+(s.AF||0);
                        const pctAprov = t.alunos_reais > 0 ? Math.round((aprovados/t.alunos_reais)*100) : 0;
                        const pctFant = t.alunos_reais > 0 ? Math.round((t.fantasmas/t.alunos_reais)*100) : 0;
                        const totalCA = (s.CA||0)+(s.AC||0)+(s.CR||0)+(s.AB||0);
                        return (
                          <div key={ti} className={`drx-turma-block ${isTurmaOpen ? "drx-turma-open" : ""}`}>
                            <button className="drx-turma-trigger" onClick={() => toggleTurma(sem, t.turma)} type="button">
                              <div className="drx-turma-main">
                                <span className="drx-turma-arrow">{isTurmaOpen ? "▾" : "▸"}</span>
                                <strong>{t.turma}</strong>
                                <span className="drx-turma-per">{t.periodo}º período</span>
                              </div>
                              <div className="drx-turma-stats">
                                <span className="drx-turma-num">{t.alunos_reais} <small>alunos</small></span>
                                <div className="drx-turma-minibar" title={`${pctAprov}% aprovados · ${pctFant}% fantasmas`}>
                                  <div className="drx-turma-minibar-fill drx-bg-success" style={{width:`${pctAprov}%`}}/>
                                  <div className="drx-turma-minibar-fill drx-bg-danger" style={{width:`${pctFant}%`}}/>
                                </div>
                                <div className="drx-turma-sits">
                                  {s.AD ? <span className="drx-sit drx-sit-ok">AD:{s.AD}</span> : null}
                                  {s.AF ? <span className="drx-sit drx-sit-ok">AF:{s.AF}</span> : null}
                                  {s.RF ? <span className="drx-sit drx-sit-bad">RF:{s.RF}</span> : null}
                                  {s.RN ? <span className="drx-sit drx-sit-warn">RN:{s.RN}</span> : null}
                                  {s.RA ? <span className="drx-sit drx-sit-warn">RA:{s.RA}</span> : null}
                                  {s.TR ? <span className="drx-sit drx-sit-muted">TR:{s.TR}</span> : null}
                                  {totalCA > 0 ? <span className="drx-sit drx-sit-bad">CA:{totalCA}</span> : null}
                                </div>
                                {t.fantasmas > 0 && <span className="drx-ghost-badge">👻 {t.fantasmas}</span>}
                              </div>
                            </button>
                            {isTurmaOpen && (
                              <div className="drx-alunos-panel">
                                {isLoading ? (
                                  <div className="drx-alunos-loading"><div className="drx-spinner"/>Buscando alunos…</div>
                                ) : alunos.length === 0 ? (
                                  <p className="drx-alunos-empty">Nenhum registro nominal encontrado para esta turma.</p>
                                ) : (
                                  <>
                                  <div className="drx-alunos-summary">
                                    <span>{alunos.length} alunos</span>
                                    <span>{alunos.filter(a => a.situacao === "AD" || a.situacao === "AF").length} aprovados</span>
                                    <span className="drx-text-danger">{alunos.filter(a => GHOST_SITS.has(a.situacao)).length} fantasmas/inativos</span>
                                  </div>
                                  <table className="drx-table drx-table-alunos">
                                    <thead><tr><th>#</th><th>Matrícula</th><th>Nome do Aluno</th><th>Situação</th><th>Perfil</th></tr></thead>
                                    <tbody>
                                      {alunos.map((a: any, j: number) => {
                                        const isGhost = GHOST_SITS.has(a.situacao);
                                        const isApproved = a.situacao === "AD" || a.situacao === "AF";
                                        return (
                                          <tr key={j} className={isGhost ? "drx-row-ghost" : isApproved ? "drx-row-ok" : ""}>
                                            <td className="drx-cell-num">{j+1}</td>
                                            <td className="drx-cell-mat">{a.matricula}</td>
                                            <td className="drx-cell-name">{a.nome_aluno}</td>
                                            <td><span className={`drx-chip ${isApproved ? "drx-chip-green" : isGhost ? "drx-chip-red" : "drx-chip-yellow"}`}>{a.situacao || "—"}</span> <span className="drx-sit-desc">{SIT_LABELS[a.situacao] || ""}</span></td>
                                            <td>{isGhost ? <span className="drx-profile-ghost">👻 Lead frio</span> : <span className="drx-profile-active">✓ Cursou</span>}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="drx-legend">
            <strong>Fantasma</strong> = sem AV1/AV2, situação CA/RF/AC/AB/TR (matriculou mas nunca cursou) · <strong>Legenda:</strong> AD = Aprovado Direto · AF = Aprovado Final · RF = Reprovado Falta · RN = Reprovado Nota · RA = Reprovado Ambos · TR = Transferido · CA = Cancelado
          </div>
        </div>
      )}

      {/* ── Crescimento Real ── */}
      {serieReal?.resumo_serie_historica && (
        <div className="drx-section">
          <div className="drx-section-header"><h4>Crescimento Real do Curso</h4><p className="drx-sub">Total de alunos reais por semestre — evolução desde a fundação</p></div>
          <div className="drx-table-wrap">
            <table className="drx-table">
              <thead><tr><th>Semestre</th><th>Total Real</th><th>Ingressantes 1º Per.</th><th>Fantasmas</th><th>% Fantasma</th><th>Crescimento</th></tr></thead>
              <tbody>
                {Object.entries(serieReal.resumo_serie_historica).map(([sem, d]: [string, any], i: number, arr: any[]) => {
                  const prevVal = i > 0 ? (arr[i-1][1] as any).total_real : 0;
                  const cresc = prevVal > 0 ? (((d.total_real - prevVal) / prevVal) * 100).toFixed(0) : "—";
                  return (
                    <tr key={sem}>
                      <td><strong>{sem}</strong></td>
                      <td><strong className="drx-big-num">{d.total_real}</strong></td>
                      <td>{d.ingressantes_1per || "—"}{d.obs ? <span className="drx-note"> ({d.obs})</span> : ""}</td>
                      <td>{d.fantasmas > 0 ? <span className="drx-text-danger">{d.fantasmas}</span> : "0"}</td>
                      <td><span className={`drx-chip ${d.pct_fantasma > 10 ? "drx-chip-red" : d.pct_fantasma > 5 ? "drx-chip-yellow" : "drx-chip-green"}`}>{d.pct_fantasma || 0}%</span></td>
                      <td>{cresc !== "—" ? <span className={Number(cresc) > 0 ? "drx-trend-up" : "drx-trend-down"}>{Number(cresc) > 0 ? "▲" : "▼"} {cresc}%</span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Evolução Semestral ── */}
      {semFiltered.length > 0 && (
        <div className="drx-section">
          <div className="drx-section-header"><h4>Evolução Semestral</h4><p className="drx-sub">Matriculados, evasão e ocupação por semestre — dados e-ORBIT</p></div>
          <div className="drx-table-wrap">
            <table className="drx-table">
              <thead><tr><th>Semestre</th><th>Matric.</th><th>Tranc.</th><th>Canc.</th><th>Transf.</th><th>Vagas</th><th>Ocupação</th><th>Evasão</th><th>Δ</th></tr></thead>
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
                          <div className="drx-bar" style={{width:`${Math.min(100,parseFloat(s.taxa_ocupacao))}%`,background:parseFloat(s.taxa_ocupacao)>30?"var(--success)":parseFloat(s.taxa_ocupacao)>15?"var(--warning)":"var(--danger)"}}/>
                          <span>{parseFloat(s.taxa_ocupacao).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>{(() => { const ev=(s.trancado||0)+(s.abandono||0)+(s.cancelado||0)+(s.transferido||0)+(s.troca_curso||0); const bs=(s.matriculados||0)+(s.pre_matriculado||0)+(s.concluido||0)+(s.graduado||0)+ev; const tx=bs>0?(ev/bs)*100:0; return <span className={`drx-chip ${chipTaxa(tx)}`}>{tx.toFixed(1)}%</span>; })()}</td>
                      <td>{i===0?"—":diff>0?<span className="drx-trend-up">▲+{diff}</span>:diff<0?<span className="drx-trend-down">▼{diff}</span>:<span>→</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Evasão: coorte, acumulada e comparação ── */}
      {coortes.length > 0 && (
        <div className="drx-section">
          <div className="drx-section-header">
            <h4>Evasão — por coorte, acumulada e comparada</h4>
            <p className="drx-sub">Cada linha é a situação <strong>atual</strong> da turma que entrou naquele semestre, não o fluxo ocorrido durante ele. Turmas antigas tiveram mais tempo para perder vínculos, então a comparação direta entre uma turma de 2023 e a de 2026 não é de igual para igual.</p>
          </div>

          <div className="drx-evasao-resumo">
            <div className="drx-evasao-card" style={{borderLeftColor: corTaxa(taxaAcumulada)}}>
              <span className="drx-evasao-label">Evasão acumulada do curso</span>
              <strong className="drx-evasao-valor" style={{color: corTaxa(taxaAcumulada)}}>{taxaAcumulada.toFixed(1)}%</strong>
              <span className="drx-evasao-sub">{evadidosAcum} encerrados de {baseAcum} vínculos · {ativosAcum} ativos{concluidosAcum>0?` · ${concluidosAcum} concluídos`:""}</span>
            </div>
            <div className="drx-evasao-card" style={{borderLeftColor:"var(--warning)"}}>
              <span className="drx-evasao-label">Composição da evasão</span>
              <strong className="drx-evasao-valor" style={{color:"var(--warning)"}}>{statusGeral.TRANCADO||0}</strong>
              <span className="drx-evasao-sub">trancados{baseAcum>0?` · ${(((statusGeral.TRANCADO||0)/baseAcum)*100).toFixed(0)}% de todos os vínculos`:""} · {statusGeral.CANCELADO||0} cancelados · {statusGeral.TRANSFERIDO||0} transferidos</span>
            </div>
          </div>

          <h5 className="drx-evasao-h5">Semestre a semestre — turma de entrada</h5>
          <div className="drx-table-wrap">
            <table className="drx-table">
              <thead><tr><th>Turma de entrada</th><th>Vínculos</th><th>Ativos</th><th>Evadidos</th><th>Taxa</th><th>Δ vs. turma anterior</th></tr></thead>
              <tbody>
                {coortes.map((c, i) => {
                  const d = i === 0 ? null : c.taxa - coortes[i-1].taxa;
                  return (
                    <tr key={c.semestre}>
                      <td><strong>{c.semestre}</strong></td>
                      <td>{c.vinculos}</td>
                      <td>{c.ativos}</td>
                      <td>{c.evadidos}</td>
                      <td><span className={`drx-chip ${chipTaxa(c.taxa)}`}>{c.taxa.toFixed(1)}%</span></td>
                      <td>{d === null ? "—" : d < 0 ? <span className="drx-trend-down">▼ {pp(d)}</span> : d > 0 ? <span className="drx-trend-up">▲ {pp(d)}</span> : <span>→</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h5 className="drx-evasao-h5">Comparação por ano de entrada</h5>
          <div className="drx-table-wrap">
            <table className="drx-table">
              <thead><tr><th>Ano</th><th>Vínculos</th><th>Ativos</th><th>Evadidos</th><th>Taxa</th><th>Δ vs. ano anterior</th><th>Retenção</th></tr></thead>
              <tbody>
                {anos.map((a, i) => {
                  const d = i === 0 ? null : a.taxa - anos[i-1].taxa;
                  const ret = 100 - a.taxa;
                  return (
                    <tr key={a.ano}>
                      <td><strong>{a.ano}</strong></td>
                      <td>{a.vinculos}</td>
                      <td>{a.ativos}</td>
                      <td>{a.evadidos}</td>
                      <td><span className={`drx-chip ${chipTaxa(a.taxa)}`}>{a.taxa.toFixed(1)}%</span></td>
                      <td>{d === null ? "—" : d < 0 ? <span className="drx-trend-down">▼ {pp(d)}</span> : d > 0 ? <span className="drx-trend-up">▲ {pp(d)}</span> : <span>→</span>}</td>
                      <td>
                        <div className="drx-bar-wrap">
                          <div className="drx-bar" style={{width:`${Math.max(0,Math.min(100,ret))}%`,background:corTaxa(a.taxa)}}/>
                          <span>{ret.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="drx-evasao-nota">
            Taxa = evadidos ÷ coorte inteira, onde evadidos = trancamento, abandono, cancelamento, transferência e troca de curso, e a coorte inteira inclui ativos, pré-matriculados, concluintes e evadidos. Concluir o curso não é evadir. É a mesma fórmula gravada na coluna <code>taxa_evasao</code> do banco.
          </p>
        </div>
      )}

      {/* ── Corpo Docente ── */}
      {profData && (
        <div className="drx-section">
          <div className="drx-section-header"><h4>Corpo Docente — 2026/01</h4><p className="drx-sub">{profData.professores?.length || 0} professores atuantes</p></div>
          <div className="drx-table-wrap">
            <table className="drx-table"><thead><tr><th>Professor</th><th>Disciplinas</th></tr></thead>
              <tbody>{(profData.professores || []).map((p: any, i: number) => (<tr key={i}><td><strong>{p.nome}</strong></td><td>{(p.disciplinas || []).join("; ")}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Evolução Docente ── */}
      {docenteEvo && (
        <div className="drx-section">
          <div className="drx-section-header"><h4>Evolução do Corpo Docente</h4></div>
          <div className="drx-docente-grid">
            {Object.entries(docenteEvo.evolucao || {}).map(([sem, data]: [string, any]) => (
              <div key={sem} className="drx-docente-card"><span className="drx-docente-sem">{sem}</span><strong className="drx-docente-num">{data.professores}</strong><span className="drx-docente-label">professores</span></div>
            ))}
          </div>
        </div>
      )}

      {/* ── Status Geral ── */}
      {quantGeral && (
        <div className="drx-section">
          <div className="drx-section-header"><h4>Distribuição por Status (Acumulado)</h4></div>
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

      <footer className="drx-footer">Dados de origem e-ORBIT UNITOP · Extração: {sourceDate ?? "—"} · Uso reservado à instituição · 779 registros nominais</footer>
    </div>
  );
}
