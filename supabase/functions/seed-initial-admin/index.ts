import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Kontrola, jestli už existuje admin
    console.log("Checking for existing admins...");
    const { data: existingAdmins, error: checkError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (checkError) {
      console.error("Error checking existing admins:", checkError);
      return new Response(
        JSON.stringify({
          error: "Failed to check existing admins",
          details: checkError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.log("Admin already exists, skipping creation");
      return new Response(
        JSON.stringify({ message: "Admin already exists, skipping creation" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vytvoření prvního admina přes Auth API
    console.log("Creating admin user...");
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: "admin@system.local",
      password: "admin123",
      email_confirm: true,
    });

    if (authError) {
      console.error("Error creating admin user:", authError);
      return new Response(
        JSON.stringify({
          error: "Failed to create admin user",
          details: authError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user?.id;
    if (!userId) {
      console.error("Failed to get user ID after creation");
      return new Response(
        JSON.stringify({ error: "Failed to get user ID after creation" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Admin user created with ID:", userId);

    // Wait briefly for the handle_new_user trigger to create the profile
    console.log("Waiting for profile trigger...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Upsert profile - create if trigger didn't fire, update if it did
    console.log("Upserting admin profile...");
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        first_name: "System",
        last_name: "Administrator",
        email: "admin@system.local",
        position: "Administrator",
        approval_status: "approved",
        approved_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (profileError) {
      console.error("Error updating admin profile:", profileError);
      return new Response(
        JSON.stringify({
          error: "Failed to update admin profile",
          details: profileError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trigger assign_default_role by měl přiřadit roli admin (první uživatel)
    // Pro jistotu zkontrolujeme a případně přidáme
    const { data: roleCheck, error: roleCheckError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .limit(1);

    if (roleCheckError) {
      console.error("Error checking admin role:", roleCheckError);
    }

    if (!roleCheck || roleCheck.length === 0) {
      console.log("Adding admin role manually...");
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });

      if (roleError) {
        console.error("Error adding admin role:", roleError);
      }
    }

    console.log("Admin user created successfully");
    return new Response(
      JSON.stringify({
      message: "Admin user created successfully",
        email: "admin@system.local",
        password: "admin123 (CHANGE THIS IMMEDIATELY IN PRODUCTION!)",
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
