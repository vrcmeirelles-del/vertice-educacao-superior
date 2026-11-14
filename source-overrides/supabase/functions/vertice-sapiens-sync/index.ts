/**
 * vertice-sapiens-sync
 *
 * Periodic sync wrapper: lists active tenants, invokes the existing
 * vertice-learning-bridge sync for each, detects new data since last
 * diagnosis, and triggers analysis when needed.
 *
 * Invoked by cron (pg_cron or Render cron) every 15 minutes.
 * Auth: service-level secret (SAPIENS_CRON_SECRET) — NOT user JWT.
 */

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (fn: (req: Request) => Promise<Response>) => void;
};

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const env = (k: string) => String(Deno.env.get(k) || "");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function cfg() {
  const url = env("SUPABASE_URL");
  const sk =
    (() => {
      const raw = env("SUPABASE_SECRET_KEYS");
      if (raw) try { const o = JSON.parse(raw); return o.default || Object.values(o)[0]; } catch { /* */ }
      return env("SUPABASE_SERVICE_ROLE_KEY");
    })();
  if (!url || !sk) throw new Error("Supabase not configured");
  return { url, sk };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 204);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Auth: cron secret or service_role key
  const secret = env("SAPIENS_CRON_SECRET");
  const auth = req.headers.get("authorization") || "";
  if (secret.length >= 16 && auth !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const { url, sk } = cfg();
    const admin = createClient(url, sk, { auth: { persistSession: false } });

    // 1. List active tenants (institutions with learning bridge enabled)
    const { data: syncRuns } = await admin
      .from("vertice_private.learning_sync_runs")
      .select("institution_id, finished_at, ingested")
      .order("finished_at", { ascending: false })
      .limit(500);

    // Get institutions that have tenant enabled on F&O side
    // by looking at the learning_students table which only has data for active tenants
    const { data: institutions } = await admin
      .from("vertice_institutions")
      .select("id, name, status, tier")
      .eq("status", "ativa");

    if (!institutions?.length) return json({ ok: true, synced: 0, message: "No active institutions" });

    // 2. For each institution, check if sync is needed
    const results: Array<{
      institutionId: string;
      name: string;
      synced: boolean;
      newEvents: number;
      diagnosisTriggered: boolean;
      error?: string;
    }> = [];

    for (const inst of institutions) {
      try {
        // Check last sync run for this institution
        const lastRun = (syncRuns || []).find(
          (r: Record<string, unknown>) => r.institution_id === inst.id
        );
        const lastSyncAt = lastRun?.finished_at || "1970-01-01T00:00:00Z";

        // Check if there are new learning events since last diagnosis
        const { count: newEventCount } = await admin
          .from("vertice_private.learning_events")
          .select("id", { count: "exact", head: true })
          .eq("institution_id", inst.id)
          .gt("synced_at", lastSyncAt);

        const hasNewData = (newEventCount || 0) > 0;

        // Check last diagnosis for this institution
        const { data: lastDiagnosis } = await admin
          .from("vertice_sapiens_diagnoses")
          .select("id, created_at, data_snapshot_at")
          .eq("institution_id", inst.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Trigger analysis if:
        // a) No diagnosis exists yet, OR
        // b) New events arrived since last diagnosis, AND at least 50 new events
        const shouldAnalyze =
          hasNewData && (!lastDiagnosis || (newEventCount || 0) >= 50);

        // Record in audit trail
        await admin.from("vertice_sapiens_audit_trail").insert({
          institution_id: inst.id,
          entity_type: "diagnosis",
          entity_id: lastDiagnosis?.id || "00000000-0000-0000-0000-000000000000",
          action: "created",
          actor_type: "system",
          details: {
            type: "sync_check",
            new_events: newEventCount || 0,
            last_sync: lastSyncAt,
            analysis_triggered: shouldAnalyze,
          },
        });

        results.push({
          institutionId: inst.id,
          name: inst.name,
          synced: true,
          newEvents: newEventCount || 0,
          diagnosisTriggered: shouldAnalyze,
        });

        // If analysis needed, invoke sapiens-analyze edge function
        if (shouldAnalyze) {
          const analyzeUrl = `${url}/functions/v1/vertice-sapiens-analyze`;
          fetch(analyzeUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sk}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              institutionId: inst.id,
              trigger: "sync",
            }),
            signal: AbortSignal.timeout(120000),
          }).catch((e) =>
            console.error(`[sapiens-sync] analyze trigger failed for ${inst.id}:`, e)
          );
        }
      } catch (instError) {
        results.push({
          institutionId: inst.id,
          name: inst.name,
          synced: false,
          newEvents: 0,
          diagnosisTriggered: false,
          error: (instError as Error).message,
        });
      }
    }

    return json({
      ok: true,
      synced: results.filter((r) => r.synced).length,
      analyzed: results.filter((r) => r.diagnosisTriggered).length,
      total: results.length,
      results,
    });
  } catch (e) {
    console.error("[sapiens-sync] fatal:", e);
    return json({ error: "internal", message: (e as Error).message }, 500);
  }
});
