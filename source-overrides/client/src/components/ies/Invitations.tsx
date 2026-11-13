import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { type IesApi, IesError } from "@/lib/ies/api";
import {
  type Institution,
  type Role,
  type Course,
  type Invitation,
  type Preview,
  roleNames,
} from "@/lib/ies/contracts";
import {
  generateInvitationSecret,
  invitationLink,
  invitationVault,
} from "@/lib/ies/invitation";
import { useTask } from "./useTask";
export default function Invitations({
  api,
  institution,
  roles,
  onBack,
}: {
  api: IesApi;
  institution: Institution;
  roles: Role[];
  onBack(): void;
}) {
  const [courses, setCourses] = useState<Course[]>([]),
    [items, setItems] = useState<Invitation[]>([]),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<Role>(roles[0] ?? "coordenador"),
    [capacity, setCapacity] = useState("principal"),
    [course, setCourse] = useState(""),
    [query, setQuery] = useState("");
  const [after, setAfter] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]),
    [revision, setRevision] = useState(0),
    [review, setReview] = useState(false),
    [link, setLink] = useState(""),
    [message, setMessage] = useState("");
  const task = useTask(),
    courseTask = useTask();
  const mounted = useRef(true);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const scopeLabel = (i: Invitation) =>
    `${institution.name} · ${i.course_id ? (courses.find((c) => c.course_id === i.course_id)?.name ?? "Curso ID " + i.course_id) : "Escopo institucional"} · ${roleNames[i.role]} · ${i.capacity}`;
  const courseRole = role === "coordenador" || role === "nde";
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    void task.run(
      () => api.invites(institution.institution_id, after),
      setItems,
    );
  }, [after, revision, api, institution.institution_id]);
  useEffect(() => {
    void courseTask.run(
      () => api.courses(institution.institution_id),
      setCourses,
    );
  }, [api, institution.institution_id]);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      !roles.includes(role) ||
      (courseRole && !courses.some((c) => c.course_id === course))
    )
      return;
    setReview(true);
    setLink("");
    setMessage("");
  }
  async function issue() {
    await task.run(
      async () => {
        const secret = await generateInvitationSecret();
        if (!mounted.current) throw new IesError("cancelled");
        const [result] = await api.issue(
          institution.institution_id,
          email.trim(),
          role,
          courseRole ? course : null,
          capacity,
          secret.hash,
        );
        return invitationLink(
          window.location.origin,
          result.invitation_id,
          secret.token,
        );
      },
      (url) => {
        setLink(url);
        setReview(false);
        setMessage(
          "Convite registrado. Copie o link para compartilhá-lo. Nenhuma mensagem foi enviada.",
        );
        setRevision((x) => x + 1);
      },
    );
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      if (mounted.current)
        setMessage(
          "Link copiado. Compartilhe somente com o destinatário indicado.",
        );
    } catch {
      if (mounted.current)
        setMessage(
          "Não foi possível copiar automaticamente. Selecione e copie o link abaixo.",
        );
    }
  }
  return (
    <section className="ies-card">
      <button onClick={onBack} disabled={task.busy}>
        Voltar à lista
      </button>
      <h2>Convites · {institution.name}</h2>
      <p>
        E-mail institucional é preferido; e-mail pessoal também é permitido. O
        destinatário precisa ter conta previamente ativada, e-mail confirmado e
        MFA. O convite não cria conta nem envia mensagem.
      </p>
      <p>
        Reitoria, direção geral e pró-reitoria de graduação são equivalentes na
        alta gestão. Direção pedagógica é subordinada; coordenação e NDE têm
        escopo por curso. Procuradoria institucional e presidência CPA não
        recebem acesso documental ou administrativo implícito.
      </p>
      {task.error && <p role="alert">{task.error}</p>}
      {message && <p role="status">{message}</p>}
      {roles.length > 0 &&
        (review ? (
          <section>
            <h3>Revisar convite</h3>
            <dl>
              <dt>Destinatário</dt>
              <dd>{email}</dd>
              <dt>Perfil</dt>
              <dd>
                {roleNames[role]} · {capacity}
              </dd>
              <dt>Escopo</dt>
              <dd>
                {courseRole
                  ? courses.find((c) => c.course_id === course)?.name
                  : institution.name}
              </dd>
            </dl>
            <div className="ies-actions">
              <button disabled={task.busy} onClick={() => setReview(false)}>
                Corrigir
              </button>
              <button disabled={task.busy} onClick={() => void issue()}>
                Confirmar e gerar link
              </button>
            </div>
          </section>
        ) : (
          <form onSubmit={submit}>
            <HelpLabel>
              E-mail do destinatário
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLink("");
                }}
              />
            </HelpLabel>
            <HelpLabel>
              Perfil
              <select
                aria-label="Perfil"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as Role);
                  setCourse("");
                  setLink("");
                }}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleNames[r]}
                  </option>
                ))}
              </select>
            </HelpLabel>
            <HelpLabel>
              Composição
              <select
                aria-label="Composição"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              >
                <option value="principal">Titular / principal</option>
                <option value="adjunto">Adjunto(a)</option>
                <option value="membro">Membro</option>
              </select>
            </HelpLabel>
            {courseRole && (
              <>
                <HelpLabel>
                  Buscar curso (quando não estiver na lista)
                  <input
                    maxLength={200}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </HelpLabel>
                <button
                  type="button"
                  disabled={courseTask.busy}
                  onClick={() =>
                    void courseTask.run(
                      () => api.courses(institution.institution_id, query),
                      (c) => {
                        setCourses(c);
                        setCourse("");
                      },
                    )
                  }
                >
                  Buscar cursos
                </button>
                {courseTask.error && <p role="alert">{courseTask.error}</p>}
                {courses.length === 100 && (
                  <p>
                    A lista está limitada a 100 cursos. Refine a busca para
                    localizar outro curso.
                  </p>
                )}
                <HelpLabel>
                  Curso
                  <select
                    aria-label="Curso"
                    required
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                  >
                    <option value="">Selecione o curso</option>
                    {courses.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.name}
                        {c.code ? ` · ${c.code}` : ""}
                      </option>
                    ))}
                  </select>
                </HelpLabel>
              </>
            )}
            <button disabled={task.busy || courseTask.busy}>
              Revisar convite
            </button>
          </form>
        ))}
      {link && (
        <section className="ies-share">
          <h3>Compartilhar convite</h3>
          <p>
            Escolher onde compartilhar este link não altera preferências de
            comunicação futura. O link ficará disponível somente nesta tela.
          </p>
          <HelpLabel>
            Link do convite
            <textarea
              aria-label="Link do convite"
              readOnly
              rows={4}
              value={link}
              onFocus={(e) => e.target.select()}
            />
          </HelpLabel>
          <div className="ies-actions">
            <button onClick={() => void copy()}>
              Copiar link para WhatsApp ou e-mail
            </button>
            <button onClick={() => setLink("")}>Ocultar link</button>
          </div>
        </section>
      )}
      <h3>Convites no seu escopo</h3>
      {task.busy ? (
        <p role="status">Consultando o servidor…</p>
      ) : items.length === 0 ? (
        <p>Nenhum convite nesta página.</p>
      ) : (
        <ul className="ies-list">
          {items.map((i) => (
            <li key={i.invitation_id}>
              <strong>{i.recipient_email}</strong>
              <p>
                {roleNames[i.role]} · {i.capacity} ·{" "}
                {i.status === "pending"
                  ? "Pendente"
                  : i.status === "accepted"
                    ? "Aceito"
                    : i.status === "revoked"
                      ? "Revogado"
                      : "Expirado"}
              </p>
              <p>{scopeLabel(i)}</p>
              <p>Convite ID: {i.invitation_id}</p>
              <p>Validade: {new Date(i.expires_at).toLocaleString("pt-BR")}</p>
              {i.status === "pending" &&
                (revokeTarget === i.invitation_id ? (
                  <section>
                    <p>
                      Confirma revogar o convite de {i.recipient_email} para{" "}
                      {scopeLabel(i)}? ID {i.invitation_id}
                    </p>
                    <button
                      disabled={task.busy}
                      onClick={() =>
                        void task.run(
                          () => api.revoke(i.invitation_id),
                          () => {
                            setLink("");
                            setRevokeTarget(null);
                            setMessage("Revogação confirmada.");
                            setRevision((x) => x + 1);
                          },
                        )
                      }
                    >
                      Confirmar revogação · {scopeLabel(i)} · {i.invitation_id}
                    </button>
                    <button
                      disabled={task.busy}
                      onClick={() => setRevokeTarget(null)}
                    >
                      Cancelar revogação
                    </button>
                  </section>
                ) : (
                  <button
                    disabled={task.busy}
                    onClick={() => setRevokeTarget(i.invitation_id)}
                  >
                    Revogar convite de {i.recipient_email} · {scopeLabel(i)} ·{" "}
                    {i.invitation_id}
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
      <div className="ies-actions">
        <button
          disabled={task.busy || !history.length}
          onClick={() => {
            setAfter(history.at(-1) ?? null);
            setHistory(history.slice(0, -1));
            setItems([]);
          }}
        >
          Página anterior
        </button>
        <button
          disabled={task.busy || items.length < 20}
          onClick={() => {
            setHistory([...history, after]);
            setAfter(items.at(-1)!.invitation_id);
            setItems([]);
          }}
        >
          Próxima página
        </button>
        <button disabled={task.busy} onClick={() => setRevision((x) => x + 1)}>
          Atualizar convites
        </button>
      </div>
    </section>
  );
}
export function AcceptInvitation({
  api,
  onDone,
}: {
  api: IesApi;
  onDone(): void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [ack, setAck] = useState(false),
    [accepted, setAccepted] = useState(false);
  const task = useTask();
  async function read(secret = invitationVault()?.peek()) {
    if (!secret) throw new IesError("invitation_unavailable");
    const p = await api.preview(secret.token);
    if (
      invitationVault()?.peek() !== secret ||
      p.invitation_id.toLowerCase() !== secret.id.toLowerCase() ||
      !Number.isFinite(Date.parse(p.expires_at)) ||
      Date.parse(p.expires_at) <= Date.now()
    )
      throw new IesError("invitation_unavailable");
    return p;
  }
  useEffect(() => {
    void task.run(read, setPreview);
  }, [api]);
  function accept() {
    if (!ack || !preview) return;
    void task.run(
      async () => {
        const secret = invitationVault()?.peek();
        if (
          !secret ||
          secret.id.toLowerCase() !== preview.invitation_id.toLowerCase()
        )
          throw new IesError("invitation_unavailable");
        const current = await read(secret);
        if (
          invitationVault()?.peek() !== secret ||
          current.invitation_id !== preview.invitation_id
        )
          throw new IesError("invitation_unavailable");
        await api.accept(secret.token);
      },
      () => {
        invitationVault()?.clear();
        setPreview(null);
        setAccepted(true);
      },
    );
  }
  return (
    <section className="ies-card">
      <h2>{accepted ? "Vínculo confirmado" : "Revisar convite recebido"}</h2>
      {task.error && <p role="alert">{task.error}</p>}
      {task.busy && <p role="status">Verificando convite…</p>}
      {accepted ? (
        <p role="status">
          O servidor confirmou o aceite. O vínculo acadêmico não concede acesso
          documental ou administrativo ao legado.
        </p>
      ) : preview ? (
        <>
          <dl>
            <dt>Instituição<ContextHelp title="Instituição" /></dt>
            <dd>
              {preview.institution_name} · e-MEC {preview.emec_code}
            </dd>
            <dt>Perfil</dt>
            <dd>
              {roleNames[preview.role]} · {preview.capacity}
            </dd>
            <dt>Curso<ContextHelp title="Curso" /></dt>
            <dd>{preview.course_name || "Escopo institucional"}</dd>
            <dt>Validade</dt>
            <dd>{new Date(preview.expires_at).toLocaleString("pt-BR")}</dd>
          </dl>
          <p>A integração documental permanece indisponível.</p>
          <HelpLabel className="ies-check">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            Conferi a instituição, o perfil e o escopo e desejo aceitar este
            vínculo.
          </HelpLabel>
          <button disabled={!ack || task.busy} onClick={accept}>
            Aceitar convite
          </button>
        </>
      ) : (
        <p>
          O aceite só estará disponível após a confirmação do convite pelo
          servidor.
        </p>
      )}
      <button disabled={task.busy} onClick={onDone}>
        {accepted ? "Abrir minhas instituições" : "Fechar convite"}
      </button>
    </section>
  );
}
