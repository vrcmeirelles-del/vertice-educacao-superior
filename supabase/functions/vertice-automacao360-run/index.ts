// Executor diário da Automação 360° (modo sombra). Só aceita a rotina agendada (x-cron-secret
// conferido no banco); não há disparo por usuário. Algoritmo determinístico, sem IA.
// Respostas e erros trazem apenas metadados (ids de escopo, contagens, códigos).
import { runAll } from "../_shared/automacao360/executor.mjs";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "backend_unavailable" }, 503);
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) { await r.body?.cancel(); throw new Error(`rpc_failed:${name}:${r.status}`); }
    return await r.json();
  };
  const secret = req.headers.get("x-cron-secret") ?? "";
  try {
    if (secret.length < 32 || (await rpc("vertice_espelho_cron_ok", { p_secret: secret })) !== true) {
      return json({ error: "access_denied" }, 403);
    }
    const summary = await runAll({ rpc });
    console.log(JSON.stringify({ event: "automacao360_run", version: summary.version, configs: summary.configs,
      failed: summary.results.filter((r: { status: string }) => r.status === "failed").length }));
    return json(summary);
  } catch (e) {
    const code = /^[a-z_:0-9.]{1,80}$/.test((e as Error)?.message ?? "") ? (e as Error).message : "run_failed";
    return json({ error: code }, 500);
  }
});
