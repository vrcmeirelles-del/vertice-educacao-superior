import {sendPortalEmail} from "../_shared/portal-email.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// v3 (12/11/2026) — correção de segurança:
// - exige usuário autenticado (não aceita só a chave pública);
// - só envia se o chamador enxerga a assinatura pelo RLS (isolamento por IES);
// - NUNCA devolve o token/link de confirmação ao chamador (prova de posse do e-mail);
// - limita reenvio a 1 a cada 5 minutos; escapa HTML no e-mail; CORS por lista.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;


const PORTAL_URL = Deno.env.get("PORTAL_URL") || "https://vertice-portal.onrender.com";

const ALLOWED_ORIGINS = new Set([
  "https://www.verticesuperior.com.br",
  "https://verticesuperior.com.br",
  "https://vertice-portal.onrender.com",
  "https://vertice-educacao-superior.onrender.com",
  "https://vertice-educacao-superior-site.onrender.com",
  "https://vertice-educacao-superior-jlri.onrender.com",
]);

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://www.verticesuperior.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json(req, { error: "Não autenticado" }, 401);

    // Cliente com a identidade do chamador: RLS decide o que ele enxerga.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(req, { error: "Não autenticado" }, 401);

    const { signature_id } = await req.json().catch(() => ({}));
    if (!signature_id || typeof signature_id !== "string") return json(req, { error: "signature_id obrigatório" }, 400);

    const { data: visible } = await userClient
      .from("vertice_contract_signatures")
      .select("id")
      .eq("id", signature_id)
      .maybeSingle();
    if (!visible) return json(req, { error: "Assinatura não encontrada" }, 404);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

    const { data: sig } = await admin
      .from("vertice_contract_signatures")
      .select("*")
      .eq("id", signature_id)
      .single();
    if (!sig) return json(req, { error: "Assinatura não encontrada" }, 404);
    if (sig.email_confirmed_at) return json(req, { already_confirmed: true });

    if (sig.email_confirmation_sent_at && Date.now() - new Date(sig.email_confirmation_sent_at).getTime() < 5 * 60 * 1000) {
      return json(req, { success: true, email_sent: false, throttled: true });
    }

    const { data: contract } = await admin
      .from("vertice_contracts")
      .select("contract_number, package_code")
      .eq("id", sig.contract_id)
      .single();
    const { data: ies } = await admin
      .from("vertice_institutions")
      .select("name")
      .eq("id", sig.institution_id)
      .single();

    const confirmUrl = `${PORTAL_URL}/confirmar-contrato?token=${encodeURIComponent(sig.confirmation_token)}`;
    const pkgLabels: Record<string, string> = { essencial: "Essencial", regulacao: "Regulação", gestao360: "Gestão 360°", completo: "Completo" };
    const acceptedAt = sig.accepted_at ? new Date(sig.accepted_at) : new Date();

    const htmlBody = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;padding:24px">
  <div style="text-align:center;margin-bottom:24px"><strong style="font-size:24px;letter-spacing:2px;color:#6366f1">VÉRTICE</strong><p style="color:#666;margin:4px 0 0">Educação Superior</p></div>
  <h2 style="color:#1a1a2e;margin:0 0 16px">Confirmação de Assinatura Digital</h2>
  <p>Olá, <strong>${esc(sig.signer_name)}</strong>,</p>
  <p>Você assinou digitalmente o contrato de prestação de serviços da Plataforma Vértice Educação Superior. Confirme seu e-mail para validar a assinatura.</p>
  <div style="background:#f8fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:20px 0">
    <p style="margin:0 0 8px"><strong>Contrato:</strong> ${esc(contract?.contract_number || "—")}</p>
    <p style="margin:0 0 8px"><strong>IES:</strong> ${esc(ies?.name || "—")}</p>
    <p style="margin:0 0 8px"><strong>Pacote:</strong> ${esc(pkgLabels[contract?.package_code] || contract?.package_code || "—")}</p>
    <p style="margin:0 0 8px"><strong>Signatário:</strong> ${esc(sig.signer_name)} (${esc(sig.signer_role)})</p>
    <p style="margin:0 0 8px"><strong>Data:</strong> ${esc(acceptedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}</p>
    <p style="margin:0;font-family:monospace;font-size:12px;color:#888"><strong>Hash SHA-256:</strong> ${esc(sig.document_hash)}</p>
  </div>
  <div style="text-align:center;margin:28px 0"><a href="${esc(confirmUrl)}" style="background:#6366f1;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Confirmar assinatura</a></div>
  <p style="color:#666;font-size:14px">Se você não reconhece esta assinatura, ignore este e-mail ou entre em contato conosco.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#999;font-size:12px;text-align:center">Assinatura eletrônica nos termos da Lei 14.063/2020.<br>Vértice Educação Superior · Fato & Direito Publicidade LTDA · Palmas/TO<br>IP: ${esc(sig.ip_address)} · ${esc(acceptedAt.toISOString())}</p>
</body></html>`;

    const delivery=await sendPortalEmail({module:'contrato',institutionId:sig.institution_id,actorId:userData.user.id,recipient:sig.signer_email,fingerprint:'contract:'+signature_id},async()=>({subject:`Confirme sua assinatura — Contrato ${contract?.contract_number||'Vértice'}`,html:htmlBody}),{env:name=>Deno.env.get(name),db:admin,fetch,log:entry=>console.log(JSON.stringify(entry))});
    const emailSent=delivery.ok;
    if (emailSent) {
      await admin
        .from("vertice_contract_signatures")
        .update({ email_confirmation_sent_at: new Date().toISOString() })
        .eq("id", signature_id);
    }

    // Sem token, sem link: a confirmação só é possível por quem recebe o e-mail.
    return json(req, { success: true, email_sent: emailSent, accepted_by_provider: emailSent, delivery_confirmed:false, code:delivery.ok?null:delivery.code });
  } catch (e) {
    console.error("send-contract-confirmation", "request_failed");
    return json(req, { error: "Falha ao processar a solicitação" }, 500);
  }
});

