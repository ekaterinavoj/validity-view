import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSMTP } from "../_shared/smtp-sender.ts";
import { resolveReminderStage, ReminderStage } from "../_shared/reminder-cadence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface TrainingItem {
  id: string;
  next_training_date: string;
  employee_id: string;
  employee_first_name: string;
  employee_last_name: string;
  employee_email: string;
  training_type_name: string;
  reminder_template_id: string | null;
  days_until: number;
  remind_days_before: number;
  repeat_days_after: number;
  reminder_stage?: ReminderStage;
}

interface ReminderTemplate {
  id: string;
  name: string;
  email_subject: string;
  email_body: string;
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("cs-CZ");
}

function formatDaysLabel(days: number): string {
  const absDays = Math.abs(days);
  const unit = absDays === 1 ? "den" : absDays >= 2 && absDays <= 4 ? "dny" : "dnů";
  return days < 0 ? `${absDays} ${unit} po termínu` : `${days} ${unit}`;
}

// {{training_name}} etc. stay supported for backward compatibility with
// existing per-record templates; the digest also gets {totalCount} etc.
function replaceVariables(template: string, totalCount: number, expiringCount: number, expiredCount: number): string {
  return template
    .replace(/\{+totalCount\}+/g, String(totalCount))
    .replace(/\{+expiringCount\}+/g, String(expiringCount))
    .replace(/\{+expiredCount\}+/g, String(expiredCount))
    .replace(/\{+reportDate\}+/g, formatDate(new Date().toISOString()));
}

function buildTrainingsTable(trainings: TrainingItem[]): string {
  if (trainings.length === 0) return "<p>Žádná školení k zobrazení.</p>";

  let html = `
    <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
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
  `;

  for (const t of trainings) {
    const statusColor = t.days_until < 0 ? "#ef4444" : t.days_until <= 7 ? "#f59e0b" : "#22c55e";
    html += `
      <tr>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${t.employee_first_name} ${t.employee_last_name}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${t.employee_email}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${t.training_type_name}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${formatDate(t.next_training_date)}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">
          <span style="background-color: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            ${formatDaysLabel(t.days_until)}
          </span>
        </td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  return html;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

  // Optional test mode: send a real digest (built from live data) to one
  // address instead of the configured recipients, and skip manager fan-out.
  // Used by the "Odeslat náhled" test button.
  let testMode = false;
  let singleRecipientEmail: string | null = null;
  try {
    const body = await req.clone().json();
    testMode = body?.test_mode === true;
    singleRecipientEmail = typeof body?.single_recipient_email === "string" ? body.single_recipient_email : null;
  } catch {
    // no/invalid body - normal cron invocation
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting training reminder check...");

    // Re-check every active employee's age against milestone thresholds (currently: 50).
    // Runs on every scheduled invocation so it fires even when nobody has edited
    // the employee's record on their actual birthday (the DB trigger alone would miss it).
    try {
      await supabase.rpc("check_employee_age_milestones");
    } catch (ageCheckError) {
      console.error("check_employee_age_milestones failed:", ageCheckError);
    }

    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["email_provider", "reminder_recipients", "training_manager_notifications", "training_reminder_frequency"]);

    const settingsMap: Record<string, any> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value; });

    const emailProvider = settingsMap["email_provider"] || {};
    const recipients = testMode && singleRecipientEmail
      ? { user_ids: [], delivery_mode: "to" }
      : settingsMap["reminder_recipients"] || { user_ids: [], delivery_mode: "bcc" };
    const managerNotifications = testMode
      ? { enabled: false }
      : settingsMap["training_manager_notifications"] || { enabled: false };
    const trainingFrequency = settingsMap["training_reminder_frequency"] || { enabled: true, skip_weekends: false };

    if (!testMode && !trainingFrequency.enabled) {
      console.log("Training summary sending is disabled");
      return new Response(
        JSON.stringify({ message: "Training reminders are disabled in settings", total_emails_sent: 0, total_skipped: 0, results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!testMode && trainingFrequency.skip_weekends) {
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.log("Skipping training reminders - weekend");
        return new Response(
          JSON.stringify({ message: "Skipped - weekend", total_emails_sent: 0, total_skipped: 0, results: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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

    // Resolve recipient emails
    let recipientEmails: string[] = [];
    if (testMode && singleRecipientEmail) {
      recipientEmails = [singleRecipientEmail];
    } else if (recipients.user_ids && recipients.user_ids.length > 0) {
      const { data: recipientProfiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", recipients.user_ids);
      recipientEmails = [...new Set((recipientProfiles || []).map(p => p.email.toLowerCase()).filter(Boolean))];
    }

    if (recipientEmails.length === 0 && !managerNotifications.enabled) {
      console.log("No recipients configured and manager notifications disabled");
      return new Response(
        JSON.stringify({ message: "No recipients configured", total_emails_sent: 0, total_skipped: 0, results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Base subject/body come from reminder_templates (the first active one) —
    // matching Deadlines/PLP, which each have their own equivalent table. A
    // training may still override this with its own reminder_template_id.
    const { data: templates } = await supabase
      .from("reminder_templates")
      .select("id, name, email_subject, email_body")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const templateMap = new Map<string, ReminderTemplate>();
    let defaultTemplate: ReminderTemplate | null = null;
    for (const t of (templates as ReminderTemplate[] | null) || []) {
      templateMap.set(t.id, t);
      if (!defaultTemplate) defaultTemplate = t;
    }

    if (!defaultTemplate) {
      console.log("No active reminder templates found");
      return new Response(
        JSON.stringify({ message: "No active templates", total_emails_sent: 0, total_skipped: 0, results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all active, non-deleted trainings
    const { data: allTrainings } = await supabase
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

    if (!allTrainings || allTrainings.length === 0) {
      console.log("No active trainings found");
      return new Response(
        JSON.stringify({ message: "No active trainings", total_emails_sent: 0, total_skipped: 0, results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allItems: TrainingItem[] = allTrainings.map((t: any) => {
      const trainingType = Array.isArray(t.training_types) ? t.training_types[0] : t.training_types;
      const employee = Array.isArray(t.employees) ? t.employees[0] : t.employees;
      return {
        id: t.id,
        next_training_date: t.next_training_date,
        employee_id: t.employee_id,
        employee_first_name: employee?.first_name || "",
        employee_last_name: employee?.last_name || "",
        employee_email: employee?.email || "",
        training_type_name: trainingType?.name || "Neznámé školení",
        reminder_template_id: t.reminder_template_id,
        days_until: getDaysUntil(t.next_training_date),
        remind_days_before: t.remind_days_before ?? 30,
        repeat_days_after: t.repeat_days_after ?? 30,
      };
    });

    const eligibleItems = allItems.filter(t => t.days_until <= t.remind_days_before);

    if (eligibleItems.length === 0) {
      console.log("No trainings within their remind_days_before window");
      return new Response(
        JSON.stringify({ message: "No trainings require reminders", total_emails_sent: 0, total_skipped: 0, results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === CADENCE CHECK ===
    // Exactly one "before" reminder, exactly one "due" reminder, then repeats
    // every repeat_days_after days — see _shared/reminder-cadence.ts. Bypassed
    // in test mode so the preview button always has something to send.
    let totalSkipped = 0;
    const trainingItems: TrainingItem[] = [];

    for (const item of eligibleItems) {
      const { data: recentLogs } = await supabase
        .from("reminder_logs")
        .select("reminder_stage, created_at")
        .eq("training_id", item.id)
        .eq("status", "sent")
        .eq("is_test", false)
        .order("created_at", { ascending: false })
        .limit(20);

      const resolvedStage = resolveReminderStage(item.days_until, item.remind_days_before, item.repeat_days_after, recentLogs || []);
      if (!testMode && !resolvedStage) {
        totalSkipped++;
        continue;
      }

      trainingItems.push({ ...item, reminder_stage: resolvedStage ?? "before" });
    }

    if (trainingItems.length === 0) {
      console.log(`All trainings skipped by deduplication (${totalSkipped} skipped)`);
      return new Response(
        JSON.stringify({ message: "All trainings were skipped (already reminded recently)", total_emails_sent: 0, total_skipped: totalSkipped, results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const expiredItems = trainingItems.filter(t => t.days_until < 0);
    const expiringItems = trainingItems.filter(t => t.days_until >= 0);

    let totalEmailsSent = 0;
    const results: any[] = [];

    // 1) Main digest to configured recipients
    if (recipientEmails.length > 0) {
      const subjectTpl = (testMode ? "[TEST] " : "") + defaultTemplate.email_subject;
      const subject = replaceVariables(subjectTpl, trainingItems.length, expiringItems.length, expiredItems.length);
      const bodyText = replaceVariables(defaultTemplate.email_body, trainingItems.length, expiringItems.length, expiredItems.length);
      const tableHtml = buildTrainingsTable(trainingItems);
      const fullBody = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
          ${greeting}
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            ${bodyText.replace(/\n/g, "<br>")}
          </div>
          ${tableHtml}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px;">Tento email byl odeslán automaticky systémem evidence školení.</p>
        </div>
      `;

      const result = await sendViaSMTP(recipientEmails, subject, fullBody, recipients.delivery_mode || "bcc", emailProvider);

      // One log row per training in the digest, so each keeps its own
      // before/due/overdue cadence regardless of what else was bundled with it.
      await supabase.from("reminder_logs").insert(trainingItems.map(t => ({
        training_id: t.id,
        template_id: (t.reminder_template_id && templateMap.has(t.reminder_template_id) ? templateMap.get(t.reminder_template_id)! : defaultTemplate!).id,
        template_name: "Souhrn školení",
        recipient_emails: recipientEmails,
        email_subject: subject,
        email_body: fullBody,
        status: result.success ? "sent" : "failed",
        reminder_stage: t.reminder_stage,
        is_test: testMode,
        error_message: result.error || null,
        provider_used: "smtp",
        delivery_mode: recipients.delivery_mode || "bcc",
      })));

      if (result.success) {
        totalEmailsSent++;
        console.log(`Sent training digest to ${recipientEmails.length} recipients with ${trainingItems.length} trainings`);
      } else {
        console.error("Failed to send training digest:", result.error);
      }
      results.push({ type: "digest", count: trainingItems.length, recipients: recipientEmails.length, status: result.success ? "sent" : "failed" });
    }

    // 2) Manager notifications - one bundled email per manager covering only
    //    their subordinates' trainings, skipped in test mode.
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
          .in("user_id", managerProfiles.map(p => p.id));

        const managerUserIds = new Set(managerRoles?.map(r => r.user_id) || []);
        const managers = managerProfiles.filter(p => managerUserIds.has(p.id) && p.employee_id);

        for (const manager of managers) {
          if (recipientEmails.includes(manager.email.toLowerCase())) continue;

          const { data: subordinates } = await supabase.rpc("get_subordinate_employee_ids_for_service", {
            root_employee_id: manager.employee_id!,
          });
          if (!subordinates || subordinates.length <= 1) continue;

          const subordinateIds = subordinates.map((s: any) => s.employee_id);
          const managerTrainings = trainingItems.filter(t => subordinateIds.includes(t.employee_id));
          if (managerTrainings.length === 0) continue;

          const mgrExpired = managerTrainings.filter(t => t.days_until < 0);
          const mgrExpiring = managerTrainings.filter(t => t.days_until >= 0);
          const mgrSubject = `Školení vašich zaměstnanců (${managerTrainings.length})`;
          const mgrTableHtml = buildTrainingsTable(managerTrainings);
          const mgrBody = `
            <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <p>Dobrý den, ${manager.first_name} ${manager.last_name},</p>
                <p>následující školení vašich podřízených vyžadují pozornost:</p>
                <p>Celkem: <strong>${managerTrainings.length}</strong> (prošlé: ${mgrExpired.length}, blížící se: ${mgrExpiring.length})</p>
              </div>
              ${mgrTableHtml}
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #9ca3af; font-size: 12px;">Tento email byl odeslán automaticky systémem evidence školení.</p>
            </div>
          `;

          const mgrResult = await sendViaSMTP([manager.email], mgrSubject, mgrBody, "to", emailProvider);

          await supabase.from("reminder_logs").insert(managerTrainings.map(t => ({
            training_id: t.id,
            template_id: defaultTemplate!.id,
            template_name: "Manager notification",
            recipient_emails: [manager.email],
            email_subject: mgrSubject,
            email_body: mgrBody,
            status: mgrResult.success ? "sent" : "failed",
            reminder_stage: t.reminder_stage,
            is_test: false,
            error_message: mgrResult.error || null,
            provider_used: "smtp",
            delivery_mode: "to",
          })));

          if (mgrResult.success) {
            totalEmailsSent++;
            console.log(`Sent manager notification to ${manager.email} with ${managerTrainings.length} trainings`);
          } else {
            console.error(`Failed manager notification to ${manager.email}: ${mgrResult.error}`);
          }
          results.push({ type: "manager_notification", manager_email: manager.email, count: managerTrainings.length, status: mgrResult.success ? "sent" : "failed" });
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
      JSON.stringify({ message: "Reminder check completed", total_emails_sent: totalEmailsSent, total_skipped: totalSkipped, results }),
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
