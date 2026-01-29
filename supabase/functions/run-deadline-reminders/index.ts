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
  template_id: string | null;
  template_name: string;
  responsible_person: string | null;
}

interface ReminderTemplate {
  id: string;
  name: string;
  email_subject: string;
  email_body: string;
  target_user_ids: string[] | null;
  remind_days_before: number;
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

// Replace template variables for email
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
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Odpovědná osoba</th>
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
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${d.responsible_person || "-"}</td>
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

  // Verify authorization - cron secret OR authenticated admin
  const cronSecret = req.headers.get("x-cron-secret");
  const envCronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization");
  
  const isCronRequest = cronSecret && envCronSecret && cronSecret === envCronSecret;
  
  // For non-cron requests, verify JWT and admin role
  let isAuthorizedAdmin = false;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  if (!isCronRequest && authHeader?.startsWith("Bearer ")) {
    // Verify the user is an admin
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    
    if (!claimsError && claimsData?.claims?.sub) {
      const userId = claimsData.claims.sub;
      const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Check if user has admin role
      const { data: roles } = await serviceSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .limit(1);
      
      isAuthorizedAdmin = !!(roles && roles.length > 0);
    }
  }
  
  if (!isCronRequest && !isAuthorizedAdmin) {
    console.log("Unauthorized access attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized - Admin access or CRON secret required" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let triggeredBy = isCronRequest ? "cron" : "admin";
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

  // Check for duplicate run (idempotency) - skip for test mode
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

  // Fetch all active reminder templates for lookup
  const { data: allTemplates } = await supabase
    .from("deadline_reminder_templates")
    .select("*")
    .eq("is_active", true);

  const templatesMap = new Map<string, ReminderTemplate>();
  let defaultTemplate: ReminderTemplate | null = null;
  
  if (allTemplates) {
    for (const t of allTemplates) {
      templatesMap.set(t.id, t as ReminderTemplate);
      // Use first active template as default fallback
      if (!defaultTemplate) {
        defaultTemplate = t as ReminderTemplate;
      }
    }
  }

  if (!defaultTemplate) {
    console.log("No active reminder template found");
    return new Response(
      JSON.stringify({ info: "No active reminder template configured", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Fetch active deadlines with related data including responsible_person from equipment
  const { data: deadlines, error: deadlinesError } = await supabase
    .from("deadlines")
    .select(`
      id, next_check_date, facility, reminder_template_id, remind_days_before, requester,
      equipment:equipment_id(id, name, inventory_number, status, responsible_person),
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

  // Group deadlines by template for batch sending
  // Key: template_id, Value: array of deadline items
  const deadlinesByTemplate = new Map<string, DeadlineItem[]>();
  
  for (const d of deadlines || []) {
    const equipment = d.equipment as any;
    const deadlineType = d.deadline_types as any;
    
    if (!equipment || equipment.status !== "active") continue;
    
    const daysUntil = getDaysUntil(d.next_check_date);
    const remindDays = d.remind_days_before || 30;
    
    // Include if expired or within reminder window
    if (daysUntil <= remindDays) {
      // Determine which template to use: per-deadline or default fallback
      const templateId = d.reminder_template_id || defaultTemplate.id;
      const template = templatesMap.get(templateId) || defaultTemplate;
      
      const item: DeadlineItem = {
        id: d.id,
        next_check_date: d.next_check_date,
        equipment_name: equipment.name,
        equipment_inventory_number: equipment.inventory_number,
        deadline_type_name: deadlineType?.name || "Neznámý typ",
        facility: d.facility,
        days_until: daysUntil,
        template_id: template.id,
        template_name: template.name,
        responsible_person: equipment.responsible_person || null,
      };
      
      const existingItems = deadlinesByTemplate.get(template.id) || [];
      existingItems.push(item);
      deadlinesByTemplate.set(template.id, existingItems);
    }
  }

  if (deadlinesByTemplate.size === 0) {
    console.log("No deadlines require reminders");
    return new Response(
      JSON.stringify({ message: "No deadlines require reminders", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  let totalEmailsSent = 0;
  let totalEmailsFailed = 0;
  const results: any[] = [];

  // Process each template group
  for (const [templateId, deadlineItems] of deadlinesByTemplate) {
    const template = templatesMap.get(templateId) || defaultTemplate;
    
    // Determine recipients:
    // 1. Template's target_user_ids (admin-configured recipients)
    // 2. TODO: In future, also include responsible_person emails from equipment
    //    Currently responsible_person is just a text field, not linked to profiles
    //    To implement: create a mapping or use email directly if it's an email format
    
    let recipientIds = template.target_user_ids || [];
    
    // Collect unique responsible persons from deadlines (as potential future recipients)
    const responsiblePersons = new Set<string>();
    for (const item of deadlineItems) {
      if (item.responsible_person) {
        responsiblePersons.add(item.responsible_person);
      }
    }
    
    // Log note about responsible persons for debugging
    if (responsiblePersons.size > 0) {
      console.log(`Template ${template.name}: Found ${responsiblePersons.size} responsible persons:`, 
        Array.from(responsiblePersons).join(", "));
      // TODO: If responsible_person contains emails, add them to recipientIds
      // For now, we only use template.target_user_ids
    }
    
    if (recipientIds.length === 0) {
      console.log(`Template ${template.name}: No recipients configured, skipping`);
      continue;
    }

    // Fetch recipient profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .in("id", recipientIds);

    if (!profiles || profiles.length === 0) {
      console.log(`Template ${template.name}: No valid recipient profiles found`);
      continue;
    }

    const recipientEmails = profiles.map(p => p.email);
    
    // Prepare email content
    const expiredCount = deadlineItems.filter(d => d.days_until < 0).length;
    const expiringCount = deadlineItems.filter(d => d.days_until >= 0).length;
    const totalCount = deadlineItems.length;

    const subject = testMode 
      ? `[TEST] ${replaceVariables(template.email_subject, totalCount, expiringCount, expiredCount)}`
      : replaceVariables(template.email_subject, totalCount, expiringCount, expiredCount);
    
    const bodyText = replaceVariables(template.email_body, totalCount, expiringCount, expiredCount);
    const tableHtml = buildDeadlinesTable(deadlineItems);
    const fullBody = `${bodyText}${tableHtml}`;

    // Send email
    const result = await sendViaResend(recipientEmails, subject, fullBody, "bcc");

    // Log per template/batch - includes deadline IDs for traceability
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
        // Store first deadline_id for reference (could extend schema for multiple)
        deadline_id: deadlineItems[0]?.id || null,
        equipment_id: null, // Could be extended to store all equipment IDs
        days_before: deadlineItems[0]?.days_until || null,
      });

    if (logError) {
      console.error(`Failed to log reminder for template ${template.name}:`, logError);
    }

    if (result.success) {
      totalEmailsSent++;
      console.log(`Sent reminder for template '${template.name}' to ${recipientEmails.length} recipients with ${deadlineItems.length} deadlines`);
    } else {
      totalEmailsFailed++;
      console.error(`Failed to send reminder for template '${template.name}':`, result.error);
    }

    results.push({
      template: template.name,
      templateId: template.id,
      deadlinesCount: deadlineItems.length,
      recipientCount: recipientEmails.length,
      success: result.success,
      error: result.error,
    });
  }

  console.log(`Deadline reminder run completed: ${totalEmailsSent} sent, ${totalEmailsFailed} failed`);

  return new Response(
    JSON.stringify({
      success: totalEmailsFailed === 0,
      emailsSent: totalEmailsSent,
      emailsFailed: totalEmailsFailed,
      results,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
};

serve(handler);
