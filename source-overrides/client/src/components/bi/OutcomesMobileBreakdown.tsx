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
type Mode = "semestres" | "anos";
type Level = "curso" | "disciplina" | "docente";
type Sort = "volume" | "aumento" | "queda";
type Stats = { rf: number; rn: number; ra: number; offers: number; links: number };
type Group = Stats & { key: string; label: string };
type ComparisonLine = {
  key: string;
  label: string;
  before: Group | null;
  after: Group | null;
};
const fmt = new Intl.NumberFormat("pt-BR");
const number1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const semesters = [
  "2026/02", "2026/01", "2025/02", "2025/01", "2024/02", "2024/01",
  "2023/02", "2023/01", "2022/02", "2022/01"
];
const years = ["2026", "2025", "2024", "2023", "2022"];
const emptyStats = (): Stats => ({ rf: 0, rn: 0, ra: 0, offers: 0, links: 0 });
const occurrences = (stats: Stats) => stats.rf + stats.rn + stats.ra;
const signed = (value: number) => (value > 0 ? "+" : "") + fmt.format(value);
const percentage = (numerator: number, denominator: number) =>
  denominator > 0 ? number1.format((numerator / denominator) * 100) + "%" : "Sem base";
const deltaPercentage = (before: number, after: number) =>
  before > 0 ? (after > before ? "+" : "") + number1.format((after / before - 1) * 100) + "%" : "Sem base percentual";
const rate = (stats: Stats) => stats.links > 0 ? (occurrences(stats) / stats.links) * 100 : null;
const rateLabel = (value: number | null) =>
  value === null ? "Sem base" : number1.format(value) + " por 100 vínculos";

function summarize(rows: Outcome[]): Stats {
  return rows.reduce((sum, row) => ({
    rf: sum.rf + (row.rf ?? 0),
    rn: sum.rn + (row.rn ?? 0),
    ra: sum.ra + (row.ra ?? 0),
    offers: sum.offers + 1,
    links: sum.links + (row.discipline_enrollments ?? 0)
  }), emptyStats());
}
function groupKey(row: Outcome, level: Level): { key: string; label: string } | null {
  if (level === "curso") {
    const code = row.course_code?.trim();
    return code ? { key: code, label: "Curso " + code } : null;
  }
  if (level === "disciplina") {
    const code = row.course_code?.trim();
    const name = row.discipline?.trim();
    return code && name ? { key: code + "|" + name.toLocaleUpperCase("pt-BR"), label: name + " · curso " + code } : null;
  }
  const teachers = row.teachers?.trim();
  return teachers ? { key: teachers.toLocaleUpperCase("pt-BR"), label: teachers } : null;
}
function groupRows(rows: Outcome[], level: Level): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const group = groupKey(row, level);
    if (!group) continue;
    const prev = groups.get(group.key) ?? { key: group.key, label: group.label, ...emptyStats() };
    prev.rf += row.rf ?? 0;
    prev.rn += row.rn ?? 0;
    prev.ra += row.ra ?? 0;
    prev.offers += 1;
    prev.links += row.discipline_enrollments ?? 0;
    groups.set(group.key, prev);
  }
  return groups;
}
function compareGroups(before: Outcome[], after: Outcome[], level: Level, order: Sort): ComparisonLine[] {
  const beforeGroups = groupRows(before, level);
  const afterGroups = groupRows(after, level);
  return [...new Set([...beforeGroups.keys(), ...afterGroups.keys()])]
    .map(key => ({
      key, label: afterGroups.get(key)?.label ?? beforeGroups.get(key)!.label,
      before: beforeGroups.get(key) ?? null, after: afterGroups.get(key) ?? null
    }))
    .sort((a, b) => {
      const aComparable = a.before !== null && a.after !== null;
      const bComparable = b.before !== null && b.after !== null;
      if (aComparable !== bComparable) return aComparable ? -1 : 1;
      const aDiff = aComparable ? occurrences(a.after!) - occurrences(a.before!) : 0;
      const bDiff = bComparable ? occurrences(b.after!) - occurrences(b.before!) : 0;
      if (order === "aumento" && aDiff !== bDiff) return bDiff - aDiff;
      if (order === "queda" && aDiff !== bDiff) return aDiff - bDiff;
      const aTotal = (a.before ? occurrences(a.before) : 0) + (a.after ? occurrences(a.after) : 0);
      const bTotal = (b.before ? occurrences(b.before) : 0) + (b.after ? occurrences(b.after) : 0);
      return bTotal - aTotal || a.label.localeCompare(b.label, "pt-BR");
    });
}
async function fetchOutcomes(institutionId: string, periods: string[]): Promise<Outcome[]> {
  const rows: Outcome[] = [];
  for (let page = 0; page < 20; page++) {
    const from = page * 1000;
    const { data, error } = await supabase.from("vertice_offering_outcomes")
      .select("id,semester,course_code,discipline,teachers,rf,rn,ra,discipline_enrollments")
      .eq("institution_id", institutionId).in("semester", periods)
      .order("id").range(from, from + 999);
    if (error) throw error;
    const batch = (data ?? []) as Outcome[];
    for (const row of batch) {
      if ([row.rf, row.rn, row.ra, row.discipline_enrollments].some(value =>
        value !== null && (!Number.isSafeInteger(value) || value < 0))) {
        throw new Error("Contagem inválida na fonte e-ORBIT.");
      }
    }
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
  throw new Error("Consulta incompleta: o limite de registros foi atingido.");
}

export default function OutcomesMobileBreakdown({ institutionId }: { institutionId: string }) {
  const [mode, setMode] = useState<Mode>("semestres");
  const [semesterBefore, setSemesterBefore] = useState("2025/02");
  const [semesterAfter, setSemesterAfter] = useState("2026/02");
  const [yearBefore, setYearBefore] = useState("2025");
  const [yearAfter, setYearAfter] = useState("2026");
  const [level, setLevel] = useState<Level>("curso");
  const [sort, setSort] = useState<Sort>("volume");
  const [rows, setRows] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [courseFilter, setCourseFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");

  const beforePeriods = mode === "semestres" ? [semesterBefore] : [yearBefore + "/01", yearBefore + "/02"];
  const afterPeriods = mode === "semestres" ? [semesterAfter] : [yearAfter + "/01", yearAfter + "/02"];
  const beforeLabel = mode === "semestres" ? semesterBefore : "Ano letivo " + yearBefore;
  const afterLabel = mode === "semestres" ? semesterAfter : "Ano letivo " + yearAfter;
  const samePeriod = mode === "semestres" ? semesterBefore === semesterAfter : yearBefore === yearAfter;
  const periodKey = [...new Set([...beforePeriods, ...afterPeriods])].sort().join("|");

  useEffect(() => {
    let active = true;
    setRows([]); setLoading(true); setError(false);
    void fetchOutcomes(institutionId, periodKey.split("|")).then(records => {
      if (active) setRows(records);
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [institutionId, periodKey, revision]);

  const courses = useMemo(() =>
    [...new Set(rows.map(row => row.course_code).filter((v): v is string => Boolean(v)))].sort(),
    [rows]
  );
  const scoped = useMemo(() => rows.filter(row =>
    (!courseFilter || row.course_code === courseFilter) &&
    (row.discipline ?? "").toLocaleLowerCase("pt-BR").includes(textFilter.toLocaleLowerCase("pt-BR"))
  ), [rows, courseFilter, textFilter]);
  const beforeAll = scoped.filter(row => beforePeriods.includes(row.semester));
  const afterAll = scoped.filter(row => afterPeriods.includes(row.semester));
  const beforeCodes = new Set(beforeAll.map(row => row.course_code).filter((v): v is string => Boolean(v)));
  const afterCodes = new Set(afterAll.map(row => row.course_code).filter((v): v is string => Boolean(v)));
  const commonCodes = new Set([...beforeCodes].filter(code => afterCodes.has(code)));
  const before = beforeAll.filter(row => row.course_code && commonCodes.has(row.course_code));
  const after = afterAll.filter(row => row.course_code && commonCodes.has(row.course_code));
  const beforeStats = summarize(before);
  const afterStats = summarize(after);
  const beforeRaw = summarize(beforeAll);
  const afterRaw = summarize(afterAll);
  const beforeSemestersFound = new Set(beforeAll.map(row => row.semester));
  const afterSemestersFound = new Set(afterAll.map(row => row.semester));
  const periodsComplete = beforePeriods.every(term => beforeSemestersFound.has(term)) &&
    afterPeriods.every(term => afterSemestersFound.has(term));
  const canCompare = !samePeriod && commonCodes.size > 0 && before.length > 0 && after.length > 0 && periodsComplete;
  const beforeRate = rate(beforeStats);
  const afterRate = rate(afterStats);
  const rateDiff = beforeRate === null || afterRate === null ? null : afterRate - beforeRate;
  const lines = useMemo(() => compareGroups(before, after, level, sort), [rows, courseFilter, textFilter, mode, periodKey, semesterBefore, semesterAfter, yearBefore, yearAfter, level, sort]);
  const highest = Math.max(1, occurrences(beforeStats), occurrences(afterStats));
  const comparisonType = mode === "anos" ? "Comparação entre anos letivos completos (1º e 2º semestres)" :
    semesterBefore.slice(5) === semesterAfter.slice(5) ? "Mesmo semestre em anos diferentes" :
    "Comparação entre semestres selecionados";

  return <section className="vm-doc-subsection" aria-label="BI comparativo de reprovações">
    <div className="vm-section-top">
      <div><small>BI DE REPROVAÇÕES · DADOS AGREGADOS DO e-ORBIT</small>
        <h3>Comparar semestres e anos letivos</h3></div>
      <button type="button" onClick={() => setRevision(value => value + 1)} disabled={loading}>Atualizar</button>
    </div>
    <p className="vm-muted">Escolha dois períodos. O comparativo usa exclusivamente as ofertas acadêmicas da mesma fonte e, por padrão, apenas os códigos de cursos presentes em ambos os recortes.</p>
    <div className="vm-filters">
      <label>Tipo de comparação
        <select value={mode} onChange={event => { setMode(event.target.value as Mode); setCourseFilter(""); }}>
          <option value="semestres">Semestre × semestre</option>
          <option value="anos">Ano letivo × ano letivo</option>
        </select>
      </label>
      {mode === "semestres" ? <>
        <label>Período de referência
          <select value={semesterBefore} onChange={event => setSemesterBefore(event.target.value)}>
            {semesters.map(term => <option key={term} value={term}>{term}</option>)}
          </select>
        </label>
        <label>Período de comparação
          <select value={semesterAfter} onChange={event => setSemesterAfter(event.target.value)}>
            {semesters.map(term => <option key={term} value={term}>{term}</option>)}
          </select>
        </label>
      </> : <>
        <label>Ano de referência
          <select value={yearBefore} onChange={event => setYearBefore(event.target.value)}>
            {years.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>Ano de comparação
          <select value={yearAfter} onChange={event => setYearAfter(event.target.value)}>
            {years.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
      </>}
    </div>
    <div className="vm-filters">
      <label>Curso (código do e-ORBIT)
        <select value={courseFilter} disabled={loading || !courses.length} onChange={event => setCourseFilter(event.target.value)}>
          <option value="">Todos os cursos</option>
          {courses.map(code => <option key={code} value={code}>{code}</option>)}
        </select>
      </label>
      <label>Organizar resultados por
        <select value={level} onChange={event => setLevel(event.target.value as Level)}>
          <option value="curso">Curso</option>
          <option value="disciplina">Disciplina</option>
          <option value="docente">Equipe docente</option>
        </select>
      </label>
      <label>Ordenação
        <select value={sort} onChange={event => setSort(event.target.value as Sort)}>
          <option value="volume">Maior volume somado</option>
          <option value="aumento">Maior aumento</option>
          <option value="queda">Maior redução</option>
        </select>
      </label>
    </div>
    <label className="vm-search">Pesquisar disciplina nas ofertas
      <input type="search" value={textFilter} onChange={event => setTextFilter(event.target.value)} placeholder="Ex.: Anatomia" />
    </label>
    <p className="vm-muted">{comparisonType} · {beforeLabel} versus {afterLabel}</p>
    {loading ? <p role="status">Consultando os dois períodos e verificando a cobertura dos cursos…</p> :
      error ? <p role="alert">Não foi possível carregar integralmente os períodos. Nenhuma comparação foi estimada.</p> :
      samePeriod ? <p role="alert">Selecione períodos diferentes para a comparação.</p> :
      !canCompare ? <p role="alert">Sem base comparável neste filtro: é necessário haver ofertas, semestres completos e cursos correspondentes nos dois períodos. Ausência de oferta não equivale a zero reprovações.</p> : <>
        <div className="vm-doc-grid">
          <article>
            <span>{beforeLabel} · referência</span>
            <strong>{fmt.format(occurrences(beforeStats))}</strong>
            <small>RF {fmt.format(beforeStats.rf)} · RN {fmt.format(beforeStats.rn)} · RA {fmt.format(beforeStats.ra)}</small>
          </article>
          <article>
            <span>{afterLabel} · comparação</span>
            <strong>{fmt.format(occurrences(afterStats))}</strong>
            <small>RF {fmt.format(afterStats.rf)} · RN {fmt.format(afterStats.rn)} · RA {fmt.format(afterStats.ra)}</small>
          </article>
          <article>
            <span>Variação de ocorrências</span>
            <strong>{signed(occurrences(afterStats) - occurrences(beforeStats))}</strong>
            <small>{deltaPercentage(occurrences(beforeStats), occurrences(afterStats))} sobre o período de referência</small>
          </article>
          <article>
            <span>Variação da razão bruta</span>
            <strong>{rateDiff === null ? "Sem base" : (rateDiff > 0 ? "+" : "") + number1.format(rateDiff) + " p.p."}</strong>
            <small>{rateLabel(beforeRate)} → {rateLabel(afterRate)}</small>
          </article>
        </div>
        <div className="vm-doc-subsection" aria-label="Gráfico de comparação entre períodos">
          <h3>Ocorrências nos dois períodos</h3>
          {([{ label: beforeLabel, stats: beforeStats }, { label: afterLabel, stats: afterStats }] as const).map(item =>
            <div className="vm-doc-course" key={item.label}>
              <div><strong>{item.label}</strong>
                <small>{fmt.format(occurrences(item.stats))} ocorrências · {fmt.format(item.stats.links)} vínculos em disciplinas · {fmt.format(item.stats.offers)} ofertas</small></div>
              <div className="vm-track" role="meter" aria-label={"Ocorrências em " + item.label} aria-valuemin={0}
                aria-valuemax={highest} aria-valuenow={occurrences(item.stats)}>
                <span style={{ width: (occurrences(item.stats) / highest * 100) + "%" }} /></div>
            </div>
          )}
          <p className="vm-muted">Comparação de {commonCodes.size} curso(s) com ofertas nos dois períodos. Base completa nos filtros: {beforeCodes.size} curso(s) em {beforeLabel} e {afterCodes.size} em {afterLabel}. Totais brutos antes da conciliação: {fmt.format(occurrences(beforeRaw))} e {fmt.format(occurrences(afterRaw))} ocorrências, respectivamente.</p>
        </div>
        <div className="vm-doc-subsection">
          <h3>Indicadores lado a lado</h3>
          <div className="vm-doc-line"><span>Ofertas de disciplina</span>
            <strong>{fmt.format(beforeStats.offers)} → {fmt.format(afterStats.offers)}</strong>
            <small>Variação {signed(afterStats.offers - beforeStats.offers)} · {deltaPercentage(beforeStats.offers, afterStats.offers)}</small></div>
          <div className="vm-doc-line"><span>Vínculos em disciplinas</span>
            <strong>{fmt.format(beforeStats.links)} → {fmt.format(afterStats.links)}</strong>
            <small>Variação {signed(afterStats.links - beforeStats.links)} · {deltaPercentage(beforeStats.links, afterStats.links)}</small></div>
          {(["rf","rn","ra"] as const).map(code => <div className="vm-doc-line" key={code}>
            <span>Ocorrências {code.toUpperCase()}</span>
            <strong>{fmt.format(beforeStats[code])} → {fmt.format(afterStats[code])}</strong>
            <small>Variação {signed(afterStats[code] - beforeStats[code])} · {deltaPercentage(beforeStats[code], afterStats[code])}</small>
          </div>)}
        </div>
        <div className="vm-doc-subsection">
          <h3>Detalhamento comparativo · {level === "curso" ? "por curso" : level === "disciplina" ? "por disciplina" : "por equipe docente"}</h3>
          {!lines.length ? <p className="vm-muted">Nenhum agrupamento encontrado neste filtro.</p> :
            lines.slice(0, 40).map(line => {
              const comparable = line.before !== null && line.after !== null;
              const first = line.before ? occurrences(line.before) : null;
              const second = line.after ? occurrences(line.after) : null;
              return <div className="vm-doc-line" key={line.key}>
                <span>{line.label}</span>
                <strong>{first === null ? "Sem oferta" : fmt.format(first)} → {second === null ? "Sem oferta" : fmt.format(second)}</strong>
                <small>{comparable && first !== null && second !== null ?
                  "Variação " + signed(second - first) + " · " + deltaPercentage(first, second) +
                  " | RF " + line.before!.rf + "→" + line.after!.rf +
                  " · RN " + line.before!.rn + "→" + line.after!.rn +
                  " · RA " + line.before!.ra + "→" + line.after!.ra :
                  "Não comparável: agrupamento sem oferta registrada em um dos períodos"}</small>
              </div>;
            })}
          {lines.length > 40 && <p className="vm-muted">Exibindo 40 de {fmt.format(lines.length)} agrupamentos. Restrinja por curso ou pesquise a disciplina para aprofundar.</p>}
        </div>
        <p className="vm-muted">
          Interpretação: RF, RN e RA são códigos de ocorrência conforme registrados na fonte, ainda sem dicionário homologado de causas. As taxas são razões brutas por 100 vínculos em disciplinas, não percentuais de alunos únicos nem indicadores de evasão. A lista de docentes pode reunir várias pessoas na mesma oferta, sem atribuição individual de responsabilidade. Diferenças na quantidade de ofertas e na composição das turmas podem afetar o resultado.
        </p>
      </>}
  </section>;
}
