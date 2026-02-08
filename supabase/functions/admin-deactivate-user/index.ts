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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseCaller.auth.getUser();

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is admin
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

    const { userId, action } = await req.json();

    if (!userId || !action) {
      return new Response(JSON.stringify({ error: "userId and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["deactivate", "reactivate"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent deactivating yourself
    if (userId === caller.id && action === "deactivate") {
      return new Response(JSON.stringify({ error: "Cannot deactivate yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if target is the last admin (prevent deactivating last admin)
    if (action === "deactivate") {
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const isTargetAdmin = targetRoles?.some((r) => r.role === "admin");
      
      if (isTargetAdmin) {
        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin");
        
        if (count && count <= 1) {
          return new Response(JSON.stringify({ error: "Cannot deactivate the last admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Get current user profile
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, first_name, last_name, approval_status")
      .eq("id", userId)
      .single();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newStatus = action === "deactivate" ? "deactivated" : "approved";
    const oldStatus = targetProfile.approval_status;

    console.log(`${action} user ${userId}: ${oldStatus} -> ${newStatus}`);

    // Update profile approval_status
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        approval_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If deactivating, also ban user in auth (prevent login)
    if (action === "deactivate") {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "876600h", // ~100 years
      });
      if (banError) {
        console.error("Ban error:", banError);
      }
    } else {
      // If reactivating, unban user
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });
      if (unbanError) {
        console.error("Unban error:", unbanError);
      }
    }

    // Log to audit
    await supabaseAdmin.from("audit_logs").insert({
      table_name: "profiles",
      record_id: userId,
      action: action === "deactivate" ? "USER_DEACTIVATED" : "USER_REACTIVATED",
      old_data: { approval_status: oldStatus },
      new_data: { approval_status: newStatus },
      user_id: caller.id,
      user_email: caller.email,
      changed_fields: ["approval_status"],
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: action === "deactivate" 
          ? `User ${targetProfile.email} has been deactivated`
          : `User ${targetProfile.email} has been reactivated`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin deactivate user error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
