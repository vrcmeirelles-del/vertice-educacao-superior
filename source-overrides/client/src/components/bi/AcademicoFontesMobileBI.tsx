import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import OutcomesMobileBreakdown from "./OutcomesMobileBreakdown";

type ReportIndex = { id: string; kind: string; course_id: string | null; source_report_at: string };
type ReproRate = { id: string; payload: { s?: string; matriculas?: number | string; reprovacoes?: number | string; pct_reprovacao?: number | string } };
type AcademicInfo = { reports: ReportIndex[]; rates: ReproRate[] };
const empty: AcademicInfo = { reports: [], rates: [] };
const nf = new Intl.NumberFormat("pt-BR");
const labels: Record<string,string> = {
  "reprovacoes_semestre":"Reprovações por semestre",
  "reprovacoes_disciplina":"Reprovações por disciplina",
  "reprovacoes_professor":"Reprovações por professor",
  "fluxo_academico":"Fluxo acadêmico",
  "quantitativo_alunos":"Quantitativo de alunos",
  "quantitativo_alunos_historico":"Histórico de quantitativos",
  "status_series":"Séries de situação acadêmica",
  "course_indicators":"Indicadores por curso",
  "dossie_direito":"Dossiês por curso",
  "biblioteca_acervo":"Acervo bibliográfico",
  "enade_habilitados":"ENADE",
  "vestibular_concorrencia":"Vestibular"
};
async function listIndexes(institutionId: string): Promise<ReportIndex[]> {
  const rows: ReportIndex[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase.from("vertice_academic_reports")
      .select("id,kind,course_id,source_report_at")
      .eq("institution_id", institutionId).order("id").range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as ReportIndex[]));
    if (!data || data.length < 1000) return rows;
  }
  throw new Error("Limite de consulta ultrapassado.");
}
export default function AcademicoFontesMobileBI({ institutionId }: { institutionId: string }) {
  const [data, setData] = useState<AcademicInfo>(empty);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setData(empty); setError(false); setPending(true);
    void Promise.all([
      listIndexes(institutionId),
      supabase.from("vertice_academic_reports").select("id,payload")
        .eq("institution_id", institutionId).eq("kind", "reprovacoes_semestre").order("source_report_at",{ascending:false}).limit(50)
    ]).then(([reports, rates]) => {
      if (rates.error) throw rates.error;
      if (active) setData({reports, rates: (rates.data ?? []) as ReproRate[]});
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [institutionId, revision]);

  const grouped = useMemo(() => {
    const categories = new Map<string,{count:number;courses:Set<string>;latest:string}>();
    for (const item of data.reports) {
      const prev = categories.get(item.kind) ?? {count:0,courses:new Set<string>(),latest:""};
      prev.count++;
      if (item.course_id) prev.courses.add(item.course_id);
      if (item.source_report_at > prev.latest) prev.latest = item.source_report_at;
      categories.set(item.kind,prev);
    }
    return [...categories].map(([kind,v]) => ({kind,...v})).sort((a,b) => b.count - a.count);
  },[data.reports]);
  const rates = useMemo(() => {
    const bySem = new Map<string,{semester:string;reproved:number;denominator:number;rate:number}>();
    for (const report of data.rates) {
      const sem = String(report.payload?.s || "");
      const reproved = Number(report.payload?.reprovacoes);
      const denom = Number(report.payload?.matriculas);
      const rate = Number(report.payload?.pct_reprovacao);
      if (!/^\d{4}\/0[12]$/.test(sem) || !Number.isFinite(reproved) || !Number.isFinite(denom) || denom <= 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) continue;
      if (!bySem.has(sem)) bySem.set(sem, {semester:sem,reproved,denominator:denom,rate});
    }
    return [...bySem.values()].sort((a,b)=>b.semester.localeCompare(a.semester)).slice(0,8);
  },[data.rates]);

  return <section className="vm-panel vm-docs" aria-labelledby="vm-academic-title">
    <div className="vm-section-top">
      <div><small>FONTES JÁ DISPONÍVEIS</small><h2 id="vm-academic-title">Inteligência acadêmica</h2></div>
      <button onClick={() => setRevision(n => n + 1)} disabled={pending}>Atualizar</button>
    </div>
    {pending ? <p role="status">Consultando os relatórios autorizados…</p> : error ?
      <p role="alert">Fontes acadêmicas indisponíveis. Nenhum indicador foi estimado.</p> : <>
      <div className="vm-doc-grid">
        <article><span>Relatórios disponíveis</span><strong>{nf.format(data.reports.length)}</strong><small>Registros indexados</small></article>
        <article><span>Tipos de relatório</span><strong>{nf.format(grouped.length)}</strong><small>Conjuntos distintos</small></article>
        <article><span>Reprovação por disciplina</span><strong>{nf.format(grouped.find(g=>g.kind==="reprovacoes_disciplina")?.count ?? 0)}</strong><small>Dados de disciplina, não alunos únicos</small></article>
        <article><span>Reprovação por professor</span><strong>{nf.format(grouped.find(g=>g.kind==="reprovacoes_professor")?.count ?? 0)}</strong><small>Exige cuidado na interpretação individual</small></article>
      </div>
      {rates.length > 0 && <div className="vm-doc-subsection">
        <h3>Taxa de reprovação informada pela fonte</h3>
        {rates.map(v => <div className="vm-doc-course" key={v.semester}>
          <div><strong>{v.semester} · {v.rate.toLocaleString("pt-BR",{maximumFractionDigits:2})}%</strong><small>{nf.format(v.reproved)} reprovações sobre {nf.format(v.denominator)} registros usados na taxa</small></div>
          <div className="vm-track"><span style={{width:Math.min(100,v.rate)+"%"}} /></div>
        </div>)}
        <p className="vm-muted">A taxa acima reproduz o percentual informado nos relatórios. O denominador não foi validado como número de estudantes únicos; não usar como taxa de evasão ou fracasso individual.</p>
      </div>}
      <div className="vm-doc-subsection">
        <h3>Cobertura de relatórios por assunto</h3>
        {grouped.map(g => <div key={g.kind} className="vm-doc-line">
          <span>{labels[g.kind] || g.kind.replaceAll("_"," ")}</span>
          <strong>{nf.format(g.count)}</strong>
          <small>{g.courses.size ? g.courses.size + " cursos" : "Relatórios institucionais"} · {g.latest ? new Date(g.latest).toLocaleDateString("pt-BR") : "sem data"}</small>
        </div>)}
      </div>
      <OutcomesMobileBreakdown institutionId={institutionId} />
      <a href={"/master#" + new URLSearchParams({instituicao:institutionId,aba:"eorbit"}).toString()} className="vm-primary">Abrir análise acadêmica completa</a>
    </>}
  </section>;
}
