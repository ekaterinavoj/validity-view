import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface DeadlineItem {
  id: string;
  next_check_date: string;
  equipment_name: string;
  equipment_inventory_number: string;
  deadline_type_name: string;
  facility: string;
  days_until: number;
}

interface Recipient {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
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

// Build HTML table for deadlines list
function buildDeadlinesTable(deadlines: DeadlineItem[]): string {
  if (deadlines.length === 0) {
    return "<p>Žádné technické události k zobrazení.</p>";
  }

  let html = `
    <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Zařízení</th>
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Inv. číslo</th>
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Typ události</th>
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Termín</th>
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">Dnů</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const d of deadlines) {
    const statusColor = d.days_until < 0 ? "#ef4444" : d.days_until <= 7 ? "#f59e0b" : "#22c55e";
    
    html += `
      <tr>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${d.equipment_name}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${d.equipment_inventory_number}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${d.deadline_type_name}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${formatDate(d.next_check_date)}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">
          <span style="background-color: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            ${d.days_until} dní
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

// Get the run period key for idempotency
function getRunPeriodKey(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

// Send email via Resend
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
      from: `${fromName || "Technical Reminders"} <${fromEmail || "onboarding@resend.dev"}>`,
      subject,
      html: body,
    };

    // Set recipients based on delivery mode
    if (deliveryMode === "bcc") {
      emailPayload.to = [fromEmail || "onboarding@resend.dev"];
      emailPayload.bcc = recipients;
    } else if (deliveryMode === "cc") {
      emailPayload.to = [recipients[0]];
      if (recipients.length > 1) {
        emailPayload.cc = recipients.slice(1);
      }
    } else {
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
    const body = await req.json().catch(() => ({}));
    if (body.triggered_by) {
      triggeredBy = body.triggered_by;
    }
    if (body.test_mode === true) {
      testMode = true;
      triggeredBy = triggeredBy === "cron" ? "test" : `${triggeredBy}_test`;
    }
  } catch {
    // No body or invalid JSON
  }

  console.log(`Starting deadline reminder run: triggered_by=${triggeredBy}, test_mode=${testMode}`);

  const weekStart = getRunPeriodKey();

  // Check for duplicate run (idempotency)
  if (!testMode) {
    const { data: existingRun } = await supabase
      .from("deadline_reminder_logs")
      .select("id")
      .eq("week_start", weekStart)
      .eq("is_test", false)
      .limit(1);

    if (existingRun && existingRun.length > 0) {
      console.log(`Duplicate run detected for week ${weekStart}, skipping`);
      return new Response(
        JSON.stringify({ message: "Already sent for this period", emailsSent: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }

  // Fetch active deadlines with related data
  const { data: deadlines, error: deadlinesError } = await supabase
    .from("deadlines")
    .select(`
      id, next_check_date, facility, reminder_template_id, remind_days_before,
      equipment:equipment_id(id, name, inventory_number, status),
      deadline_types:deadline_type_id(id, name)
    `)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("next_check_date", { ascending: true });

  if (deadlinesError) {
    console.error("Failed to fetch deadlines:", deadlinesError);
    return new Response(
      JSON.stringify({ error: "Failed to fetch deadlines" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Filter deadlines that are expiring or expired
  const relevantDeadlines: DeadlineItem[] = [];
  
  for (const d of deadlines || []) {
    const equipment = d.equipment as any;
    const deadlineType = d.deadline_types as any;
    
    if (!equipment || equipment.status !== "active") continue;
    
    const daysUntil = getDaysUntil(d.next_check_date);
    const remindDays = d.remind_days_before || 30;
    
    // Include if expired or within reminder window
    if (daysUntil <= remindDays) {
      relevantDeadlines.push({
        id: d.id,
        next_check_date: d.next_check_date,
        equipment_name: equipment.name,
        equipment_inventory_number: equipment.inventory_number,
        deadline_type_name: deadlineType?.name || "Neznámý typ",
        facility: d.facility,
        days_until: daysUntil,
      });
    }
  }

  if (relevantDeadlines.length === 0) {
    console.log("No deadlines require reminders");
    return new Response(
      JSON.stringify({ message: "No deadlines require reminders", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Get active reminder template
  const { data: templates } = await supabase
    .from("deadline_reminder_templates")
    .select("*")
    .eq("is_active", true)
    .limit(1);

  const template = templates?.[0];
  
  if (!template) {
    console.log("No active reminder template found");
    return new Response(
      JSON.stringify({ info: "No active reminder template configured", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Get recipients from template
  const recipientIds = template.target_user_ids || [];
  
  if (recipientIds.length === 0) {
    console.log("No recipients configured in template");
    return new Response(
      JSON.stringify({ info: "No recipients configured in reminder template", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Fetch recipient profiles
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name")
    .in("id", recipientIds);

  if (profilesError || !profiles || profiles.length === 0) {
    console.error("Failed to fetch recipient profiles:", profilesError);
    return new Response(
      JSON.stringify({ info: "No valid recipients found", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const recipientEmails = profiles.map(p => p.email);
  
  // Prepare email content
  const expiredCount = relevantDeadlines.filter(d => d.days_until < 0).length;
  const expiringCount = relevantDeadlines.filter(d => d.days_until >= 0).length;
  const totalCount = relevantDeadlines.length;

  const subject = testMode 
    ? `[TEST] ${replaceVariables(template.email_subject, totalCount, expiringCount, expiredCount)}`
    : replaceVariables(template.email_subject, totalCount, expiringCount, expiredCount);
  
  const bodyText = replaceVariables(template.email_body, totalCount, expiringCount, expiredCount);
  const tableHtml = buildDeadlinesTable(relevantDeadlines);
  const fullBody = `${bodyText}${tableHtml}`;

  // Send email
  const result = await sendViaResend(recipientEmails, subject, fullBody, "bcc");

  // Log the result
  const { error: logError } = await supabase
    .from("deadline_reminder_logs")
    .insert({
      template_id: template.id,
      template_name: template.name,
      recipient_emails: recipientEmails,
      email_subject: subject,
      email_body: fullBody,
      status: result.success ? "sent" : "failed",
      error_message: result.error || null,
      is_test: testMode,
      week_start: weekStart,
      delivery_mode: "bcc",
    });

  if (logError) {
    console.error("Failed to log reminder:", logError);
  }

  console.log(`Deadline reminder ${result.success ? "sent" : "failed"}: ${recipientEmails.length} recipients`);

  return new Response(
    JSON.stringify({
      success: result.success,
      emailsSent: result.success ? 1 : 0,
      recipientCount: recipientEmails.length,
      deadlinesCount: relevantDeadlines.length,
      error: result.error,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
};

serve(handler);
