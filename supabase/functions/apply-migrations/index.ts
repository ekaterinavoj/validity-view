import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: only admins ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    // Check admin role using service client
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Parse request ---
    const body = await req.json();
    const { action } = body;

    if (action === "status") {
      // Return list of applied migrations
      const { data: applied, error } = await serviceClient
        .from("schema_migrations")
        .select("version, name, applied_at")
        .order("version", { ascending: true });

      if (error) throw error;

      return new Response(JSON.stringify({ applied: applied || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "apply") {
      const { migrations } = body as {
        migrations: Array<{ version: string; name: string; sql: string }>;
      };

      if (!migrations || !Array.isArray(migrations) || migrations.length === 0) {
        return new Response(
          JSON.stringify({ error: "No migrations provided" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Sort migrations by version
      const sorted = [...migrations].sort((a, b) =>
        a.version.localeCompare(b.version)
      );

      // Get already applied versions
      const { data: applied } = await serviceClient
        .from("schema_migrations")
        .select("version");
      const appliedVersions = new Set(
        (applied || []).map((r: { version: string }) => r.version)
      );

      const results: Array<{
        version: string;
        name: string;
        status: string;
        error?: string;
      }> = [];

      // Use the DB URL for raw SQL execution
      const dbUrl = Deno.env.get("SUPABASE_DB_URL");
      if (!dbUrl) {
        return new Response(
          JSON.stringify({ error: "SUPABASE_DB_URL not configured" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      for (const migration of sorted) {
        if (appliedVersions.has(migration.version)) {
          results.push({
            version: migration.version,
            name: migration.name,
            status: "skipped",
          });
          continue;
        }

        try {
          // Execute migration SQL via pg connection
          // We use supabase rpc with a helper function, or direct SQL
          // Since we can't run raw SQL via supabase-js, we use the REST API
          const pgResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
              "Content-Type": "application/json",
            },
          });

          // Alternative: use Deno postgres for direct SQL execution
          const { default: postgres } = await import(
            "https://deno.land/x/postgresjs@v3.4.5/mod.js"
          );

          const sql = postgres(dbUrl, {
            max: 1,
            idle_timeout: 5,
            connect_timeout: 10,
          });

          try {
            // Execute in transaction
            await sql.begin(async (tx: any) => {
              await tx.unsafe(migration.sql);
              await tx`
                INSERT INTO public.schema_migrations (version, name)
                VALUES (${migration.version}, ${migration.name})
                ON CONFLICT (version) DO NOTHING
              `;
            });

            results.push({
              version: migration.version,
              name: migration.name,
              status: "applied",
            });
          } finally {
            await sql.end();
          }
        } catch (err: any) {
          results.push({
            version: migration.version,
            name: migration.name,
            status: "error",
            error: err.message,
          });
          // Stop on first error
          break;
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use 'status' or 'apply'" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
