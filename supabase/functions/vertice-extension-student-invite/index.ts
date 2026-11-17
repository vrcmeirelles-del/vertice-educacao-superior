import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const origin = "https://www.verticesuperior.com.br";
const allowedOrigins = new Set([origin, "https://verticesuperior.com.br", "https://vertice-portal.onrender.com", "https://vertice-educacao-superior.onrender.com"]);
Deno.serve(async (req) => {
  const requestedOrigin = req.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigins.has(requestedOrigin) ? requestedOrigin : origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
  const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "Método inválido." }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Entre no portal para convidar alunos." }, 401);
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EXTENSION_RESEND_FROM") || Deno.env.get("RESEND_FROM");
  if (!key || !from) return reply({ error: "Serviço de e-mail da Extensão indisponível." }, 503);
  try {
    const body = await req.json();
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data, error } = await client.rpc("vertice_extension_student_issue", {
      p_project: body.project,
      p_registration: body.registration ?? null,
      p_cpf: body.cpf ?? null,
      p_email: body.email ?? null,
      p_fields: body.fields ?? [],
      p_execution: body.execution === true,
      p_invite: body.invite ?? null,
    });
    if (error || !data) return reply({ error: error?.code === "42501" ? "Acesso ao projeto não autorizado." : error?.code === "P0001" ? error.message : "Não foi possível emitir o convite." }, 403);
    const link = new URL("/extensao-convite", origin);
    link.searchParams.set("aluno", "1");
    link.hash = new URLSearchParams({ ativacao: data.token }).toString();
    try {
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          from, to: [data.email], subject: "Convite individual para a Extensão 360°",
          text: `Você foi convidado(a) para contribuir com o projeto “${data.title}”.\n\nAcesse o Vértice pelo link individual abaixo e valide seus dados com o e-mail cadastrado. O link expira em 72 horas.\n\n${link.href}\n\nSe precisar de ajuda, procure o responsável pelo projeto.`,
        }),
      });
      if (!sent.ok) return reply({ error: "Convite registrado. Falha no envio de e-mail. Use Reenviar." }, 502);
    } catch {
      return reply({ error: "Convite registrado. Falha no envio de e-mail. Use Reenviar." }, 502);
    }
    return reply({ sent: true });
  } catch {
    return reply({ error: "Não foi possível processar o convite." }, 400);
  }
});
