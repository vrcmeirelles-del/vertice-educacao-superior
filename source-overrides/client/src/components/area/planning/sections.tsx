import { useState, type ReactNode } from "react";
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
  { key: "semestre", label: "Planejamento Semestral" },
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
interface CalendarEntry { date: string; label: string; category: 'aula'|'avaliacao'|'recesso'|'tematica'|'sabado_letivo'|'colacao'|'outro'; notes: string | null; }
interface CourseOffering { period: string; discipline: string; professor: string | null; workload_hours: number | null; is_new: boolean; needs_hire: boolean; }
interface FacultyAssignment { professor: string; class_hours: number | null; advising_hours: number | null; extension_hours: number | null; research_hours: number | null; }
interface FacultyTraining { professor: string; topic: string; date: string | null; status: 'planned'|'completed'|'cancelled'; }
interface CollegiateMinutes { body: 'NDE'|'colegiado'|'outro'; date: string; agenda: string | null; }
interface SemesterGoal { area: 'aprovacao'|'evasao'|'frequencia'|'rematricula'|'enade'|'outro'; target_value: string; metric: string; baseline: string | null; }
interface ExtensionLink { project_name: string; hours_per_student: number | null; linked_from: string | null; }
interface AcActivity { name: string; type: string | null; date: string | null; hours: number | null; partner: string | null; }
interface InternshipInfo { student_count: number | null; supervisors: string | null; conventions_to_renew: string | null; }
interface TccInfo { defense_count: number | null; defense_dates: string | null; advisors: string | null; }
interface InfraItem { item: string; category: 'sala'|'laboratorio'|'biblioteca'|'software'|'orcamento'|'outro'; status: 'disponivel'|'a_providenciar'|'pendente'; notes: string | null; }
interface StudentSupportEntry { category: 'pei'|'risco'|'nivelamento'|'regime_especial'; description: string; student_count: number | null; responsible: string | null; }
interface EngagementAction { type: 'reuniao_turma'|'acolhimento'|'cpa'|'integracao'|'outro'; description: string; date: string | null; }

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
  context: { start_date: string | null; end_date: string | null; school_days: number | null; objective: string | null; notes: string | null; };
  calendar: CalendarEntry[];
  course_offerings: CourseOffering[];
  faculty: { assignments: FacultyAssignment[]; trainings: FacultyTraining[]; meetings: CollegiateMinutes[]; };
  semester_goals: SemesterGoal[];
  extension_ac: { extension_projects: ExtensionLink[]; ac_activities: AcActivity[]; partnerships: string[]; };
  internship_tcc: { internship: InternshipInfo; tcc: TccInfo; conventions: string[]; };
  infrastructure: InfraItem[];
  student_support: { entries: StudentSupportEntry[]; leveling_actions: string[]; };
  engagement: { actions: EngagementAction[]; };
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
  courseId: "", semester: "", version: 1, status: "draft",
  context: { start_date: null, end_date: null, school_days: null, objective: null, notes: null },
  calendar: [],
  course_offerings: [],
  faculty: { assignments: [], trainings: [], meetings: [] },
  semester_goals: [],
  extension_ac: { extension_projects: [], ac_activities: [], partnerships: [] },
  internship_tcc: { internship: { student_count: null, supervisors: null, conventions_to_renew: null }, tcc: { defense_count: null, defense_dates: null, advisors: null }, conventions: [] },
  infrastructure: [],
  student_support: { entries: [], leveling_actions: [] },
  engagement: { actions: [] },
  activities: [],
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

const STATUS_LABELS: Record<string, string> = { planned: 'Planejado', in_progress: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado' };
const CAL_LABELS: Record<string, string> = { aula: 'Aula', avaliacao: 'Avaliação', recesso: 'Recesso', tematica: 'Semana Temática', sabado_letivo: 'Sábado Letivo', colacao: 'Colação', outro: 'Outro' };
const INFRA_CAT: Record<string, string> = { sala: 'Sala', laboratorio: 'Laboratório', biblioteca: 'Biblioteca', software: 'Software', orcamento: 'Orçamento', outro: 'Outro' };
const INFRA_STATUS: Record<string, string> = { disponivel: 'Disponível', a_providenciar: 'A providenciar', pendente: 'Pendente' };
const SUPPORT_CAT: Record<string, string> = { pei: 'PEI', risco: 'Risco acadêmico', nivelamento: 'Nivelamento', regime_especial: 'Regime especial' };
const ENGAGE_TYPE: Record<string, string> = { reuniao_turma: 'Reunião de turma', acolhimento: 'Acolhimento', cpa: 'Pesquisa CPA', integracao: 'Integração', outro: 'Outro' };
const GOAL_AREA: Record<string, string> = { aprovacao: 'Aprovação', evasao: 'Evasão', frequencia: 'Frequência', rematricula: 'Rematrícula', enade: 'ENADE', outro: 'Outro' };

function CollapsibleSection({ icon, title, hint, children }: { icon: string; title: string; hint?: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card" style={{ padding: 20 }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: 0 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{icon}</span> {title} <span style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.5 }}>{open ? '▾' : '▸'}</span>
        </h3>
        {hint && <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.65, fontWeight: 400 }}>{hint}</p>}
      </button>
      {open && <div className="stack" style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}

export function SemestreTab({ draft, setDraft, crossData }: { draft: SemesterDraft; setDraft: (d: SemesterDraft) => void; crossData?: {extensionProjects?:{name:string;hours_per_student?:number}[];goals?:{area:string;target_value:string;metric:string;baseline?:string}[];internshipCount?:number;tccDefenseCount?:number;atRiskCount?:number;peiCount?:number;professors?:{name:string;title?:string}[]}|null }) {
  const ctx = draft.context ?? { start_date: null, end_date: null, school_days: null, objective: null, notes: null };
  const fac = draft.faculty ?? { assignments: [], trainings: [], meetings: [] };
  const ext = draft.extension_ac ?? { extension_projects: [], ac_activities: [], partnerships: [] };
  const itcc = draft.internship_tcc ?? { internship: { student_count: null, supervisors: null, conventions_to_renew: null }, tcc: { defense_count: null, defense_dates: null, advisors: null }, conventions: [] };
  const sup = draft.student_support ?? { entries: [], leveling_actions: [] };
  const eng = draft.engagement ?? { actions: [] };
  const statuses = ["planned", "in_progress", "completed", "cancelled"] as const;
  const setCtx = (patch: Partial<typeof ctx>) => setDraft({ ...draft, context: { ...ctx, ...patch } });
  return <>
    {/* Semestre identifier */}
    <div className="card" style={{ padding: 20 }}>
      <Field label="Semestre (AAAA/S)">
        <input className="input" placeholder="2026/1" value={draft.semester} onChange={(e) => setDraft({ ...draft, semester: e.target.value })} />
      </Field>
    </div>

    {/* 1. Contexto */}
    <CollapsibleSection icon="📋" title="Contexto e Período Letivo" hint="Datas, dias letivos, objetivo geral e observações do semestre.">
      <div className="row">
        <Field label="Início do semestre"><input className="input" type="date" value={ctx.start_date ?? ""} onChange={(e) => setCtx({ start_date: e.target.value || null })} /></Field>
        <Field label="Fim do semestre"><input className="input" type="date" value={ctx.end_date ?? ""} onChange={(e) => setCtx({ end_date: e.target.value || null })} /></Field>
        <Field label="Dias letivos previstos"><input className="input" type="number" min={0} value={ctx.school_days ?? ""} onChange={(e) => setCtx({ school_days: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
      </div>
      <TextField label="Objetivo geral do semestre" value={ctx.objective} onChange={(v) => setCtx({ objective: v })} multiline rows={3} />
      <TextField label="Observações / contexto institucional" value={ctx.notes} onChange={(v) => setCtx({ notes: v })} multiline rows={3} />
    </CollapsibleSection>

    {/* 2. Calendário */}
    <CollapsibleSection icon="📅" title="Calendário Acadêmico" hint="Datas-chave: aulas, avaliações, recessos, semanas temáticas, sábados letivos e colação.">
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Observação</th></tr></thead>
          <tbody>
            {(draft.calendar ?? []).map((c, i) => (
              <tr key={i}>
                <td><input className="input" type="date" value={c.date} onChange={(e) => { const n = [...draft.calendar]; n[i] = { ...c, date: e.target.value }; setDraft({ ...draft, calendar: n }); }} /></td>
                <td><input className="input" value={c.label} onChange={(e) => { const n = [...draft.calendar]; n[i] = { ...c, label: e.target.value }; setDraft({ ...draft, calendar: n }); }} /></td>
                <td><select className="select" value={c.category} onChange={(e) => { const n = [...draft.calendar]; n[i] = { ...c, category: e.target.value as CalendarEntry['category'] }; setDraft({ ...draft, calendar: n }); }}>
                  {Object.entries(CAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></td>
                <td><input className="input" value={c.notes ?? ""} onChange={(e) => { const n = [...draft.calendar]; n[i] = { ...c, notes: e.target.value || null }; setDraft({ ...draft, calendar: n }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, calendar: [...(draft.calendar ?? []), { date: "", label: "", category: "outro", notes: null }] })}>+ Adicionar data</button>
    </CollapsibleSection>

    {/* 3. Oferta de Disciplinas */}
    <CollapsibleSection icon="📚" title="Oferta de Disciplinas no Semestre" hint="Grade do semestre com disciplinas, professores e carga horária por período.">
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Período</th><th>Disciplina</th><th>Professor</th><th>CH</th><th>Nova</th><th>A contratar</th></tr></thead>
          <tbody>
            {(draft.course_offerings ?? []).map((o, i) => (
              <tr key={i}>
                <td><input className="input" placeholder="1º" value={o.period} onChange={(e) => { const n = [...draft.course_offerings]; n[i] = { ...o, period: e.target.value }; setDraft({ ...draft, course_offerings: n }); }} /></td>
                <td><input className="input" value={o.discipline} onChange={(e) => { const n = [...draft.course_offerings]; n[i] = { ...o, discipline: e.target.value }; setDraft({ ...draft, course_offerings: n }); }} /></td>
                <td><input className="input" value={o.professor ?? ""} onChange={(e) => { const n = [...draft.course_offerings]; n[i] = { ...o, professor: e.target.value || null }; setDraft({ ...draft, course_offerings: n }); }} /></td>
                <td><input className="input" type="number" style={{ width: 70 }} value={o.workload_hours ?? ""} onChange={(e) => { const n = [...draft.course_offerings]; n[i] = { ...o, workload_hours: e.target.value === "" ? null : Number(e.target.value) }; setDraft({ ...draft, course_offerings: n }); }} /></td>
                <td><input type="checkbox" checked={o.is_new} onChange={(e) => { const n = [...draft.course_offerings]; n[i] = { ...o, is_new: e.target.checked }; setDraft({ ...draft, course_offerings: n }); }} /></td>
                <td><input type="checkbox" checked={o.needs_hire} onChange={(e) => { const n = [...draft.course_offerings]; n[i] = { ...o, needs_hire: e.target.checked }; setDraft({ ...draft, course_offerings: n }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, course_offerings: [...(draft.course_offerings ?? []), { period: "", discipline: "", professor: null, workload_hours: null, is_new: false, needs_hire: false }] })}>+ Adicionar disciplina</button>
    </CollapsibleSection>

    {/* 4. Corpo Docente */}
    <CollapsibleSection icon="👩‍🏫" title="Corpo Docente e Colegiados" hint="Atribuição de carga, capacitações e reuniões de NDE/Colegiado programadas.">
      {crossData?.professors?.length ? <p style={{fontSize:13,color:'var(--text-secondary)',margin:'0 0 10px',padding:'6px 10px',background:'var(--bg-card)',borderRadius:6,borderLeft:'3px solid var(--accent)'}}>📊 <strong>{crossData.professors.length} docentes</strong> registrados no e-ORBIT para este curso</p> : null}
      <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Atribuição de Carga Docente</h4>
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Professor</th><th>Aula (h)</th><th>Orientação (h)</th><th>Extensão (h)</th><th>Pesquisa (h)</th></tr></thead>
          <tbody>
            {fac.assignments.map((a, i) => (
              <tr key={i}>
                <td><input className="input" value={a.professor} onChange={(e) => { const n = [...fac.assignments]; n[i] = { ...a, professor: e.target.value }; setDraft({ ...draft, faculty: { ...fac, assignments: n } }); }} /></td>
                <td><input className="input" type="number" style={{ width: 70 }} value={a.class_hours ?? ""} onChange={(e) => { const n = [...fac.assignments]; n[i] = { ...a, class_hours: e.target.value === "" ? null : Number(e.target.value) }; setDraft({ ...draft, faculty: { ...fac, assignments: n } }); }} /></td>
                <td><input className="input" type="number" style={{ width: 70 }} value={a.advising_hours ?? ""} onChange={(e) => { const n = [...fac.assignments]; n[i] = { ...a, advising_hours: e.target.value === "" ? null : Number(e.target.value) }; setDraft({ ...draft, faculty: { ...fac, assignments: n } }); }} /></td>
                <td><input className="input" type="number" style={{ width: 70 }} value={a.extension_hours ?? ""} onChange={(e) => { const n = [...fac.assignments]; n[i] = { ...a, extension_hours: e.target.value === "" ? null : Number(e.target.value) }; setDraft({ ...draft, faculty: { ...fac, assignments: n } }); }} /></td>
                <td><input className="input" type="number" style={{ width: 70 }} value={a.research_hours ?? ""} onChange={(e) => { const n = [...fac.assignments]; n[i] = { ...a, research_hours: e.target.value === "" ? null : Number(e.target.value) }; setDraft({ ...draft, faculty: { ...fac, assignments: n } }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, faculty: { ...fac, assignments: [...fac.assignments, { professor: "", class_hours: null, advising_hours: null, extension_hours: null, research_hours: null }] } })}>+ Adicionar docente</button>

      <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600 }}>Capacitações Previstas</h4>
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Professor</th><th>Tema</th><th>Data</th><th>Situação</th></tr></thead>
          <tbody>
            {fac.trainings.map((t, i) => (
              <tr key={i}>
                <td><input className="input" value={t.professor} onChange={(e) => { const n = [...fac.trainings]; n[i] = { ...t, professor: e.target.value }; setDraft({ ...draft, faculty: { ...fac, trainings: n } }); }} /></td>
                <td><input className="input" value={t.topic} onChange={(e) => { const n = [...fac.trainings]; n[i] = { ...t, topic: e.target.value }; setDraft({ ...draft, faculty: { ...fac, trainings: n } }); }} /></td>
                <td><input className="input" type="date" value={t.date ?? ""} onChange={(e) => { const n = [...fac.trainings]; n[i] = { ...t, date: e.target.value || null }; setDraft({ ...draft, faculty: { ...fac, trainings: n } }); }} /></td>
                <td><select className="select" value={t.status} onChange={(e) => { const n = [...fac.trainings]; n[i] = { ...t, status: e.target.value as FacultyTraining['status'] }; setDraft({ ...draft, faculty: { ...fac, trainings: n } }); }}>
                  {(['planned', 'completed', 'cancelled'] as const).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, faculty: { ...fac, trainings: [...fac.trainings, { professor: "", topic: "", date: null, status: "planned" }] } })}>+ Adicionar capacitação</button>

      <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600 }}>Reuniões de NDE e Colegiado</h4>
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Órgão</th><th>Data</th><th>Pauta prevista</th></tr></thead>
          <tbody>
            {fac.meetings.map((m, i) => (
              <tr key={i}>
                <td><select className="select" value={m.body} onChange={(e) => { const n = [...fac.meetings]; n[i] = { ...m, body: e.target.value as CollegiateMinutes['body'] }; setDraft({ ...draft, faculty: { ...fac, meetings: n } }); }}>
                  <option value="NDE">NDE</option><option value="colegiado">Colegiado</option><option value="outro">Outro</option>
                </select></td>
                <td><input className="input" type="date" value={m.date} onChange={(e) => { const n = [...fac.meetings]; n[i] = { ...m, date: e.target.value }; setDraft({ ...draft, faculty: { ...fac, meetings: n } }); }} /></td>
                <td><input className="input" value={m.agenda ?? ""} onChange={(e) => { const n = [...fac.meetings]; n[i] = { ...m, agenda: e.target.value || null }; setDraft({ ...draft, faculty: { ...fac, meetings: n } }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, faculty: { ...fac, meetings: [...fac.meetings, { body: "NDE", date: "", agenda: null }] } })}>+ Adicionar reunião</button>
    </CollapsibleSection>

    {/* 5. Metas */}
    <CollapsibleSection icon="🎯" title="Metas Acadêmicas do Semestre" hint="Conecte com as metas do módulo de Gestão para acompanhamento automático.">
      {crossData?.goals?.length ? <p style={{fontSize:13,color:'var(--text-secondary)',margin:'0 0 10px',padding:'6px 10px',background:'var(--bg-card)',borderRadius:6,borderLeft:'3px solid var(--accent)'}}>📊 <strong>{crossData.goals.length} metas ativas</strong> no módulo de Gestão — vincule aqui as metas específicas deste semestre</p> : null}
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Área</th><th>Meta</th><th>Métrica</th><th>Linha de base</th></tr></thead>
          <tbody>
            {(draft.semester_goals ?? []).map((g, i) => (
              <tr key={i}>
                <td><select className="select" value={g.area} onChange={(e) => { const n = [...draft.semester_goals]; n[i] = { ...g, area: e.target.value as SemesterGoal['area'] }; setDraft({ ...draft, semester_goals: n }); }}>
                  {Object.entries(GOAL_AREA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></td>
                <td><input className="input" value={g.target_value} onChange={(e) => { const n = [...draft.semester_goals]; n[i] = { ...g, target_value: e.target.value }; setDraft({ ...draft, semester_goals: n }); }} /></td>
                <td><input className="input" value={g.metric} onChange={(e) => { const n = [...draft.semester_goals]; n[i] = { ...g, metric: e.target.value }; setDraft({ ...draft, semester_goals: n }); }} /></td>
                <td><input className="input" value={g.baseline ?? ""} onChange={(e) => { const n = [...draft.semester_goals]; n[i] = { ...g, baseline: e.target.value || null }; setDraft({ ...draft, semester_goals: n }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, semester_goals: [...(draft.semester_goals ?? []), { area: "aprovacao", target_value: "", metric: "", baseline: null }] })}>+ Adicionar meta</button>
    </CollapsibleSection>

    {/* 6. Extensão e AC */}
    <CollapsibleSection icon="🤝" title="Extensão e Atividades Complementares" hint="Projetos cadastrados no módulo Extensão 360° aparecem automaticamente. Adicione atividades específicas deste semestre.">
      {crossData?.extensionProjects?.length ? <p style={{fontSize:13,color:'var(--text-secondary)',margin:'0 0 10px',padding:'6px 10px',background:'var(--bg-card)',borderRadius:6,borderLeft:'3px solid var(--accent)'}}>📊 <strong>{crossData.extensionProjects.length} projetos ativos</strong> no módulo Extensão 360°</p> : null}
      <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Projetos de Extensão Vinculados</h4>
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Projeto</th><th>Horas/aluno</th><th>Origem</th></tr></thead>
          <tbody>
            {ext.extension_projects.map((p, i) => (
              <tr key={i}>
                <td><input className="input" value={p.project_name} onChange={(e) => { const n = [...ext.extension_projects]; n[i] = { ...p, project_name: e.target.value }; setDraft({ ...draft, extension_ac: { ...ext, extension_projects: n } }); }} /></td>
                <td><input className="input" type="number" style={{ width: 80 }} value={p.hours_per_student ?? ""} onChange={(e) => { const n = [...ext.extension_projects]; n[i] = { ...p, hours_per_student: e.target.value === "" ? null : Number(e.target.value) }; setDraft({ ...draft, extension_ac: { ...ext, extension_projects: n } }); }} /></td>
                <td><input className="input" value={p.linked_from ?? ""} placeholder="Extensão 360°" disabled style={{ opacity: 0.6 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, extension_ac: { ...ext, extension_projects: [...ext.extension_projects, { project_name: "", hours_per_student: null, linked_from: null }] } })}>+ Adicionar projeto</button>

      <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600 }}>Atividades Complementares Programadas</h4>
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Atividade</th><th>Tipo</th><th>Data</th><th>Horas</th><th>Parceiro</th></tr></thead>
          <tbody>
            {ext.ac_activities.map((a, i) => (
              <tr key={i}>
                <td><input className="input" value={a.name} onChange={(e) => { const n = [...ext.ac_activities]; n[i] = { ...a, name: e.target.value }; setDraft({ ...draft, extension_ac: { ...ext, ac_activities: n } }); }} /></td>
                <td><input className="input" value={a.type ?? ""} placeholder="Palestra, Workshop…" onChange={(e) => { const n = [...ext.ac_activities]; n[i] = { ...a, type: e.target.value || null }; setDraft({ ...draft, extension_ac: { ...ext, ac_activities: n } }); }} /></td>
                <td><input className="input" type="date" value={a.date ?? ""} onChange={(e) => { const n = [...ext.ac_activities]; n[i] = { ...a, date: e.target.value || null }; setDraft({ ...draft, extension_ac: { ...ext, ac_activities: n } }); }} /></td>
                <td><input className="input" type="number" style={{ width: 70 }} value={a.hours ?? ""} onChange={(e) => { const n = [...ext.ac_activities]; n[i] = { ...a, hours: e.target.value === "" ? null : Number(e.target.value) }; setDraft({ ...draft, extension_ac: { ...ext, ac_activities: n } }); }} /></td>
                <td><input className="input" value={a.partner ?? ""} onChange={(e) => { const n = [...ext.ac_activities]; n[i] = { ...a, partner: e.target.value || null }; setDraft({ ...draft, extension_ac: { ...ext, ac_activities: n } }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, extension_ac: { ...ext, ac_activities: [...ext.ac_activities, { name: "", type: null, date: null, hours: null, partner: null }] } })}>+ Adicionar atividade</button>

      <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600 }}>Parcerias Externas Ativas</h4>
      <div className="stack" style={{ gap: 6 }}>
        {ext.partnerships.map((p, i) => (
          <input key={i} className="input" value={p} placeholder="Escritório, órgão público, empresa…" onChange={(e) => { const n = [...ext.partnerships]; n[i] = e.target.value; setDraft({ ...draft, extension_ac: { ...ext, partnerships: n } }); }} />
        ))}
        <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, extension_ac: { ...ext, partnerships: [...ext.partnerships, ""] } })}>+ Adicionar parceria</button>
      </div>
    </CollapsibleSection>

    {/* 7. Estágio e TCC */}
    <CollapsibleSection icon="🏢" title="Estágio e TCC" hint="Dados vinculados aos módulos Estágio 360° e TCC 360°.">
      {(crossData?.internshipCount||crossData?.tccDefenseCount)?<p style={{fontSize:13,color:'var(--text-secondary)',margin:'0 0 10px',padding:'6px 10px',background:'var(--bg-card)',borderRadius:6,borderLeft:'3px solid var(--accent)'}}>📊 {crossData.internshipCount?<><strong>{crossData.internshipCount} estágios</strong> ativos</>:null}{crossData.internshipCount&&crossData.tccDefenseCount?' · ':''}{crossData.tccDefenseCount?<><strong>{crossData.tccDefenseCount} TCCs</strong> em andamento</>:null}</p>:null}
      <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Estágio Obrigatório</h4>
      <div className="row">
        <Field label="Alunos em estágio"><input className="input" type="number" value={itcc.internship.student_count ?? ""} onChange={(e) => setDraft({ ...draft, internship_tcc: { ...itcc, internship: { ...itcc.internship, student_count: e.target.value === "" ? null : Number(e.target.value) } } })} /></Field>
        <TextField label="Supervisores" value={itcc.internship.supervisors} onChange={(v) => setDraft({ ...draft, internship_tcc: { ...itcc, internship: { ...itcc.internship, supervisors: v } } })} />
        <TextField label="Convênios a renovar" value={itcc.internship.conventions_to_renew} onChange={(v) => setDraft({ ...draft, internship_tcc: { ...itcc, internship: { ...itcc.internship, conventions_to_renew: v } } })} />
      </div>
      <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600 }}>TCC</h4>
      <div className="row">
        <Field label="Bancas previstas"><input className="input" type="number" value={itcc.tcc.defense_count ?? ""} onChange={(e) => setDraft({ ...draft, internship_tcc: { ...itcc, tcc: { ...itcc.tcc, defense_count: e.target.value === "" ? null : Number(e.target.value) } } })} /></Field>
        <TextField label="Datas das bancas" value={itcc.tcc.defense_dates} onChange={(v) => setDraft({ ...draft, internship_tcc: { ...itcc, tcc: { ...itcc.tcc, defense_dates: v } } })} />
        <TextField label="Orientadores" value={itcc.tcc.advisors} onChange={(v) => setDraft({ ...draft, internship_tcc: { ...itcc, tcc: { ...itcc.tcc, advisors: v } } })} />
      </div>
      <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600 }}>Convênios a Firmar</h4>
      <div className="stack" style={{ gap: 6 }}>
        {itcc.conventions.map((c, i) => (
          <input key={i} className="input" value={c} placeholder="Novo convênio…" onChange={(e) => { const n = [...itcc.conventions]; n[i] = e.target.value; setDraft({ ...draft, internship_tcc: { ...itcc, conventions: n } }); }} />
        ))}
        <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, internship_tcc: { ...itcc, conventions: [...itcc.conventions, ""] } })}>+ Adicionar convênio</button>
      </div>
    </CollapsibleSection>

    {/* 8. Infraestrutura */}
    <CollapsibleSection icon="🏗️" title="Infraestrutura e Recursos" hint="Salas, laboratórios, softwares, orçamento e aquisições necessárias.">
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Item</th><th>Categoria</th><th>Situação</th><th>Observação</th></tr></thead>
          <tbody>
            {(draft.infrastructure ?? []).map((inf, i) => (
              <tr key={i}>
                <td><input className="input" value={inf.item} onChange={(e) => { const n = [...draft.infrastructure]; n[i] = { ...inf, item: e.target.value }; setDraft({ ...draft, infrastructure: n }); }} /></td>
                <td><select className="select" value={inf.category} onChange={(e) => { const n = [...draft.infrastructure]; n[i] = { ...inf, category: e.target.value as InfraItem['category'] }; setDraft({ ...draft, infrastructure: n }); }}>
                  {Object.entries(INFRA_CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></td>
                <td><select className="select" value={inf.status} onChange={(e) => { const n = [...draft.infrastructure]; n[i] = { ...inf, status: e.target.value as InfraItem['status'] }; setDraft({ ...draft, infrastructure: n }); }}>
                  {Object.entries(INFRA_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></td>
                <td><input className="input" value={inf.notes ?? ""} onChange={(e) => { const n = [...draft.infrastructure]; n[i] = { ...inf, notes: e.target.value || null }; setDraft({ ...draft, infrastructure: n }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, infrastructure: [...(draft.infrastructure ?? []), { item: "", category: "outro", status: "pendente", notes: null }] })}>+ Adicionar item</button>
    </CollapsibleSection>

    {/* 9. Acompanhamento */}
    <CollapsibleSection icon="♿" title="Acompanhamento e Suporte ao Estudante" hint="Dados vinculados aos módulos Inclusão 360° e Acompanhamento Especial.">
      {(crossData?.atRiskCount||crossData?.peiCount)?<p style={{fontSize:13,color:'var(--text-secondary)',margin:'0 0 10px',padding:'6px 10px',background:'var(--bg-card)',borderRadius:6,borderLeft:'3px solid var(--accent)'}}>📊 {crossData.atRiskCount?<><strong>{crossData.atRiskCount} alunos em risco</strong> identificados</>:null}{crossData.atRiskCount&&crossData.peiCount?' · ':''}{crossData.peiCount?<><strong>{crossData.peiCount} PEIs</strong> ativos</>:null}</p>:null}
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Categoria</th><th>Descrição</th><th>Alunos</th><th>Responsável</th></tr></thead>
          <tbody>
            {sup.entries.map((s, i) => (
              <tr key={i}>
                <td><select className="select" value={s.category} onChange={(e) => { const n = [...sup.entries]; n[i] = { ...s, category: e.target.value as StudentSupportEntry['category'] }; setDraft({ ...draft, student_support: { ...sup, entries: n } }); }}>
                  {Object.entries(SUPPORT_CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></td>
                <td><input className="input" value={s.description} onChange={(e) => { const n = [...sup.entries]; n[i] = { ...s, description: e.target.value }; setDraft({ ...draft, student_support: { ...sup, entries: n } }); }} /></td>
                <td><input className="input" type="number" style={{ width: 70 }} value={s.student_count ?? ""} onChange={(e) => { const n = [...sup.entries]; n[i] = { ...s, student_count: e.target.value === "" ? null : Number(e.target.value) }; setDraft({ ...draft, student_support: { ...sup, entries: n } }); }} /></td>
                <td><input className="input" value={s.responsible ?? ""} onChange={(e) => { const n = [...sup.entries]; n[i] = { ...s, responsible: e.target.value || null }; setDraft({ ...draft, student_support: { ...sup, entries: n } }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, student_support: { ...sup, entries: [...sup.entries, { category: "risco", description: "", student_count: null, responsible: null }] } })}>+ Adicionar registro</button>

      <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 600 }}>Ações de Nivelamento</h4>
      <div className="stack" style={{ gap: 6 }}>
        {sup.leveling_actions.map((a, i) => (
          <input key={i} className="input" value={a} placeholder="Ex: Oficina de leitura e produção textual" onChange={(e) => { const n = [...sup.leveling_actions]; n[i] = e.target.value; setDraft({ ...draft, student_support: { ...sup, leveling_actions: n } }); }} />
        ))}
        <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, student_support: { ...sup, leveling_actions: [...sup.leveling_actions, ""] } })}>+ Adicionar ação</button>
      </div>
    </CollapsibleSection>

    {/* 10. Engajamento */}
    <CollapsibleSection icon="📣" title="Engajamento e Comunicação" hint="Reuniões com representantes, acolhimento de calouros, pesquisas CPA e eventos de integração.">
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Tipo</th><th>Descrição</th><th>Data</th></tr></thead>
          <tbody>
            {eng.actions.map((a, i) => (
              <tr key={i}>
                <td><select className="select" value={a.type} onChange={(e) => { const n = [...eng.actions]; n[i] = { ...a, type: e.target.value as EngagementAction['type'] }; setDraft({ ...draft, engagement: { ...eng, actions: n } }); }}>
                  {Object.entries(ENGAGE_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></td>
                <td><input className="input" value={a.description} onChange={(e) => { const n = [...eng.actions]; n[i] = { ...a, description: e.target.value }; setDraft({ ...draft, engagement: { ...eng, actions: n } }); }} /></td>
                <td><input className="input" type="date" value={a.date ?? ""} onChange={(e) => { const n = [...eng.actions]; n[i] = { ...a, date: e.target.value || null }; setDraft({ ...draft, engagement: { ...eng, actions: n } }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, engagement: { ...eng, actions: [...eng.actions, { type: "outro", description: "", date: null }] } })}>+ Adicionar ação</button>
    </CollapsibleSection>

    {/* Legacy: Cronograma de Atividades */}
    <CollapsibleSection icon="📆" title="Cronograma de Atividades" hint="Tabela legada de atividades do semestre com mês, data, evento, tipo e status.">
      <div className="planning-scroll">
        <table className="table">
          <thead><tr><th>Mês</th><th>Data</th><th>Evento</th><th>Tipo</th><th>Status</th></tr></thead>
          <tbody>
            {draft.activities.map((a, i) => (
              <tr key={i}>
                <td><input className="input" value={a.month} onChange={(e) => { const n = [...draft.activities]; n[i] = { ...a, month: e.target.value }; setDraft({ ...draft, activities: n }); }} /></td>
                <td><input className="input" value={a.date} onChange={(e) => { const n = [...draft.activities]; n[i] = { ...a, date: e.target.value }; setDraft({ ...draft, activities: n }); }} /></td>
                <td><input className="input" value={a.event} onChange={(e) => { const n = [...draft.activities]; n[i] = { ...a, event: e.target.value }; setDraft({ ...draft, activities: n }); }} /></td>
                <td><input className="input" value={a.event_type ?? ""} onChange={(e) => { const n = [...draft.activities]; n[i] = { ...a, event_type: e.target.value || null }; setDraft({ ...draft, activities: n }); }} /></td>
                <td><select className="select" value={a.status} onChange={(e) => { const n = [...draft.activities]; n[i] = { ...a, status: e.target.value as SemesterActivity["status"] }; setDraft({ ...draft, activities: n }); }}>
                  {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, activities: [...draft.activities, { month: "", date: "", event: "", event_type: null, action: null, student_count: null, location: null, status: "planned" }] })}>+ Adicionar atividade</button>
    </CollapsibleSection>
  </>;
}

