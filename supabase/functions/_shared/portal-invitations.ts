import { parsePortalInvitationLink } from "../../../source-overrides/shared/portal-invitation-link.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { PORTAL_MAIL_MODULES } from "../../../source-overrides/shared/portal-communications.ts";
import { digest, portalEmailConfig, sendPortalEmail } from "./portal-email.ts";
const ORIGIN = "https://www.verticesuperior.com.br";
const ORIGINS = new Set([
  ORIGIN,
  "https://verticesuperior.com.br",
  "https://vertice-portal.onrender.com",
  "https://vertice-educacao-superior.onrender.com",
]);
const uuid = (x: unknown) =>
  typeof x === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
export async function portalInvitationHandler(req: Request) {
  const origin = req.headers.get("origin") || ORIGIN;
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : ORIGIN,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const reply = (v: unknown, status = 200) =>
    new Response(JSON.stringify(v), { status, headers });
  if (!ORIGINS.has(origin))
    return reply({ error: "Origem não autorizada." }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "Método inválido." }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer "))
    return reply({ error: "Entre no portal." }, 401);
  try {
    const raw = await req.text();
    if (raw.length > 5000)
      return reply({ error: "Solicitação muito grande." }, 413);
    const p = JSON.parse(raw),
      inst = p.institution_id;
    if (p.action !== "native" && !uuid(inst))
      return reply({ error: "Instituição inválida." }, 400);
    const env = (key: string) => Deno.env.get(key);
    const caller = createClient(
      env("SUPABASE_URL")!,
      env("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: auth } },
        auth: { persistSession: false },
      },
    );
    const identity = await caller.auth.getUser();
    if (
      identity.error ||
      !identity.data.user ||
      !identity.data.user.email_confirmed_at
    )
      return reply({ error: "Sessão inválida." }, 401);
    if (p.action === "native") {
      if (
        !["ies", "master", "experience"].includes(p.source) ||
        !uuid(p.id) ||
        !uuid(p.request_id) ||
        typeof p.token !== "string"
      )
        return reply({ error: "Convite inválido." }, 400);
      const target = new URL(
        p.source === "experience" ? "/experience" : "/master",
        ORIGIN,
      );
      target.hash =
        p.source === "experience"
          ? "convite=" + p.id + "." + p.token
          : new URLSearchParams({
              [p.source + "_invitation"]: p.id,
              [p.source + "_token"]: p.token,
            }).toString();
      parsePortalInvitationLink(target.href, p.source);
      const authorized = await caller.rpc("vertice_portal_email_native", {
        p_kind: p.source,
        p_id: p.id,
        p_digest: await digest(p.token),
      });
      if (authorized.error || !authorized.data)
        return reply(
          { error: "Convite não autorizado, expirado, revogado ou já aceito." },
          403,
        );
      const ctx = authorized.data;
      const admin = createClient(
        env("SUPABASE_URL")!,
        env("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const result = await sendPortalEmail(
        {
          module: ctx.module,
          institutionId: ctx.institution_id,
          courseId: ctx.course_id,
          actorId: identity.data.user.id,
          recipient: ctx.recipient,
          requestId: p.request_id,
          fingerprint: p.source + ":" + p.id + ":" + (await digest(p.token)),
        },
        async () => ({
          subject: "Convite Vértice — " + PORTAL_MAIL_MODULES[ctx.module],
          text: `Você recebeu um convite individual da Vértice. A validade, o destinatário e o perfil seguem o registro do portal.\n\n${target.href}\n\nSe não reconhecer o convite, ignore a mensagem.`,
        }),
        { env, db: admin, fetch, log: (x) => console.log(JSON.stringify(x)) },
      );
      return result.ok ? reply({ ...result, sent: true }) : reply(result, 502);
    }
    // História e configuração são reservadas aos gestores autorizados com MFA.
    const history = await caller.rpc("vertice_portal_email_history", {
      p_institution: inst,
      p_module: p.action === "status" ? null : p.module || "institucional",
      p_course: p.course_id || null,
    });
    if (history.error)
      return reply(
        {
          error:
            "Gestão de convites não autorizada. Confira o perfil e o segundo fator.",
        },
        403,
      );
    const config = portalEmailConfig(env);
    if (p.action === "status")
      return reply({
        configured: config.configured,
        key_name: "VERTICE_RESEND_API_KEY",
        sender_name: "VERTICE_RESEND_FROM",
        history: history.data,
        modules: PORTAL_MAIL_MODULES,
      });
    const requestId = p.request_id || crypto.randomUUID();
    const module = p.module || "institucional",
      role = p.role || "equipe",
      email = typeof p.email === "string" ? p.email.trim().toLowerCase() : "";
    if (
      !Object.hasOwn(PORTAL_MAIL_MODULES, module) ||
      !["equipe", "leitor", "gestor"].includes(role) ||
      !uuid(requestId) ||
      (p.course_id && !uuid(p.course_id))
    )
      return reply({ error: "Dados do convite inválidos." }, 400);
    const admin = createClient(
      env("SUPABASE_URL")!,
      env("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const result = await sendPortalEmail(
      {
        module,
        institutionId: inst,
        courseId: p.course_id || null,
        actorId: identity.data.user.id,
        requestId,
        recipient: email,
        fingerprint: JSON.stringify({
          module,
          inst,
          course: p.course_id || null,
          role,
          email,
        }),
      },
      async () => {
        const prepared = await caller.rpc("vertice_portal_prepare_invite", {
          p_institution: inst,
          p_email: email,
          p_role: role,
          p_course: p.course_id || null,
        });
        if (prepared.error || !prepared.data) throw Error("invite_denied");
        const invite = prepared.data;
        const target = new URL("/entrar", ORIGIN);
        if (invite.invitation_id)
          target.searchParams.set("convite", invite.invitation_id);
        // O contexto não é uma autorização: as permissões continuam no banco.
        const redirect = target.href;
        let generated = await admin.auth.admin.generateLink({
          type: invite.existing_member ? "magiclink" : "invite",
          email,
          options: { redirectTo: redirect },
        });
        if (
          generated.error &&
          !invite.existing_member &&
          /already|registered|exists/i.test(generated.error.message)
        )
          generated = await admin.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: { redirectTo: redirect },
          });
        if (generated.error || !generated.data.properties?.action_link)
          throw Error("auth_link_unavailable");
        const scope = p.course_id
          ? "Curso informado no convite; as permissões efetivas seguem seu perfil institucional."
          : "Contexto institucional.";
        return {
          subject: "Convite Vértice — " + PORTAL_MAIL_MODULES[module],
          text: `Você recebeu um convite para acessar a Vértice no contexto de ${PORTAL_MAIL_MODULES[module]}.\n\n${scope}\n\nPerfil solicitado: ${role}. O aceite e o segundo fator continuam sujeitos aos controles do portal.\n\n${generated.data.properties.action_link}\n\nSe não reconhecer o convite, ignore esta mensagem e procure a administração da instituição.`,
        };
      },
      { env, db: admin, fetch, log: (x) => console.log(JSON.stringify(x)) },
    );
    return result.ok ? reply({ ...result, sent: true }) : reply(result, 502);
  } catch {
    return reply(
      {
        error:
          "Não foi possível concluir o convite. Confira o histórico antes de repetir.",
      },
      400,
    );
  }
}
