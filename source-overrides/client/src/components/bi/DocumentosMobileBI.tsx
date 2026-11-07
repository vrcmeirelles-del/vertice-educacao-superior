import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Course } from "@/components/InstitutionArea";

type Requirement = { id: string; course_id: string | null; active: boolean; not_applicable: boolean | null; indicator: string | null; due_date: string | null; repository_section: string | null; title: string };
type Evidence = { id: string; request_id: string; status: string | null; document_category: string | null };
type Inep = { id: string; code: string | null; dimension: number | null; is_placeholder: boolean | null; object_path: string | null };
type DocData = { requirements: Requirement[]; evidence: Evidence[]; inep: Inep[] };
const empty: DocData = { requirements: [], evidence: [], inep: [] };
const formatter = new Intl.NumberFormat("pt-BR");
async function fetchAll<T>(table: string, columns: string, institutionId: string, activeOnly = false): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 50; page++) {
    const first = page * 1000;
    let query = supabase.from(table).select(columns).eq("institution_id", institutionId).order("id").range(first, first + 999);
    if (activeOnly) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data || []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
  throw new Error("Fonte com mais de 50.000 registros: informe o administrador.");
}

export default function DocumentosMobileBI({ institutionId, courses }: { institutionId: string; courses: Course[] }) {
  const [data, setData] = useState<DocData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setData(empty);
    void Promise.all([
      fetchAll<Requirement>("vertice_repository_requests", "id,course_id,active,not_applicable,indicator,due_date,repository_section,title", institutionId),
      fetchAll<Evidence>("vertice_repository_files", "id,request_id,status,document_category", institutionId),
      fetchAll<Inep>("vertice_inep_library", "id,code,dimension,is_placeholder,object_path", institutionId, true)
    ]).then(([requirements, evidence, inep]) => {
      if (!active) return;
      setData({ requirements, evidence, inep }); setUpdated(new Date());
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [institutionId, refresh]);

  const stats = useMemo(() => {
    const requirements = data.requirements.filter(item => item.active && !item.not_applicable);
    const evidence = data.evidence;
    const linked = new Map<string, Evidence[]>();
    for (const e of evidence) {
      const current = linked.get(e.request_id) ?? [];
      current.push(e); linked.set(e.request_id, current);
    }
    const covered = requirements.filter(r => linked.has(r.id));
    const validated = requirements.filter(r => linked.get(r.id)?.some(f => f.status === "validado"));
    const submitted = requirements.filter(r => linked.get(r.id)?.some(f => f.status === "enviado") && !linked.get(r.id)?.some(f => f.status === "validado"));
    const missing = requirements.filter(r => !linked.has(r.id));
    const overdue = missing.filter(r => r.due_date && new Date(r.due_date + "T23:59:59") < new Date());
    const byCourse = new Map<string, { total: number; covered: number; validated: number }>();
    for (const r of requirements) {
      if (!r.course_id) continue;
      const previous = byCourse.get(r.course_id) ?? { total: 0, covered: 0, validated: 0 };
      previous.total += 1;
      if (linked.has(r.id)) previous.covered += 1;
      if (linked.get(r.id)?.some(f => f.status === "validado")) previous.validated += 1;
      byCourse.set(r.course_id, previous);
    }
    const courseStats = [...byCourse.entries()].map(([id, s]) => ({
      id, label: courses.find(c => c.id === id)?.name ?? "Curso cadastrado", ...s
    })).sort((a, b) => (b.total - b.covered) - (a.total - a.covered));
    const byDimension = [1, 2, 3].map(dim => ({
      dim, rows: data.inep.filter(x => x.dimension === dim)
    }));
    return { requirements, evidence, covered, validated, submitted, missing, overdue, courseStats, byDimension,
      placeholders: data.inep.filter(r => r.is_placeholder), indicators: new Set(requirements.map(r => r.indicator).filter(Boolean)).size };
  }, [data, courses]);
  const fraction = (numerator: number, denominator: number) => denominator ? (numerator / denominator * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "Sem base";
  return <section className="vm-panel vm-docs" aria-labelledby="vm-doc-title">
    <div className="vm-section-top">
      <div><small>EVIDÊNCIAS INSTITUCIONAIS</small><h2 id="vm-doc-title">Cobertura documental</h2></div>
      <button type="button" onClick={() => setRefresh(v => v + 1)} disabled={loading}>Atualizar</button>
    </div>
    {loading ? <p role="status">Consultando exigências, arquivos e Biblioteca INEP…</p> : error ?
      <p role="alert">Não foi possível consultar a base documental autorizada. Nenhum valor foi estimado.</p> : <>
      <div className="vm-doc-grid">
        <article><span>Exigências ativas</span><strong>{formatter.format(stats.requirements.length)}</strong><small>Exclui registros NSA</small></article>
        <article><span>Com arquivo vinculado</span><strong>{formatter.format(stats.covered.length)}</strong><small>{fraction(stats.covered.length, stats.requirements.length)} de cobertura</small></article>
        <article><span>Sem arquivo vinculado</span><strong>{formatter.format(stats.missing.length)}</strong><small>Requer triagem documental</small></article>
        <article><span>Arquivos cadastrados</span><strong>{formatter.format(stats.evidence.length)}</strong><small>Não equivale a requisitos atendidos</small></article>
        <article><span>Evidências validadas</span><strong>{formatter.format(stats.validated.length)}</strong><small>Exigências com ao menos um arquivo validado</small></article>
        <article><span>Biblioteca INEP ativa</span><strong>{formatter.format(data.inep.length)}</strong><small>{stats.placeholders.length} itens identificados como modelos provisórios</small></article>
      </div>
      <p className="vm-muted">Há {formatter.format(stats.submitted.length)} exigências com arquivos enviados, ainda sem validação final, e {formatter.format(stats.overdue.length)} exigências sem arquivo cujo prazo informado venceu.</p>
      <div className="vm-doc-subsection">
        <h3>Biblioteca INEP por dimensão</h3>
        {stats.byDimension.map(item => <div className="vm-doc-line" key={item.dim}><span>Dimensão {item.dim}</span><strong>{formatter.format(item.rows.length)}</strong><small>{item.rows.filter(r => r.is_placeholder).length} modelos provisórios</small></div>)}
        <p className="vm-muted">A Biblioteca INEP documenta referências; uma referência ativa não comprova a existência de evidência validada no curso.</p>
      </div>
      <div className="vm-doc-subsection">
        <h3>Cursos com maior lacuna documental</h3>
        {!stats.courseStats.length ? <p>Sem cursos com exigências disponíveis.</p> : stats.courseStats.slice(0, 12).map(s => <div className="vm-doc-course" key={s.id}>
          <div><strong>{s.label}</strong><small>{s.covered} de {s.total} exigências com arquivo · {s.validated} validadas</small></div>
          <div className="vm-track"><span style={{ width: fraction(s.covered, s.total) === "Sem base" ? "0%" : (s.covered / s.total * 100) + "%" }} /></div>
        </div>)}
      </div>
      <a className="vm-primary" href={"/master#" + new URLSearchParams({ instituicao: institutionId, aba: "repositorio" }).toString()}>Abrir repositório e validar documentos</a>
      {updated && <p className="vm-muted">Consulta realizada: {updated.toLocaleString("pt-BR")}. Os dados permanecem no repositório original.</p>}
    </>}
  </section>;
}
