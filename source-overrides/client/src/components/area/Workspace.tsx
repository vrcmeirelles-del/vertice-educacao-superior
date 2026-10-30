import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import {
  ACTION_STATUS, COURSE_STATUS, DEGREE, DIMENSIONS, DIRECTION, FINDING_STATUS, FREQUENCY, GOAL_STATUS, MODALITY, PRIORITY, ROLE_LABEL, TABLES, UF,
  can, deleteRow, explain, fmtDate, fmtNum, goalProgress, isLate, label, listByInstitution, saveRow, today,
  type Field, type Role, type Row,
} from "@/lib/area";
import RecordForm from "./RecordForm";
import { FIELD_HELP, TAB_FAQ, TAB_HELP, withHelp } from "@/lib/help";
import "./area.css";

type Tab = "visao" | "cadastro" | "metas" | "plano" | "diagnostico" | "equipe";
const TABS: [Tab, string][] = [
  ["visao", "Matrículas"],
  ["cadastro", "Cadastro e cursos"],
  ["metas", "Metas e indicadores"],
  ["plano", "Plano de ação 5W2H"],
  ["diagnostico", "Diagnóstico"],
  ["equipe", "Equipe"],
];

type Data = { courses: Row[]; goals: Row[]; measurements: Row[]; actions: Row[]; diagnosis: Row[] };
const EMPTY: Data = { courses: [], goals: [], measurements: [], actions: [], diagnosis: [] };

export default function Workspace({
  institution,
  role,
  overview,
  onBack,
  onChanged,
}: {
  institution: Row;
  role: Role | null;
  overview: ReactNode;
  onBack: () => void;
  onChanged: () => void;
}) {
  const id = institution.id;
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get("aba") as Tab | null;
    return t && TABS.some(([k]) => k === t) ? t : "visao";
  });
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    try {
      const [courses, goals, measurements, actions, diagnosis] = await Promise.all([
        listByInstitution(TABLES.courses, id, "name"),
        listByInstitution(TABLES.goals, id),
        listByInstitution(TABLES.measurements, id, "measured_on"),
        listByInstitution(TABLES.actions, id, "due_date"),
        listByInstitution(TABLES.diagnosis, id),
      ]);
      setData({ courses, goals, measurements, actions, diagnosis });
    } catch {
      setError("Não foi possível carregar os dados de gestão. Atualize a página.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    reload();
  }, [reload]);

  const choose = (t: Tab) => {
    setTab(t);
    const p = new URLSearchParams(window.location.hash.slice(1));
    p.set("aba", t);
    window.history.replaceState(null, "", `#${p.toString()}`);
  };

  const late = data.actions.filter(a => isLate(a.due_date, a.status)).length;
  const openFindings = data.diagnosis.filter(d => d.status !== "resolvido").length;
  const activeGoals = data.goals.filter(g => g.status === "ativa" || g.status === "planejada").length;
  const visible = TABS.filter(([k]) => k !== "equipe" || can.manageTeam(role));

  return (
    <section aria-labelledby="ws-title" className="area-ws">
      <p>
        <button className="corp-login-text-button" onClick={onBack}>
          ← Todas as instituições
        </button>
      </p>
      <div className="area-ws-head">
        <div>
          <h2 id="ws-title">
            {String(institution.name)}
            {institution.acronym ? <small> · {String(institution.acronym)}</small> : null}
          </h2>
          <p className="area-muted">
            Seu perfil nesta instituição: <strong>{role ? ROLE_LABEL[role] : "sem vínculo"}</strong>
            {institution.status === "arquivada" && <span className="badge gray"> Arquivada</span>}
          </p>
        </div>
        <a className="area-guide-link" href="/guia.html" target="_blank" rel="noopener">Guia e glossário ↗</a>
        <div className="area-kpis">
          <span><b>{data.courses.length}</b> cursos</span>
          <span><b>{activeGoals}</b> metas em curso</span>
          <span className={late ? "warn" : ""}><b>{late}</b> ações atrasadas</span>
          <span><b>{openFindings}</b> achados abertos</span>
        </div>
      </div>
      <div role="tablist" aria-label="Áreas da instituição" className="area-tabs">
        {visible.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => choose(k)}>
            {l}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="area-error">{error}</p>}
      {TAB_HELP[tab] && <TabHelp id={tab} />}
      {tab === "visao" ? (
        overview
      ) : loading ? (
        <p role="status">Carregando…</p>
      ) : tab === "cadastro" ? (
        <RegistryTab institution={institution} role={role} courses={data.courses} reload={reload} onChanged={onChanged} />
      ) : tab === "metas" ? (
        <GoalsTab institutionId={id} role={role} data={data} reload={reload} />
      ) : tab === "plano" ? (
        <ActionsTab institutionId={id} role={role} data={data} reload={reload} />
      ) : tab === "diagnostico" ? (
        <DiagnosisTab institutionId={id} role={role} data={data} reload={reload} onPlan={() => choose("plano")} />
      ) : (
        <TeamTab institutionId={id} role={role} />
      )}
      {TAB_FAQ[tab] && <TabFaq id={tab} />}
    </section>
  );
}

// ================================================================ utilidades de UI
function TabFaq({ id }: { id: string }) {
  const f = TAB_FAQ[id];
  return (
    <section className="area-faq" aria-labelledby={`faq-${id}`}>
      <h3 id={`faq-${id}`}>Perguntas frequentes · {f.label}</h3>
      {f.items.map(i => (
        <details key={i.q}>
          <summary>{i.q}</summary>
          <p>{i.a}</p>
        </details>
      ))}
      <p className="area-muted small">
        Não encontrou sua dúvida? <a href="/guia.html#perguntas-frequentes" target="_blank" rel="noopener">Veja o guia completo ↗</a>
      </p>
    </section>
  );
}
function TabHelp({ id }: { id: string }) {
  const h = TAB_HELP[id];
  const key = `vertice-help-${id}`;
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(key) !== "fechado"; } catch { return true; }
  });
  return (
    <details
      className="area-help"
      open={open}
      onToggle={e => {
        const o = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(o);
        try { localStorage.setItem(key, o ? "aberto" : "fechado"); } catch { /* sem armazenamento */ }
      }}
    >
      <summary>{h.title}</summary>
      {h.text.map(t => <p key={t}>{t}</p>)}
      <p><a href="/guia.html" target="_blank" rel="noopener">Ver o guia completo e o glossário ↗</a></p>
    </details>
  );
}

function useEditor<T = Row>() {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  return { editing, open: (r: T | "new") => setEditing(r), close: () => setEditing(null) };
}

function RemoveButton({ onConfirm, label = "Remover", title }: { onConfirm: () => Promise<void>; label?: string; title?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="corp-login-text-button area-danger"
      disabled={busy}
      title={title}
      aria-label={title}
      onClick={async () => {
        if (!window.confirm("Remover este registro? A operação fica registrada na auditoria e não pode ser desfeita pela tela.")) return;
        setBusy(true);
        try {
          await onConfirm();
        } catch (e) {
          window.alert(explain(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </button>
  );
}

const courseOptions = (courses: Row[]): [string, string][] =>
  courses.map(c => [c.id, `${c.code ? `${c.code} · ` : ""}${c.name}`]);

// ================================================================ cadastro
export const INSTITUTION_FIELDS: Field[] = withHelp([
  { name: "name", label: "Nome da instituição", required: true, wide: true },
  { name: "acronym", label: "Sigla" },
  { name: "cnpj", label: "CNPJ (somente números)", placeholder: "00000000000000" },
  { name: "emec_code", label: "Código e-MEC" },
  { name: "maintainer", label: "Mantenedora", wide: true },
  { name: "city", label: "Município" },
  { name: "state", label: "UF", type: "select", options: UF },
  { name: "status", label: "Situação", type: "select", required: true, options: [["ativa", "Ativa"], ["arquivada", "Arquivada"]] },
  { name: "notes", label: "Observações", type: "textarea" },
], FIELD_HELP.institution);
const COURSE_FIELDS: Field[] = withHelp([
  { name: "name", label: "Nome do curso", required: true, wide: true },
  { name: "code", label: "Código (e-MEC ou interno)" },
  { name: "degree", label: "Grau", type: "select", options: DEGREE },
  { name: "modality", label: "Modalidade", type: "select", options: MODALITY },
  { name: "status", label: "Situação", type: "select", required: true, options: COURSE_STATUS },
  { name: "vacancies", label: "Vagas autorizadas", type: "number", min: 0, step: "1" },
  { name: "coordinator", label: "Coordenação" },
], FIELD_HELP.course);

function RegistryTab({ institution, role, courses, reload, onChanged }: { institution: Row; role: Role | null; courses: Row[]; reload: () => Promise<void>; onChanged: () => void }) {
  const [editInst, setEditInst] = useState(false);
  const ed = useEditor();
  const [q, setQ] = useState("");
  const list = courses.filter(c => `${c.code ?? ""} ${c.name}`.toLowerCase().includes(q.toLowerCase()));
  const cnpj = institution.cnpj ? String(institution.cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "—";
  return (
    <>
      <div className="area-panel">
        <div className="area-panel-head">
          <h3>Dados da instituição</h3>
          {can.editInstitution(role) && !editInst && <button className="corp-login-text-button" onClick={() => setEditInst(true)}>Editar</button>}
        </div>
        {editInst ? (
          <RecordForm
            title="Editar instituição"
            fields={INSTITUTION_FIELDS}
            initial={{ ...institution, status: institution.status ?? "ativa" }}
            onCancel={() => setEditInst(false)}
            onSubmit={async v => {
              await saveRow(TABLES.institutions, v, institution.id);
              setEditInst(false);
              onChanged();
            }}
          />
        ) : (
          <dl className="area-dl">
            <div><dt>Sigla</dt><dd>{String(institution.acronym ?? "—")}</dd></div>
            <div><dt>CNPJ</dt><dd>{cnpj}</dd></div>
            <div><dt>Código e-MEC</dt><dd>{String(institution.emec_code ?? "—")}</dd></div>
            <div><dt>Mantenedora</dt><dd>{String(institution.maintainer ?? "—")}</dd></div>
            <div><dt>Município/UF</dt><dd>{[institution.city, institution.state].filter(Boolean).join("/") || "—"}</dd></div>
            <div><dt>Situação</dt><dd>{institution.status === "arquivada" ? "Arquivada" : "Ativa"}</dd></div>
            {institution.notes ? <div className="wide"><dt>Observações</dt><dd>{String(institution.notes)}</dd></div> : null}
          </dl>
        )}
      </div>

      <div className="area-panel">
        <div className="area-panel-head">
          <h3>Cursos ({courses.length})</h3>
          {can.manageCourses(role) && <button className="corp-button small" onClick={() => ed.open("new")}>Novo curso</button>}
        </div>
        {ed.editing && (
          <RecordForm
            title={ed.editing === "new" ? "Novo curso" : "Editar curso"}
            fields={COURSE_FIELDS}
            initial={ed.editing === "new" ? { status: "ativo", modality: "presencial" } : ed.editing}
            onCancel={ed.close}
            onSubmit={async v => {
              await saveRow(TABLES.courses, ed.editing === "new" ? { ...v, institution_id: institution.id } : v, ed.editing === "new" ? undefined : (ed.editing as Row).id);
              ed.close();
              await reload();
              onChanged();
            }}
          />
        )}
        <label className="area-search">Buscar curso <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome ou código" /></label>
        {!courses.length ? (
          <p className="area-muted">Nenhum curso cadastrado.</p>
        ) : (
          <div className="table-scroll">
            <table className="area-table">
              <thead><tr><th>Código</th><th>Curso</th><th>Grau</th><th>Modalidade</th><th>Situação</th><th>Vagas</th><th>Coordenação</th><th /></tr></thead>
              <tbody>
                {list.map(c => (
                  <tr key={c.id}>
                    <td>{String(c.code ?? "—")}</td>
                    <td>{String(c.name)}</td>
                    <td>{label(DEGREE, c.degree)}</td>
                    <td>{label(MODALITY, c.modality)}</td>
                    <td>{label(COURSE_STATUS, c.status ?? "ativo")}</td>
                    <td>{fmtNum(c.vacancies)}</td>
                    <td>{String(c.coordinator ?? "—")}</td>
                    <td className="area-row-actions">
                      {can.manageCourses(role) && <button className="corp-login-text-button" onClick={() => ed.open(c)}>Editar</button>}
                      {can.deleteCourse(role) && <RemoveButton onConfirm={async () => { await deleteRow(TABLES.courses, c.id); await reload(); onChanged(); }} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="area-muted">Cursos com matrículas importadas não podem ser removidos; use a situação “Em extinção” ou “Extinto”.</p>
      </div>
    </>
  );
}

// ================================================================ metas
function goalFields(courses: Row[]): Field[] {
  return withHelp([
    { name: "title", label: "Meta", required: true, wide: true, placeholder: "Ex.: Reduzir a evasão do 1º ano" },
    { name: "indicator", label: "Indicador", required: true, placeholder: "Ex.: Taxa de evasão anual" },
    { name: "course_id", label: "Curso (opcional)", type: "select", options: courseOptions(courses) },
    { name: "unit", label: "Unidade", placeholder: "%, alunos, nota…" },
    { name: "direction", label: "Sentido desejado", type: "select", required: true, options: DIRECTION },
    { name: "baseline", label: "Linha de base", type: "number" },
    { name: "baseline_date", label: "Data da linha de base", type: "date" },
    { name: "target", label: "Alvo", type: "number", required: true },
    { name: "due_date", label: "Prazo", type: "date" },
    { name: "frequency", label: "Periodicidade de medição", type: "select", options: FREQUENCY },
    { name: "owner_name", label: "Responsável" },
    { name: "status", label: "Situação", type: "select", required: true, options: GOAL_STATUS },
    { name: "source", label: "Fonte do dado", wide: true, placeholder: "Ex.: relatório e-ORBIT, CPA, secretaria" },
    { name: "formula", label: "Regra de cálculo", type: "textarea", placeholder: "Ex.: evadidos no ano ÷ matriculados no início do ano × 100" },
    { name: "notes", label: "Observações", type: "textarea" },
  ], FIELD_HELP.goal);
}
const MEASUREMENT_FIELDS: Field[] = withHelp([
  { name: "measured_on", label: "Data da medição", type: "date", required: true },
  { name: "value", label: "Valor medido", type: "number", required: true },
  { name: "source", label: "Fonte" },
  { name: "note", label: "Observação", type: "textarea" },
], FIELD_HELP.measurement);

function GoalsTab({ institutionId, role, data, reload }: { institutionId: string; role: Role | null; data: Data; reload: () => Promise<void> }) {
  const ed = useEditor();
  const [measuring, setMeasuring] = useState<Row | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [course, setCourse] = useState("");
  const byGoal = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of data.measurements) {
      const k = String(r.goal_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [data.measurements]);
  const goals = data.goals.filter(g => !course || g.course_id === course);
  const courseName = (cid: unknown) => data.courses.find(c => c.id === cid)?.name as string | undefined;
  return (
    <div className="area-panel">
      <div className="area-panel-head">
        <h3>Metas e indicadores ({data.goals.length})</h3>
        <div className="area-inline">
          <select aria-label="Filtrar por curso" value={course} onChange={e => setCourse(e.target.value)}>
            <option value="">Toda a instituição</option>
            {courseOptions(data.courses).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {can.manageGoals(role) && <button className="corp-button small" onClick={() => ed.open("new")}>Nova meta</button>}
        </div>
      </div>
      {ed.editing && (
        <RecordForm
          title={ed.editing === "new" ? "Nova meta" : "Editar meta"}
          fields={goalFields(data.courses)}
          initial={ed.editing === "new" ? { direction: "aumentar", status: "ativa", course_id: course } : ed.editing}
          onCancel={ed.close}
          onSubmit={async v => {
            await saveRow(TABLES.goals, ed.editing === "new" ? { ...v, institution_id: institutionId } : v, ed.editing === "new" ? undefined : (ed.editing as Row).id);
            ed.close();
            await reload();
          }}
        />
      )}
      {measuring && (
        <RecordForm
          title={`Registrar medição · ${String(measuring.indicator)}`}
          fields={MEASUREMENT_FIELDS}
          initial={{ measured_on: today(), source: measuring.source ?? "" }}
          submitLabel="Registrar"
          onCancel={() => setMeasuring(null)}
          onSubmit={async v => {
            await saveRow(TABLES.measurements, { ...v, goal_id: measuring.id, institution_id: institutionId });
            setOpen(measuring.id);
            setMeasuring(null);
            await reload();
          }}
        />
      )}
      {!goals.length ? (
        <p className="area-muted">Nenhuma meta cadastrada{course ? " para este curso" : ""}.{can.manageGoals(role) ? " Comece pela que mais pesa na decisão da gestão." : ""}</p>
      ) : (
        <div className="area-cards">
          {goals.map(g => {
            const ms = byGoal.get(g.id) ?? [];
            const last = ms.length ? Number(ms[ms.length - 1].value) : null;
            const p = goalProgress(g, last);
            const late = isLate(g.due_date, g.status);
            return (
              <article key={g.id} className="area-card">
                <div className="area-card-top">
                  <span className={`badge ${g.status === "concluida" ? "green" : g.status === "cancelada" ? "gray" : late ? "red" : "amber"}`}>
                    {late ? "Prazo vencido" : label(GOAL_STATUS, g.status)}
                  </span>
                  {courseName(g.course_id) && <small>{courseName(g.course_id)}</small>}
                </div>
                <h4>{String(g.title)}</h4>
                <p className="area-muted">{String(g.indicator)}{g.owner_name ? ` · ${String(g.owner_name)}` : ""}</p>
                <div className="area-goal-numbers">
                  <div><small>Linha de base</small><b>{fmtNum(g.baseline, g.unit)}</b></div>
                  <div><small>Última medição</small><b>{fmtNum(last, g.unit)}</b></div>
                  <div><small>Alvo ({label(DIRECTION, g.direction).toLowerCase()})</small><b>{fmtNum(g.target, g.unit)}</b></div>
                  <div><small>Prazo</small><b>{fmtDate(g.due_date)}</b></div>
                </div>
                <div className="area-progress" aria-label={p === null ? "Sem medição" : `Progresso ${p}%`}>
                  <span style={{ width: `${p ?? 0}%` }} />
                </div>
                <p className="area-muted small">{p === null ? "Sem medição registrada." : `${p}% do caminho entre a linha de base e o alvo.`}</p>
                <div className="area-row-actions">
                  {can.record(role) && <button className="corp-login-text-button" onClick={() => setMeasuring(g)}>Registrar medição</button>}
                  <button className="corp-login-text-button" onClick={() => setOpen(open === g.id ? null : g.id)}>Histórico ({ms.length})</button>
                  {can.manageGoals(role) && <button className="corp-login-text-button" onClick={() => ed.open(g)}>Editar</button>}
                  {can.remove(role) && <RemoveButton onConfirm={async () => { await deleteRow(TABLES.goals, g.id); await reload(); }} />}
                </div>
                {open === g.id && (
                  <div className="table-scroll">
                    {!ms.length ? <p className="area-muted">Sem medições.</p> : (
                      <table className="area-table compact">
                        <thead><tr><th>Data</th><th>Valor</th><th>Fonte</th><th>Observação</th><th /></tr></thead>
                        <tbody>
                          {ms.slice().reverse().map(m => (
                            <tr key={m.id}>
                              <td>{fmtDate(m.measured_on)}</td><td>{fmtNum(m.value, g.unit)}</td><td>{String(m.source ?? "—")}</td><td>{String(m.note ?? "")}</td>
                              <td>{can.remove(role) && <RemoveButton label="✕" title="Remover medição" onConfirm={async () => { await deleteRow(TABLES.measurements, m.id); await reload(); }} />}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {g.formula ? <p className="area-muted small">Regra de cálculo: {String(g.formula)}</p> : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================================================================ plano 5W2H
function actionFields(data: Data): Field[] {
  return withHelp([
    { name: "what", label: "O quê (ação)", required: true, wide: true },
    { name: "why", label: "Por quê", type: "textarea" },
    { name: "goal_id", label: "Meta relacionada", type: "select", options: data.goals.map(g => [g.id, String(g.title)]) },
    { name: "finding_id", label: "Achado do diagnóstico", type: "select", options: data.diagnosis.map(d => [d.id, String(d.criterion)]) },
    { name: "course_id", label: "Curso", type: "select", options: courseOptions(data.courses) },
    { name: "who", label: "Quem (responsável)" },
    { name: "where_at", label: "Onde" },
    { name: "start_date", label: "Início", type: "date" },
    { name: "due_date", label: "Quando (prazo)", type: "date" },
    { name: "how", label: "Como", type: "textarea" },
    { name: "how_much", label: "Quanto custa" },
    { name: "status", label: "Situação", type: "select", required: true, options: ACTION_STATUS },
    { name: "progress", label: "Avanço (%)", type: "number", min: 0, max: 100, step: "5" },
    { name: "evidence", label: "Evidência de execução", type: "textarea", placeholder: "Ata, documento, link interno, registro…" },
  ], FIELD_HELP.action);
}

function ActionsTab({ institutionId, role, data, reload }: { institutionId: string; role: Role | null; data: Data; reload: () => Promise<void> }) {
  const ed = useEditor();
  const [filter, setFilter] = useState("abertas");
  const pre = sessionStorage.getItem("vertice-action-prefill");
  useEffect(() => {
    if (pre) {
      sessionStorage.removeItem("vertice-action-prefill");
      ed.open("new");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [prefill] = useState<Record<string, unknown>>(() => (pre ? JSON.parse(pre) : {}));
  const rows = data.actions.filter(a =>
    filter === "todas" ? true : filter === "atrasadas" ? isLate(a.due_date, a.status) : filter === "abertas" ? !["concluida", "cancelada"].includes(String(a.status)) : a.status === filter
  );
  const goalTitle = (gid: unknown) => data.goals.find(g => g.id === gid)?.title as string | undefined;
  const counts = Object.fromEntries(ACTION_STATUS.map(([k]) => [k, data.actions.filter(a => a.status === k).length]));
  return (
    <div className="area-panel">
      <div className="area-panel-head">
        <h3>Plano de ação 5W2H ({data.actions.length})</h3>
        <div className="area-inline">
          <select aria-label="Filtrar ações" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="abertas">Em aberto</option>
            <option value="atrasadas">Atrasadas</option>
            {ACTION_STATUS.map(([k, l]) => <option key={k} value={k}>{l} ({counts[k]})</option>)}
            <option value="todas">Todas</option>
          </select>
          {can.record(role) && <button className="corp-button small" onClick={() => ed.open("new")}>Nova ação</button>}
        </div>
      </div>
      {ed.editing && (
        <RecordForm
          title={ed.editing === "new" ? "Nova ação" : "Editar ação"}
          fields={actionFields(data)}
          initial={ed.editing === "new" ? { status: "nao_iniciada", progress: 0, ...prefill } : ed.editing}
          onCancel={ed.close}
          onSubmit={async v => {
            await saveRow(TABLES.actions, ed.editing === "new" ? { ...v, progress: v.progress ?? 0, institution_id: institutionId } : { ...v, progress: v.progress ?? 0 }, ed.editing === "new" ? undefined : (ed.editing as Row).id);
            ed.close();
            await reload();
          }}
        />
      )}
      {!rows.length ? (
        <p className="area-muted">Nenhuma ação neste filtro.</p>
      ) : (
        <div className="table-scroll">
          <table className="area-table">
            <thead><tr><th>O quê</th><th>Quem</th><th>Quando</th><th>Situação</th><th>Avanço</th><th>Meta</th><th>Evidência</th><th /></tr></thead>
            <tbody>
              {rows.map(a => {
                const late = isLate(a.due_date, a.status);
                return (
                  <tr key={a.id} className={late ? "late" : ""}>
                    <td><strong>{String(a.what)}</strong>{a.how ? <small className="area-block">{String(a.how)}</small> : null}</td>
                    <td>{String(a.who ?? "—")}</td>
                    <td>{fmtDate(a.due_date)}{late && <small className="area-block warn">atrasada</small>}</td>
                    <td><span className={`badge ${a.status === "concluida" ? "green" : a.status === "bloqueada" ? "red" : a.status === "em_andamento" ? "amber" : "gray"}`}>{label(ACTION_STATUS, a.status)}</span></td>
                    <td>{Number(a.progress ?? 0)}%</td>
                    <td>{goalTitle(a.goal_id) ?? "—"}</td>
                    <td>{a.evidence ? <small>{String(a.evidence)}</small> : <small className="area-muted">sem registro</small>}</td>
                    <td className="area-row-actions">
                      {can.record(role) && <button className="corp-login-text-button" onClick={() => ed.open(a)}>Atualizar</button>}
                      {can.remove(role) && <RemoveButton onConfirm={async () => { await deleteRow(TABLES.actions, a.id); await reload(); }} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ================================================================ diagnóstico
function diagnosisFields(courses: Row[]): Field[] {
  return withHelp([
    { name: "dimension", label: "Dimensão", type: "select", required: true, options: DIMENSIONS.map(d => [d, d] as [string, string]) },
    { name: "course_id", label: "Curso (opcional)", type: "select", options: courseOptions(courses) },
    { name: "criterion", label: "Critério avaliado", required: true, wide: true, placeholder: "Ex.: PPC atualizado às DCNs vigentes" },
    { name: "reference", label: "Referência", placeholder: "Ex.: Instrumento INEP 1.1" },
    { name: "score", label: "Nota (1 a 5)", type: "number", min: 1, max: 5, step: "0.5" },
    { name: "priority", label: "Prioridade", type: "select", required: true, options: PRIORITY },
    { name: "status", label: "Situação", type: "select", required: true, options: FINDING_STATUS },
    { name: "assessed_on", label: "Data da avaliação", type: "date" },
    { name: "finding", label: "Achado", type: "textarea" },
    { name: "evidence", label: "Evidência consultada", type: "textarea" },
  ], FIELD_HELP.diagnosis);
}

function DiagnosisTab({ institutionId, role, data, reload, onPlan }: { institutionId: string; role: Role | null; data: Data; reload: () => Promise<void>; onPlan: () => void }) {
  const ed = useEditor();
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const d of data.diagnosis) {
      const k = String(d.dimension);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(d);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [data.diagnosis]);
  const avg = (rows: Row[]) => {
    const s = rows.map(r => r.score).filter(v => v !== null && v !== undefined).map(Number);
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
  };
  const actionsFor = (fid: string) => data.actions.filter(a => a.finding_id === fid).length;
  return (
    <div className="area-panel">
      <div className="area-panel-head">
        <h3>Diagnóstico ({data.diagnosis.length} critérios)</h3>
        {can.record(role) && <button className="corp-button small" onClick={() => ed.open("new")}>Novo critério</button>}
      </div>
      {ed.editing && (
        <RecordForm
          title={ed.editing === "new" ? "Novo critério avaliado" : "Editar critério"}
          fields={diagnosisFields(data.courses)}
          initial={ed.editing === "new" ? { priority: "media", status: "aberto", assessed_on: today() } : ed.editing}
          onCancel={ed.close}
          onSubmit={async v => {
            await saveRow(TABLES.diagnosis, ed.editing === "new" ? { ...v, institution_id: institutionId } : v, ed.editing === "new" ? undefined : (ed.editing as Row).id);
            ed.close();
            await reload();
          }}
        />
      )}
      {!groups.length ? (
        <p className="area-muted">Nenhum critério avaliado. Registre cada critério com nota, achado e evidência; os achados podem gerar ações no plano 5W2H.</p>
      ) : (
        groups.map(([dim, rows]) => {
          const a = avg(rows);
          return (
            <section key={dim} className="area-dim">
              <h4>{dim} <small>{a === null ? "sem nota" : `média ${a.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`} · {rows.length} critério(s)</small></h4>
              <div className="table-scroll">
                <table className="area-table">
                  <thead><tr><th>Critério</th><th>Nota</th><th>Achado</th><th>Prioridade</th><th>Situação</th><th>Ações</th><th /></tr></thead>
                  <tbody>
                    {rows.map(d => (
                      <tr key={d.id}>
                        <td><strong>{String(d.criterion)}</strong>{d.reference ? <small className="area-block">{String(d.reference)}</small> : null}</td>
                        <td>{d.score === null || d.score === undefined ? "—" : Number(d.score).toLocaleString("pt-BR")}</td>
                        <td><small>{String(d.finding ?? "—")}</small></td>
                        <td><span className={`badge ${d.priority === "alta" ? "red" : d.priority === "media" ? "amber" : "gray"}`}>{label(PRIORITY, d.priority)}</span></td>
                        <td>{label(FINDING_STATUS, d.status)}</td>
                        <td>{actionsFor(d.id)}</td>
                        <td className="area-row-actions">
                          {can.record(role) && (
                            <button
                              className="corp-login-text-button"
                              onClick={() => {
                                sessionStorage.setItem("vertice-action-prefill", JSON.stringify({ finding_id: d.id, course_id: d.course_id ?? "", why: d.finding ?? "" }));
                                onPlan();
                              }}
                            >
                              Criar ação
                            </button>
                          )}
                          {can.record(role) && <button className="corp-login-text-button" onClick={() => ed.open(d)}>Editar</button>}
                          {can.remove(role) && <RemoveButton onConfirm={async () => { await deleteRow(TABLES.diagnosis, d.id); await reload(); }} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

// ================================================================ equipe
type Member = { user_id: string; email: string; role: Role; created_at: string };

function TeamTab({ institutionId, role }: { institutionId: string; role: Role | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("equipe");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const roles: Role[] = role === "master" ? ["gestor", "equipe", "leitor"] : ["equipe", "leitor"];

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.rpc("vertice_team", { target: institutionId }),
      supabase.from(TABLES.invites).select("*").eq("institution_id", institutionId).is("accepted_at", null).order("created_at"),
    ]);
    if (!m.error) setMembers((m.data ?? []) as Member[]);
    if (!i.error) setInvites((i.data ?? []) as Row[]);
  }, [institutionId]);
  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const mail = email.trim().toLowerCase();
      const { data, error } = await supabase.rpc("vertice_add_member", { target: institutionId, member_email: mail, member_role: newRole });
      if (error) throw error;
      if (data === "convite_pendente") {
        const sent = await supabase.functions.invoke("vertice-convite", { body: { institution_id: institutionId, email: mail } });
        setMsg(
          sent.error
            ? "Convite registrado. O e-mail de acesso não pôde ser enviado automaticamente; peça à administração da Vértice para enviar o convite."
            : "Convite enviado por e-mail. O acesso é liberado quando a pessoa definir a senha e o segundo fator."
        );
      } else {
        setMsg("Conta existente vinculada a esta instituição.");
      }
      setEmail("");
      await load();
    } catch (err) {
      setMsg(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(m: Member, r: Role) {
    const { error, count } = await supabase.from(TABLES.memberships).update({ role: r }, { count: "exact" }).eq("user_id", m.user_id).eq("institution_id", institutionId);
    if (error || !count) window.alert(explain(error ?? { code: "42501" }));
    await load();
  }
  async function remove(m: Member) {
    if (!window.confirm(`Retirar o acesso de ${m.email} a esta instituição?`)) return;
    const { error, count } = await supabase.from(TABLES.memberships).delete({ count: "exact" }).eq("user_id", m.user_id).eq("institution_id", institutionId);
    if (error || !count) window.alert(explain(error ?? { code: "42501" }));
    await load();
  }
  const manageable = (m: Member) => role === "master" || (role === "gestor" && m.role !== "gestor");

  return (
    <div className="area-panel">
      <div className="area-panel-head"><h3>Equipe com acesso ({members.length})</h3></div>
      <form className="area-form area-inline-form" onSubmit={add}>
        <label>E-mail <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@instituicao.edu.br" /></label>
        <label>Perfil
          <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}>
            {roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </label>
        <button className="corp-button small" disabled={busy}>{busy ? "Enviando…" : "Dar acesso"}</button>
      </form>
      <p className="area-field-help">Use o e-mail institucional da pessoa. Se ela ainda não tiver conta, receberá um convite para criar senha e segundo fator.</p>
      {msg && <p role="status" className="area-note">{msg}</p>}
      <dl className="area-roles">
        <div><dt>Gestor</dt><dd>cadastra cursos, define metas, gere a equipe (equipe e leitura) e remove registros.</dd></div>
        <div><dt>Equipe</dt><dd>registra medições, ações 5W2H e critérios do diagnóstico; não altera metas nem remove registros.</dd></div>
        <div><dt>Leitura</dt><dd>apenas consulta.</dd></div>
      </dl>
      <div className="table-scroll">
        <table className="area-table">
          <thead><tr><th>E-mail</th><th>Perfil</th><th>Desde</th><th /></tr></thead>
          <tbody>
            {members.map(m => (
              <tr key={m.user_id}>
                <td>{m.email}</td>
                <td>
                  {manageable(m) ? (
                    <select aria-label={`Perfil de ${m.email}`} value={m.role} onChange={e => changeRole(m, e.target.value as Role)}>
                      {(role === "master" ? ["gestor", "equipe", "leitor"] : ["equipe", "leitor"]).map(r => <option key={r} value={r}>{ROLE_LABEL[r as Role]}</option>)}
                    </select>
                  ) : ROLE_LABEL[m.role]}
                </td>
                <td>{fmtDate(m.created_at?.slice(0, 10))}</td>
                <td>{manageable(m) && <button className="corp-login-text-button area-danger" onClick={() => remove(m)}>Retirar acesso</button>}</td>
              </tr>
            ))}
            {invites.map(i => (
              <tr key={i.id} className="pending">
                <td>{String(i.email)}</td>
                <td>{ROLE_LABEL[i.role as Role]} <small className="area-muted">(convite pendente)</small></td>
                <td>{fmtDate(String(i.created_at).slice(0, 10))}</td>
                <td>
                  {(role === "master" || i.role !== "gestor") && (
                    <RemoveButton label="Cancelar convite" onConfirm={async () => { await deleteRow(TABLES.invites, i.id); await load(); }} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="area-muted small">Masters da Vértice têm acesso a todas as instituições e não aparecem nesta lista.</p>
    </div>
  );
}
