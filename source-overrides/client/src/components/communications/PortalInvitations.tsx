import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import {
  PORTAL_MAIL_MODULES,
  PORTAL_EMAIL_NOTICE,
} from "../../../../shared/portal-communications";
type Course = { id: string; name: string };
type Entry = {
  id: string;
  module: string;
  course_id: string | null;
  status: string;
  code: string | null;
  created_at: string;
};
export default function PortalInvitations({
  institutionId,
  role,
  courses = [],
  module = "institucional",
}: {
  institutionId: string;
  role: string | null;
  courses?: Course[];
  module?: string;
}) {
  const [open, setOpen] = useState(false),
    [email, setEmail] = useState(""),
    [profile, setProfile] = useState("equipe"),
    [course, setCourse] = useState(""),
    [context, setContext] = useState(
      PORTAL_MAIL_MODULES[module] ? module : "institucional",
    );
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [configured, setConfigured] = useState<boolean | null>(null),
    [history, setHistory] = useState<Entry[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const generation = useRef(0),
    request = useRef<string | null>(null),
    sending = useRef(false);
  const manage = role === "master" || role === "gestor";
  useEffect(() => {
    generation.current++;
    setOpen(false);
    setEmail("");
    setCourse("");
    setContext(PORTAL_MAIL_MODULES[module] ? module : "institucional");
    setConfirmed(false);
    setBusy(false);
    setUncertain(false);
    setError("");
    setNotice("");
    setHistory([]);
    setConfigured(null);
    request.current = null;
    sending.current = false;
  }, [institutionId, module, role]);
  async function inspect() {
    const g = generation.current;
    try {
      const r = await supabase.functions.invoke("vertice-communications", {
        body: { action: "status", institution_id: institutionId },
      });
      if (g !== generation.current) return;
      if (r.error || r.data?.error)
        throw Error(
          r.data?.error || "Não foi possível consultar a central de e-mail.",
        );
      setConfigured(r.data.configured === true);
      setHistory(r.data.history || []);
      setError("");
    } catch (e) {
      if (g === generation.current) {
        setConfigured(null);
        setError((e as Error).message);
      }
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!confirmed || busy || sending.current || uncertain || !configured)
      return;
    sending.current = true;
    const g = generation.current;
    request.current ??= crypto.randomUUID();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await supabase.functions.invoke("vertice-communications", {
        body: {
          institution_id: institutionId,
          email: email.trim().toLowerCase(),
          role: profile,
          module: context,
          course_id: course || null,
          request_id: request.current,
        },
      });
      if (g !== generation.current) return;
      if (r.error) {
        const response = (r.error as { context?: Response }).context;
        const details = await response?.json().catch(() => null);
        setUncertain(true);
        throw Error(
          details?.error ||
            "Envio não confirmado. Confira o histórico antes de repetir.",
        );
      }
      if (!r.data?.sent) {
        setUncertain(true);
        throw Error(r.data?.error || "O envio não foi confirmado.");
      }
      setNotice(PORTAL_EMAIL_NOTICE);
      setEmail("");
      setConfirmed(false);
      request.current = null;
      await inspect();
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    } finally {
      if (g === generation.current) {
        setBusy(false);
        sending.current = false;
      }
    }
  }
  if (!manage) return null;
  return (
    <section
      className="area-card"
      style={{
        margin: "16px 0",
        padding: 16,
        border: "1px solid #cbd5e1",
        borderRadius: 8,
      }}
      aria-label="Central de convites e e-mail"
    >
      <button
        type="button"
        className="corp-login-text-button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void inspect();
        }}
      >
        Convites e e-mail · todos os módulos
      </button>
      {open && (
        <>
          <h3>Central de convites e e-mail</h3>
          <p>
            Um serviço de envio para cursos, TCC, estágio, Extensão e demais
            módulos. O convite segue o aceite, a autenticação e as permissões do
            portal.
          </p>
          {configured === false && (
            <p role="alert">
              E-mail indisponível. Configure a chave institucional
              VERTICE_RESEND_API_KEY e o remetente VERTICE_RESEND_FROM para o
              domínio da Vértice. Essa configuração atende todos os módulos.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <form
            onSubmit={submit}
            style={{ display: "grid", gap: 12, maxWidth: 720 }}
          >
            <fieldset
              disabled={busy || uncertain || !configured}
              style={{ display: "grid", gap: 12, border: 0, padding: 0 }}
            >
              <label style={{ display: "grid", gap: 4 }}>
                Contexto do convite
                <select
                  value={context}
                  onChange={(e) => {
                    setContext(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  {Object.entries(PORTAL_MAIL_MODULES)
                    .filter(
                      ([k]) =>
                        ![
                          "master",
                          "experience",
                          "contrato",
                          "notificacoes",
                        ].includes(k),
                    )
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                Curso vinculado
                <select
                  value={course}
                  onChange={(e) => {
                    setCourse(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  <option value="">Institucional / sem curso específico</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                E-mail do destinatário
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                Perfil institucional
                <select
                  value={profile}
                  onChange={(e) => {
                    setProfile(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  <option value="equipe">Colaborador da instituição</option>
                  <option value="leitor">Leitura institucional</option>
                  {role === "master" && (
                    <option value="gestor">Gestor da instituição</option>
                  )}
                </select>
              </label>
              <p>
                O curso e o módulo organizam o convite; estes perfis são
                institucionais. Para coordenação ou NDE restritos ao curso, use
                os perfis de governança. Convites de estudantes seguem os fluxos
                individuais de cada módulo; este formulário convida
                colaboradores da instituição. Uma conta já vinculada mantém o
                perfil atual.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                Conferi o destinatário e o alcance do perfil e autorizo este
                envio individual.
              </label>
              <button
                type="submit"
                className="corp-button"
                disabled={!confirmed || !email.trim()}
              >
                {busy ? "Enviando…" : "Enviar convite por e-mail"}
              </button>
            </fieldset>
          </form>
          <button type="button" disabled={busy} onClick={() => void inspect()}>
            Atualizar configuração e histórico
          </button>
          {uncertain && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Você conferiu o histórico e o provedor e deseja iniciar uma nova tentativa?",
                  )
                ) {
                  request.current = null;
                  setUncertain(false);
                  setConfirmed(false);
                }
              }}
            >
              Preparar outra tentativa após conferência
            </button>
          )}
          <h4>Últimos envios da instituição</h4>
          <p>
            Aceito pelo provedor, falha e resultado incerto são estados
            distintos. Entrega e leitura não são comprovadas por esta lista.
          </p>
          <div style={{ maxHeight: 260, overflow: "auto" }}>
            <ul>
              {history
                .filter((h) => !course || h.course_id === course)
                .map((h) => (
                  <li key={h.id}>
                    {new Date(h.created_at).toLocaleString("pt-BR")} ·{" "}
                    {PORTAL_MAIL_MODULES[h.module] || h.module} ·{" "}
                    {(
                      {
                        accepted: "Aceito pelo provedor",
                        failed: "Falha",
                        uncertain: "Não confirmado",
                        processing: "Em processamento",
                      } as Record<string, string>
                    )[h.status] || h.status}
                    {h.code ? " · " + h.code : ""} · protocolo {h.id}
                  </li>
                ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
