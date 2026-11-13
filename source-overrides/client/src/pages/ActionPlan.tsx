import { HelpLabel } from '@/components/ContextHelp';
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Flag,
  Info,
  Link2,
  Plus,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Filter } from "@/components/PilotLayout";
import { usePilot } from "@/contexts/PilotContext";
import { enrichAction, initialGoals, type Goal } from "@/lib/management";
import { dimensions, type Action, type PilotState } from "@/lib/pilot";

type ManagedAction = Action & {
  relatedGoal?: string;
  why?: string;
  how?: string;
  where?: string;
  information?: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  budget?: number | null;
  expectedReturn?: number | null;
  tags?: string[];
  observation?: string;
  evidence?: string;
  review?: string;
};

type ManagedState = PilotState & { goals?: Goal[] };

const statuses: Action["status"][] = ["A fazer", "Em andamento", "Concluída"];

function moneyValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function nullableNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function dateWarnings(action: ManagedAction): string[] {
  const warnings: string[] = [];
  if (
    action.plannedStart &&
    action.plannedEnd &&
    action.plannedStart > action.plannedEnd
  ) {
    warnings.push(
      "O início planejado deve ser anterior ou igual ao fim planejado."
    );
  }
  if (
    action.actualStart &&
    action.actualEnd &&
    action.actualStart > action.actualEnd
  ) {
    warnings.push("O início real deve ser anterior ou igual ao fim real.");
  }
  if (
    action.actualStart &&
    action.plannedStart &&
    action.actualStart < action.plannedStart
  ) {
    warnings.push(
      "O início real está antes do início planejado; revise a evidência."
    );
  }
  if (
    action.actualEnd &&
    action.plannedEnd &&
    action.actualEnd > action.plannedEnd
  ) {
    warnings.push(
      "O fim real está depois do fim planejado; registre a justificativa na revisão."
    );
  }
  return warnings;
}

export default function ActionPlan() {
  const { state, setState } = usePilot();
  const managedState = state as ManagedState;
  const goals = managedState.goals ?? initialGoals;
  const [dimension, setDimension] = useState("all");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [newDimension, setNewDimension] = useState(
    dimensions[0]?.id ?? "governanca"
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const closeDetailButton = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);

  const items = state.actions
    .map(action => enrichAction(action) as ManagedAction)
    .filter(action => dimension === "all" || action.dimension === dimension);
  const completed = items.filter(
    action => action.status === "Concluída"
  ).length;
  const detailAction = detailId
    ? state.actions.find(action => action.id === detailId)
      ? (enrichAction(
          state.actions.find(action => action.id === detailId)!
        ) as ManagedAction)
      : null
    : null;

  useEffect(() => {
    if (!detailId) return;
    closeDetailButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetails();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [detailId]);

  const update = (id: string, patch: Partial<ManagedAction>) =>
    setState(current => ({
      ...current,
      actions: current.actions.map(action =>
        action.id === id
          ? ({ ...enrichAction(action), ...patch } as Action)
          : action
      ),
    }));

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const action = enrichAction({
      id: `acao-${crypto.randomUUID()}`,
      title: title.trim(),
      dimension: newDimension,
      owner: "",
      deadline: "",
      priority: "Média",
      status: "A fazer",
    } as Action);
    setState(current => ({
      ...current,
      actions: [...current.actions, action],
    }));
    setAdding(false);
    setTitle("");
    toast.success("Nova ação incluída na simulação local.");
  };

  const openDetails = (
    id: string,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    returnFocus.current = event.currentTarget;
    setDetailId(id);
  };

  function closeDetails() {
    setDetailId(null);
    window.setTimeout(() => returnFocus.current?.focus(), 0);
  }

  const updateDetailText = (field: keyof ManagedAction, value: string) => {
    if (!detailAction) return;
    update(detailAction.id, { [field]: value } as Partial<ManagedAction>);
  };

  const updateDetailNumber = (
    field: "budget" | "expectedReturn",
    raw: string
  ) => {
    if (!detailAction) return;
    update(detailAction.id, { [field]: nullableNumber(raw) });
  };

  return (
    <>
      <PageHeader
        eyebrow="DA RECOMENDAÇÃO À EXECUÇÃO"
        title="Estratégia que sai do papel."
        description="Organize prioridades, detalhe o 5W2H e acompanhe a execução da simulação local."
      >
        <button
          className="button primary"
          onClick={() => setAdding(value => !value)}
        >
          <Plus size={17} />
          Nova ação
        </button>
      </PageHeader>

      <div className="mg-local-banner" role="note">
        <Info size={17} aria-hidden="true" />
        <div>
          <strong>Simulação local</strong>
          <p>
            Ações, prazos e registros são exemplos fictícios. Datas reais,
            execução e evidências dependem de validação e registro responsável.
          </p>
        </div>
      </div>

      <div className="plan-summary">
        <span className="plan-summary-icon">
          <Flag size={23} />
        </span>
        <div>
          <h3>
            {completed} de {items.length} ações concluídas
          </h3>
          <p>Andamento demonstrativo; não representa execução real.</p>
        </div>
        <div className="plan-progress">
          <span
            style={{
              width: `${items.length ? (completed / items.length) * 100 : 0}%`,
            }}
          />
        </div>
        <strong>
          {items.length ? Math.round((completed / items.length) * 100) : 0}%
        </strong>
      </div>

      <div className="mg-plan-layout">
        <div className="mg-plan-main">
          <div className="filter-bar">
            <span className="subtle-text">
              <Clock3 size={15} /> Kanban de acompanhamento; datas são
              informadas separadamente.
            </span>
            <Filter
              value={dimension}
              onChange={setDimension}
              options={dimensions}
            />
          </div>

          {adding && (
            <form className="panel new-action" onSubmit={add}>
              <div className="panel-heading">
                <div>
                  <span className="mg-kicker">NOVA AÇÃO</span>
                  <h3>Adicionar ação à simulação</h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setAdding(false)}
                  aria-label="Fechar formulário de nova ação"
                >
                  <X size={18} />
                </button>
              </div>
              <HelpLabel className="field-label">
                Título da ação
                <input
                  required
                  autoFocus
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  maxLength={180}
                  placeholder="Ex.: definir rito de acompanhamento"
                />
              </HelpLabel>
              <HelpLabel className="field-label">
                Eixo
                <select
                  value={newDimension}
                  onChange={event => setNewDimension(event.target.value)}
                >
                  {dimensions.map(dimensionOption => (
                    <option key={dimensionOption.id} value={dimensionOption.id}>
                      {dimensionOption.name}
                    </option>
                  ))}
                </select>
              </HelpLabel>
              <button className="button primary" type="submit">
                <Plus size={15} /> Adicionar
              </button>
            </form>
          )}

          <div className="kanban-board">
            {statuses.map(status => (
              <section className="kanban-column" key={status}>
                <div className="kanban-heading">
                  <span
                    className={`status-dot ${status === "Concluída" ? "green" : status === "Em andamento" ? "jade" : "gray"}`}
                  />
                  <h2>{status}</h2>
                  <span>
                    {items.filter(action => action.status === status).length}
                  </span>
                </div>
                {items
                  .filter(action => action.status === status)
                  .map(action => {
                    const linkedGoal = goals.find(
                      goal => goal.id === action.relatedGoal
                    );
                    return (
                      <article className="action-card" key={action.id}>
                        <div className="action-card-top">
                          <span className="action-dimension">
                            {
                              dimensions.find(
                                dimensionOption =>
                                  dimensionOption.id === action.dimension
                              )?.short
                            }
                          </span>
                          <HelpLabel className="priority-control">
                            <span className="sr-only">
                              Prioridade da ação {action.title}
                            </span>
                            <select
                              aria-label={`Prioridade: ${action.title}`}
                              value={action.priority}
                              onChange={event =>
                                update(action.id, {
                                  priority: event.target
                                    .value as Action["priority"],
                                })
                              }
                              className={
                                action.priority === "Alta"
                                  ? "priority-high"
                                  : ""
                              }
                            >
                              <option>Alta</option>
                              <option>Média</option>
                              <option>Baixa</option>
                            </select>
                          </HelpLabel>
                        </div>
                        <HelpLabel className="action-title-label">
                          <span className="sr-only">Título da ação</span>
                          <textarea
                            className="action-title-input"
                            value={action.title}
                            onChange={event =>
                              update(action.id, { title: event.target.value })
                            }
                            maxLength={180}
                            aria-label="Título da ação"
                          />
                        </HelpLabel>
                        <div className="action-details">
                          <HelpLabel>
                            Responsável
                            <input
                              value={action.owner}
                              onChange={event =>
                                update(action.id, { owner: event.target.value })
                              }
                              maxLength={100}
                              placeholder="A definir"
                            />
                          </HelpLabel>
                          <HelpLabel>
                            Prazo registrado
                            <input
                              value={action.deadline}
                              onChange={event =>
                                update(action.id, {
                                  deadline: event.target.value,
                                })
                              }
                              maxLength={40}
                              placeholder="A definir"
                            />
                          </HelpLabel>
                        </div>
                        {linkedGoal && (
                          <div className="mg-linked-goal">
                            <Target size={13} /> Meta: {linkedGoal.title}
                          </div>
                        )}
                        <div className="action-status">
                          <span>
                            {status === "Concluída" ? (
                              <Check size={15} />
                            ) : (
                              <Clock3 size={15} />
                            )}
                          </span>
                          <select
                            aria-label={`Andamento da ação: ${action.title}`}
                            value={action.status}
                            onChange={event =>
                              update(action.id, {
                                status: event.target.value as Action["status"],
                              })
                            }
                          >
                            {statuses.map(itemStatus => (
                              <option key={itemStatus}>{itemStatus}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          className="mg-detail-button"
                          type="button"
                          onClick={event => openDetails(action.id, event)}
                          aria-label={`Detalhar 5W2H: ${action.title}`}
                        >
                          <Link2 size={14} /> Detalhar 5W2H
                        </button>
                      </article>
                    );
                  })}
                {!items.some(action => action.status === status) && (
                  <div className="kanban-empty">
                    Nenhuma ação neste estágio.
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>

        {detailAction && (
          <aside
            className="mg-action-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mg-action-detail-title"
          >
            <div className="mg-panel-heading">
              <div>
                <span className="mg-kicker">DETALHAMENTO 5W2H</span>
                <h2 id="mg-action-detail-title">{detailAction.title}</h2>
              </div>
              <button
                ref={closeDetailButton}
                type="button"
                className="icon-button"
                onClick={closeDetails}
                aria-label="Fechar detalhamento 5W2H"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mg-panel-note">
              O painel permanece na área de conteúdo e não altera o andamento
              automaticamente.
            </p>
            <HelpLabel className="mg-field">
              <span>Meta ligada</span>
              <select
                value={detailAction.relatedGoal ?? ""}
                onChange={event =>
                  updateDetailText("relatedGoal", event.target.value)
                }
              >
                <option value="">Nenhuma meta ligada</option>
                {goals.map(goal => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </HelpLabel>
            <HelpLabel className="mg-field">
              <span>
                Por quê? <small>(máximo 2.000 caracteres)</small>
              </span>
              <textarea
                maxLength={2000}
                value={detailAction.why ?? ""}
                onChange={event => updateDetailText("why", event.target.value)}
                placeholder="Problema ou oportunidade que a ação enfrenta."
              />
            </HelpLabel>
            <HelpLabel className="mg-field">
              <span>
                Como? <small>(máximo 500 caracteres)</small>
              </span>
              <textarea
                maxLength={500}
                value={detailAction.how ?? ""}
                onChange={event => updateDetailText("how", event.target.value)}
                placeholder="Abordagem, passos e critério de entrega."
              />
            </HelpLabel>
            <div className="mg-field-grid">
              <HelpLabel className="mg-field">
                <span>Onde?</span>
                <input
                  value={detailAction.where ?? ""}
                  onChange={event =>
                    updateDetailText("where", event.target.value)
                  }
                  placeholder="Área, canal ou contexto"
                />
              </HelpLabel>
              <HelpLabel className="mg-field">
                <span>Informações necessárias</span>
                <input
                  value={detailAction.information ?? ""}
                  onChange={event =>
                    updateDetailText("information", event.target.value)
                  }
                  placeholder="Fonte ou dado a reunir"
                />
              </HelpLabel>
            </div>
            <fieldset className="mg-date-fieldset">
              <legend>
                <CalendarDays size={14} /> Datas planejadas
              </legend>
              <div className="mg-field-grid">
                <HelpLabel className="mg-field">
                  <span>Início planejado</span>
                  <input
                    type="date"
                    value={detailAction.plannedStart ?? ""}
                    onChange={event =>
                      updateDetailText("plannedStart", event.target.value)
                    }
                  />
                </HelpLabel>
                <HelpLabel className="mg-field">
                  <span>Fim planejado</span>
                  <input
                    type="date"
                    value={detailAction.plannedEnd ?? ""}
                    onChange={event =>
                      updateDetailText("plannedEnd", event.target.value)
                    }
                  />
                </HelpLabel>
              </div>
            </fieldset>
            <fieldset className="mg-date-fieldset">
              <legend>
                <CalendarDays size={14} /> Datas reais
              </legend>
              <div className="mg-field-grid">
                <HelpLabel className="mg-field">
                  <span>Início real</span>
                  <input
                    type="date"
                    value={detailAction.actualStart ?? ""}
                    onChange={event =>
                      updateDetailText("actualStart", event.target.value)
                    }
                  />
                </HelpLabel>
                <HelpLabel className="mg-field">
                  <span>Fim real</span>
                  <input
                    type="date"
                    value={detailAction.actualEnd ?? ""}
                    onChange={event =>
                      updateDetailText("actualEnd", event.target.value)
                    }
                  />
                </HelpLabel>
              </div>
            </fieldset>
            {dateWarnings(detailAction).map(warning => (
              <p className="mg-date-warning" role="alert" key={warning}>
                {warning}
              </p>
            ))}
            <div className="mg-field-grid">
              <HelpLabel className="mg-field">
                <span>Investimento estimado (R$)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={moneyValue(detailAction.budget)}
                  onChange={event =>
                    updateDetailNumber("budget", event.target.value)
                  }
                  placeholder="A informar"
                />
              </HelpLabel>
              <HelpLabel className="mg-field">
                <span>Retorno estimado (R$)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={moneyValue(detailAction.expectedReturn)}
                  onChange={event =>
                    updateDetailNumber("expectedReturn", event.target.value)
                  }
                  placeholder="A informar"
                />
              </HelpLabel>
            </div>
            <HelpLabel className="mg-field">
              <span>Tags</span>
              <input
                value={(detailAction.tags ?? []).join(", ")}
                onChange={event =>
                  update(detailAction.id, {
                    tags: event.target.value
                      .split(",")
                      .map(tag => tag.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="ex.: permanência, evidência"
              />
            </HelpLabel>
            <HelpLabel className="mg-field">
              <span>Observação</span>
              <textarea
                value={detailAction.observation ?? ""}
                onChange={event =>
                  updateDetailText("observation", event.target.value)
                }
              />
            </HelpLabel>
            <HelpLabel className="mg-field">
              <span>Evidências (texto, sem upload)</span>
              <textarea
                value={detailAction.evidence ?? ""}
                onChange={event =>
                  updateDetailText("evidence", event.target.value)
                }
                placeholder="Registre referência, achado ou link validado manualmente."
              />
            </HelpLabel>
            <HelpLabel className="mg-field">
              <span>Revisão</span>
              <textarea
                value={detailAction.review ?? ""}
                onChange={event =>
                  updateDetailText("review", event.target.value)
                }
                placeholder="Aprendizado, decisão e próximo ciclo de revisão."
              />
            </HelpLabel>
          </aside>
        )}
      </div>
    </>
  );
}
