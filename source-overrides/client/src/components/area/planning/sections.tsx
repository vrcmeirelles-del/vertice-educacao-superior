import type { ReactNode } from "react";
function Field({label,children}:{label:string;children:ReactNode}) { return <label className="planning-field"><span>{label}</span>{children}</label>; }
export type TabKey =
  | "identificacao"
  | "visao"
  | "ciclo"
  | "bcg"
  | "porter"
  | "fcs"
  | "atributos"
  | "objetivos"
  | "operacional"
  | "semestre";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "identificacao", label: "1. Identificação" },
  { key: "visao", label: "2. Visão" },
  { key: "ciclo", label: "3. Ciclo de Vida" },
  { key: "bcg", label: "4. Matriz BCG" },
  { key: "porter", label: "5. Porter" },
  { key: "fcs", label: "6-9. FCS" },
  { key: "atributos", label: "10. Atributos" },
  { key: "objetivos", label: "11. Objetivos Estratégicos" },
  { key: "operacional", label: "12. Plano de Ação" },
  { key: "semestre", label: "Semestre" },
];

interface VisionReflection { item: string; current_state: string; desired_state: string; }
interface BcgStrategy { quadrant: string; strategy: string; }
interface FcsInstitutional { name: string; description: string; differentiator: string; }
interface FcsCourse { name: string; maturity: string; differentiator: string; }
interface FcsCompetitor { fcs_name: string; competitors: { name: string; rating: string }[]; }
interface FcsCompetitive { fcs_name: string; institution_code: string; rating: string; }
interface AttributeRow { attribute: string; importance: string; satisfaction: string; gap: string; }
interface StrategicObjective {
  theme: string;
  indicator: string;
  description: string;
  targets: { year1?: string; year2?: string; year3?: string; year4?: string; year5?: string };
}
interface OperationalObjective {
  description: string;
  responsible: string | null;
  deadline: string | null;
  resources: string | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
}
interface SemesterActivity {
  month: string;
  date: string;
  event: string;
  event_type: string | null;
  action: string | null;
  student_count: string | null;
  location: string | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
}

export interface PlanDraft {
  id?: string;
  courseId: string;
  version: number;
  status: "draft" | "published" | "archived";
  coordinator_name: string | null;
  coordinator_since: string | null;
  enrolled_count: number | null;
  first_semester: string | null;
  vision_text: string | null;
  vision_inspirations: { text: string }[];
  vision_reflections: VisionReflection[];
  lifecycle_stage: string | null;
  lifecycle_strategies: { text: string }[];
  bcg_market_growth: string | null;
  bcg_market_share: string | null;
  bcg_quadrant: string | null;
  bcg_strategies: BcgStrategy[];
  porter_rivalry: string | null;
  porter_buyer_power: string | null;
  porter_supplier_power: string | null;
  porter_substitutes: string | null;
  porter_new_entrants: string | null;
  fcs_institutional: FcsInstitutional[];
  fcs_course: FcsCourse[];
  fcs_competitors: FcsCompetitor[];
  fcs_competitive_matrix: FcsCompetitive[];
  attributes_matrix: AttributeRow[];
  strategic_objectives: StrategicObjective[];
  operational_objectives: OperationalObjective[];
}

export interface SemesterDraft {
  id?: string;
  courseId: string;
  semester: string;
  version: number;
  status: "draft" | "published" | "archived";
  activities: SemesterActivity[];
}

export const EMPTY_PLAN: PlanDraft = {
  courseId: "", version: 1, status: "draft",
  coordinator_name: null, coordinator_since: null, enrolled_count: null, first_semester: null,
  vision_text: null, vision_inspirations: [], vision_reflections: [],
  lifecycle_stage: null, lifecycle_strategies: [],
  bcg_market_growth: null, bcg_market_share: null, bcg_quadrant: null, bcg_strategies: [],
  porter_rivalry: null, porter_buyer_power: null, porter_supplier_power: null,
  porter_substitutes: null, porter_new_entrants: null,
  fcs_institutional: [], fcs_course: [], fcs_competitors: [], fcs_competitive_matrix: [],
  attributes_matrix: [], strategic_objectives: [], operational_objectives: [],
};

export const EMPTY_SEMESTER: SemesterDraft = {
  courseId: "", semester: "", version: 1, status: "draft", activities: [],
};

function TextField({ label, value, onChange, multiline = false, rows = 3 }: {
  label: string; value: string | null | undefined; onChange: (v: string) => void; multiline?: boolean; rows?: number;
}) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea className="textarea" rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 650 }}>{title}</h3>
      <div className="stack">{children}</div>
    </div>
  );
}

export function IdentificacaoTab({ plan, setPlan }: { plan: PlanDraft; setPlan: (p: PlanDraft) => void }) {
  return (
    <SectionCard title="Identificação do Curso">
      <TextField label="Nome do coordenador" value={plan.coordinator_name}
        onChange={(v) => setPlan({ ...plan, coordinator_name: v })} />
      <TextField label="Tempo na coordenação" value={plan.coordinator_since}
        onChange={(v) => setPlan({ ...plan, coordinator_since: v })} />
      <Field label="Matriculados (último censo)">
        <input className="input" type="number" value={plan.enrolled_count ?? ""}
          onChange={(e) => setPlan({ ...plan, enrolled_count: e.target.value === "" ? null : Number(e.target.value) })} />
      </Field>
      <TextField label="Semestre da primeira turma (AAAA/S)" value={plan.first_semester}
        onChange={(v) => setPlan({ ...plan, first_semester: v })} />
    </SectionCard>
  );
}

export function VisaoTab({ plan, setPlan }: { plan: PlanDraft; setPlan: (p: PlanDraft) => void }) {
  return (
    <SectionCard title="Visão Estratégica">
      <TextField label="Onde o curso deseja estar no futuro?" value={plan.vision_text}
        onChange={(v) => setPlan({ ...plan, vision_text: v })} multiline rows={5} />
      <Field label="Reflexões (Estado Atual vs. Desejado)">
        <div className="stack" style={{ gap: 8 }}>
          {plan.vision_reflections.map((r, i) => (
            <div key={i} className="card" style={{ padding: 12 }}>
              <input className="input" placeholder="Item" value={r.item}
                onChange={(e) => {
                  const next = [...plan.vision_reflections];
                  next[i] = { ...r, item: e.target.value };
                  setPlan({ ...plan, vision_reflections: next });
                }} />
              <div className="row" style={{ marginTop: 6 }}>
                <input className="input" placeholder="Estado atual" value={r.current_state}
                  onChange={(e) => {
                    const next = [...plan.vision_reflections];
                    next[i] = { ...r, current_state: e.target.value };
                    setPlan({ ...plan, vision_reflections: next });
                  }} />
                <input className="input" placeholder="Estado desejado" value={r.desired_state}
                  onChange={(e) => {
                    const next = [...plan.vision_reflections];
                    next[i] = { ...r, desired_state: e.target.value };
                    setPlan({ ...plan, vision_reflections: next });
                  }} />
              </div>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => setPlan({
            ...plan,
            vision_reflections: [...plan.vision_reflections, { item: "", current_state: "", desired_state: "" }],
          })}>+ Adicionar reflexão</button>
        </div>
      </Field>
    </SectionCard>
  );
}

export function CicloTab({ plan, setPlan }: { plan: PlanDraft; setPlan: (p: PlanDraft) => void }) {
  const stages = ["Introdução", "Crescimento", "Maturidade", "Declínio"];
  return (
    <SectionCard title="Ciclo de Vida do Curso">
      <Field label="Estágio atual">
        <select className="select" value={plan.lifecycle_stage ?? ""}
          onChange={(e) => setPlan({ ...plan, lifecycle_stage: e.target.value || null })}>
          <option value="">— selecione —</option>
          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Estratégias para o estágio">
        <div className="stack" style={{ gap: 6 }}>
          {plan.lifecycle_strategies.map((s, i) => (
            <input key={i} className="input" value={s.text}
              onChange={(e) => {
                const next = [...plan.lifecycle_strategies];
                next[i] = { text: e.target.value };
                setPlan({ ...plan, lifecycle_strategies: next });
              }} />
          ))}
          <button className="btn btn-ghost"
            onClick={() => setPlan({ ...plan, lifecycle_strategies: [...plan.lifecycle_strategies, { text: "" }] })}>
            + Adicionar estratégia
          </button>
        </div>
      </Field>
    </SectionCard>
  );
}

export function BcgTab({ plan, setPlan }: { plan: PlanDraft; setPlan: (p: PlanDraft) => void }) {
  const quadrants = ["Estrela", "Interrogação", "Vaca Leiteira", "Abacaxi"];
  return (
    <SectionCard title="Matriz BCG">
      <TextField label="Taxa de crescimento do mercado" value={plan.bcg_market_growth}
        onChange={(v) => setPlan({ ...plan, bcg_market_growth: v })} />
      <TextField label="Participação relativa no mercado" value={plan.bcg_market_share}
        onChange={(v) => setPlan({ ...plan, bcg_market_share: v })} />
      <Field label="Quadrante">
        <select className="select" value={plan.bcg_quadrant ?? ""}
          onChange={(e) => setPlan({ ...plan, bcg_quadrant: e.target.value || null })}>
          <option value="">— selecione —</option>
          {quadrants.map((q) => <option key={q} value={q}>{q}</option>)}
        </select>
      </Field>
    </SectionCard>
  );
}

export function PorterTab({ plan, setPlan }: { plan: PlanDraft; setPlan: (p: PlanDraft) => void }) {
  return (
    <SectionCard title="5 Forças de Porter">
      <TextField label="Rivalidade entre concorrentes" value={plan.porter_rivalry}
        onChange={(v) => setPlan({ ...plan, porter_rivalry: v })} multiline />
      <TextField label="Poder de negociação dos clientes" value={plan.porter_buyer_power}
        onChange={(v) => setPlan({ ...plan, porter_buyer_power: v })} multiline />
      <TextField label="Poder de negociação dos fornecedores" value={plan.porter_supplier_power}
        onChange={(v) => setPlan({ ...plan, porter_supplier_power: v })} multiline />
      <TextField label="Ameaça de produtos substitutos" value={plan.porter_substitutes}
        onChange={(v) => setPlan({ ...plan, porter_substitutes: v })} multiline />
      <TextField label="Ameaça de novos entrantes" value={plan.porter_new_entrants}
        onChange={(v) => setPlan({ ...plan, porter_new_entrants: v })} multiline />
    </SectionCard>
  );
}

export function FcsTab({ plan, setPlan }: { plan: PlanDraft; setPlan: (p: PlanDraft) => void }) {
  return (
    <>
      <SectionCard title="FCS Institucionais (4 fatores)">
        <div className="stack" style={{ gap: 8 }}>
          {plan.fcs_institutional.map((f, i) => (
            <div key={i} className="card" style={{ padding: 12 }}>
              <input className="input" placeholder="Nome do FCS" value={f.name}
                onChange={(e) => { const n = [...plan.fcs_institutional]; n[i] = { ...f, name: e.target.value }; setPlan({ ...plan, fcs_institutional: n }); }} />
              <textarea className="textarea" rows={2} placeholder="Descrição" style={{ marginTop: 6 }} value={f.description}
                onChange={(e) => { const n = [...plan.fcs_institutional]; n[i] = { ...f, description: e.target.value }; setPlan({ ...plan, fcs_institutional: n }); }} />
              <textarea className="textarea" rows={2} placeholder="Diferencial estratégico" style={{ marginTop: 6 }} value={f.differentiator}
                onChange={(e) => { const n = [...plan.fcs_institutional]; n[i] = { ...f, differentiator: e.target.value }; setPlan({ ...plan, fcs_institutional: n }); }} />
            </div>
          ))}
          <button className="btn btn-ghost"
            onClick={() => setPlan({ ...plan, fcs_institutional: [...plan.fcs_institutional, { name: "", description: "", differentiator: "" }] })}>
            + Adicionar FCS institucional
          </button>
        </div>
      </SectionCard>

      <SectionCard title="FCS do Curso (maturidade + diferencial)">
        <div className="stack" style={{ gap: 8 }}>
          {plan.fcs_course.map((f, i) => (
            <div key={i} className="card" style={{ padding: 12 }}>
              <input className="input" placeholder="Nome do FCS" value={f.name}
                onChange={(e) => { const n = [...plan.fcs_course]; n[i] = { ...f, name: e.target.value }; setPlan({ ...plan, fcs_course: n }); }} />
              <div className="row" style={{ marginTop: 6 }}>
                <select className="select" value={f.maturity}
                  onChange={(e) => { const n = [...plan.fcs_course]; n[i] = { ...f, maturity: e.target.value }; setPlan({ ...plan, fcs_course: n }); }}>
                  <option value="">— maturidade —</option>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
                <input className="input" placeholder="Diferencial" value={f.differentiator}
                  onChange={(e) => { const n = [...plan.fcs_course]; n[i] = { ...f, differentiator: e.target.value }; setPlan({ ...plan, fcs_course: n }); }} />
              </div>
            </div>
          ))}
          <button className="btn btn-ghost"
            onClick={() => setPlan({ ...plan, fcs_course: [...plan.fcs_course, { name: "", maturity: "", differentiator: "" }] })}>
            + Adicionar FCS do curso
          </button>
        </div>
      </SectionCard>
    </>
  );
}

export function AtributosTab({ plan, setPlan }: { plan: PlanDraft; setPlan: (p: PlanDraft) => void }) {
  return (
    <SectionCard title="Matriz de Atributos">
      <table className="table">
        <thead>
          <tr><th>Atributo</th><th>Importância</th><th>Satisfação</th><th>Gap</th></tr>
        </thead>
        <tbody>
          {plan.attributes_matrix.map((r, i) => (
            <tr key={i}>
              <td><input className="input" value={r.attribute}
                onChange={(e) => { const n = [...plan.attributes_matrix]; n[i] = { ...r, attribute: e.target.value }; setPlan({ ...plan, attributes_matrix: n }); }} /></td>
              <td><input className="input" value={r.importance}
                onChange={(e) => { const n = [...plan.attributes_matrix]; n[i] = { ...r, importance: e.target.value }; setPlan({ ...plan, attributes_matrix: n }); }} /></td>
              <td><input className="input" value={r.satisfaction}
                onChange={(e) => { const n = [...plan.attributes_matrix]; n[i] = { ...r, satisfaction: e.target.value }; setPlan({ ...plan, attributes_matrix: n }); }} /></td>
              <td><input className="input" value={r.gap}
                onChange={(e) => { const n = [...plan.attributes_matrix]; n[i] = { ...r, gap: e.target.value }; setPlan({ ...plan, attributes_matrix: n }); }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-ghost"
        onClick={() => setPlan({ ...plan, attributes_matrix: [...plan.attributes_matrix, { attribute: "", importance: "", satisfaction: "", gap: "" }] })}>
        + Adicionar atributo
      </button>
    </SectionCard>
  );
}

export function ObjetivosTab({ plan, setPlan }: { plan: PlanDraft; setPlan: (p: PlanDraft) => void }) {
  return (
    <SectionCard title="Objetivos Estratégicos (5 anos)">
      <div className="stack" style={{ gap: 10 }}>
        {plan.strategic_objectives.map((o, i) => (
          <div key={i} className="card" style={{ padding: 14 }}>
            <div className="row">
              <input className="input" placeholder="Tema" value={o.theme}
                onChange={(e) => { const n = [...plan.strategic_objectives]; n[i] = { ...o, theme: e.target.value }; setPlan({ ...plan, strategic_objectives: n }); }} />
              <input className="input" placeholder="Indicador" value={o.indicator}
                onChange={(e) => { const n = [...plan.strategic_objectives]; n[i] = { ...o, indicator: e.target.value }; setPlan({ ...plan, strategic_objectives: n }); }} />
            </div>
            <textarea className="textarea" rows={2} placeholder="Descrição" style={{ marginTop: 8 }} value={o.description}
              onChange={(e) => { const n = [...plan.strategic_objectives]; n[i] = { ...o, description: e.target.value }; setPlan({ ...plan, strategic_objectives: n }); }} />
            <div className="row" style={{ marginTop: 8 }}>
              {([1, 2, 3, 4, 5] as const).map((y) => (
                <input key={y} className="input" placeholder={`Ano ${y}`} style={{ flex: 1 }}
                  value={o.targets[`year${y}` as keyof typeof o.targets] ?? ""}
                  onChange={(e) => {
                    const n = [...plan.strategic_objectives];
                    n[i] = { ...o, targets: { ...o.targets, [`year${y}`]: e.target.value || undefined } };
                    setPlan({ ...plan, strategic_objectives: n });
                  }} />
              ))}
            </div>
          </div>
        ))}
        <button className="btn btn-ghost"
          onClick={() => setPlan({ ...plan, strategic_objectives: [...plan.strategic_objectives, { theme: "", indicator: "", description: "", targets: {} }] })}>
          + Adicionar objetivo
        </button>
      </div>
    </SectionCard>
  );
}

export function OperacionalTab({ plan, setPlan }: { plan: PlanDraft; setPlan: (p: PlanDraft) => void }) {
  const statuses = ["planned", "in_progress", "completed", "cancelled"] as const;
  return (
    <SectionCard title="Objetivos Operacionais / Plano de Ação">
      <div className="stack" style={{ gap: 10 }}>
        {plan.operational_objectives.map((o, i) => (
          <div key={i} className="card" style={{ padding: 14 }}>
            <textarea className="textarea" rows={2} placeholder="Descrição do objetivo operacional" value={o.description}
              onChange={(e) => { const n = [...plan.operational_objectives]; n[i] = { ...o, description: e.target.value }; setPlan({ ...plan, operational_objectives: n }); }} />
            <div className="row" style={{ marginTop: 8 }}>
              <input className="input" placeholder="Responsável" value={o.responsible ?? ""}
                onChange={(e) => { const n = [...plan.operational_objectives]; n[i] = { ...o, responsible: e.target.value || null }; setPlan({ ...plan, operational_objectives: n }); }} />
              <input className="input" type="date" value={o.deadline ?? ""}
                onChange={(e) => { const n = [...plan.operational_objectives]; n[i] = { ...o, deadline: e.target.value || null }; setPlan({ ...plan, operational_objectives: n }); }} />
              <select className="select" value={o.status}
                onChange={(e) => { const n = [...plan.operational_objectives]; n[i] = { ...o, status: e.target.value as OperationalObjective["status"] }; setPlan({ ...plan, operational_objectives: n }); }}>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <textarea className="textarea" rows={2} placeholder="Recursos necessários" style={{ marginTop: 8 }} value={o.resources ?? ""}
              onChange={(e) => { const n = [...plan.operational_objectives]; n[i] = { ...o, resources: e.target.value || null }; setPlan({ ...plan, operational_objectives: n }); }} />
          </div>
        ))}
        <button className="btn btn-ghost"
          onClick={() => setPlan({ ...plan, operational_objectives: [...plan.operational_objectives, { description: "", responsible: null, deadline: null, resources: null, status: "planned" }] })}>
          + Adicionar objetivo operacional
        </button>
      </div>
    </SectionCard>
  );
}

export function SemestreTab({ draft, setDraft }: { draft: SemesterDraft; setDraft: (d: SemesterDraft) => void }) {
  const statuses = ["planned", "in_progress", "completed", "cancelled"] as const;
  return (
    <SectionCard title="Planejamento Semestral de Atividades">
      <div className="row">
        <Field label="Semestre (AAAA/S)">
          <input className="input" placeholder="2026/1" value={draft.semester}
            onChange={(e) => setDraft({ ...draft, semester: e.target.value })} />
        </Field>

      </div>
      <table className="table" style={{ marginTop: 12 }}>
        <thead>
          <tr><th>Mês</th><th>Data</th><th>Evento</th><th>Tipo</th><th>Status</th></tr>
        </thead>
        <tbody>
          {draft.activities.map((a, i) => (
            <tr key={i}>
              <td><input className="input" value={a.month} onChange={(e) => { const n = [...draft.activities]; n[i] = { ...a, month: e.target.value }; setDraft({ ...draft, activities: n }); }} /></td>
              <td><input className="input" value={a.date} onChange={(e) => { const n = [...draft.activities]; n[i] = { ...a, date: e.target.value }; setDraft({ ...draft, activities: n }); }} /></td>
              <td><input className="input" value={a.event} onChange={(e) => { const n = [...draft.activities]; n[i] = { ...a, event: e.target.value }; setDraft({ ...draft, activities: n }); }} /></td>
              <td><input className="input" value={a.event_type ?? ""} onChange={(e) => { const n = [...draft.activities]; n[i] = { ...a, event_type: e.target.value || null }; setDraft({ ...draft, activities: n }); }} /></td>
              <td>
                <select className="select" value={a.status}
                  onChange={(e) => { const n = [...draft.activities]; n[i] = { ...a, status: e.target.value as SemesterActivity["status"] }; setDraft({ ...draft, activities: n }); }}>
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-ghost"
        onClick={() => setDraft({ ...draft, activities: [...draft.activities, { month: "", date: "", event: "", event_type: null, action: null, student_count: null, location: null, status: "planned" }] })}>
        + Adicionar atividade
      </button>
    </SectionCard>
  );
}

