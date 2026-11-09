/**
 * Painel da Reitoria — Governança Regulatória 360
 *
 * Visão consolidada de todos os cursos da IES:
 * - CC simulado por curso (instrumento 2017)
 * - Conformidade no Novo Instrumento (2026)
 * - Cobertura documental
 * - Comparativo 2017↔2026
 * - Alertas e prioridades
 * - Modo TV para monitor do reitor
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { type Row } from "@/lib/area";
import { DIMENSOES, calcularResumo, formatarConceito, corConceito, faixaConceito, listarIndicadores } from "@/lib/avaliacao-simulada";
import { MAPPING_2017_2026 } from "@/lib/instrumento-mapping";
import "./governanca-bi.css";
import Governanca360Auditoria from "./Governanca360Auditoria";

// ================================================================ tipos
type CourseStatus = {
  courseId: string;
  courseName: string;
  coordinator: string;
  // 2017
  indicadoresAvaliados: number;
  indicadoresTotal: number;
  ccAtual: number | null;
  ccViavel: number | null;
  dimMedias: { dim: number; media: number | null }[];
  alertas2017: string[];
  // 2026
  objetosTotal: number;
  objetosConformes: number;
  objetosParciais: number;
  objetosNaoConformes: number;
  objetosNaoAvaliados: number;
  pctConforme2026: number;
  // docs
  docsTotal: number;
  docsEnviados: number;
  docsValidados: number;
  docsPendentes: number;
  coberturaDoc: number;
};

type Props = {
  institutionId: string;
  institutionName: string;
  courses: Row[];
};

// ================================================================ Donut
type Parte = { value: number; color: string; label: string };
function Donut({ parts, center, caption, size = 80 }: { parts: Parte[]; center: string; caption: string; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  let acc = 0;
  return (
    <svg className="gov-donut" viewBox="0 0 42 42" width={size} height={size} role="img" aria-label={caption}>
      <circle cx="21" cy="21" r="15.915" fill="none" stroke="#e7ecf1" strokeWidth="5" />
      {total > 0 && parts.filter(p => p.value > 0).map(p => {
        const len = (p.value / total) * 100;
        const el = <circle key={p.label} cx="21" cy="21" r="15.915" fill="none" stroke={p.color} strokeWidth="5" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={25 - acc} />;
        acc += len;
        return el;
      })}
      <text x="21" y="23" textAnchor="middle" className="gov-donut-text">{center}</text>
    </svg>
  );
}

// ================================================================ componente principal
export default function GovernancaBI({ institutionId, institutionName, courses }: Props) {
  const [data, setData] = useState<CourseStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState("");
  const [tv, setTv] = useState(false);
  const indicadores = useMemo(() => listarIndicadores(), []);

  const load = useCallback(async () => {
    setLoading(true);setLoadError("");
    try {
      // Carregar avaliações simuladas (2017)
      const { data: avs, error: avError } = await supabase
        .from("vertice_avaliacao_simulada")
        .select("*")
        .eq("institution_id", institutionId);

      // Carregar checklist do novo instrumento (2026)
      const { data: ni, error: niError } = await supabase
        .from("vertice_instrumento_checklist")
        .select("*")
        .eq("institution_id", institutionId);

      // Carregar documentos do repositório
      const { data: reqs, error: reqError } = await supabase
        .from("vertice_repository_requests")
        .select("id, course_id, indicator, not_applicable, active, repository_section")
        .eq("institution_id", institutionId)
        .eq("active", true);

      const { data: files, error: fileError } = await supabase
        .from("vertice_repository_files")
        .select("request_id, status, created_at")
        .eq("institution_id", institutionId);

      if(avError||niError||reqError||fileError)throw new Error("Uma das fontes regulatórias não está disponível nesta sessão; não é seguro calcular os indicadores como zero.");
      const avsRows = avs ?? [];
      const niRows = ni ?? [];
      const reqRows = reqs ?? [];
      const fileRows = files ?? [];

      const latest=new Map<string,{request_id:string;status:string;created_at:string}>();
      for(const f of [...fileRows].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))))if(!latest.has(String(f.request_id)))latest.set(String(f.request_id),f);
      const statuses: CourseStatus[] = courses.filter(c=>String(c.institution_id)===institutionId).map(course => {
        const cid = String(course.id);
        const cname = String(course.name ?? "Curso");
        const coord = String(course.coordinator ?? "Não informada");

        // 2017 — avaliação simulada
        const courseAvs = avsRows.filter(r => r.course_id === cid);
        const conceitosMap = new Map<string, number | null>();
        for (const r of courseAvs) {
          conceitosMap.set(String(r.indicador), r.conceito_atual != null ? Number(r.conceito_atual) : null);
        }
        const resumo = calcularResumo(conceitosMap, indicadores);
        const avaliadosViaveis=courseAvs.filter(r=>r.conceito_viavel!=null);
        const ccViavel = avaliadosViaveis.length
          ? avaliadosViaveis.reduce((s,r)=>s+Number(r.conceito_viavel),0)/avaliadosViaveis.length : null;

        // Alertas 2017
        const alertas: string[] = [];
        for (const r of courseAvs) {
          if (r.conceito_atual != null && Number(r.conceito_atual) <= 2) {
            alertas.push(`${r.indicador}: conceito ${r.conceito_atual}`);
          }
        }

        // 2026 — novo instrumento
        const courseNi = niRows.filter(r => r.course_id === cid);
        const conformes = courseNi.filter(r => r.status === "conforme").length;
        const parciais = courseNi.filter(r => r.status === "parcial").length;
        const naoConf = courseNi.filter(r => r.status === "nao_conforme").length;
        const naoAval = courseNi.filter(r => r.status === "nao_avaliado" || !r.status).length;
        const totalNi = courseNi.length;

        // Documentos
        // Nunca misturar recredenciamento institucional nem proposta 2026 com reconhecimento 2017.
        const courseReqs=reqRows.filter(r=>r.course_id===cid&&!r.not_applicable&&
          !["recredenciamento_2017","novo_instrumento_2026_curso","novo_instrumento_2026_institucional"].includes(String(r.repository_section??"")));
        const current=courseReqs.map(r=>latest.get(String(r.id)));
        const validados=current.filter(f=>f?.status==="validado").length;
        const enviados=current.filter(f=>f?.status==="enviado").length;
        const pendentes=current.filter(f=>!f).length;

        return {
          courseId: cid,
          courseName: cname,
          coordinator: coord,
          indicadoresAvaliados: resumo.totalAvaliados,
          indicadoresTotal: resumo.totalIndicadores,
          ccAtual: resumo.conceitoCurso,
          ccViavel: ccViavel!==null&&Number.isFinite(ccViavel) ? ccViavel : null,
          dimMedias: resumo.dimensoes.map(d => ({ dim: d.dimensao, media: d.media })),
          alertas2017: alertas.slice(0, 5),
          objetosTotal: totalNi,
          objetosConformes: conformes,
          objetosParciais: parciais,
          objetosNaoConformes: naoConf,
          objetosNaoAvaliados: naoAval,
          pctConforme2026: totalNi ? Math.round((conformes / totalNi) * 100) : 0,
          docsTotal: courseReqs.length,
          docsEnviados: enviados,
          docsValidados: validados,
          docsPendentes: Math.max(0, pendentes),
          coberturaDoc: courseReqs.length ? Math.round(((enviados + validados) / courseReqs.length) * 100) : 0,
        };
      }).filter(c => c.indicadoresAvaliados > 0 || c.objetosTotal > 0 || c.docsTotal > 0);

      setData(statuses);
    } catch(e){setData([]);setLoadError(e instanceof Error?e.message:"Não foi possível consultar as fontes regulatórias.");}
    finally {setLoading(false); }
  }, [institutionId, courses, indicadores]);

  useEffect(() => { void load(); }, [load]);

  // Modo TV: refresh a cada 10min
  useEffect(() => {
    if (!tv) return;
    const id = setInterval(() => void load(), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [tv, load]);

  // KPIs globais
  const cursosComAvs = data.filter(d => d.ccAtual !== null);
  const ccMedioIES = cursosComAvs.length
    ? cursosComAvs.reduce((s, d) => s + (d.ccAtual ?? 0), 0) / cursosComAvs.length
    : null;
  const cursosRisco = data.filter(d => d.ccAtual !== null && d.ccAtual < 3).length;
  const cursosComDocs=data.filter(d=>d.docsTotal>0);
  const coberturaMedia = cursosComDocs.length
    ? Math.round(cursosComDocs.reduce((s, d) => s + d.coberturaDoc, 0) / cursosComDocs.length)
    : null;

  if (loading) return <p role="status" className="area-muted">Carregando governança regulatória…</p>;
  if(loadError)return <section role="alert" className="area-error"><p>{loadError}</p><button type="button" onClick={()=>void load()}>Tentar novamente</button></section>;

  return (
    <section className={`gov ${tv ? "gov-tv" : ""}`} aria-label="Governança Regulatória">
      <Governanca360Auditoria institutionId={institutionId}/>
      <header className="gov-header">
        <div>
          <span className="gov-eyebrow">Governança regulatória 360</span>
          <h2>{institutionName}</h2>
          <p className="gov-sub">Visão interna de indicadores regulatórios · {data.length} cursos com registros nas fontes consultadas; não representa conceito oficial do MEC.</p>
        </div>
        <button className="gov-tv-btn" onClick={() => { setTv(!tv); if (!tv) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }}>
          {tv ? "Sair do modo TV" : "📺 Modo TV"}
        </button>
      </header>

      {/* KPIs globais */}
      <div className="gov-kpis">
        <div className="gov-kpi">
          <Donut
            parts={[
              { value: cursosComAvs.filter(d => (d.ccAtual ?? 0) >= 4).length, color: "#2d6a4f", label: "≥4" },
              { value: cursosComAvs.filter(d => (d.ccAtual ?? 0) >= 3 && (d.ccAtual ?? 0) < 4).length, color: "#4f9a76", label: "3" },
              { value: cursosComAvs.filter(d => (d.ccAtual ?? 0) < 3).length, color: "#c0594f", label: "<3" },
              { value: data.length - cursosComAvs.length, color: "#a9b6c4", label: "s/n" },
            ]}
            center={formatarConceito(ccMedioIES)}
            caption="Média de conceitos simulados dos cursos avaliados"
            size={100}
          />
          <div>
            <strong className="gov-kpi-value">{formatarConceito(ccMedioIES)}</strong>
            <span className="gov-kpi-label">Média dos conceitos simulados (2017)</span>
            <span className="gov-kpi-detail">{faixaConceito(ccMedioIES)}</span>
          </div>
        </div>
        <div className="gov-kpi-simple">
          <strong style={{ color: cursosRisco > 0 ? "#c0594f" : "#4f9a76" }}>{cursosComAvs.length?cursosRisco:"Sem dados"}</strong>
          <span>curso(s) com CC {'<'} 3</span>
        </div>
        <div className="gov-kpi-simple">
          <strong>{coberturaMedia===null?'Sem dados':coberturaMedia+'%'}</strong>
          <span>cobertura documental média</span>
        </div>
        <div className="gov-kpi-simple">
          <strong>{MAPPING_2017_2026.length}</strong>
          <span>conexões 2017↔2026</span>
        </div>
      </div>

      {/* Tabela por curso */}
      <div className="gov-table-scroll">
        <table className="gov-table">
          <thead>
            <tr>
              <th>Curso</th>
              <th>Coordenação</th>
              <th>Conceito simulado (2017)</th>
              <th>Conceito viável estimado</th>
              <th>D1</th>
              <th>D2</th>
              <th>D3</th>
              <th>Docs</th>
              <th>Proposta 2026</th>
              <th>Alertas</th>
            </tr>
          </thead>
          <tbody>
            {data.sort((a, b) => (a.ccAtual ?? 99) - (b.ccAtual ?? 99)).map(c => (
              <tr key={c.courseId} className={c.ccAtual !== null && c.ccAtual < 3 ? "gov-risco" : ""}>
                <td><strong>{c.courseName}</strong></td>
                <td className="gov-coord">{c.coordinator}</td>
                <td>
                  <span className="gov-cc" style={{ background: corConceito(c.ccAtual) }}>
                    {formatarConceito(c.ccAtual)}
                  </span>
                </td>
                <td>
                  <span className="gov-cc gov-cc-viavel" style={{ borderColor: corConceito(c.ccViavel) }}>
                    {formatarConceito(c.ccViavel)}
                  </span>
                </td>
                {[1, 2, 3].map(dim => {
                  const d = c.dimMedias.find(m => m.dim === dim);
                  return (
                    <td key={dim}>
                      <span className="gov-dim" style={{ color: corConceito(d?.media ?? null) }}>
                        {d?.media !== null && d?.media !== undefined ? d.media.toFixed(1) : "—"}
                      </span>
                    </td>
                  );
                })}
                <td>
                  {c.docsTotal>0?<><div className="gov-docs-bar"><div className="gov-docs-fill" style={{ width: `${c.coberturaDoc}%`, background: c.coberturaDoc >= 80 ? "#4f9a76" : c.coberturaDoc >= 50 ? "#d1a54a" : "#c0594f" }} /></div><span className="gov-docs-label">{c.coberturaDoc}% de exigências com arquivo · {c.docsPendentes} sem envio</span></>:<span className="gov-docs-label">Sem exigências cadastradas</span>}
                </td>
                <td>
                  {c.objetosTotal > 0 ? (
                    <span className="gov-ni">{c.pctConforme2026}% com situação conforme · simulado</span>
                  ) : (
                    <span className="gov-ni gov-ni-empty">—</span>
                  )}
                </td>
                <td>
                  {c.alertas2017.length > 0 ? (
                    <span className="gov-alertas" title={c.alertas2017.join("\n")}>
                      ⚠️ {c.alertas2017.length}
                    </span>
                  ) : (
                    <span className="gov-ok">{c.indicadoresAvaliados>0?"Sem alertas neste recorte":"Não avaliado"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda e comparativo */}
      <div className="gov-footer">
        <div className="gov-legenda">
          <span><i style={{ background: "#2d6a4f" }} /> CC ≥ 4</span>
          <span><i style={{ background: "#4f9a76" }} /> CC 3–3,9</span>
          <span><i style={{ background: "#c0594f" }} /> CC {'<'} 3</span>
          <span><i style={{ background: "#a9b6c4" }} /> Sem avaliação</span>
        </div>
        <p className="gov-disclaimer">
          Avaliação simulada interna. O CC é calculado conforme o instrumento INEP de Reconhecimento de Curso (2017).
          A análise da proposta de Novo Instrumento (2026) é preliminar e independente dos conceitos de 2017; não há instrumento definitivo confirmado nesta tela.
          Nenhum dado substitui a avaliação oficial do INEP/MEC.
        </p>
      </div>
    </section>
  );
}
