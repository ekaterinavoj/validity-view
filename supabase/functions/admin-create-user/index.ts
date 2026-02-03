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
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify caller is admin
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
    
    // Create user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for admin-created users
      user_metadata: {
        first_name: firstName || "",
        last_name: lastName || "",
      },
    });

    if (createError) {
      console.error("Create user error:", createError);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("User created successfully:", newUser.user.id);

    const userId = newUser.user.id;

    // Wait a moment for the profile trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));

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

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // Delete any existing roles and set the new one
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: role || "user",
        created_by: caller.id,
      });

    if (roleError) {
      console.error("Role insert error:", roleError);
    }

    // Delete existing module access and set new ones
    await supabaseAdmin
      .from("user_module_access")
      .delete()
      .eq("user_id", userId);

    // Determine which modules to grant
    const modulesToGrant = role === "admin" 
      ? ["trainings", "deadlines"] 
      : (modules || ["trainings", "deadlines"]);

    for (const module of modulesToGrant) {
      await supabaseAdmin
        .from("user_module_access")
        .insert({
          user_id: userId,
          module: module,
          created_by: caller.id,
        });
    }

    // Log to audit
    await supabaseAdmin
      .from("audit_logs")
      .insert({
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        email,
        message: `User ${email} created successfully` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
