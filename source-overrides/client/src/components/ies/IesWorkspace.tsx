import { useEffect, useState } from "react";
import { IesApi, IesError } from "@/lib/ies/api";
import {
  type Context,
  type Institution,
  type Notice,
  roleNames,
  allowedRoles,
  highManagement,
} from "@/lib/ies/contracts";
import { invitationVault } from "@/lib/ies/invitation";
import { useTask } from "./useTask";
import Registration from "./Registration";
import Invitations, { AcceptInvitation } from "./Invitations";
import Preferences, { ReviewPolicy } from "./Preferences";
export default function IesWorkspace({
  api,
  global,
}: {
  api: IesApi;
  global: boolean;
}) {
  const [context, setContext] = useState<Context | null>(null),
    [notices, setNotices] = useState<Notice[]>([]),
    [institutions, setInstitutions] = useState<Institution[]>([]);
  const [page, setPage] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]),
    [view, setView] = useState<
      "list" | "register" | "detail" | "preferences" | "invites" | "policy"
    >("list"),
    [selected, setSelected] = useState<Institution | null>(null);
  const [accepting, setAccepting] = useState(
    Boolean(invitationVault()?.peek()),
  );
  const [disabled, setDisabled] = useState(false),
    [refresh, setRefresh] = useState(0);
  const task = useTask();
  const [writing, setWriting] = useState(api.isWriting);
  useEffect(() => api.onWriting(setWriting), [api]);
  useEffect(
    () =>
      api.onDisabled(() => {
        invitationVault()?.clear();
        setContext(null);
        setInstitutions([]);
        setNotices([]);
        setSelected(null);
        setDisabled(true);
      }),
    [api],
  );
  useEffect(() => {
    void task.run(
      async () => {
        try {
          const [c, n, i] = await Promise.all([
            api.context(),
            api.notices(),
            api.institutions(page),
          ]);
          return { c, n, i };
        } catch (e) {
          if (e instanceof IesError && e.kind === "feature_disabled")
            setDisabled(true);
          throw e;
        }
      },
      ({ c, n, i }) => {
        setContext(c);
        setNotices(n);
        setInstitutions(i);
      },
    );
  }, [api, page, refresh]);
  function home() {
    if (api.isWriting) return;
    setSelected(null);
    setView("list");
    setRefresh((x) => x + 1);
  }
  if (disabled)
    return (
      <section className="ies-card ies-unavailable">
        <h2>Cadastro institucional indisponível</h2>
        {api.registrationReceipt && (
          <p role="status">
            Última escrita confirmada nesta sessão:{" "}
            {api.registrationReceipt.kind === "registered"
              ? "rascunho registrado"
              : "revisão reaberta"}
            , ID {api.registrationReceipt.id}
            {api.registrationReceipt.revision !== null
              ? `, revisão ${api.registrationReceipt.revision}`
              : ""}
            . Ela permanece registrada. Consulte a lista após a reativação; não
            repita o cadastro.
          </p>
        )}
        <p role="status">
          O cadastro e os convites institucionais estão desativados. Não é
          possível cadastrar, revisar, emitir ou aceitar convites neste momento.
        </p>
        <p>
          Nenhuma alteração é permitida enquanto o recurso estiver desativado. A
          integração documental também permanece indisponível.
        </p>
      </section>
    );
  if (!context)
    return (
      <section className="ies-card">
        {task.busy ? (
          <p role="status">Consultando seu contexto institucional…</p>
        ) : (
          <>
            <p role="alert">
              {task.error || "Contexto institucional indisponível."}
            </p>
            <button onClick={() => setRefresh((x) => x + 1)}>
              Tentar novamente
            </button>
          </>
        )}
      </section>
    );
  if (accepting)
    return (
      <AcceptInvitation
        api={api}
        onDone={() => {
          invitationVault()?.clear();
          setAccepting(false);
          home();
        }}
      />
    );
  const permit = selected
    ? allowedRoles(context, selected.institution_id, global)
    : [];
  return (
    <>
      <nav className="ies-nav" aria-label="Área institucional">
        <button
          disabled={writing}
          onClick={home}
          aria-current={view === "list" ? "page" : undefined}
        >
          Minhas instituições
        </button>
        {global && (
          <button
            disabled={writing}
            onClick={() => {
              if (api.isWriting) return;
              setSelected(null);
              setView("register");
            }}
          >
            Cadastrar instituição
          </button>
        )}
        <button
          disabled={writing}
          onClick={() => {
            if (!api.isWriting) setView("preferences");
          }}
        >
          Preferências de comunicação
        </button>
      </nav>
      <aside className="ies-note">
        Integração documental indisponível. Estes vínculos não concedem acesso
        documental ou administrativo ao portal legado.
      </aside>
      {view === "register" && global ? (
        <Registration key="new" api={api} onBack={home} onChanged={home} />
      ) : view === "detail" && selected && global ? (
        <Registration
          key={selected.institution_id}
          api={api}
          institutionId={selected.institution_id}
          onBack={home}
          onChanged={home}
        />
      ) : view === "preferences" ? (
        <Preferences
          api={api}
          initial={context.preferences}
          notice={notices.find((n) => n.kind === "communications")}
          onSaved={(p) => setContext({ ...context, preferences: p })}
        />
      ) : view === "invites" && selected ? (
        <Invitations
          key={selected.institution_id}
          api={api}
          institution={selected}
          roles={permit}
          onBack={home}
        />
      ) : view === "policy" && selected ? (
        <ReviewPolicy
          key={selected.institution_id}
          api={api}
          institution={selected}
          notice={notices.find((n) => n.kind === "double_check")}
          onBack={home}
        />
      ) : (
        <section className="ies-card">
          <h2>
            {global
              ? "Instituições · administração global"
              : "Instituições vinculadas à sua conta"}
          </h2>
          <p>
            Cadastros manuais são identificados como não verificados no e-MEC. A
            revisão interna não equivale à validação oficial.
          </p>
          {task.error && <p role="alert">{task.error}</p>}
          {task.busy ? (
            <p role="status">Atualizando instituições…</p>
          ) : institutions.length === 0 ? (
            <p>Nenhuma instituição disponível neste escopo.</p>
          ) : (
            <ul className="ies-list">
              {institutions.map((i) => (
                <li key={i.institution_id}>
                  <h3>{i.name}</h3>
                  <p>
                    e-MEC {i.emec_code} ·{" "}
                    {i.status === "reviewed"
                      ? "Revisão aprovada"
                      : i.status === "rejected"
                        ? "Revisão recusada"
                        : "Aguardando revisão"}
                  </p>
                  <p>Origem: cadastro manual não verificado</p>
                  <p>
                    {context.assignments
                      .filter((a) => a.institution_id === i.institution_id)
                      .map(
                        (a) =>
                          `${roleNames[a.role]} (${a.capacity}${a.course_id ? ", por curso" : ""})`,
                      )
                      .join(" · ") || (global ? "Administração global" : "")}
                  </p>
                  <div className="ies-actions">
                    {global && (
                      <button
                        onClick={() => {
                          setSelected(i);
                          setView("detail");
                        }}
                      >
                        Revisar cadastro
                      </button>
                    )}
                    {i.status === "reviewed" &&
                      allowedRoles(context, i.institution_id, global).length >
                        0 && (
                        <button
                          onClick={() => {
                            setSelected(i);
                            setView("invites");
                          }}
                        >
                          Gerenciar convites
                        </button>
                      )}
                    {i.status === "reviewed" &&
                      context.assignments.some(
                        (a) =>
                          a.institution_id === i.institution_id &&
                          highManagement.includes(a.role),
                      ) && (
                        <button
                          onClick={() => {
                            setSelected(i);
                            setView("policy");
                          }}
                        >
                          Decisão sobre dupla checagem
                        </button>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="ies-actions">
            <button
              disabled={task.busy || history.length === 0}
              onClick={() => {
                setPage(history.at(-1) ?? null);
                setHistory(history.slice(0, -1));
                setInstitutions([]);
              }}
            >
              Página anterior
            </button>
            <button
              disabled={task.busy || institutions.length < 20}
              onClick={() => {
                setHistory([...history, page]);
                setPage(institutions.at(-1)!.institution_id);
                setInstitutions([]);
              }}
            >
              Próxima página
            </button>
            <button
              disabled={task.busy}
              onClick={() => setRefresh((x) => x + 1)}
            >
              Atualizar lista
            </button>
          </div>
        </section>
      )}
    </>
  );
}
