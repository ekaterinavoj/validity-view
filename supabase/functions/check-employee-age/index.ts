import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: cron secret OR admin JWT (same as run-medical-reminders)
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = Deno.env.get("X_CRON_SECRET");

    let isAuthorized = false;

    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      isAuthorized = true;
    }

    if (!isAuthorized && authHeader) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: roles } = await supabaseClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (roles?.some((r: { role: string }) => r.role === "admin")) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch active employees with birth_date
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, employee_number, birth_date")
      .eq("status", "employed")
      .not("birth_date", "is", null);

    if (empError) throw empError;

    const today = new Date();
    let checked = 0;
    let notified = 0;
    let skipped = 0;

    for (const emp of employees || []) {
      checked++;

      const birth = new Date(emp.birth_date);
      const age = today.getFullYear() - birth.getFullYear()
        - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);

      if (age < 50) continue;

      // Check if notification already exists for this employee
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("related_entity_type", "employee_age_50")
        .eq("related_entity_id", emp.id)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Get admin user IDs
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (!admins || admins.length === 0) {
        skipped++;
        continue;
      }

      const empNumber = emp.employee_number ? ` (č. ${emp.employee_number})` : "";
      const notifications = admins.map((admin: { user_id: string }) => ({
        user_id: admin.user_id,
        title: "Zaměstnanec dosáhl 50 let",
        message: `${emp.first_name} ${emp.last_name}${empNumber} dosáhl(a) věku 50 let. Zkontrolujte periodu PLP prohlídek.`,
        type: "warning",
        related_entity_type: "employee_age_50",
        related_entity_id: emp.id,
        is_read: false,
      }));

      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (insertError) {
        console.error(`Failed to insert notifications for employee ${emp.id}:`, insertError);
        skipped++;
      } else {
        notified++;
      }
    }

    console.log(`check-employee-age: checked=${checked}, notified=${notified}, skipped=${skipped}`);

    return new Response(
      JSON.stringify({ success: true, checked, notified, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-employee-age error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
