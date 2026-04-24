import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSMTP } from "../_shared/smtp-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

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

interface ReminderTemplate {
  id: string;
  name: string;
  email_subject: string;
  email_body: string;
  is_active: boolean;
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!isCronRequest && authHeader?.startsWith("Bearer ")) {
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting training reminder check...");

    // Load all needed settings
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["email_provider", "reminder_recipients", "training_manager_notifications"]);

    const settingsMap: Record<string, any> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value; });

    const emailProvider = settingsMap["email_provider"] || {};
    const moduleRecipients = settingsMap["reminder_recipients"] || { user_ids: [], delivery_mode: "bcc" };
    const managerNotifications = settingsMap["training_manager_notifications"] || { enabled: false };

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

    // Resolve module recipients from system_settings
    let moduleRecipientEmails: string[] = [];
    if (moduleRecipients.user_ids && moduleRecipients.user_ids.length > 0) {
      const { data: recipientProfiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", moduleRecipients.user_ids);
      moduleRecipientEmails = [...new Set((recipientProfiles || []).map(p => p.email.toLowerCase()).filter(Boolean))];
    }

    if (moduleRecipientEmails.length === 0 && !managerNotifications.enabled) {
      console.log("No module recipients configured and manager notifications disabled");
      return new Response(
        JSON.stringify({ message: "No recipients configured", total_emails_sent: 0, total_skipped: 0, results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all active templates (for email content only)
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
    console.log(`Module recipients: ${moduleRecipientEmails.length}, Manager notifications: ${managerNotifications.enabled}`);

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
    const deliveryMode = moduleRecipients.delivery_mode || "bcc";

    for (const training of allTrainings as Training[]) {
      const nextDate = new Date(training.next_training_date);
      nextDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const remindDaysBefore = training.remind_days_before ?? 30;

      // Only process if within the reminder window (including past-due)
      if (daysUntil > remindDaysBefore) continue;

      // Resolve template for email content (not recipients!)
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

      const employeeEmail = employee?.email || "";
      const nextDateFormatted = nextDate.toLocaleDateString("cs-CZ");
      const statusColor = daysUntil < 0 ? "#ef4444" : daysUntil <= 7 ? "#f59e0b" : "#22c55e";
      const absDays = Math.abs(daysUntil);
      const daysUnit = absDays === 1 ? "den" : (absDays >= 2 && absDays <= 4) ? "dny" : "dnů";
      const daysLabel = daysUntil < 0 ? `${absDays} ${daysUnit} po termínu` : `${daysUntil} ${daysUnit}`;

      // Build records table HTML for {{records_table}} variable
      const recordsTableHtml = `
        <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Zaměstnanec</th>
              <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Email</th>
              <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Školení</th>
              <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Vyprší</th>
              <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">Dnů</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 10px;">${employeeName}</td>
              <td style="border: 1px solid #e5e7eb; padding: 10px;">${employeeEmail}</td>
              <td style="border: 1px solid #e5e7eb; padding: 10px;">${trainingName}</td>
              <td style="border: 1px solid #e5e7eb; padding: 10px;">${nextDateFormatted}</td>
              <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">
                <span style="background-color: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                  ${daysLabel}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      `;

      const body = template.email_body
        .replace(/\{\{training_name\}\}/g, trainingName)
        .replace(/\{\{days_remaining\}\}/g, daysUntil.toString())
        .replace(/\{\{employee_name\}\}/g, employeeName)
        .replace(/\{\{records_table\}\}/g, recordsTableHtml);

      // If template already includes {{records_table}}, don't append default table
      const templateHasRecordsTable = /\{\{records_table\}\}/.test(template.email_body);

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            ${body.split('\n').map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
          </div>
          ${templateHasRecordsTable ? '' : recordsTableHtml}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px;">
            Tento email byl odeslán automaticky systémem evidence školení.
          </p>
        </div>
      `;

      // 1) Send to module-configured recipients
      if (moduleRecipientEmails.length > 0) {
        try {
          const result = await sendViaSMTP(moduleRecipientEmails, subject, htmlBody, deliveryMode, emailProvider);

          if (result.success) {
            console.log(`Email sent for training ${training.id} to module recipients`);
            totalEmailsSent++;

            await supabase.from("reminder_logs").insert({
              training_id: training.id,
              template_id: template.id,
              template_name: template.name,
              recipient_emails: moduleRecipientEmails,
              email_subject: subject,
              email_body: body,
              status: "sent",
              provider_used: "smtp",
              delivery_mode: deliveryMode,
            });

            results.push({
              training_id: training.id,
              template: template.name,
              recipients: moduleRecipientEmails.length,
              type: "module_recipients",
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
            recipient_emails: moduleRecipientEmails,
            email_subject: subject,
            email_body: body,
            status: "failed",
            error_message: emailError.message,
            provider_used: "smtp",
            delivery_mode: deliveryMode,
          });

          results.push({
            training_id: training.id,
            template: template.name,
            type: "module_recipients",
            status: "failed",
            error: emailError.message,
          });
        }
      }

      // 2) Send to managers if enabled (filtered by subordinate hierarchy)
      if (managerNotifications.enabled) {
        // Get managers with linked employees
        const { data: managerProfiles } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name, employee_id")
          .not("employee_id", "is", null);

        if (managerProfiles && managerProfiles.length > 0) {
          const { data: managerRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["admin", "manager"])
            .in("user_id", managerProfiles.map(p => p.id));

          const managerUserIds = new Set(managerRoles?.map(r => r.user_id) || []);
          const managers = managerProfiles.filter(p => managerUserIds.has(p.id) && p.employee_id);

          for (const manager of managers) {
            // Skip if manager already receives via module recipients
            if (moduleRecipientEmails.includes(manager.email.toLowerCase())) continue;

            // Check if this training's employee is subordinate to this manager
            const { data: subordinates } = await supabase.rpc("get_subordinate_employee_ids", {
              root_employee_id: manager.employee_id!,
            });

            if (!subordinates || subordinates.length <= 1) continue;

            const subordinateIds = subordinates.map((s: any) => s.employee_id);
            if (!subordinateIds.includes(training.employee_id)) continue;

            // This manager is responsible for this employee - send notification
            const mgrSubject = `Připomínka školení: ${employeeName} - ${trainingName}`;
            const mgrDaysLabel = daysUntil < 0 ? `${Math.abs(daysUntil)} ${Math.abs(daysUntil) === 1 ? "den" : Math.abs(daysUntil) >= 2 && Math.abs(daysUntil) <= 4 ? "dny" : "dnů"} po termínu` : `${daysUntil} ${daysUntil === 1 ? "den" : daysUntil >= 2 && daysUntil <= 4 ? "dny" : "dnů"}`;
            const mgrStatusColor = daysUntil < 0 ? "#ef4444" : daysUntil <= 7 ? "#f59e0b" : "#22c55e";
            const mgrNextDateFormatted = nextDate.toLocaleDateString("cs-CZ");
            const mgrBody = `
              <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                  <p>Dobrý den, ${manager.first_name} ${manager.last_name},</p>
                  <p>školení <strong>${trainingName}</strong> zaměstnance <strong>${employeeName}</strong> vyžaduje pozornost.</p>
                </div>
                <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
                  <thead>
                    <tr style="background-color: #f3f4f6;">
                      <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Zaměstnanec</th>
                      <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Školení</th>
                      <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Vyprší</th>
                      <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">Dnů</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="border: 1px solid #e5e7eb; padding: 10px;">${employeeName}</td>
                      <td style="border: 1px solid #e5e7eb; padding: 10px;">${trainingName}</td>
                      <td style="border: 1px solid #e5e7eb; padding: 10px;">${mgrNextDateFormatted}</td>
                      <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">
                        <span style="background-color: ${mgrStatusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                          ${mgrDaysLabel}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px;">Tento email byl odeslán automaticky systémem evidence školení.</p>
              </div>
            `;

            try {
              const mgrResult = await sendViaSMTP([manager.email], mgrSubject, mgrBody, "to", emailProvider);

              await supabase.from("reminder_logs").insert({
                training_id: training.id,
                template_id: template.id,
                template_name: "Manager notification",
                recipient_emails: [manager.email],
                email_subject: mgrSubject,
                email_body: mgrBody,
                status: mgrResult.success ? "sent" : "failed",
                error_message: mgrResult.error || null,
                provider_used: "smtp",
                delivery_mode: "to",
              });

              if (mgrResult.success) {
                totalEmailsSent++;
                console.log(`Sent manager notification to ${manager.email} for training ${training.id}`);
                results.push({
                  training_id: training.id,
                  type: "manager_notification",
                  manager_email: manager.email,
                  status: "sent",
                });
              }
            } catch (mgrError: any) {
              console.error(`Failed to send manager notification to ${manager.email}:`, mgrError);
            }
          }
        }
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
