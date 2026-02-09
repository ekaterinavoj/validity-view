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

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent deleting yourself
    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target user profile
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, first_name, last_name, approval_status, employee_id")
      .eq("id", userId)
      .single();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow deleting deactivated users
    if (targetProfile.approval_status !== "deactivated") {
      return new Response(JSON.stringify({ error: "Only deactivated users can be deleted. Deactivate the user first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Deleting user ${userId} (${targetProfile.email}) - starting cascade cleanup...`);

    // 1. Remove user_module_access
    const { error: moduleError } = await supabaseAdmin
      .from("user_module_access")
      .delete()
      .eq("user_id", userId);
    if (moduleError) console.error("Error deleting module access:", moduleError);

    // 2. Remove user_roles
    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (rolesError) console.error("Error deleting user roles:", rolesError);

    // 3. Remove from responsibility_group_members
    const { error: groupMembersError } = await supabaseAdmin
      .from("responsibility_group_members")
      .delete()
      .eq("profile_id", userId);
    if (groupMembersError) console.error("Error deleting group memberships:", groupMembersError);

    // 4. Remove from deadline_responsibles
    const { error: deadlineRespError } = await supabaseAdmin
      .from("deadline_responsibles")
      .delete()
      .eq("profile_id", userId);
    if (deadlineRespError) console.error("Error deleting deadline responsibles:", deadlineRespError);

    // 5. Remove from equipment_responsibles
    const { error: equipRespError } = await supabaseAdmin
      .from("equipment_responsibles")
      .delete()
      .eq("profile_id", userId);
    if (equipRespError) console.error("Error deleting equipment responsibles:", equipRespError);

    // 6. Remove notifications
    const { error: notifError } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("user_id", userId);
    if (notifError) console.error("Error deleting notifications:", notifError);

    // 7. Unlink employee (set employee's profile link to null if needed)
    // The profile has employee_id, but we don't need to touch the employee record itself

    // 8. Delete profile (this must come before auth deletion)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileError) {
      console.error("Error deleting profile:", profileError);
      return new Response(JSON.stringify({ error: `Failed to delete profile: ${profileError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Delete auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error("Error deleting auth user:", authDeleteError);
      return new Response(JSON.stringify({ error: `Failed to delete auth user: ${authDeleteError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log to audit
    await supabaseAdmin.from("audit_logs").insert({
      table_name: "profiles",
      record_id: userId,
      action: "USER_DELETED",
      old_data: {
        email: targetProfile.email,
        first_name: targetProfile.first_name,
        last_name: targetProfile.last_name,
      },
      new_data: null,
      user_id: caller.id,
      user_email: caller.email,
      changed_fields: ["user_deleted"],
    });

    console.log(`User ${userId} (${targetProfile.email}) successfully deleted.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${targetProfile.email} has been permanently deleted`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin delete user error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
