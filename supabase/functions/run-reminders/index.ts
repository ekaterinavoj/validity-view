import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface SystemSetting {
  key: string;
  value: any;
}

interface TrainingItem {
  id: string;
  next_training_date: string;
  employee_first_name: string;
  employee_last_name: string;
  employee_email: string;
  training_type_name: string;
  days_until: number;
}

interface Recipient {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

// Get the start of the current week (Monday) or run period
function getRunPeriodKey(frequencyType: string, intervalDays: number): string {
  const now = new Date();
  
  if (frequencyType === "daily") {
    return now.toISOString().split("T")[0];
  }
  
  // For weekly/biweekly/monthly/custom, use week start
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

// Calculate days until expiration
function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Format date to Czech format
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("cs-CZ");
}

// Replace template variables for summary email
function replaceVariables(
  template: string, 
  totalCount: number, 
  expiringCount: number, 
  expiredCount: number
): string {
  const today = new Date();
  return template
    .replace(/{totalCount}/g, String(totalCount))
    .replace(/{expiringCount}/g, String(expiringCount))
    .replace(/{expiredCount}/g, String(expiredCount))
    .replace(/{reportDate}/g, formatDate(today.toISOString()));
}

// Build HTML table for trainings list
function buildTrainingsTable(trainings: TrainingItem[]): string {
  if (trainings.length === 0) {
    return "<p>Žádná školení k zobrazení.</p>";
  }

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
    const statusText = t.days_until < 0 ? "Prošlé" : t.days_until <= 7 ? "Urgentní" : "Brzy";
    
    html += `
      <tr>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${t.employee_first_name} ${t.employee_last_name}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${t.employee_email}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${t.training_type_name}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${formatDate(t.next_training_date)}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">
          <span style="background-color: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            ${t.days_until} dní
          </span>
        </td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  return html;
}

// Send email via Resend with BCC/To/CC support
async function sendViaResend(
  recipients: string[], 
  subject: string, 
  body: string, 
  deliveryMode: string,
  fromEmail?: string, 
  fromName?: string
): Promise<{ success: boolean; error?: string; provider: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured", provider: "resend" };
  }

  try {
    const emailPayload: any = {
      from: `${fromName || "Training System"} <${fromEmail || "onboarding@resend.dev"}>`,
      subject,
      html: body,
    };

    // Set recipients based on delivery mode
    if (deliveryMode === "bcc") {
      emailPayload.to = [fromEmail || "onboarding@resend.dev"]; // Send to self
      emailPayload.bcc = recipients;
    } else if (deliveryMode === "cc") {
      emailPayload.to = [recipients[0]];
      if (recipients.length > 1) {
        emailPayload.cc = recipients.slice(1);
      }
    } else {
      // "to" mode
      emailPayload.to = recipients;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error, provider: "resend" };
    }

    return { success: true, provider: "resend" };
  } catch (error: any) {
    return { success: false, error: error.message, provider: "resend" };
  }
}

// Send email with provider selection
async function sendEmail(
  recipients: string[],
  subject: string,
  body: string,
  deliveryMode: string,
  emailProvider: any
): Promise<{ success: boolean; error?: string; provider: string }> {
  // For now, only Resend is fully implemented with BCC support
  return await sendViaResend(
    recipients, 
    subject, 
    body, 
    deliveryMode,
    emailProvider.smtp_from_email, 
    emailProvider.smtp_from_name
  );
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authorization
  const cronSecret = req.headers.get("x-cron-secret");
  const envCronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization");
  
  const isCronRequest = cronSecret && envCronSecret && cronSecret === envCronSecret;
  const isAuthenticatedRequest = authHeader?.startsWith("Bearer ");
  
  if (!isCronRequest && !isAuthenticatedRequest) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let triggeredBy = "cron";
  let testMode = false;

  try {
    // Get trigger type and test mode from body if provided
    const body = await req.json().catch(() => ({}));
    if (body.triggered_by) {
      triggeredBy = body.triggered_by;
    }
    if (body.test_mode === true) {
      testMode = true;
      triggeredBy = triggeredBy === "cron" ? "test" : `${triggeredBy}_test`;
    }
  } catch {
    // No body or invalid JSON, use default
  }

  console.log(`Starting reminder run: triggered_by=${triggeredBy}, test_mode=${testMode}`);

  // Load all settings
  const { data: settings, error: settingsError } = await supabase
    .from("system_settings")
    .select("key, value");

  if (settingsError) {
    console.error("Failed to load settings:", settingsError);
    return new Response(
      JSON.stringify({ error: "Failed to load settings" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const settingsMap: Record<string, any> = {};
  settings?.forEach((s: SystemSetting) => {
    settingsMap[s.key] = s.value;
  });

  const reminderSchedule = settingsMap.reminder_schedule || { enabled: true, skip_weekends: true };
  const reminderDays = settingsMap.reminder_days || { days_before: [30, 14, 7] };
  const reminderFrequency = settingsMap.reminder_frequency || { type: "weekly", interval_days: 7 };
  const reminderRecipients = settingsMap.reminder_recipients || { user_ids: [], delivery_mode: "bcc" };
  const emailProvider = settingsMap.email_provider || { provider: "resend" };
  const emailTemplate = settingsMap.email_template || {
    subject: "Souhrn školení k obnovení - {reportDate}",
    body: "Dobrý den,\n\nzasíláme přehled školení vyžadujících pozornost.\n\nCelkem: {totalCount} školení\n- Brzy vypršuje: {expiringCount}\n- Prošlé: {expiredCount}",
  };

  // Get run period key for idempotency
  const runPeriodKey = getRunPeriodKey(reminderFrequency.type, reminderFrequency.interval_days);

  // Check if reminders are enabled
  if (!reminderSchedule.enabled) {
    console.log("Reminders are disabled");
    return new Response(
      JSON.stringify({ message: "Reminders are disabled", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Check if today is weekend and skip_weekends is enabled
  const today = new Date().getDay();
  if (reminderSchedule.skip_weekends && (today === 0 || today === 6)) {
    console.log("Skipped - weekend");
    return new Response(
      JSON.stringify({ message: "Skipped - weekend", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Check for recipients
  if (!reminderRecipients.user_ids || reminderRecipients.user_ids.length === 0) {
    console.log("No recipients configured");
    return new Response(
      JSON.stringify({ message: "No recipients configured", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Create run record
  const { data: runData, error: runError } = await supabase
    .from("reminder_runs")
    .insert({
      week_start: runPeriodKey,
      triggered_by: triggeredBy,
      status: "running",
    })
    .select()
    .single();

  if (runError) {
    console.error("Failed to create run record:", runError);
    return new Response(
      JSON.stringify({ error: "Failed to create run record" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const runId = runData.id;
  let emailsSent = 0;
  let emailsFailed = 0;
  const errors: string[] = [];

  try {
    // Check idempotency - have we already sent for this period?
    const { data: existingRun } = await supabase
      .from("reminder_logs")
      .select("id")
      .eq("week_start", runPeriodKey)
      .eq("is_test", testMode)
      .limit(1);

    if (existingRun && existingRun.length > 0 && !testMode) {
      console.log(`Already sent for period ${runPeriodKey}, skipping`);
      await supabase
        .from("reminder_runs")
        .update({
          status: "success",
          ended_at: new Date().toISOString(),
          error_message: "Already sent for this period",
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({ message: "Already sent for this period", emailsSent: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get recipients from profiles
    const { data: recipientProfiles, error: recipientsError } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .in("id", reminderRecipients.user_ids);

    if (recipientsError || !recipientProfiles || recipientProfiles.length === 0) {
      console.error("No valid recipients found:", recipientsError);
      await supabase
        .from("reminder_runs")
        .update({
          status: "failed",
          ended_at: new Date().toISOString(),
          error_message: "No valid recipients found",
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({ error: "No valid recipients found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const recipientEmails = recipientProfiles.map(r => r.email);

    // Collect all trainings that need attention
    const daysBeforeList: number[] = reminderDays.days_before;
    const allTrainings: TrainingItem[] = [];
    
    // Get trainings expiring within the configured days
    const maxDays = Math.max(...daysBeforeList);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + maxDays);
    const targetDateStr = targetDate.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];

    // Get all active trainings expiring between now and maxDays from now (or already expired)
    const { data: trainingsRaw, error: trainingsError } = await supabase
      .from("trainings")
      .select(`
        id,
        next_training_date,
        employee_id,
        training_type_id
      `)
      .eq("is_active", true)
      .lte("next_training_date", targetDateStr);

    if (trainingsError) {
      console.error("Error fetching trainings:", trainingsError);
      errors.push(`Error fetching trainings: ${trainingsError.message}`);
    } else {
      for (const trainingRaw of trainingsRaw || []) {
        const daysUntil = getDaysUntil(trainingRaw.next_training_date);
        
        // Include if expired (negative days) or within any of the configured thresholds
        const shouldInclude = daysUntil < 0 || daysBeforeList.some(d => daysUntil <= d);
        
        if (!shouldInclude) continue;

        // Fetch employee
        const { data: employee } = await supabase
          .from("employees")
          .select("id, first_name, last_name, email, status")
          .eq("id", trainingRaw.employee_id)
          .single();

        if (!employee) continue;
        
        // Only include active employees
        if (employee.status !== "employed") continue;

        // Fetch training type
        const { data: trainingType } = await supabase
          .from("training_types")
          .select("name")
          .eq("id", trainingRaw.training_type_id)
          .single();

        if (!trainingType) continue;

        allTrainings.push({
          id: trainingRaw.id,
          next_training_date: trainingRaw.next_training_date,
          employee_first_name: employee.first_name,
          employee_last_name: employee.last_name,
          employee_email: employee.email,
          training_type_name: trainingType.name,
          days_until: daysUntil,
        });
      }
    }

    // Sort by soonest expiration first, then by employee name
    allTrainings.sort((a, b) => {
      if (a.days_until !== b.days_until) {
        return a.days_until - b.days_until;
      }
      const nameA = `${a.employee_last_name} ${a.employee_first_name}`;
      const nameB = `${b.employee_last_name} ${b.employee_first_name}`;
      return nameA.localeCompare(nameB, "cs");
    });

    if (allTrainings.length === 0) {
      console.log("No trainings need attention");
      await supabase
        .from("reminder_runs")
        .update({
          status: "success",
          ended_at: new Date().toISOString(),
          emails_sent: 0,
          error_message: "No trainings need attention",
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({ message: "No trainings need attention", emailsSent: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Calculate counts
    const expiredCount = allTrainings.filter(t => t.days_until < 0).length;
    const expiringCount = allTrainings.filter(t => t.days_until >= 0).length;
    const totalCount = allTrainings.length;

    // Build email content
    const subject = replaceVariables(emailTemplate.subject, totalCount, expiringCount, expiredCount);
    const bodyText = replaceVariables(emailTemplate.body, totalCount, expiringCount, expiredCount);
    const trainingsTable = buildTrainingsTable(allTrainings);
    const fullBody = `${bodyText.replace(/\n/g, "<br>")}<br><br>${trainingsTable}`;

    // Send email (or simulate in test mode)
    let result: { success: boolean; error?: string; provider: string };
    if (testMode) {
      console.log(`[TEST MODE] Would send summary email to ${recipientEmails.length} recipients`);
      console.log(`[TEST MODE] Subject: ${subject}`);
      console.log(`[TEST MODE] Trainings count: ${totalCount}`);
      result = { success: true, provider: "simulated" };
    } else {
      result = await sendEmail(
        recipientEmails,
        subject,
        fullBody,
        reminderRecipients.delivery_mode,
        emailProvider
      );
    }

    // Log the reminder for each recipient
    for (const recipient of recipientProfiles) {
      await supabase.from("reminder_logs").insert({
        training_id: null, // Summary email, not per-training
        employee_id: null,
        days_before: null,
        week_start: runPeriodKey,
        is_test: testMode,
        provider_used: result.provider,
        recipient_emails: recipientEmails,
        email_subject: subject,
        email_body: fullBody,
        status: testMode ? "simulated" : (result.success ? "sent" : "failed"),
        error_message: result.error || null,
        template_name: `Summary to ${recipient.email}${testMode ? " (test)" : ""}`,
      });
    }

    if (result.success) {
      emailsSent = recipientEmails.length;
      console.log(`Summary email sent to ${emailsSent} recipients`);
    } else {
      emailsFailed = recipientEmails.length;
      errors.push(`Failed to send summary: ${result.error}`);
      console.error(`Failed to send summary email: ${result.error}`);
    }

    // Update run record
    await supabase
      .from("reminder_runs")
      .update({
        status: emailsFailed > 0 && emailsSent === 0 ? "failed" : "success",
        ended_at: new Date().toISOString(),
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        error_message: errors.length > 0 ? errors[0] : null,
        error_details: errors.length > 0 ? { errors, trainings_count: totalCount } : { trainings_count: totalCount },
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        emailsFailed,
        trainingsCount: totalCount,
        recipients: recipientEmails,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in run-reminders:", error);

    await supabase
      .from("reminder_runs")
      .update({
        status: "failed",
        ended_at: new Date().toISOString(),
        error_message: error.message,
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
