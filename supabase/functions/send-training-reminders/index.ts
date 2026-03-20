import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSMTP } from "../_shared/smtp-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface ReminderTemplate {
  id: string;
  name: string;
  email_subject: string;
  email_body: string;
  is_active: boolean;
  target_user_ids: string[] | null;
}

interface Training {
  id: string;
  next_training_date: string;
  employee_id: string;
  reminder_template_id: string | null;
  remind_days_before: number | null;
  repeat_days_after: number | null;
  training_types: Array<{ name: string }> | { name: string } | null;
  employees: Array<{ first_name: string; last_name: string; email: string }> | { first_name: string; last_name: string; email: string } | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authorization (cron secret or admin JWT)
  const cronSecret = req.headers.get("x-cron-secret");
  const envCronSecret = Deno.env.get("X_CRON_SECRET") || Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization");
  
  const isCronRequest = cronSecret && envCronSecret && cronSecret === envCronSecret;
  let isAuthorizedAdmin = false;

  if (!isCronRequest && authHeader?.startsWith("Bearer ")) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await userSupabase.auth.getUser(token);

    if (userData?.user) {
      const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: roles } = await serviceSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .limit(1);

      isAuthorizedAdmin = !!(roles && roles.length > 0);
    }
  }
  
  if (!isCronRequest && !isAuthorizedAdmin) {
    return new Response(
      JSON.stringify({ error: "Unauthorized - Admin access or CRON secret required" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting training reminder check...");

    // Get email provider settings
    const { data: providerSettings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "email_provider")
      .single();

    const emailProvider = providerSettings?.value || {};

    if (!emailProvider.smtp_host || !emailProvider.smtp_from_email) {
      console.warn("SMTP server is not configured");
      return new Response(
        JSON.stringify({ 
          message: "SMTP server není nakonfigurován",
          info: "Pro odesílání emailů je potřeba nastavit SMTP server v administraci.",
          total_emails_sent: 0,
          total_skipped: 0,
          results: []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all active templates and build a map by id
    const { data: templates, error: templatesError } = await supabase
      .from("reminder_templates")
      .select("*")
      .eq("is_active", true);

    if (templatesError) {
      console.error("Error fetching templates:", templatesError);
      throw templatesError;
    }

    const templateMap = new Map<string, ReminderTemplate>();
    let defaultTemplate: ReminderTemplate | null = null;
    if (templates) {
      for (const t of templates as ReminderTemplate[]) {
        templateMap.set(t.id, t);
        if (!defaultTemplate) defaultTemplate = t;
      }
    }

    if (!defaultTemplate) {
      console.log("No active reminder templates found");
      return new Response(
        JSON.stringify({ message: "No active templates", sent: 0, total_skipped: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${templateMap.size} active reminder templates`);

    // Fetch all active, non-deleted trainings
    const { data: allTrainings, error: trainingsError } = await supabase
      .from("trainings")
      .select(`
        id,
        next_training_date,
        employee_id,
        reminder_template_id,
        remind_days_before,
        repeat_days_after,
        training_types (name),
        employees (first_name, last_name, email)
      `)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (trainingsError) {
      console.error("Error fetching trainings:", trainingsError);
      throw trainingsError;
    }

    if (!allTrainings || allTrainings.length === 0) {
      console.log("No active trainings found");
      return new Response(
        JSON.stringify({ message: "No active trainings", total_emails_sent: 0, total_skipped: 0, results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${allTrainings.length} active trainings, filtering by remind_days_before...`);

    let totalEmailsSent = 0;
    let totalSkipped = 0;
    const results: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const training of allTrainings as Training[]) {
      const nextDate = new Date(training.next_training_date);
      nextDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const remindDaysBefore = training.remind_days_before ?? 30;

      // Only process if within the reminder window (including past-due)
      if (daysUntil > remindDaysBefore) continue;

      // Resolve template: use assigned one or fall back to default
      const template = (training.reminder_template_id && templateMap.has(training.reminder_template_id))
        ? templateMap.get(training.reminder_template_id)!
        : defaultTemplate;

      // Deduplication check
      const repeatDaysAfter = training.repeat_days_after ?? 30;
      if (repeatDaysAfter > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - repeatDaysAfter);
        const cutoffDateStr = cutoffDate.toISOString();

        const { data: recentLogs } = await supabase
          .from("reminder_logs")
          .select("id, created_at")
          .eq("training_id", training.id)
          .eq("status", "sent")
          .eq("is_test", false)
          .gte("created_at", cutoffDateStr)
          .order("created_at", { ascending: false })
          .limit(1);

        if (recentLogs && recentLogs.length > 0) {
          console.log(`Skipping training ${training.id}: reminder already sent on ${recentLogs[0].created_at} (repeat_days_after=${repeatDaysAfter})`);
          totalSkipped++;
          continue;
        }
      }

      // Resolve recipients from template
      let recipients: string[] = [];

      if (template.target_user_ids && template.target_user_ids.length > 0) {
        const { data: users } = await supabase
          .from("profiles")
          .select("email")
          .in("id", template.target_user_ids);
        recipients = users?.map(u => u.email).filter(Boolean) || [];
      } else {
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "manager"]);

        const userIds = [...new Set(userRoles?.map(r => r.user_id) || [])];
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from("profiles")
            .select("email")
            .in("id", userIds);
          recipients = users?.map(u => u.email).filter(Boolean) || [];
        }
      }

      recipients = [...new Set(recipients.map(e => e.toLowerCase()))];
      if (recipients.length === 0) {
        console.log(`No recipients for training ${training.id}`);
        continue;
      }

      // Prepare email content
      const trainingType = Array.isArray(training.training_types)
        ? training.training_types[0]
        : training.training_types;
      const employee = Array.isArray(training.employees)
        ? training.employees[0]
        : training.employees;

      const trainingName = trainingType?.name || "Neznámé školení";
      const employeeName = employee
        ? `${employee.first_name} ${employee.last_name}`
        : "Neznámý zaměstnanec";

      const subject = template.email_subject
        .replace(/\{\{training_name\}\}/g, trainingName)
        .replace(/\{\{days_remaining\}\}/g, daysUntil.toString())
        .replace(/\{\{employee_name\}\}/g, employeeName);

      const body = template.email_body
        .replace(/\{\{training_name\}\}/g, trainingName)
        .replace(/\{\{days_remaining\}\}/g, daysUntil.toString())
        .replace(/\{\{employee_name\}\}/g, employeeName);

      try {
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Připomínka školení</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${body.split('\n').map(line => `<p style="margin: 10px 0;">${line}</p>`).join('')}
            </div>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Tento email byl odeslán automaticky systémem evidence školení.
            </p>
          </div>
        `;

        const result = await sendViaSMTP(recipients, subject, htmlBody, "bcc", emailProvider);

        if (result.success) {
          console.log(`Email sent for training ${training.id}`);
          totalEmailsSent++;

          await supabase.from("reminder_logs").insert({
            training_id: training.id,
            template_id: template.id,
            template_name: template.name,
            recipient_emails: recipients,
            email_subject: subject,
            email_body: body,
            status: "sent",
            provider_used: "smtp",
          });

          results.push({
            training_id: training.id,
            template: template.name,
            recipients: recipients.length,
            status: "sent",
          });
        } else {
          throw new Error(result.error);
        }
      } catch (emailError: any) {
        console.error(`Failed to send email for training ${training.id}:`, emailError);

        await supabase.from("reminder_logs").insert({
          training_id: training.id,
          template_id: template.id,
          template_name: template.name,
          recipient_emails: recipients,
          email_subject: subject,
          email_body: body,
          status: "failed",
          error_message: emailError.message,
          provider_used: "smtp",
        });

        results.push({
          training_id: training.id,
          template: template.name,
          status: "failed",
          error: emailError.message,
        });
      }
    }

    console.log(`Reminder check completed. Total emails sent: ${totalEmailsSent}, skipped (dedup): ${totalSkipped}`);

    return new Response(
      JSON.stringify({
        message: "Reminder check completed",
        total_emails_sent: totalEmailsSent,
        total_skipped: totalSkipped,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-training-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
