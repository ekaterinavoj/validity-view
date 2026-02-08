import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  try {
    // Kontrola, jestli už existuje admin
    const { data: existingAdmins, error: checkError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (checkError) {
      return new Response(
        JSON.stringify({
          error: "Failed to check existing admins",
          details: checkError.message,
        }),
        { status: 500 }
      );
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ message: "Admin already exists, skipping creation" }),
        { status: 200 }
      );
    }

    // Vytvoření prvního admina přes Auth API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: "admin@system.local",
      password: "admin",
      email_confirm: true,
    });

    if (authError) {
      return new Response(
        JSON.stringify({
          error: "Failed to create admin user",
          details: authError.message,
        }),
        { status: 500 }
      );
    }

    const userId = authData.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Failed to get user ID after creation" }),
        { status: 500 }
      );
    }

    // Vytvoření profilu
    const { error: profileError } = await supabase.from("profiles").insert([
      {
        id: userId,
        email: "admin@system.local",
        first_name: "System",
        last_name: "Administrator",
        position: "Administrator",
        approval_status: "approved",
        approved_at: new Date().toISOString(),
      },
    ]);

    if (profileError) {
      return new Response(
        JSON.stringify({
          error: "Failed to create admin profile",
          details: profileError.message,
        }),
        { status: 500 }
      );
    }

    // Role se přiřadí automaticky triggerm assign_default_role
    return new Response(
      JSON.stringify({
        message: "Admin user created successfully",
        email: "admin@system.local",
        password: "admin (CHANGE THIS IMMEDIATELY IN PRODUCTION!)",
      }),
      { status: 201 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500 }
    );
  }
});
