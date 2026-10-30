// Edge Function "vertice-convite": envia o e-mail de convite de acesso.
// Só envia quando quem chama consegue ver o convite pendente pela própria sessão
// (RLS: master ou gestor da instituição, com MFA). A chave de serviço nunca sai daqui.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ALLOWED = ["https://www.verticesuperior.com.br", "https://verticesuperior.com.br", "https://vertice-educacao-superior-site.onrender.com"];
const REDIRECT = "https://www.verticesuperior.com.br/redefinir-senha";

// Chaves: novo sistema (sb_publishable/sb_secret) com fallback para as chaves legadas.
function key(kind: "PUBLISHABLE" | "SECRET") {
  const raw = Deno.env.get(`SUPABASE_${kind}_KEYS`);
  if (raw) {
    try {
      const keys = JSON.parse(raw) as Record<string, string>;
      return keys.default ?? Object.values(keys)[0];
    } catch { /* usa o legado */ }
  }
  return Deno.env.get(kind === "PUBLISHABLE" ? "SUPABASE_ANON_KEY" : "SUPABASE_SERVICE_ROLE_KEY")!;
}

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

Deno.serve(async req => {
  const headers = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "método" }), { status: 405, headers });
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "sessão" }), { status: 401, headers });

  let body: { institution_id?: string; email?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "corpo" }), { status: 400, headers }); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const institution = String(body.institution_id ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^[0-9a-f-]{36}$/.test(institution))
    return new Response(JSON.stringify({ error: "dados" }), { status: 400, headers });

  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, key("PUBLISHABLE"), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: invite, error } = await asCaller
    .from("vertice_invites").select("id").eq("institution_id", institution).eq("email", email).is("accepted_at", null).maybeSingle();
  if (error || !invite) return new Response(JSON.stringify({ error: "sem permissão" }), { status: 403, headers });

  const admin = createClient(url, key("SECRET"), { auth: { persistSession: false } });
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: REDIRECT });
  if (inviteError) {
    const exists = /already|registered|exists/i.test(inviteError.message);
    return new Response(JSON.stringify({ error: exists ? "conta já existe" : "falha no envio" }), { status: exists ? 409 : 502, headers });
  }
  return new Response(JSON.stringify({ ok: true }), { headers });
});
