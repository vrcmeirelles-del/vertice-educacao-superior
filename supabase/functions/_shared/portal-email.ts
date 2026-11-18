import { PORTAL_MAIL_MODULES } from "../../../source-overrides/shared/portal-communications.ts";
export { classifyEmailFailure } from "./provider-errors.ts";
import { classifyEmailFailure } from "./provider-errors.ts";
export type EmailDb = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: any; error: any }>;
};
export type MailContext = {
  module: string;
  institutionId?: string | null;
  courseId?: string | null;
  actorId?: string | null;
  requestId?: string;
  fingerprint: string;
  recipient: string;
};
export type MailMessage = { subject: string; text?: string; html?: string };
export type MailDeps = {
  env: (name: string) => string | undefined;
  db: EmailDb;
  fetch: typeof fetch;
  log: (x: Record<string, unknown>) => void;
};
export const digest = async (text: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export function portalEmailConfig(env: MailDeps["env"]) {
  const key = env("VERTICE_RESEND_API_KEY") || env("RESEND_API_KEY") || "";
  const from =
    env("VERTICE_RESEND_FROM") ||
    env("RESEND_FROM") ||
    "Vértice Educação Superior <noreply@verticesuperior.com.br>";
  const address = from.match(/<([^<>]+)>/)?.[1] || from;
  return {
    key,
    from,
    configured:
      !!key && /^[^@\s]+@verticesuperior\.com\.br$/i.test(address.trim()),
  };
}
export async function sendPortalEmail(
  context: MailContext,
  build: () => Promise<MailMessage>,
  deps: MailDeps,
) {
  const id = context.requestId || crypto.randomUUID();
  const fail = (code: string, error: string, uncertain = false) => ({
    ok: false as const,
    id,
    code,
    error,
    uncertain,
  });
  if (!Object.hasOwn(PORTAL_MAIL_MODULES, context.module))
    return fail("email_module_invalid", "Contexto de comunicação inválido.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(context.recipient))
    return fail("email_recipient_invalid", "Destinatário inválido.");
  const config = portalEmailConfig(deps.env);
  if (!config.configured)
    return fail(
      "email_configuration",
      "Configure a chave e o remetente institucionais da Vértice na central de e-mail.",
    );
  const metadata = {
    id,
    institution_id: context.institutionId || null,
    course_id: context.courseId || null,
    module: context.module,
    actor_id: context.actorId || null,
    recipient_digest: await digest(context.recipient.toLowerCase()),
    fingerprint: await digest(context.fingerprint),
  };
  const claim = await deps.db.rpc("vertice_email_delivery", {
    p_action: "claim",
    p_data: metadata,
  });
  if (claim.error || !claim.data)
    return fail(
      "email_audit_unavailable",
      "Não foi possível reservar o envio no histórico. Nenhuma mensagem foi enviada.",
    );
  if (!claim.data.claimed) {
    if (claim.data.status === "accepted")
      return {
        ok: true as const,
        id,
        accepted_by_provider: true,
        delivery_confirmed: false,
        duplicate: true,
      };
    return fail(
      "email_request_already_used",
      "Esta tentativa já foi registrada. Confira o histórico antes de iniciar outra.",
      true,
    );
  }
  let outcome: any;
  let message: MailMessage | undefined;
  try {
    message = await build();
    if (!message.subject || (!message.text && !message.html))
      throw Error("message_invalid");
  } catch {
    outcome = {
      status: "failed",
      code: "email_preparation_failed",
      error:
        "Não foi possível preparar o convite com as permissões atuais. Nenhum e-mail foi enviado.",
    };
  }
  if (message && !outcome)
    try {
      const res = await deps.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + config.key,
          "Content-Type": "application/json",
          "Idempotency-Key": "vertice/" + id,
        },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          from: config.from,
          to: [context.recipient],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const f = classifyEmailFailure(res.status, body);
        outcome = { status: "failed", ...f };
        deps.log({
          event: "portal_email_failed",
          id,
          module: context.module,
          provider_status: res.status,
          code: f.code,
        });
      } else if (typeof body?.id === "string" && body.id.trim())
        outcome = { status: "accepted", provider_id: body.id };
      else
        outcome = {
          status: "uncertain",
          code: "email_receipt_missing",
          error:
            "O provedor respondeu sem recibo. Confira os envios antes de repetir.",
        };
    } catch {
      outcome = {
        status: "uncertain",
        code: "email_result_unconfirmed",
        error:
          "O envio não foi confirmado. Confira o histórico e o provedor antes de repetir.",
      };
    }
  const finish = await deps.db.rpc("vertice_email_delivery", {
    p_action: "finish",
    p_data: {
      id,
      status: outcome.status,
      code: outcome.code || null,
      provider_id: outcome.provider_id || null,
    },
  });
  if (finish.error)
    return fail(
      "email_audit_unconfirmed",
      "O resultado não pôde ser registrado; confira o provedor antes de reenviar.",
      true,
    );
  if (outcome.status === "accepted") {
    deps.log({ event: "portal_email_accepted", id, module: context.module });
    return {
      ok: true as const,
      id,
      accepted_by_provider: true,
      delivery_confirmed: false,
      duplicate: false,
    };
  }
  return fail(outcome.code, outcome.error, outcome.status === "uncertain");
}
