import { HelpLabel } from '@/components/ContextHelp';
import { useMemo, useState } from "react";
import { BarChart3, Check, Plus, Target, X } from "lucide-react";
import { toast } from "sonner";
import { Filter, PageHeader } from "@/components/PilotLayout";
import { usePilot } from "@/contexts/PilotContext";
import {
  goalProgress,
  goalSummary,
  initialGoals,
  type Goal,
} from "@/lib/management";
import { type PilotState } from "@/lib/pilot";

type ManagedState = PilotState & { goals?: Goal[] };

type NumberGoalFieldProps = {
  label: string;
  value: number | null;
  min: number;
  step: number | "any";
  onChange: (value: number | null) => void;
  help?: string;
};

function parseNullableNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function NumberGoalField({
  label,
  value,
  min,
  step,
  onChange,
  help,
}: NumberGoalFieldProps) {
  return (
    <HelpLabel className="mg-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value ?? ""}
        onChange={event => onChange(parseNullableNumber(event.target.value))}
      />
      {help && <small>{help}</small>}
    </HelpLabel>
  );
}

function axisLabel(axis: string): string {
  return axis
    .replaceAll("_", " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

export default function Goals() {
  const { state, setState } = usePilot();
  const managedState = state as ManagedState;
  const goals = managedState.goals ?? initialGoals;
  const [axisFilter, setAxisFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAxis, setNewAxis] = useState("");

  const axisOptions = useMemo(
    () =>
      Array.from(new Set(goals.map(goal => goal.axis).filter(Boolean))).map(
        axis => ({ id: axis, name: axisLabel(axis) })
      ),
    [goals]
  );
  const selectedGoals = goals.filter(
    goal => axisFilter === "all" || goal.axis === axisFilter
  );
  const summary = goalSummary(selectedGoals);

  const updateGoal = (id: string, patch: Partial<Goal>) => {
    setState(current => {
      const currentState = current as ManagedState;
      const currentGoals = currentState.goals ?? initialGoals;
      return {
        ...current,
        goals: currentGoals.map(goal =>
          goal.id === id ? { ...goal, ...patch } : goal
        ),
      } as PilotState;
    });
  };

  const addGoal = (event: React.FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    const axis = newAxis.trim();
    if (!title || !axis) return;

    const nextGoal: Goal = {
      id: `meta-${crypto.randomUUID()}`,
      title,
      axis,
      objective: "",
      unit: "",
      baseline: null,
      target: null,
      current: null,
      direction: "up",
      weight: 1,
      period: "",
      owner: "",
      source: "",
      frequency: "",
    };
    setState(current => {
      const currentState = current as ManagedState;
      const currentGoals = currentState.goals ?? initialGoals;
      return { ...current, goals: [...currentGoals, nextGoal] } as PilotState;
    });
    setAxisFilter(axis);
    setNewTitle("");
    setNewAxis("");
    setAdding(false);
    toast.success("Meta adicionada à simulação local.");
  };

  const updateNumeric = (
    goal: Goal,
    field: "baseline" | "target" | "current",
    value: number | null
  ) => updateGoal(goal.id, { [field]: value } as Partial<Goal>);

  return (
    <>
      <PageHeader
        eyebrow="GESTÃO POR OBJETIVOS"
        title="Metas que orientam a execução."
        description="Conecte objetivos, indicadores, ações, evidências e revisão em um ciclo de gestão demonstrativo."
      >
        <button
          className="button primary"
          type="button"
          onClick={() => setAdding(value => !value)}
          aria-expanded={adding}
        >
          <Plus size={17} />
          Nova meta
        </button>
      </PageHeader>

      <div className="mg-local-banner" role="note">
        <Target size={17} aria-hidden="true" />
        <div>
          <strong>Simulação local</strong>
          <p>
            Valores e responsáveis são fictícios para demonstrar a gestão. Nada
            aqui confirma desempenho, aprovação ou dado institucional.
          </p>
        </div>
      </div>

      {adding && (
        <form className="mg-add-goal panel" onSubmit={addGoal}>
          <div className="mg-panel-heading">
            <div>
              <span className="mg-kicker">NOVA META</span>
              <h2>Comece pelo título e pelo eixo</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setAdding(false)}
              aria-label="Fechar formulário de nova meta"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mg-add-fields">
            <HelpLabel className="mg-field">
              <span>Título da meta</span>
              <input
                required
                autoFocus
                maxLength={140}
                value={newTitle}
                onChange={event => setNewTitle(event.target.value)}
                placeholder="Ex.: ampliar conclusão de trilhas"
              />
            </HelpLabel>
            <HelpLabel className="mg-field">
              <span>Eixo</span>
              <input
                required
                maxLength={70}
                value={newAxis}
                onChange={event => setNewAxis(event.target.value)}
                placeholder="Ex.: aprendizagem"
              />
            </HelpLabel>
          </div>
          <button className="button primary" type="submit">
            <Plus size={15} />
            Criar meta em branco
          </button>
        </form>
      )}

      <div className="mg-summary-grid" aria-label="Resumo das metas filtradas">
        <article className="mg-summary-card">
          <span className="mg-summary-icon">
            <BarChart3 size={17} />
          </span>
          <div>
            <small>Progresso ponderado</small>
            <strong>
              {summary.progress === null
                ? "—"
                : `${Math.round(summary.progress)}%`}
            </strong>
          </div>
          <p>Avanço relativo à linha de base; não é indicador de aprovação.</p>
        </article>
        <article className="mg-summary-card">
          <span className="mg-summary-icon">
            <Check size={17} />
          </span>
          <div>
            <small>Metas medidas</small>
            <strong>
              {summary.measured} <em>de {summary.total}</em>
            </strong>
          </div>
          <p>
            Somente indicadores válidos com medição atual entram no cálculo.
          </p>
        </article>
        <article className="mg-summary-card">
          <span className="mg-summary-icon">
            <Target size={17} />
          </span>
          <div>
            <small>Peso válido considerado</small>
            <strong>
              {summary.validWeight.toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}
            </strong>
          </div>
          <p>Pesos inválidos ou sem medição são excluídos do resumo.</p>
        </article>
      </div>

      <div className="mg-filter-row">
        <p className="mg-helper">
          Edite os campos diretamente. Campo numérico vazio permanece
          desconhecido.
        </p>
        <Filter
          value={axisFilter}
          onChange={setAxisFilter}
          options={axisOptions}
        />
      </div>

      <div className="mg-goals-grid">
        {selectedGoals.map(goal => {
          const result = goalProgress(goal);
          const progressWidth = result.progress === null ? 0 : result.progress;
          return (
            <article className="mg-goal-card" key={goal.id}>
              <div className="mg-goal-card-header">
                <div>
                  <span className="mg-axis-label">{axisLabel(goal.axis)}</span>
                  <h2>{goal.title || "Meta sem título"}</h2>
                </div>
                <span className="mg-goal-state">
                  {result.progress === null
                    ? "Sem medição"
                    : `${Math.round(result.progress)}%`}
                </span>
              </div>

              <HelpLabel className="mg-field mg-full-field">
                <span>Identificador</span>
                <input
                  value={goal.id}
                  readOnly
                  aria-label={`Identificador da meta ${goal.title}`}
                />
              </HelpLabel>
              <div className="mg-field-grid">
                <HelpLabel className="mg-field">
                  <span>Título</span>
                  <input
                    value={goal.title}
                    onChange={event =>
                      updateGoal(goal.id, { title: event.target.value })
                    }
                  />
                </HelpLabel>
                <HelpLabel className="mg-field">
                  <span>Eixo</span>
                  <input
                    value={goal.axis}
                    onChange={event =>
                      updateGoal(goal.id, { axis: event.target.value })
                    }
                  />
                </HelpLabel>
              </div>
              <HelpLabel className="mg-field mg-full-field">
                <span>Objetivo</span>
                <textarea
                  value={goal.objective}
                  onChange={event =>
                    updateGoal(goal.id, { objective: event.target.value })
                  }
                />
              </HelpLabel>
              <div className="mg-field-grid mg-three-columns">
                <NumberGoalField
                  label="Linha de base"
                  value={goal.baseline}
                  min={0}
                  step="any"
                  onChange={value => updateNumeric(goal, "baseline", value)}
                  help="Vazio = desconhecido"
                />
                <NumberGoalField
                  label="Meta numérica"
                  value={goal.target}
                  min={0}
                  step="any"
                  onChange={value => updateNumeric(goal, "target", value)}
                  help="Vazio = desconhecido"
                />
                <NumberGoalField
                  label="Atual"
                  value={goal.current}
                  min={0}
                  step="any"
                  onChange={value => updateNumeric(goal, "current", value)}
                  help="Vazio = sem medição"
                />
              </div>
              <div className="mg-field-grid mg-three-columns">
                <HelpLabel className="mg-field">
                  <span>Unidade</span>
                  <input
                    value={goal.unit}
                    onChange={event =>
                      updateGoal(goal.id, { unit: event.target.value })
                    }
                    placeholder="%, alunos, 0–5"
                  />
                </HelpLabel>
                <HelpLabel className="mg-field">
                  <span>Direção</span>
                  <select
                    value={goal.direction}
                    onChange={event =>
                      updateGoal(goal.id, {
                        direction: event.target.value as Goal["direction"],
                      })
                    }
                  >
                    <option value="up">Aumentar</option>
                    <option value="down">Reduzir</option>
                  </select>
                </HelpLabel>
                <HelpLabel className="mg-field">
                  <span>Peso</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={goal.weight ?? ""}
                    onChange={event =>
                      updateGoal(goal.id, {
                        weight: parseNullableNumber(event.target.value),
                      })
                    }
                  />
                </HelpLabel>
              </div>
              <div className="mg-field-grid">
                <HelpLabel className="mg-field">
                  <span>Período</span>
                  <input
                    value={goal.period}
                    onChange={event =>
                      updateGoal(goal.id, { period: event.target.value })
                    }
                  />
                </HelpLabel>
                <HelpLabel className="mg-field">
                  <span>Frequência</span>
                  <input
                    value={goal.frequency}
                    onChange={event =>
                      updateGoal(goal.id, { frequency: event.target.value })
                    }
                  />
                </HelpLabel>
              </div>
              <div className="mg-field-grid">
                <HelpLabel className="mg-field">
                  <span>Responsável</span>
                  <input
                    value={goal.owner}
                    onChange={event =>
                      updateGoal(goal.id, { owner: event.target.value })
                    }
                  />
                </HelpLabel>
                <HelpLabel className="mg-field">
                  <span>Fonte</span>
                  <input
                    value={goal.source}
                    onChange={event =>
                      updateGoal(goal.id, { source: event.target.value })
                    }
                  />
                </HelpLabel>
              </div>

              <div className="mg-progress-block">
                <div className="mg-progress-label">
                  <span>Avanço calculado</span>
                  <strong>
                    {result.progress === null
                      ? "Desconhecido"
                      : `${result.progress.toFixed(1)}%`}
                  </strong>
                </div>
                <div
                  className="mg-progress-track"
                  role="progressbar"
                  aria-label={`Avanço da meta ${goal.title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={result.progress ?? undefined}
                  aria-valuetext={
                    result.progress === null
                      ? "Progresso desconhecido"
                      : `${Math.round(result.progress)} por cento`
                  }
                >
                  <span style={{ width: `${progressWidth}%` }} />
                </div>
                <small>{result.reason}</small>
                {result.delta !== null && (
                  <small>
                    Variação desde a linha de base:{" "}
                    {result.delta > 0 ? "+" : ""}
                    {result.delta.toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    {goal.unit === "%" ? "pontos percentuais" : goal.unit}
                  </small>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <section className="panel calculation-panel" style={{ marginTop: 24 }}>
        <div>
          <h3>Como o avanço é calculado</h3>
          <p>
            Avanço = (realizado − linha de base) ÷ (meta − linha de base) × 100,
            limitado entre 0 e 100. Para aumentar, a meta precisa estar acima da
            linha de base; para reduzir, abaixo. Se faltar medição ou a
            configuração for inválida, o cálculo fica desconhecido.
          </p>
          <p>
            O resumo é a soma dos avanços multiplicados pelos pesos válidos,
            dividida pela soma desses pesos. Indicadores excluídos não entram
            como zero. Este avanço não é uma nota oficial nem a razão realizado
            ÷ meta.
          </p>
          <p>
            Exemplo independente: linha de base 20, meta 30 e realizado 25
            representam 50% do avanço planejado. Em um indicador percentual, a
            diferença entre 20% e 25% é de 5 pontos percentuais.
          </p>
        </div>
      </section>
      {selectedGoals.length === 0 && (
        <div className="mg-empty-state">
          Nenhuma meta corresponde ao eixo selecionado. Crie ou edite uma meta
          para continuar.
        </div>
      )}
    </>
  );
}
