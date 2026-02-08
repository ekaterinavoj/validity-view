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

// Check if it's time to send based on frequency settings
function isDueNow(frequency: any, schedule: any): { isDue: boolean; reason: string } {
  const timezone = frequency.timezone || "Europe/Prague";
  const startTime = frequency.start_time || "08:00";
  const frequencyType = frequency.type || "weekly";
  const intervalDays = frequency.interval_days || 7;
  const enabled = frequency.enabled !== false; // Default to true if not set
  
  // Check if enabled
  if (!enabled) {
    return { isDue: false, reason: "Frequency is disabled" };
  }
  
  // Check if schedule is enabled
  if (schedule.enabled === false) {
    return { isDue: false, reason: "Schedule is disabled" };
  }
  
  // Get current time in configured timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  });
  const parts = formatter.formatToParts(now);
  const currentHour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  const currentMinute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
  const currentWeekday = parts.find(p => p.type === "weekday")?.value || "";
  
  // Parse start time
  const [targetHour, targetMinute] = startTime.split(":").map(Number);
  
  // Check if within the send window (within 1 hour of start time)
  const currentMinutes = currentHour * 60 + currentMinute;
  const targetMinutes = targetHour * 60 + targetMinute;
  const minutesDiff = currentMinutes - targetMinutes;
  
  // Only send within 59 minutes after start time
  if (minutesDiff < 0 || minutesDiff > 59) {
    return { isDue: false, reason: `Not within send window (current: ${currentHour}:${currentMinute}, target: ${startTime})` };
  }
  
  // Check skip_weekends
  if (schedule.skip_weekends) {
    const weekdayNames = ["Sunday", "Saturday"];
    if (weekdayNames.includes(currentWeekday)) {
      return { isDue: false, reason: "Weekend - skipped" };
    }
  }
  
  // For weekly frequency, check day of week
  if (frequencyType === "weekly" || frequencyType === "biweekly") {
    const dayOfWeek = schedule.day_of_week ?? 1; // Default Monday
    const weekdayMap: Record<number, string> = {
      0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
      4: "Thursday", 5: "Friday", 6: "Saturday"
    };
    const targetWeekday = weekdayMap[dayOfWeek];
    if (currentWeekday !== targetWeekday) {
      return { isDue: false, reason: `Not the configured day (current: ${currentWeekday}, target: ${targetWeekday})` };
    }
  }
  
  // For daily, monthly, custom - just check time window (already checked above)
  return { isDue: true, reason: "Due now" };
}

// Get the run period key for idempotency
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

// Format days with correct Czech grammar
function formatDaysLabel(days: number): string {
  const absDays = Math.abs(days);
  let unit: string;
  
  if (absDays === 1) {
    unit = "den";
  } else if (absDays >= 2 && absDays <= 4) {
    unit = "dny";
  } else {
    unit = "dnů";
  }
  
  if (days < 0) {
    return `${absDays} ${unit} po termínu`;
  }
  return `${days} ${unit}`;
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

  html += `
      </tbody>
    </table>
  `;

  return html;
}

// Transient error patterns that should trigger retry
const TRANSIENT_ERROR_PATTERNS = [
  /timeout/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /socket hang up/i,
  /network/i,
  /rate.?limit/i,
  /too many requests/i,
  /5\d{2}/,  // 5xx errors
  /temporarily unavailable/i,
  /service unavailable/i,
  /internal server error/i,
  /bad gateway/i,
  /gateway timeout/i,
];

// Permanent error patterns that should NOT retry
const PERMANENT_ERROR_PATTERNS = [
  /invalid.*(email|recipient|address)/i,
  /unverified/i,
  /bounced/i,
  /blocked/i,
  /unauthorized/i,
  /forbidden/i,
  /authentication/i,
  /invalid.?api.?key/i,
  /not configured/i,
  /missing.*key/i,
  /bad request/i,
  /invalid.*domain/i,
  /domain not verified/i,
];

function isTransientError(error: string): boolean {
  // Check permanent errors first - these should never retry
  if (PERMANENT_ERROR_PATTERNS.some(pattern => pattern.test(error))) {
    return false;
  }
  // Check if matches transient patterns
  return TRANSIENT_ERROR_PATTERNS.some(pattern => pattern.test(error));
}

function calculateBackoffDelay(attempt: number): number {
  // Exponential backoff: 30s, 2min, 10min with jitter
  const baseDelays = [30000, 120000, 600000]; // 30s, 2min, 10min
  const delay = baseDelays[attempt - 1] || baseDelays[baseDelays.length - 1];
  // Add jitter: +/- 20% of delay
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send email via Resend with BCC/To/CC support
async function sendViaResend(
  recipients: string[], 
  subject: string, 
  body: string, 
  deliveryMode: string,
  fromEmail?: string, 
  fromName?: string
): Promise<{ success: boolean; error?: string; provider: string; statusCode?: number }> {
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
      return { success: false, error, provider: "resend", statusCode: response.status };
    }

    return { success: true, provider: "resend" };
  } catch (error: any) {
    return { success: false, error: error.message, provider: "resend" };
  }
}

interface SendEmailResult {
  success: boolean;
  error?: string;
  provider: string;
  attempts: number;
  attemptErrors: string[];
}

// Send email with provider selection and exponential backoff retry
async function sendEmail(
  recipients: string[],
  subject: string,
  body: string,
  deliveryMode: string,
  emailProvider: any,
  maxAttempts: number = 3
): Promise<SendEmailResult> {
  const attemptErrors: string[] = [];
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Email send attempt ${attempt}/${maxAttempts}`);
    
    const result = await sendViaResend(
      recipients, 
      subject, 
      body, 
      deliveryMode,
      emailProvider.smtp_from_email, 
      emailProvider.smtp_from_name
    );
    
    if (result.success) {
      return {
        success: true,
        provider: result.provider,
        attempts: attempt,
        attemptErrors,
      };
    }
    
    const errorMsg = `Attempt ${attempt}: ${result.error || "Unknown error"}`;
    attemptErrors.push(errorMsg);
    console.log(`Attempt ${attempt} failed: ${result.error}`);
    
    // Check if this is a permanent error - don't retry
    if (!isTransientError(result.error || "")) {
      console.log(`Permanent error detected, not retrying: ${result.error}`);
      return {
        success: false,
        error: result.error,
        provider: result.provider,
        attempts: attempt,
        attemptErrors,
      };
    }
    
    // If not last attempt, wait before retrying
    if (attempt < maxAttempts) {
      const delay = calculateBackoffDelay(attempt);
      console.log(`Transient error, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  // All attempts exhausted
  return {
    success: false,
    error: attemptErrors[attemptErrors.length - 1],
    provider: "resend",
    attempts: maxAttempts,
    attemptErrors,
  };
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
  let forceRun = false; // Manual runs bypass "due now" check
  let resendLogId: string | null = null;
  let singleRecipientEmail: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    if (body.triggered_by) {
      triggeredBy = body.triggered_by;
      // Manual triggers bypass the "due now" check
      if (triggeredBy === "manual" || triggeredBy.startsWith("manual") || triggeredBy === "resend" || triggeredBy === "single_test") {
        forceRun = true;
      }
    }
    if (body.test_mode === true) {
      testMode = true;
      triggeredBy = triggeredBy === "cron" ? "test" : `${triggeredBy}_test`;
    }
    if (body.force === true) {
      forceRun = true;
    }
    if (body.resend_log_id) {
      resendLogId = body.resend_log_id;
    }
    if (body.single_recipient_email) {
      singleRecipientEmail = body.single_recipient_email;
    }
  } catch {
    // No body or invalid JSON, use default
  }

  console.log(`Starting reminder run: triggered_by=${triggeredBy}, test_mode=${testMode}, force=${forceRun}, resend_log_id=${resendLogId}, single_recipient=${singleRecipientEmail}`);

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
  const reminderFrequency = settingsMap.reminder_frequency || { type: "weekly", interval_days: 7, enabled: true };
  const reminderRecipients = settingsMap.reminder_recipients || { user_ids: [], delivery_mode: "bcc" };
  const emailProvider = settingsMap.email_provider || { provider: "resend" };
  const emailTemplate = settingsMap.email_template || {
    subject: "Souhrn školení k obnovení - {reportDate}",
    body: "Dobrý den,\n\nzasíláme přehled školení vyžadujících pozornost.\n\nCelkem: {totalCount} školení\n- Brzy vypršuje: {expiringCount}\n- Prošlé: {expiredCount}",
  };

  // Check if frequency is enabled
  if (reminderFrequency.enabled === false) {
    console.log("Reminder frequency is disabled");
    return new Response(
      JSON.stringify({ message: "Reminder frequency is disabled", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Check if schedule is enabled
  if (!reminderSchedule.enabled) {
    console.log("Reminders are disabled");
    return new Response(
      JSON.stringify({ message: "Reminders are disabled", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Handle resend of a failed email
  if (resendLogId) {
    console.log(`Resending failed email from log: ${resendLogId}`);
    
    // Fetch the original log entry
    const { data: originalLog, error: logError } = await supabase
      .from("reminder_logs")
      .select("*")
      .eq("id", resendLogId)
      .single();
    
    if (logError || !originalLog) {
      console.error("Failed to fetch original log:", logError);
      return new Response(
        JSON.stringify({ error: "Original log not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Only allow resending failed emails
    if (originalLog.status !== "failed") {
      return new Response(
        JSON.stringify({ error: "Only failed emails can be resent" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Send the email using the original content with retry
    const deliveryMode = originalLog.delivery_mode || "bcc";
    const result = await sendEmail(
      originalLog.recipient_emails,
      originalLog.email_subject,
      originalLog.email_body,
      deliveryMode,
      emailProvider,
      3 // Max 3 retry attempts
    );
    
    // Log the resend attempt with reference to original and attempt history
    await supabase.from("reminder_logs").insert({
      training_id: null,
      employee_id: null,
      days_before: null,
      week_start: originalLog.week_start,
      is_test: false,
      provider_used: result.provider,
      recipient_emails: originalLog.recipient_emails,
      email_subject: originalLog.email_subject,
      email_body: originalLog.email_body,
      status: result.success ? "resent" : "failed",
      error_message: result.success ? null : result.attemptErrors.join(" | "),
      template_name: `Resend`,
      delivery_mode: deliveryMode,
      resent_from_log_id: resendLogId, // Audit trail reference
      attempt_number: result.attempts,
      max_attempts: 3,
      attempt_errors: result.attemptErrors.length > 0 ? result.attemptErrors : null,
      final_status: result.success ? "sent" : "failed",
    });
    
    return new Response(
      JSON.stringify({
        success: result.success,
        emailsSent: result.success ? originalLog.recipient_emails.length : 0,
        emailsFailed: result.success ? 0 : originalLog.recipient_emails.length,
        resent: true,
        originalLogId: resendLogId,
        error: result.error,
        attempts: result.attempts,
        attemptErrors: result.attemptErrors,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Check "due now" logic for cron triggers (not manual)
  if (!forceRun) {
    const dueCheck = isDueNow(reminderFrequency, reminderSchedule);
    if (!dueCheck.isDue) {
      console.log(`Not due: ${dueCheck.reason}`);
      return new Response(
        JSON.stringify({ message: `Not due: ${dueCheck.reason}`, emailsSent: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    console.log(`Due check passed: ${dueCheck.reason}`);
  }

  // Server-side validation of recipients - only existing users, deduplicated
  const rawUserIds: string[] = reminderRecipients.user_ids || [];
  const uniqueUserIds = [...new Set(rawUserIds)]; // Remove duplicates

  if (uniqueUserIds.length === 0) {
    console.log("No recipients configured");
    return new Response(
      JSON.stringify({ 
        success: false,
        info: "Nejsou nakonfigurováni žádní příjemci připomínek. Přejděte do Nastavení → Příjemci připomínek a přidejte alespoň jednoho uživatele.",
        warning: "Please configure reminder recipients in Admin Settings",
        emailsSent: 0 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Validate user IDs exist in profiles
  const { data: validProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name")
    .in("id", uniqueUserIds);

  if (profilesError) {
    console.error("Failed to validate recipients:", profilesError);
    return new Response(
      JSON.stringify({ error: "Failed to validate recipients" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Filter to only valid users
  const validUserIds = validProfiles?.map(p => p.id) || [];
  const invalidUserIds = uniqueUserIds.filter(id => !validUserIds.includes(id));
  
  if (invalidUserIds.length > 0) {
    console.log(`Ignoring ${invalidUserIds.length} invalid user IDs: ${invalidUserIds.join(", ")}`);
  }

  if (validProfiles?.length === 0) {
    console.log("No valid recipients after validation");
    return new Response(
      JSON.stringify({ 
        error: "No valid recipients", 
        warning: "All configured recipients are invalid. Please update in Admin Settings",
        emailsSent: 0 
      }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const recipientEmails = validProfiles!.map(r => r.email);

  // Get run period key for idempotency
  const runPeriodKey = getRunPeriodKey(reminderFrequency.type, reminderFrequency.interval_days);

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

    if (existingRun && existingRun.length > 0 && !testMode && !forceRun) {
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

    // Collect all trainings that need attention
    const daysBeforeList: number[] = reminderDays.days_before;
    const allTrainings: TrainingItem[] = [];
    
    const maxDays = Math.max(...daysBeforeList);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + maxDays);
    const targetDateStr = targetDate.toISOString().split("T")[0];

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
        
        // Only include active employees (status = 'employed')
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

    // Build email content - add TEST: prefix for test mode
    const deliveryMode = reminderRecipients.delivery_mode || "bcc";
    const baseSubject = replaceVariables(emailTemplate.subject, totalCount, expiringCount, expiredCount);
    const subject = testMode ? `[TEST] ${baseSubject}` : baseSubject;
    const bodyText = replaceVariables(emailTemplate.body, totalCount, expiringCount, expiredCount);
    const trainingsTable = buildTrainingsTable(allTrainings);
    const testNotice = testMode 
      ? `<div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 10px; margin-bottom: 20px; border-radius: 4px;"><strong>⚠️ TESTOVACÍ EMAIL</strong> - Tento email byl odeslán v testovacím režimu.</div>`
      : "";
    const fullBody = `${testNotice}${bodyText.replace(/\n/g, "<br>")}<br><br>${trainingsTable}`;

    // Determine actual recipients - use single recipient if specified (for preview)
    const actualRecipients = singleRecipientEmail ? [singleRecipientEmail] : recipientEmails;
    const actualDeliveryMode = singleRecipientEmail ? "to" : deliveryMode;

    // Send email - test mode now actually sends with TEST prefix (for verification)
    // Simulation mode (dry run) is handled separately in UI
    // Uses exponential backoff retry for transient errors
    const result = await sendEmail(
      actualRecipients,
      subject,
      fullBody,
      actualDeliveryMode,
      emailProvider,
      3 // Max 3 retry attempts
    );

    // Log the reminder - one entry per send (not per recipient) for summary emails
    // This is the idempotency record: week_start + is_test determines uniqueness
    // Includes attempt history for debugging
    await supabase.from("reminder_logs").insert({
      training_id: null,
      employee_id: null,
      days_before: null,
      week_start: runPeriodKey,
      is_test: testMode,
      provider_used: result.provider,
      recipient_emails: actualRecipients,
      email_subject: subject,
      email_body: fullBody,
      status: result.success ? "sent" : "failed",
      error_message: result.success ? null : result.attemptErrors.join(" | "),
      template_name: singleRecipientEmail ? `Single preview to ${singleRecipientEmail}` : `Summary${testMode ? " (test)" : ""}`,
      delivery_mode: actualDeliveryMode,
      attempt_number: result.attempts,
      max_attempts: 3,
      attempt_errors: result.attemptErrors.length > 0 ? result.attemptErrors : null,
      final_status: result.success ? "sent" : "failed",
    });

    if (result.success) {
      emailsSent = recipientEmails.length;
      console.log(`Summary email sent to ${emailsSent} recipients after ${result.attempts} attempt(s)`);
    } else {
      emailsFailed = recipientEmails.length;
      errors.push(`Failed to send summary after ${result.attempts} attempts: ${result.error}`);
      console.error(`Failed to send summary email after ${result.attempts} attempts: ${result.error}`);
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
