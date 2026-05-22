import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const email = (body?.email ?? "").toString().trim().toLowerCase();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Neplatný e-mail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate-limit: pouze 1 samoodemčení / e-mail / 60 min — zabráníme zneužití jako brute-force bypass.
    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const { data: recent } = await admin
      .from("audit_logs")
      .select("id, created_at")
      .eq("action", "SELF_UNLOCK_ACCOUNT")
      .eq("user_email", email)
      .gte("created_at", oneHourAgo)
      .limit(1);

    if (recent && recent.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Samoodemčení lze provést maximálně 1× za hodinu. Vyčkejte na automatické odemčení nebo kontaktujte administrátora.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Smaž neúspěšné pokusy → účet bude okamžitě odemčen.
    const { data: deleted, error: delErr } = await admin
      .from("auth_signin_attempts")
      .delete()
      .ilike("email", email)
      .eq("status", "failure")
      .select("id");

    if (delErr) throw delErr;

    const deletedCount = deleted?.length ?? 0;

    // Audit log (přes service role obejde "no manual modifications" policy).
    await admin.from("audit_logs").insert({
      action: "SELF_UNLOCK_ACCOUNT",
      table_name: "auth_signin_attempts",
      record_id: crypto.randomUUID(),
      user_email: email,
      user_name: "self-service",
      new_data: { deleted_attempts: deletedCount, ip: req.headers.get("x-forwarded-for") ?? null },
    });

    return new Response(
      JSON.stringify({ success: true, deleted_attempts: deletedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
