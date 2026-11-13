import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "123456";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is authenticated
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: authErr,
    } = await admin.auth.getUser(token);
    if (authErr || !caller) throw new Error("Not authenticated");

    const body = await req.json();
    const { email, institution_id, role, name } = body as {
      email: string;
      institution_id: string;
      role?: string;
      name?: string;
    };

    if (!email || !institution_id) throw new Error("email and institution_id required");

    const mail = email.trim().toLowerCase();
    const memberRole = role || "equipe";

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === mail,
    );

    let userId: string;

    if (existing) {
      userId = existing.id;
    } else {
      // Create user with default password, email auto-confirmed
      const { data: newUser, error: createErr } =
        await admin.auth.admin.createUser({
          email: mail,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: name || mail.split("@")[0] },
        });
      if (createErr) throw createErr;
      userId = newUser.user.id;
    }

    // Add membership (upsert to avoid duplicates)
    const { error: memberErr } = await admin
      .from("vertice_memberships")
      .upsert(
        {
          user_id: userId,
          institution_id,
          role: memberRole,
        },
        { onConflict: "user_id,institution_id" },
      );
    if (memberErr) throw memberErr;

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        created: !existing,
        email: mail,
        password: existing ? null : DEFAULT_PASSWORD,
        login_url: `${req.headers.get("origin") || "https://www.verticesuperior.com.br"}/entrar`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
