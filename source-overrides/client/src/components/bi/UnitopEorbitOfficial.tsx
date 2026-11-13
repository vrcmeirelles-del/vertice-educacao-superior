import { HelpLabel } from '@/components/ContextHelp';
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type UnitopOfficialSummary = {
  matriculas: number;
  vinculos: number;
  grades: number;
  cursos: number;
};

type SourceRow = {
  curso_id: number;
  grade_id: number;
  total_matriculados: number;
  total_vinculos: number;
};
type CourseRow = { id: number; nome: string; modalidade: string | null };
type CourseTotal = {
  id: number;
  nome: string;
  modalidade: string;
  matriculas: number;
  vinculos: number;
  grades: number;
};
type SourceData = { summary: UnitopOfficialSummary; courses: CourseTotal[] };
const fmt = new Intl.NumberFormat("pt-BR");

/**
 * Reconstitui o relatório 2 por curso x semestre x grade.
 * A tabela de snapshots (1.987 em 2026/02) não deve ser confundida com esta
 * extração (6.846). Nenhuma linha nominal é consultada ou gravada.
 * O identificador da instituição no espelho e-ORBIT é distinto do cadastro
 * Vértice; a rota pai só monta este componente para UNITOP + sessão MFA AAL2.
 */
async function loadOfficialUnitop(): Promise<SourceData> {
  const { data: semesters, error: semesterError } = await supabase
    .from("vertice_eorbit_semestres")
    .select("id,semestre")
    .eq("semestre", "2026/02")
    .limit(10);
  if (semesterError || !semesters || semesters.length !== 1) {
    throw new Error("Identificação unívoca do semestre não confirmada.");
  }
  const { data: source, error, count } = await supabase
    .from("vertice_eorbit_quantitativo")
    .select("curso_id,grade_id,total_matriculados,total_vinculos", { count: "exact" })
    .eq("semestre_id", semesters[0].id)
    .eq("fonte", "eorbit_rel2")
    .order("grade_id")
    .limit(500);
  if (error || !source || !source.length || count !== source.length) {
    throw new Error("Fonte quantitativa ausente ou consulta incompleta.");
  }
  const rows = source as SourceRow[];
  const gradeIds = new Set<number>();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.grade_id) || gradeIds.has(row.grade_id) ||
        !Number.isSafeInteger(row.curso_id) ||
        !Number.isSafeInteger(row.total_matriculados) || row.total_matriculados < 0 ||
        !Number.isSafeInteger(row.total_vinculos) || row.total_vinculos < 0) {
      throw new Error("Há grades duplicadas ou valores inválidos na fonte.");
    }
    gradeIds.add(row.grade_id);
  }

  const uniqueCourseIds = [...new Set(rows.map(row => row.curso_id))];
  const { data: courseData, error: courseError } = await supabase
    .from("vertice_eorbit_cursos")
    .select("id,nome,modalidade")
    .in("id", uniqueCourseIds);
  if (courseError || !courseData || courseData.length !== uniqueCourseIds.length) {
    throw new Error("O cadastro de cursos e-ORBIT está incompleto.");
  }
  const lookup = new Map((courseData as CourseRow[]).map(c => [c.id, c]));
  const byCourse = new Map<number, CourseTotal>();
  let matriculas = 0;
  let vinculos = 0;
  for (const row of rows) {
    const course = lookup.get(row.curso_id);
    if (!course) throw new Error("Curso sem correspondência no espelho e-ORBIT.");
    const subtotal = byCourse.get(row.curso_id) ?? {
      id: row.curso_id, nome: course.nome,
      modalidade: course.modalidade ?? "não informada",
      matriculas: 0, vinculos: 0, grades: 0
    };
    subtotal.matriculas += row.total_matriculados;
    subtotal.vinculos += row.total_vinculos;
    subtotal.grades += 1;
    byCourse.set(row.curso_id, subtotal);
    matriculas += row.total_matriculados;
    vinculos += row.total_vinculos;
  }
  const courses = [...byCourse.values()].sort(
    (a, b) => b.matriculas - a.matriculas || a.nome.localeCompare(b.nome, "pt-BR")
  );
  if (courses.reduce((n, c) => n + c.matriculas, 0) !== matriculas) {
    throw new Error("A conferência dos totais por curso não fechou.");
  }
  return {
    summary: { matriculas, vinculos, grades: rows.length, cursos: courses.length },
    courses
  };
}

export default function UnitopEorbitOfficial({
  onVerified,
  showCourses
}: {
  onVerified: (summary: UnitopOfficialSummary | null) => void;
  showCourses: boolean;
}) {
  const [payload, setPayload] = useState<SourceData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setPayload(null);
    onVerified(null);
    void loadOfficialUnitop().then(result => {
      if (!active) return;
      setPayload(result);
      onVerified(result.summary);
    }).catch(() => {
      if (!active) return;
      setError(true);
      onVerified(null);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [onVerified, revision]);

  const filtered = useMemo(
    () => payload?.courses.filter(c =>
      (c.nome + " " + c.modalidade).toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR"))) ?? [],
    [payload, search]
  );

  return <section className="vm-panel" aria-label="Matrículas confirmadas pela base e-ORBIT">
    <div className="vm-section-top">
      <div>
        <small>UNITOP · RELATÓRIO 2 e-ORBIT · 2026/02</small>
        <h2>Fonte quantitativa completa</h2>
      </div>
      <button type="button" disabled={loading} onClick={() => setRevision(v => v + 1)}>
        {loading ? "Conferindo…" : "Reconsultar"}
      </button>
    </div>
    {loading ? <p role="status">Somando todas as grades da extração original…</p> :
      error || !payload ? <p role="alert">Não foi possível reconciliar a base completa com segurança. O total antigo de 1.987 não será usado como substituto.</p> : <>
        <div className="vm-indicators">
          <article className="vm-indicator vm-blue"><span>Matrículas no relatório 2</span>
            <strong>{fmt.format(payload.summary.matriculas)}</strong>
            <small>Contagem quantitativa por curso e grade</small></article>
          <article className="vm-indicator vm-teal"><span>Vínculos do relatório</span>
            <strong>{fmt.format(payload.summary.vinculos)}</strong>
            <small>Unidade estatística distinta de matrículas</small></article>
          <article className="vm-indicator vm-violet"><span>Cursos encontrados</span>
            <strong>{payload.summary.cursos}</strong><small>{payload.summary.grades} grades conferidas</small></article>
        </div>
        <p className="vm-muted">A tabela resumida antiga permanece em conciliação. Estes valores são lidos diretamente da base e-ORBIT existente, sem substituir registros originais nem afirmar que vínculos são alunos únicos. O comparativo com 2025/02 só será liberado após validação de equivalência e cobertura das fontes.</p>
        {showCourses && <>
          <HelpLabel className="vm-search">Buscar curso no relatório 2
            <input type="search" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Nome ou modalidade" />
          </HelpLabel>
          <div className="vm-course-list">
            {filtered.map(c => <article className="vm-course" key={c.id}>
              <span><strong>{c.nome}</strong>
                <small>{c.modalidade} · {c.grades} grade(s)</small></span>
              <span><b>{fmt.format(c.matriculas)}</b>
                <small>matrículas · {fmt.format(c.vinculos)} vínculos</small></span>
            </article>)}
          </div>
        </>}
      </>}
  </section>;
}
