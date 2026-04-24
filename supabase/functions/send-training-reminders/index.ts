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

    /**
     * Per-recipient grouping
     * --------------------------------------------------
     * Each recipient (module recipient OR manager) accumulates a list of trainings
     * that should appear in HIS digest. We then emit ONE email per recipient
     * containing a single {{records_table}} with all their records, instead of
     * one email per training.
     *
     * Idempotency (`repeat_days_after`) is still evaluated per-training so that a
     * training that was already emailed within the window is excluded from the
     * digest of EVERY recipient (it stays out of the table and we count it once
     * in `totalSkipped`).
     */
    interface DigestRow {
      trainingId: string;
      employeeName: string;
      employeeEmail: string;
      trainingName: string;
      nextDate: Date;
      nextDateFormatted: string;
      daysUntil: number;
      statusColor: string;
      daysLabel: string;
      template: ReminderTemplate;
    }

    // Map<recipientEmail, { rows: DigestRow[], type: "module" | "manager", managerName?: string }>
    const moduleDigest = new Map<string, DigestRow[]>();
    const managerDigest = new Map<string, { rows: DigestRow[]; firstName: string; lastName: string }>();

    // Pre-load managers (only if manager notifications are enabled)
    let managers: Array<{ id: string; email: string; first_name: string; last_name: string; employee_id: string }> = [];
    const subordinatesCache = new Map<string, Set<string>>();

    if (managerNotifications.enabled) {
      const { data: managerProfiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, employee_id")
        .not("employee_id", "is", null);

      if (managerProfiles && managerProfiles.length > 0) {
        const { data: managerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "manager"])
          .in("user_id", managerProfiles.map((p) => p.id));

        const managerUserIds = new Set(managerRoles?.map((r) => r.user_id) || []);
        managers = managerProfiles
          .filter((p) => managerUserIds.has(p.id) && p.employee_id)
          .map((p) => ({ ...p, employee_id: p.employee_id! }));

        for (const mgr of managers) {
          const { data: subs } = await supabase.rpc("get_subordinate_employee_ids", {
            root_employee_id: mgr.employee_id,
          });
          subordinatesCache.set(mgr.id, new Set((subs || []).map((s: any) => s.employee_id)));
        }
      }
    }

    for (const training of allTrainings as Training[]) {
      const nextDate = new Date(training.next_training_date);
      nextDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const remindDaysBefore = training.remind_days_before ?? 30;

      // Only process if within the reminder window (including past-due)
      if (daysUntil > remindDaysBefore) continue;

      // Resolve template (fallback to default)
      const template = (training.reminder_template_id && templateMap.has(training.reminder_template_id))
        ? templateMap.get(training.reminder_template_id)!
        : defaultTemplate;

      // Idempotency check via repeat_days_after
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
          console.log(
            `Skipping training ${training.id}: already sent on ${recentLogs[0].created_at} (repeat_days_after=${repeatDaysAfter})`,
          );
          totalSkipped++;
          continue;
        }
      }

      // Build digest row
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
      const employeeEmail = employee?.email || "";
      const nextDateFormatted = nextDate.toLocaleDateString("cs-CZ");
      const statusColor = daysUntil < 0 ? "#ef4444" : daysUntil <= 7 ? "#f59e0b" : "#22c55e";
      const absDays = Math.abs(daysUntil);
      const daysUnit = absDays === 1 ? "den" : (absDays >= 2 && absDays <= 4) ? "dny" : "dnů";
      const daysLabel = daysUntil < 0 ? `${absDays} ${daysUnit} po termínu` : `${daysUntil} ${daysUnit}`;

      const row: DigestRow = {
        trainingId: training.id,
        employeeName,
        employeeEmail,
        trainingName,
        nextDate,
        nextDateFormatted,
        daysUntil,
        statusColor,
        daysLabel,
        template,
      };

      // Append to module recipients' digest
      for (const email of moduleRecipientEmails) {
        if (!moduleDigest.has(email)) moduleDigest.set(email, []);
        moduleDigest.get(email)!.push(row);
      }

      // Append to manager digests (only if employee is subordinate)
      for (const mgr of managers) {
        if (moduleRecipientEmails.includes(mgr.email.toLowerCase())) continue;
        const subs = subordinatesCache.get(mgr.id);
        if (!subs || subs.size <= 1) continue;
        if (!subs.has(training.employee_id)) continue;

        const key = mgr.email.toLowerCase();
        if (!managerDigest.has(key)) {
          managerDigest.set(key, { rows: [], firstName: mgr.first_name, lastName: mgr.last_name });
        }
        managerDigest.get(key)!.rows.push(row);
      }
    }

    /**
     * Render a multi-row records_table for a digest.
     */
    const buildRecordsTable = (rows: DigestRow[]): string => {
      const tbody = rows
        .map(
          (r) => `
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 10px;">${r.employeeName}</td>
              <td style="border: 1px solid #e5e7eb; padding: 10px;">${r.employeeEmail}</td>
              <td style="border: 1px solid #e5e7eb; padding: 10px;">${r.trainingName}</td>
              <td style="border: 1px solid #e5e7eb; padding: 10px;">${r.nextDateFormatted}</td>
              <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">
                <span style="background-color: ${r.statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                  ${r.daysLabel}
                </span>
              </td>
            </tr>`,
        )
        .join("");
      return `
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
          <tbody>${tbody}</tbody>
        </table>`;
    };

    /**
     * Send a digest email and write one reminder_logs row per included training.
     */
    const sendDigest = async (
      recipientEmails: string[],
      rows: DigestRow[],
      mode: "bcc" | "to" | "cc",
      digestType: "module_recipients" | "manager_notification",
      managerName?: string,
    ) => {
      if (rows.length === 0 || recipientEmails.length === 0) return;

      // Pick the first row's template for subject/body (records share template via filter)
      // For mixed templates, fallback to default template's subject/body.
      const template = rows[0].template;
      const tableHtml = buildRecordsTable(rows);
      const totalCount = rows.length;
      const expiredCount = rows.filter((r) => r.daysUntil < 0).length;
      const expiringCount = totalCount - expiredCount;

      const subjectVars = (s: string) =>
        s
          .replace(/\{\{training_name\}\}/g, totalCount === 1 ? rows[0].trainingName : `${totalCount} školení`)
          .replace(/\{\{employee_name\}\}/g, totalCount === 1 ? rows[0].employeeName : `${totalCount} zaměstnanců`)
          .replace(/\{\{days_remaining\}\}/g, totalCount === 1 ? String(rows[0].daysUntil) : "—")
          .replace(/\{totalCount\}/g, String(totalCount))
          .replace(/\{expiringCount\}/g, String(expiringCount))
          .replace(/\{expiredCount\}/g, String(expiredCount));

      const greeting = managerName ? `<p>Dobrý den, ${managerName},</p>` : "";
      const subject = subjectVars(template.email_subject);
      const bodyText = subjectVars(template.email_body).replace(/\{\{records_table\}\}/g, tableHtml);
      const templateHasRecordsTable = /\{\{records_table\}\}/.test(template.email_body);

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
          ${greeting}
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            ${bodyText.split("\n").map((line) => `<p style="margin: 8px 0;">${line}</p>`).join("")}
          </div>
          ${templateHasRecordsTable ? "" : tableHtml}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px;">
            Tento email byl odeslán automaticky systémem evidence školení.
          </p>
        </div>`;

      try {
        const result = await sendViaSMTP(recipientEmails, subject, htmlBody, mode, emailProvider);

        if (result.success) {
          totalEmailsSent++;
          // Log per-training so dedup (repeat_days_after) sees each record
          for (const r of rows) {
            await supabase.from("reminder_logs").insert({
              training_id: r.trainingId,
              template_id: r.template.id,
              template_name: r.template.name,
              recipient_emails: recipientEmails,
              email_subject: subject,
              email_body: bodyText,
              status: "sent",
              provider_used: "smtp",
              delivery_mode: mode,
            });
          }
          results.push({
            type: digestType,
            recipients: recipientEmails,
            records: rows.length,
            status: "sent",
          });
        } else {
          throw new Error(result.error);
        }
      } catch (emailError: any) {
        console.error(`Failed to send digest to ${recipientEmails.join(",")}:`, emailError);
        for (const r of rows) {
          await supabase.from("reminder_logs").insert({
            training_id: r.trainingId,
            template_id: r.template.id,
            template_name: r.template.name,
            recipient_emails: recipientEmails,
            email_subject: subject,
            email_body: bodyText,
            status: "failed",
            error_message: emailError.message,
            provider_used: "smtp",
            delivery_mode: mode,
          });
        }
        results.push({
          type: digestType,
          recipients: recipientEmails,
          records: rows.length,
          status: "failed",
          error: emailError.message,
        });
      }
    };

    // 1) Module recipients: all share the same recipient list, one digest with merged rows
    if (moduleRecipientEmails.length > 0) {
      // Merge digest rows by training_id (deduplicate; module recipients all see the same set)
      const seen = new Set<string>();
      const merged: DigestRow[] = [];
      for (const rows of moduleDigest.values()) {
        for (const r of rows) {
          if (seen.has(r.trainingId)) continue;
          seen.add(r.trainingId);
          merged.push(r);
        }
      }
      if (merged.length > 0) {
        await sendDigest(moduleRecipientEmails, merged, deliveryMode as any, "module_recipients");
      }
    }

    // 2) Manager digests: one email per manager
    for (const [email, digest] of managerDigest.entries()) {
      if (digest.rows.length === 0) continue;
      await sendDigest([email], digest.rows, "to", "manager_notification", `${digest.firstName} ${digest.lastName}`);
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
