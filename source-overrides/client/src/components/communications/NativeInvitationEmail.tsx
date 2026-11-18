import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PORTAL_EMAIL_NOTICE } from "../../../../shared/portal-communications";
import { parsePortalInvitationLink } from "../../../../shared/portal-invitation-link";
export default function NativeInvitationEmail({
  link,
  kind,
}: {
  link: string;
  kind: "ies" | "master" | "experience";
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const id = useRef<string | null>(null),
    generation = useRef(0),
    sending = useRef(false);
  useEffect(() => {
    generation.current++;
    id.current = null;
    sending.current = false;
    setBusy(false);
    setMessage("");
    setUncertain(false);
  }, [link, kind]);
  async function send() {
    if (
      busy ||
      sending.current ||
      uncertain ||
      !window.confirm(
        "Enviar este convite individual por e-mail ao destinatário cadastrado? O envio mantém a validade e as permissões do convite.",
      )
    )
      return;
    const g = generation.current;
    sending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const credential = parsePortalInvitationLink(link, kind);
      id.current ??= crypto.randomUUID();
      const r = await supabase.functions.invoke("vertice-communications", {
        body: {
          action: "native",
          source: kind,
          ...credential,
          request_id: id.current,
        },
      });
      if (g !== generation.current) return;
      if (r.error) {
        const details = await (r.error as { context?: Response }).context
          ?.json()
          .catch(() => null);
        setUncertain(true);
        throw Error(
          details?.error ||
            "Envio não confirmado. Confira o histórico antes de repetir.",
        );
      }
      if (!r.data?.sent) throw Error("O envio não foi confirmado.");
      setMessage(PORTAL_EMAIL_NOTICE);
      setUncertain(true);
    } catch (e) {
      if (g === generation.current) setMessage((e as Error).message);
    } finally {
      if (g === generation.current) {
        sending.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div>
      <button
        type="button"
        disabled={busy || uncertain}
        onClick={() => void send()}
      >
        {busy ? "Enviando…" : "Enviar este convite por e-mail"}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
