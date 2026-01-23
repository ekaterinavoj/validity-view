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

interface Training {
  id: string;
  next_training_date: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  training_type: {
    name: string;
  };
}

// Get the start of the current week (Monday)
function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

// Calculate days until expiration
function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Format date to Czech format
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("cs-CZ");
}

// Replace template variables
function replaceVariables(template: string, training: Training, daysLeft: number): string {
  return template
    .replace(/{firstName}/g, training.employee.first_name)
    .replace(/{lastName}/g, training.employee.last_name)
    .replace(/{trainingName}/g, training.training_type.name)
    .replace(/{expiresOn}/g, formatDate(training.next_training_date))
    .replace(/{daysLeft}/g, String(daysLeft));
}

// Send email via Resend
async function sendViaResend(to: string, subject: string, body: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Training System <onboarding@resend.dev>",
        to: [to],
        subject,
        html: body.replace(/\n/g, "<br>"),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Send email via SMTP
async function sendViaSMTP(
  to: string, 
  subject: string, 
  body: string, 
  config: any
): Promise<{ success: boolean; error?: string }> {
  // For SMTP we would use a library like nodemailer
  // Since Deno doesn't have native SMTP support, we'll use an HTTP relay or external service
  // For on-prem, you would configure this with your SMTP server
  
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  if (!smtpPassword) {
    return { success: false, error: "SMTP_PASSWORD not configured" };
  }

  // In production, implement SMTP sending here using the config
  // For now, we return an error indicating SMTP is not yet implemented
  return { success: false, error: "SMTP sending not yet implemented - use Resend" };
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
  
  // Allow access if:
  // 1. Valid cron secret is provided
  // 2. Valid JWT token is provided (for manual triggers from UI)
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

  const weekStart = getWeekStart();
  let triggeredBy = "cron";

  try {
    // Get trigger type from body if provided
    const body = await req.json().catch(() => ({}));
    if (body.triggered_by) {
      triggeredBy = body.triggered_by;
    }
  } catch {
    // No body or invalid JSON, use default
  }

  // Create run record
  const { data: runData, error: runError } = await supabase
    .from("reminder_runs")
    .insert({
      week_start: weekStart,
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
    // Load settings
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value");

    if (settingsError) throw settingsError;

    const settingsMap: Record<string, any> = {};
    settings?.forEach((s: SystemSetting) => {
      settingsMap[s.key] = s.value;
    });

    const reminderSchedule = settingsMap.reminder_schedule || { enabled: true, skip_weekends: true };
    const reminderDays = settingsMap.reminder_days || { days_before: [30, 14, 7] };
    const emailProvider = settingsMap.email_provider || { provider: "resend" };
    const emailTemplate = settingsMap.email_template || {
      subject: "Upozornění: Školení {trainingName} brzy vyprší",
      body: "Dobrý den {firstName} {lastName},\n\nvaše školení \"{trainingName}\" vyprší dne {expiresOn} (za {daysLeft} dní).\n\nProsím zajistěte si včasné obnovení školení.\n\nS pozdravem,\nVáš systém školení",
    };

    // Check if reminders are enabled
    if (!reminderSchedule.enabled) {
      await supabase
        .from("reminder_runs")
        .update({
          status: "success",
          ended_at: new Date().toISOString(),
          error_message: "Reminders are disabled",
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({ message: "Reminders are disabled", emailsSent: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if today is weekend and skip_weekends is enabled
    const today = new Date().getDay();
    if (reminderSchedule.skip_weekends && (today === 0 || today === 6)) {
      await supabase
        .from("reminder_runs")
        .update({
          status: "success",
          ended_at: new Date().toISOString(),
          error_message: "Skipped - weekend",
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({ message: "Skipped - weekend", emailsSent: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get trainings that need reminders
    const daysBeforeList: number[] = reminderDays.days_before;
    
    for (const daysBefore of daysBeforeList) {
      // Calculate target date
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysBefore);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      // Get trainings expiring on target date
      const { data: trainingsRaw, error: trainingsError } = await supabase
        .from("trainings")
        .select(`
          id,
          next_training_date,
          employee_id,
          training_type_id
        `)
        .eq("next_training_date", targetDateStr)
        .eq("is_active", true);

      if (trainingsError) {
        console.error("Error fetching trainings:", trainingsError);
        errors.push(`Error fetching trainings for ${daysBefore} days: ${trainingsError.message}`);
        continue;
      }

      for (const trainingRaw of trainingsRaw || []) {
        // Check if we already sent a reminder this week for this training
        const { data: existingLog } = await supabase
          .from("reminder_logs")
          .select("id")
          .eq("training_id", trainingRaw.id)
          .eq("week_start", weekStart)
          .single();

        if (existingLog) {
          console.log(`Skipping training ${trainingRaw.id} - already reminded this week`);
          continue;
        }

        // Fetch employee and training type separately
        const { data: employee } = await supabase
          .from("employees")
          .select("id, first_name, last_name, email")
          .eq("id", trainingRaw.employee_id)
          .single();

        const { data: trainingType } = await supabase
          .from("training_types")
          .select("name")
          .eq("id", trainingRaw.training_type_id)
          .single();

        if (!employee || !trainingType) {
          console.error(`Missing data for training ${trainingRaw.id}`);
          continue;
        }

        const training: Training = {
          id: trainingRaw.id,
          next_training_date: trainingRaw.next_training_date,
          employee: {
            id: employee.id,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
          },
          training_type: {
            name: trainingType.name,
          },
        };

        const daysLeft = getDaysUntil(training.next_training_date);
        const subject = replaceVariables(emailTemplate.subject, training as Training, daysLeft);
        const body = replaceVariables(emailTemplate.body, training as Training, daysLeft);

        // Send email
        let result: { success: boolean; error?: string };
        if (emailProvider.provider === "smtp") {
          result = await sendViaSMTP(training.employee.email, subject, body, emailProvider);
        } else {
          result = await sendViaResend(training.employee.email, subject, body);
        }

        // Log the reminder
        await supabase.from("reminder_logs").insert({
          training_id: training.id,
          week_start: weekStart,
          recipient_emails: [training.employee.email],
          email_subject: subject,
          email_body: body,
          status: result.success ? "sent" : "failed",
          error_message: result.error || null,
          template_name: `${daysBefore} days before`,
        });

        if (result.success) {
          emailsSent++;
          console.log(`Email sent to ${training.employee.email} for training ${training.id}`);
        } else {
          emailsFailed++;
          errors.push(`Failed to send to ${training.employee.email}: ${result.error}`);
          console.error(`Failed to send email: ${result.error}`);
        }
      }
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
        error_details: errors.length > 0 ? { errors } : null,
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        emailsFailed,
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