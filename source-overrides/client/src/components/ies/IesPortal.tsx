import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { flushSync } from "react-dom";
import { iesBootstrapRejected } from "@/lib/ies/preAuthGuard";
import { supabase } from "@/lib/supabase";
import Login from "@/pages/public/Login";
import { IesApi } from "@/lib/ies/api";
import { invitationVault } from "@/lib/ies/invitation";
import IesWorkspace from "./IesWorkspace";
import "./ies.css";
export function useIesRoute() {
  const read = () =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.hash.slice(1)).get("ies") === "1";
  const [active, setActive] = useState(read);
  const [revision, setRevision] = useState(0);
  const [suspended, setSuspended] = useState(false);
  useEffect(() => {
    const route = () => {
      const next = read();
      if (!next) invitationVault()?.clear();
      setActive(next);
      setRevision((value) => value + 1);
    };
    window.addEventListener("hashchange", route);
    window.addEventListener("popstate", route);
    window.addEventListener("pushState", route);
    window.addEventListener("replaceState", route);
    const hide = () => {
      invitationVault()?.clear();
      // Commit unmount and remove emitted links from the DOM before BFCache freezes it.
      flushSync(() => setSuspended(true));
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) {
        invitationVault()?.clear();
        setRevision((value) => value + 1);
        setSuspended(false);
        setActive(read());
      }
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const vault = invitationVault();
      if (event === "SIGNED_OUT") vault?.clear();
      else vault?.bind(session?.user.id ?? null);
    });
    return () => {
      window.removeEventListener("hashchange", route);
      window.removeEventListener("popstate", route);
      window.removeEventListener("pushState", route);
      window.removeEventListener("replaceState", route);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      data.subscription.unsubscribe();
    };
  }, []);
  return { active, revision, suspended };
}
type Access = { userId: string; email: string; ready: boolean; factor: string };
export default function IesPortal() {
  const [writing, setWriting] = useState(false),
    [exitNotice, setExitNotice] = useState("");
  const writingRef = useRef(false);
  const updateWriting = useCallback((value: boolean) => {
    writingRef.current = value;
    setWriting(value);
  }, []);
  const safetyExit = useCallback(
    (message: string) => setExitNotice(message),
    [],
  );
  const invitationAtMount = useRef(invitationVault()?.peek());
  const [access, setAccess] = useState<Access | null>(null),
    [checking, setChecking] = useState(true),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false);
  const epoch = useRef(0),
    lock = useRef(false);
  const [verifyError, setVerifyError] = useState("");
  useEffect(() => {
    let mounted = true,
      timer: ReturnType<typeof setTimeout>;
    async function check() {
      const ticket = ++epoch.current;
      setChecking(true);
      setAccess(null);
      setError("");
      setCode("");
      setBusy(false);
      lock.current = false;
      setVerifyError("");
      try {
        const {
          data: { session },
          error: se,
        } = await supabase.auth.getSession();
        if (se) throw se;
        if (!session) {
          if (mounted && ticket === epoch.current) setChecking(false);
          return;
        }
        const {
          data: { user },
          error: ue,
        } = await supabase.auth.getUser();
        if (ue || !user || user.id !== session.user.id) throw ue;
        const { data: aal, error: ae } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (ae) throw ae;
        const { data: factors, error: fe } =
          await supabase.auth.mfa.listFactors();
        if (fe) throw fe;
        if (mounted && ticket === epoch.current) {
          invitationVault()?.bind(user.id);
          if (!user.email_confirmed_at) {
            setError(
              "Confirme o e-mail da conta previamente ativada antes de continuar.",
            );
            return;
          }
          setAccess({
            userId: user.id,
            email: user.email ?? "",
            ready: aal.currentLevel === "aal2",
            factor: factors.totp.find((f) => f.status === "verified")?.id ?? "",
          });
        }
      } catch {
        if (mounted && ticket === epoch.current)
          setError(
            "Não foi possível verificar a sessão. Entre novamente antes de continuar.",
          );
      } finally {
        if (mounted && ticket === epoch.current) setChecking(false);
      }
    }
    void check();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      // Invalidate the visible workspace synchronously; SDK calls run outside the Auth callback.
      ++epoch.current;
      setAccess(null);
      setChecking(true);
      setCode("");
      setBusy(false);
      lock.current = false;
      setVerifyError("");
      if (event === "SIGNED_OUT") invitationVault()?.clear();
      else invitationVault()?.bind(session?.user.id ?? null);
      clearTimeout(timer);
      timer = setTimeout(() => void check(), 0);
    });
    return () => {
      mounted = false;
      ++epoch.current;
      clearTimeout(timer);
      data.subscription.unsubscribe();
      if (invitationVault()?.peek() === invitationAtMount.current)
        invitationVault()?.clear();
    };
  }, []);
  async function verify(e: FormEvent) {
    e.preventDefault();
    if (lock.current || !access?.factor) return;
    lock.current = true;
    setBusy(true);
    setVerifyError("");
    const ticket = epoch.current;
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: access.factor,
        code,
      });
      if (error) throw error;
    } catch {
      if (ticket === epoch.current)
        setVerifyError(
          "Código não validado. Confira seu aplicativo autenticador.",
        );
    } finally {
      if (ticket === epoch.current) {
        lock.current = false;
        setBusy(false);
        setCode("");
      }
    }
  }
  function close() {
    if (writingRef.current) return;
    invitationVault()?.clear();
    window.history.pushState(null, "", window.location.pathname);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  return (
    <main className="ies-shell">
      <header className="ies-header">
        <div>
          <p className="ies-eyebrow">VÉRTICE · INSTITUIÇÕES</p>
          <h1>Cadastro e vínculos acadêmicos</h1>
          <p>Identificação, revisão e convites por instituição e curso.</p>
        </div>
        <button disabled={writing} onClick={close}>
          Fechar área IES
        </button>
      </header>
      {exitNotice && <p role="alert">{exitNotice}</p>}
      {iesBootstrapRejected || !invitationVault() ? (
        <p role="alert">
          A inicialização segura desta área não está disponível. Recarregue a
          página.
        </p>
      ) : invitationVault()?.invalid() ? (
        <p role="alert">
          O link contém parâmetros inválidos ou misturados. Solicite um novo
          link de convite.
        </p>
      ) : checking ? (
        <p role="status">Verificando conta e segundo fator…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !access ? (
        <>
          <p>
            Aceites exigem conta previamente ativada, e-mail confirmado e
            segundo fator existente.
          </p>
          <Login />
        </>
      ) : !access.ready ? (
        <section className="ies-card">
          <h2>Confirme seu segundo fator</h2>
          <p>{access.email}</p>
          {verifyError && <p role="alert">{verifyError}</p>}
          {access.factor ? (
            <form onSubmit={verify}>
              <label>
                Código do autenticador
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button disabled={busy}>Validar código</button>
            </form>
          ) : (
            <p>
              Esta conta precisa concluir a configuração de segurança no portal
              antes de aceitar convites. Reabra o convite após concluir essa
              configuração.
            </p>
          )}
        </section>
      ) : (
        <Authenticated
          key={access.userId}
          userId={access.userId}
          email={access.email}
          onWriting={updateWriting}
          onExitNotice={safetyExit}
        />
      )}
    </main>
  );
}
function Authenticated({
  userId,
  email,
  onWriting,
  onExitNotice,
}: {
  userId: string;
  email: string;
  onWriting(value: boolean): void;
  onExitNotice(message: string): void;
}) {
  const createApi = () =>
    new IesApi((name: string, args: Record<string, unknown>) =>
      supabase.rpc(name, args),
    );
  const [api, setApi] = useState(createApi);
  useEffect(() => api.onWriting(onWriting), [api, onWriting]);
  const [global, setGlobal] = useState<boolean | null>(null);
  const [leaving, setLeaving] = useState(false),
    [exitError, setExitError] = useState("");
  const mounted = useRef(true),
    signoutLock = useRef(false);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    let active = true;
    setGlobal(null);
    void supabase
      .from("vertice_admins")
      .select("user_id")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (active) setGlobal(!error && Boolean(data?.length));
      });
    return () => {
      active = false;
      api.dispose();
    };
  }, [api, userId]);
  async function signOut() {
    if (signoutLock.current) return;
    signoutLock.current = true;
    invitationVault()?.clear();
    if (api.isWriting)
      onExitNotice(
        "Uma operação já enviada pode concluir no servidor mesmo após sair. Ao retornar, consulte os cadastros e convites antes de repetir uma ação; se um convite foi emitido sem link disponível, revogue-o antes de gerar outro.",
      );
    api.dispose();
    setLeaving(true);
    setExitError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch {
      onExitNotice(
        "Não foi possível confirmar o encerramento de todas as sessões. Os links foram removidos. Se esta sessão foi encerrada, entre novamente; caso contrário, tente sair novamente ou reabra a área.",
      );
      if (mounted.current)
        setExitError(
          "Não foi possível encerrar a sessão. Os links foram removidos. Tente sair novamente ou reabra a área com a sessão atual.",
        );
    } finally {
      signoutLock.current = false;
      if (mounted.current) setLeaving(false);
    }
  }
  return (
    <>
      <div className="ies-account">
        <span>{email}</span>
        <button disabled={leaving} onClick={() => void signOut()}>
          Sair da conta
        </button>
      </div>
      {leaving ? (
        <p role="status">Encerrando sessão…</p>
      ) : exitError ? (
        <section>
          <p role="alert">{exitError}</p>
          <button
            onClick={() => {
              setApi(createApi());
              setExitError("");
            }}
          >
            Reabrir área com sessão atual
          </button>
        </section>
      ) : global === null ? (
        <p role="status">Verificando escopo…</p>
      ) : (
        <IesWorkspace api={api} global={global} />
      )}
    </>
  );
}
