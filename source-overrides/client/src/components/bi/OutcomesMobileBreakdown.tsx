import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Outcome = {
  id: number;
  semester: string;
  course_code: string | null;
  discipline: string | null;
  teachers: string | null;
  rf: number | null;
  rn: number | null;
  ra: number | null;
  discipline_enrollments: number | null;
};
type Group = { key: string; label: string; rf: number; rn: number; ra: number; count: number };
const fmt = new Intl.NumberFormat("pt-BR");
const SEMESTERS = ["2026/02", "2026/01", "2025/02", "2025/01", "2024/02", "2024/01", "2023/02", "2023/01"];

function sumCodes(row: Outcome) {
  return (row.rf ?? 0) + (row.rn ?? 0) + (row.ra ?? 0);
}
function groupRows(rows: Outcome[], selector: (row: Outcome) => { key: string; label: string }): Group[] {
  const grouped = new Map<string, Group>();
  for (const row of rows) {
    const { key, label } = selector(row);
    if (!key.trim()) continue;
    const prev = grouped.get(key) ?? { key, label, rf: 0, rn: 0, ra: 0, count: 0 };
    prev.rf += row.rf ?? 0;
    prev.rn += row.rn ?? 0;
    prev.ra += row.ra ?? 0;
    prev.count++;
    grouped.set(key, prev);
  }
  return [...grouped.values()].sort((a, b) =>
    (b.rf + b.rn + b.ra) - (a.rf + a.rn + a.ra) || a.label.localeCompare(b.label, "pt-BR")
  );
}

async function fetchOutcomes(institutionId: string, semester: string): Promise<Outcome[]> {
  const rows: Outcome[] = [];
  for (let page = 0; page < 20; page++) {
    const first = page * 1000;
    const { data, error } = await supabase.from("vertice_offering_outcomes")
      .select("id,semester,course_code,discipline,teachers,rf,rn,ra,discipline_enrollments")
      .eq("institution_id", institutionId).eq("semester", semester)
      .order("id").range(first, first + 999);
    if (error) throw error;
    const batch = (data ?? []) as Outcome[];
    for (const row of batch) {
      if ([row.rf, row.rn, row.ra, row.discipline_enrollments].some(v =>
        v !== null && (!Number.isSafeInteger(v) || v < 0))) {
        throw new Error("Contagem inválida no relatório.");
      }
    }
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
  throw new Error("Consulta de ofertas incompleta.");
}

export default function OutcomesMobileBreakdown({ institutionId }: { institutionId: string }) {
  const [semester, setSemester] = useState("2026/02");
  const [rows, setRows] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [courseFilter, setCourseFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  useEffect(() => {
    let active = true;
    setRows([]); setLoading(true); setError(false);
    void fetchOutcomes(institutionId, semester).then(records => {
      if (active) setRows(records);
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [institutionId, semester, revision]);

  const courses = useMemo(() => [...new Set(rows.map(r => r.course_code).filter((v): v is string => Boolean(v)))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter(row =>
    (!courseFilter || row.course_code === courseFilter) &&
    (row.discipline ?? "").toLocaleLowerCase("pt-BR").includes(textFilter.toLocaleLowerCase("pt-BR"))
  ), [rows, courseFilter, textFilter]);
  const codes = [filtered.reduce((n, r) => n + (r.rf ?? 0), 0),
    filtered.reduce((n, r) => n + (r.rn ?? 0), 0),
    filtered.reduce((n, r) => n + (r.ra ?? 0), 0)];
  const disciplines = useMemo(() => groupRows(filtered, row => ({
    key: (row.course_code ?? "?") + "·" + (row.discipline ?? ""),
    label: (row.discipline ?? "Disciplina não identificada") + " · curso " + (row.course_code ?? "?")
  })), [filtered]);
  const teachers = useMemo(() => groupRows(filtered, row => ({
    key: row.teachers ?? "",
    label: row.teachers ?? ""
  })), [filtered]);

  return <section className="vm-doc-subsection" aria-label="Resultados acadêmicos por oferta">
    <div className="vm-section-top">
      <div><small>RECORTE DE OFERTAS · ACESSO DE ALTA GESTÃO</small>
        <h3>Reprovações por curso, disciplina e docência</h3></div>
      <button type="button" onClick={() => setRevision(v => v + 1)} disabled={loading}>Atualizar</button>
    </div>
    <div className="vm-filters">
      <label>Semestre
        <select value={semester} onChange={event => { setSemester(event.target.value); setCourseFilter(""); }}>
          {SEMESTERS.map(s => <option value={s} key={s}>{s}</option>)}
        </select>
      </label>
      <label>Curso (código e-ORBIT)
        <select disabled={loading || !courses.length} value={courseFilter} onChange={event => setCourseFilter(event.target.value)}>
          <option value="">Todos os cursos</option>
          {courses.map(c => <option value={c} key={c}>{c}</option>)}
        </select>
      </label>
    </div>
    {loading ? <p role="status">Conferindo ofertas e ocorrências acadêmicas…</p> :
      error ? <p role="alert">Não foi possível conferir as ofertas autorizadas.</p> :
      !rows.length ? <p className="vm-muted">Nenhuma oferta visível para este perfil/semestre; isto pode indicar restrição de acesso ou ausência de dados, não zero reprovações.</p> : <>
        <div className="vm-doc-grid">
          <article><span>Ofertas no filtro</span><strong>{fmt.format(filtered.length)}</strong>
            <small>Não representa alunos únicos</small></article>
          {(["RF", "RN", "RA"] as const).map((code, i) =>
            <article key={code}><span>Ocorrências {code}</span><strong>{fmt.format(codes[i])}</strong>
              <small>Categoria registrada na fonte</small></article>)}
        </div>
        <p className="vm-muted">Total de códigos neste recorte: {fmt.format(codes.reduce((a, b) => a + b, 0))}. Vínculos em disciplinas registrados nas ofertas: {fmt.format(filtered.reduce((n, r) => n + (r.discipline_enrollments ?? 0), 0))}. As definições oficiais de RF/RN/RA precisam ser confirmadas no dicionário da fonte antes de rotular as categorias como falta, nota ou outra causa. Os relatórios históricos da Reitoria têm cobertura diferente; não comparar diretamente seus totais.</p>
        <label className="vm-search">Filtrar disciplina
          <input type="search" value={textFilter} onChange={event => setTextFilter(event.target.value)} placeholder="Ex.: Anatomia" />
        </label>
        <h3>Disciplinas no recorte</h3>
        {!disciplines.length ? <p className="vm-muted">Nenhuma disciplina atende ao filtro.</p> :
          disciplines.slice(0, 20).map(g => <div className="vm-doc-line" key={g.key}>
            <span>{g.label}</span><strong>{fmt.format(g.rf + g.rn + g.ra)} ocorrências</strong>
            <small>RF {g.rf} · RN {g.rn} · RA {g.ra} · {g.count} oferta(s)</small>
          </div>)}
        <h3>Docentes conforme identificados nas ofertas</h3>
        {!teachers.length ? <p className="vm-muted">Docentes não informados para as ofertas selecionadas.</p> :
          teachers.slice(0, 15).map(g => <div className="vm-doc-line" key={g.key}>
            <span>{g.label}</span><strong>{fmt.format(g.rf + g.rn + g.ra)} ocorrências</strong>
            <small>RF {g.rf} · RN {g.rn} · RA {g.ra} · {g.count} oferta(s)</small>
          </div>)}
        <p className="vm-muted">Os nomes de docentes podem aparecer em conjunto numa mesma oferta. Esta listagem não atribui causalidade, responsabilidade pedagógica individual nem a quantidade de alunos distintos reprovados. Use-a apenas como triagem para análise acadêmica.</p>
      </>}
  </section>;
}
