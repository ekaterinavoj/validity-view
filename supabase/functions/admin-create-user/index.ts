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

    // Create admin client with service role
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

    // caller client (ověřuje JWT z requestu)
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
    const { data: callerRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (rolesError) {
      return new Response(JSON.stringify({ error: rolesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = callerRoles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { email, password, firstName, lastName, role, modules, employeeId } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Employee link is only required for non-admin roles
    const isAdminRole = role === "admin";
    if (!isAdminRole && !employeeId) {
      return new Response(JSON.stringify({ error: "Employee link is required for non-admin users" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Creating user with email:", email);

    // Create user with admin API - use raw_user_meta_data compatible format
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for admin-created users
      user_metadata: {
        first_name: firstName || "",
        last_name: lastName || "",
        position: "",
      },
      // Also set app_metadata for additional info
      app_metadata: {
        provider: "admin",
        created_by: caller.id,
      },
    });

    if (createError) {
      console.error("Create user error:", createError);

      // If trigger failed, try to create user without metadata and handle profile manually
      if (createError.message.includes("Database error")) {
        console.log("Trigger may have failed, attempting alternative approach...");

        // Try creating with minimal data
        const { data: minimalUser, error: minimalError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (minimalError) {
          console.error("Minimal create also failed:", minimalError);
          return new Response(JSON.stringify({ error: minimalError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const userId = minimalUser.user.id;
        console.log("User created with minimal data:", userId);

        // Manually ensure profile exists (trigger might have created partial or none)
        const { data: existingProfile } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).single();

        if (!existingProfile) {
          // Create profile manually
          console.log("Creating profile manually for user:", userId);
          const { error: insertError } = await supabaseAdmin.from("profiles").insert({
            id: userId,
            email: email,
            first_name: firstName || "",
            last_name: lastName || "",
            position: "",
            approval_status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: caller.id,
          });

          if (insertError) {
            console.error("Manual profile insert error:", insertError);
          }
        } else {
          // Update existing profile
          const profileUpdate: Record<string, any> = {
            first_name: firstName || "",
            last_name: lastName || "",
            approval_status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: caller.id,
          };

          if (employeeId) {
            profileUpdate.employee_id = employeeId;
          }

          await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", userId);
        }

        // Continue with role and module setup
        await setupUserRolesAndModules(supabaseAdmin, userId, role, modules, caller.id, employeeId);

        // Log to audit
        await logAuditEntry(supabaseAdmin, userId, email, firstName, lastName, role, modules, employeeId, caller);

        return new Response(
          JSON.stringify({
            success: true,
            userId,
            email,
            message: `User ${email} created successfully`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User created successfully:", newUser.user.id);

    const userId = newUser.user.id;

    // Wait a moment for the profile trigger to create the profile
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if profile was created by trigger
    const { data: existingProfile } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).single();

    if (!existingProfile) {
      // Create profile manually if trigger failed
      console.log("Profile not found, creating manually for user:", userId);
      const { error: insertError } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        email: email,
        first_name: firstName || "",
        last_name: lastName || "",
        position: "",
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: caller.id,
        employee_id: employeeId || null,
      });

      if (insertError) {
        console.error("Manual profile insert error:", insertError);
      }
    } else {
      // Update profile with name, employee link (if provided), and approval
      const profileUpdate: Record<string, any> = {
        first_name: firstName || "",
        last_name: lastName || "",
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: caller.id,
      };

      // Only set employee_id if provided (admins don't need it)
      if (employeeId) {
        profileUpdate.employee_id = employeeId;
      }

      const { error: profileError } = await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", userId);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }
    }

    // Setup roles and modules
    await setupUserRolesAndModules(supabaseAdmin, userId, role, modules, caller.id, employeeId);

    // Log to audit
    await logAuditEntry(supabaseAdmin, userId, email, firstName, lastName, role, modules, employeeId, caller);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        email,
        message: `User ${email} created successfully`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin create user error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper function to setup user roles and module access
async function setupUserRolesAndModules(
  supabaseAdmin: any,
  userId: string,
  role: string,
  modules: string[] | undefined,
  callerId: string,
  employeeId: string | undefined,
) {
  // Delete any existing roles and set the new one
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);

  const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
    user_id: userId,
    role: role || "user",
    created_by: callerId,
  });

  if (roleError) {
    console.error("Role insert error:", roleError);
  }

  // Delete existing module access and set new ones
  await supabaseAdmin.from("user_module_access").delete().eq("user_id", userId);

  // Determine which modules to grant
  const modulesToGrant = role === "admin" ? ["trainings", "deadlines"] : modules || ["trainings", "deadlines"];

  for (const module of modulesToGrant) {
    await supabaseAdmin.from("user_module_access").insert({
      user_id: userId,
      module: module,
      created_by: callerId,
    });
  }
}

// Helper function to log audit entry
async function logAuditEntry(
  supabaseAdmin: any,
  userId: string,
  email: string,
  firstName: string,
  lastName: string,
  role: string,
  modules: string[] | undefined,
  employeeId: string | undefined,
  caller: any,
) {
  const modulesToGrant = role === "admin" ? ["trainings", "deadlines"] : modules || ["trainings", "deadlines"];

  await supabaseAdmin.from("audit_logs").insert({
    table_name: "profiles",
    record_id: userId,
    action: "ADMIN_CREATE_USER",
    new_data: {
      email,
      first_name: firstName,
      last_name: lastName,
      role: role || "user",
      modules: modulesToGrant,
      employee_id: employeeId,
    },
    user_id: caller.id,
    user_email: caller.email,
  });
}
