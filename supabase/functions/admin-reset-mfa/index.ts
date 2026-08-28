import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Removes ALL MFA (TOTP) factors for a target user — the recovery path for
// someone locked out after losing their authenticator device (lost phone,
// reinstalled app without transferring the secret, etc). Mirrors
// admin-reset-password: admin-only, audit-logged, no self-service equivalent
// exists on purpose (a user who still has their factor should just use it or
// unenroll it themselves from their own Profile page).
//
// Uses the raw GoTrue admin REST endpoints directly (GET/DELETE
// /admin/users/{id}/factors[/​{factorId}]) rather than a supabase-js helper,
// since factor management isn't exposed as a typed method on this client version.

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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isAdmin = callerRoles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminHeaders = {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    };

    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/factors`, {
      headers: adminHeaders,
    });
    if (!listRes.ok) {
      const body = await listRes.text();
      throw new Error(`Failed to list factors (${listRes.status}): ${body}`);
    }
    const factors: Array<{ id: string; factor_type: string }> = await listRes.json();

    let removed = 0;
    for (const factor of factors) {
      const delRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${userId}/factors/${factor.id}`,
        { method: "DELETE", headers: adminHeaders },
      );
      if (delRes.ok) {
        removed++;
      } else {
        console.error(`Failed to delete factor ${factor.id}:`, await delRes.text());
      }
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", userId)
      .single();

    await supabaseAdmin.from("audit_logs").insert({
      table_name: "profiles",
      record_id: userId,
      action: "ADMIN_RESET_MFA",
      new_data: {
        target_email: profile?.email,
        target_name: `${profile?.first_name} ${profile?.last_name}`,
        factors_removed: removed,
      },
      user_id: caller.id,
      user_email: caller.email,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Odebráno ${removed} faktorů dvoufázového ověření pro ${profile?.email || userId}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin reset MFA error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
