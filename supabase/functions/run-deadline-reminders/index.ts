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
  equipment_id: string;
  deadline_type_name: string;
  facility: string;
  days_until: number;
  template_id: string | null;
  template_name: string;
  responsible_person: string | null;
  status: 'expired' | 'warning';
}

interface ReminderTemplate {
  id: string;
  name: string;
  email_subject: string;
  email_body: string;
  target_user_ids: string[] | null;
  remind_days_before: number;
}

interface ReminderFrequency {
  type: string;
  interval_days: number;
  start_time: string;
  timezone: string;
  enabled: boolean;
  dual_mode?: boolean;
  expired_frequency?: string;
  expired_start_time?: string;
  warning_frequency?: string;
  warning_start_time?: string;
  warning_day_of_week?: number;
}

interface ReminderSchedule {
  enabled: boolean;
  day_of_week: number;
  skip_weekends: boolean;
}

// Check if now is the right time to send based on frequency settings
function isDueNow(
  frequency: ReminderFrequency,
  schedule: ReminderSchedule,
  category: 'expired' | 'warning' | 'all'
): boolean {
  if (!frequency.enabled) {
    console.log("Reminders disabled via frequency.enabled");
    return false;
  }

  const timezone = frequency.timezone || "Europe/Prague";
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  });
  const parts = formatter.formatToParts(now);
  const currentHour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  const currentMinute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
  const currentWeekdayEn = parts.find(p => p.type === "weekday")?.value || "";
  
  const weekdayToNum: Record<string, number> = {
    "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
    "Thursday": 4, "Friday": 5, "Saturday": 6
  };
  const currentDayNum = weekdayToNum[currentWeekdayEn] ?? now.getDay();
  
  if (schedule.skip_weekends && (currentDayNum === 0 || currentDayNum === 6)) {
    console.log("Skipping weekend");
    return false;
  }

  if (frequency.dual_mode && category !== 'all') {
    if (category === 'expired') {
      const expiredFreq = frequency.expired_frequency || 'daily';
      const [targetHour, targetMinute] = (frequency.expired_start_time || "08:00").split(":").map(Number);
      
      const currentMinutes = currentHour * 60 + currentMinute;
      const targetMinutes = targetHour * 60 + targetMinute;
      const isInWindow = currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 60;
      
      if (!isInWindow) {
        console.log(`Expired: Not in time window. Current: ${currentHour}:${currentMinute}, Target: ${targetHour}:${targetMinute}`);
        return false;
      }
      
      if (expiredFreq === 'daily' || expiredFreq === 'twice_daily') {
        console.log(`Expired: Daily/twice_daily frequency, in time window - due now`);
        return true;
      }
      
      return true;
    }
    
    if (category === 'warning') {
      const warningFreq = frequency.warning_frequency || 'weekly';
      const [targetHour, targetMinute] = (frequency.warning_start_time || "08:00").split(":").map(Number);
      const targetDayOfWeek = frequency.warning_day_of_week ?? 1;
      
      const currentMinutes = currentHour * 60 + currentMinute;
      const targetMinutes = targetHour * 60 + targetMinute;
      const isInWindow = currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 60;
      
      if (!isInWindow) {
        console.log(`Warning: Not in time window. Current: ${currentHour}:${currentMinute}, Target: ${targetHour}:${targetMinute}`);
        return false;
      }
      
      if (warningFreq === 'weekly' || warningFreq === 'biweekly') {
        if (currentDayNum !== targetDayOfWeek) {
          console.log(`Warning: Wrong day. Current: ${currentDayNum}, Target: ${targetDayOfWeek}`);
          return false;
        }
      }
      
      console.log(`Warning: ${warningFreq} frequency, in time window - due now`);
      return true;
    }
  }

  const [targetHour, targetMinute] = (frequency.start_time || "08:00").split(":").map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;
  const targetMinutes = targetHour * 60 + targetMinute;
  const isInWindow = currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 60;
  
  if (!isInWindow) {
    console.log(`Single mode: Not in time window. Current: ${currentHour}:${currentMinute}, Target: ${targetHour}:${targetMinute}`);
    return false;
  }

  switch (frequency.type) {
    case "daily":
      return true;
    case "weekly":
      return currentDayNum === (schedule.day_of_week ?? 1);
    case "biweekly":
      return currentDayNum === (schedule.day_of_week ?? 1);
    case "monthly":
      const dayOfMonth = now.getDate();
      return dayOfMonth <= 7 && currentDayNum === (schedule.day_of_week ?? 1);
    case "custom":
      return true;
    default:
      return true;
  }
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("cs-CZ");
}

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

function replaceVariables(
  template: string, 
  totalCount: number, 
  expiringCount: number, 
  expiredCount: number,
  deadlines?: DeadlineItem[]
): string {
  const today = new Date();
  let result = template
    .replace(/\{+totalCount\}+/g, String(totalCount))
    .replace(/\{+expiringCount\}+/g, String(expiringCount))
    .replace(/\{+expiredCount\}+/g, String(expiredCount))
    .replace(/\{+reportDate\}+/g, formatDate(today.toISOString()))
    .replace(/\{+total_count\}+/g, String(totalCount))
    .replace(/\{+expiring_count\}+/g, String(expiringCount))
    .replace(/\{+expired_count\}+/g, String(expiredCount))
    .replace(/\{+report_date\}+/g, formatDate(today.toISOString()));
  
  if (deadlines && deadlines.length > 0) {
    const sample = deadlines[0];
    
    result = result
      .replace(/\{\{equipment_name\}\}/g, sample.equipment_name)
      .replace(/\{\{equipment_inventory_number\}\}/g, sample.equipment_inventory_number)
      .replace(/\{\{deadline_type\}\}/g, sample.deadline_type_name)
      .replace(/\{\{deadline_type_name\}\}/g, sample.deadline_type_name)
      .replace(/\{\{days_remaining\}\}/g, sample.days_until >= 0 ? String(sample.days_until) : "0")
      .replace(/\{\{days_left\}\}/g, sample.days_until >= 0 ? String(sample.days_until) : "0")
      .replace(/\{\{check_date\}\}/g, formatDate(sample.next_check_date))
      .replace(/\{\{next_check_date\}\}/g, formatDate(sample.next_check_date))
      .replace(/\{\{facility\}\}/g, sample.facility)
      .replace(/\{\{responsible_person\}\}/g, sample.responsible_person || "-")
      .replace(/\{equipmentName\}/g, sample.equipment_name)
      .replace(/\{inventoryNumber\}/g, sample.equipment_inventory_number)
      .replace(/\{deadlineType\}/g, sample.deadline_type_name)
      .replace(/\{daysLeft\}/g, sample.days_until >= 0 ? String(sample.days_until) : "0")
      .replace(/\{daysRemaining\}/g, sample.days_until >= 0 ? String(sample.days_until) : "0")
      .replace(/\{checkDate\}/g, formatDate(sample.next_check_date))
      .replace(/\{nextCheckDate\}/g, formatDate(sample.next_check_date))
      .replace(/\{responsiblePerson\}/g, sample.responsible_person || "-");
  }
  
  return result;
}

function buildDeadlinesTable(deadlines: DeadlineItem[], category: 'expired' | 'warning' | 'all'): string {
  if (deadlines.length === 0) {
    return "<p>Žádné technické události k zobrazení.</p>";
  }

  const headerColor = category === 'expired' ? '#ef4444' : category === 'warning' ? '#f59e0b' : '#3b82f6';
  const headerText = category === 'expired' ? '⚠️ PROŠLÉ TECHNICKÉ UDÁLOSTI' : 
                     category === 'warning' ? '📅 Blížící se technické události' : 
                     'Technické události';

  let html = `
    <h3 style="color: ${headerColor}; margin-bottom: 10px;">${headerText}</h3>
    <table style="border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 20px;">
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
            ${formatDaysLabel(d.days_until)}
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

function getRunPeriodKey(category: string = 'all'): string {
  const now = new Date();
  const dateKey = now.toISOString().split("T")[0];
  return `${dateKey}_${category}`;
}

// Send email via native SMTP
async function sendViaSMTP(
  recipients: string[],
  subject: string,
  body: string,
  deliveryMode: string,
  emailProvider: any
): Promise<{ success: boolean; error?: string; provider: string }> {
  const host = emailProvider.smtp_host;
  const port = emailProvider.smtp_port || 587;
  const fromEmail = emailProvider.smtp_from_email;
  const fromName = emailProvider.smtp_from_name || "Deadline System";
  const authEnabled = emailProvider.smtp_auth_enabled !== false;
  const username = emailProvider.smtp_user;
  const password = emailProvider.smtp_password;
  const tlsMode = emailProvider.smtp_tls_mode || "starttls";

  if (!host || !fromEmail) {
    return { success: false, error: "SMTP not configured", provider: "smtp" };
  }

  let toRecipients: string[] = [];
  let bccRecipients: string[] = [];

  if (deliveryMode === "bcc") {
    toRecipients = [fromEmail];
    bccRecipients = recipients;
  } else {
    toRecipients = recipients;
  }

  const allRecipients = [...toRecipients, ...bccRecipients].filter(Boolean);
  if (allRecipients.length === 0) {
    return { success: false, error: "No recipients", provider: "smtp" };
  }

  let connection: Deno.TcpConn | Deno.TlsConn | null = null;

  try {
    console.log(`Connecting to SMTP ${host}:${port}`);

    if (tlsMode === "smtps") {
      connection = await Deno.connectTls({ hostname: host, port });
    } else {
      connection = await Deno.connect({ hostname: host, port });
    }

    const reader = connection.readable.getReader();
    const writer = connection.writable.getWriter();

    const readResponse = async (): Promise<string> => {
      const decoder = new TextDecoder();
      let response = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        response += decoder.decode(value, { stream: true });
        if (response.includes("\r\n")) {
          const lines = response.split("\r\n");
          const lastLine = lines[lines.length - 2] || lines[lines.length - 1];
          if (lastLine.length >= 4 && lastLine[3] !== '-') break;
        }
      }
      return response;
    };

    const sendCommand = async (cmd: string): Promise<{ code: number; msg: string }> => {
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(cmd + "\r\n"));
      const resp = await readResponse();
      return { code: parseInt(resp.substring(0, 3), 10), msg: resp };
    };

    const greeting = await readResponse();
    if (!greeting.startsWith("220")) throw new Error(`Invalid greeting: ${greeting}`);

    let resp = await sendCommand(`EHLO ${host}`);
    if (resp.code !== 250) {
      resp = await sendCommand(`HELO ${host}`);
      if (resp.code !== 250) throw new Error(`HELO failed: ${resp.msg}`);
    }

    if (tlsMode === "starttls") {
      resp = await sendCommand("STARTTLS");
      if (resp.code === 220) {
        reader.releaseLock();
        writer.releaseLock();
        connection = await Deno.startTls(connection as Deno.TcpConn, { hostname: host });
        
        const tlsReader = connection.readable.getReader();
        const tlsWriter = connection.writable.getWriter();
        
        const sendTlsCommand = async (cmd: string): Promise<{ code: number; msg: string }> => {
          const encoder = new TextEncoder();
          await tlsWriter.write(encoder.encode(cmd + "\r\n"));
          const decoder = new TextDecoder();
          let response = "";
          while (true) {
            const { value, done } = await tlsReader.read();
            if (done) break;
            response += decoder.decode(value, { stream: true });
            if (response.includes("\r\n")) break;
          }
          return { code: parseInt(response.substring(0, 3), 10), msg: response };
        };

        await sendTlsCommand(`EHLO ${host}`);
        
        if (authEnabled && username && password) {
          await sendTlsCommand("AUTH LOGIN");
          await sendTlsCommand(btoa(username));
          await sendTlsCommand(btoa(password));
        }

        await sendTlsCommand(`MAIL FROM:<${fromEmail}>`);
        for (const rcpt of allRecipients) {
          await sendTlsCommand(`RCPT TO:<${rcpt}>`);
        }
        await sendTlsCommand("DATA");

        const emailData = [
          `From: "${fromName}" <${fromEmail}>`,
          `To: ${toRecipients.join(", ")}`,
          bccRecipients.length > 0 ? `Bcc: ${bccRecipients.join(", ")}` : "",
          `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
          "MIME-Version: 1.0",
          `Content-Type: text/html; charset=UTF-8`,
          "",
          body,
          ".",
        ].filter(Boolean).join("\r\n");

        await tlsWriter.write(new TextEncoder().encode(emailData + "\r\n"));
        await sendTlsCommand("QUIT");
        
        tlsReader.releaseLock();
        tlsWriter.releaseLock();
        connection.close();
        return { success: true, provider: "smtp" };
      }
    }

    if (authEnabled && username && password) {
      await sendCommand("AUTH LOGIN");
      await sendCommand(btoa(username));
      await sendCommand(btoa(password));
    }

    await sendCommand(`MAIL FROM:<${fromEmail}>`);
    for (const rcpt of allRecipients) {
      await sendCommand(`RCPT TO:<${rcpt}>`);
    }
    await sendCommand("DATA");

    const emailData = [
      `From: "${fromName}" <${fromEmail}>`,
      `To: ${toRecipients.join(", ")}`,
      bccRecipients.length > 0 ? `Bcc: ${bccRecipients.join(", ")}` : "",
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      "MIME-Version: 1.0",
      `Content-Type: text/html; charset=UTF-8`,
      "",
      body,
      ".",
    ].filter(Boolean).join("\r\n");

    await writer.write(new TextEncoder().encode(emailData + "\r\n"));
    await sendCommand("QUIT");
    
    reader.releaseLock();
    writer.releaseLock();
    connection.close();
    console.log("Deadline reminder email sent via SMTP");
    return { success: true, provider: "smtp" };
    
  } catch (error: any) {
    console.error("SMTP error:", error.message);
    if (connection) try { connection.close(); } catch {}
    return { success: false, error: error.message, provider: "smtp" };
  }
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
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  if (!isCronRequest && authHeader?.startsWith("Bearer ")) {
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
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
    console.log("Unauthorized access attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized - Admin access or CRON secret required" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let triggeredBy = isCronRequest ? "cron" : "admin";
  let testMode = false;
  let forceCategory: 'expired' | 'warning' | 'all' | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    if (body.triggered_by) {
      triggeredBy = body.triggered_by;
    }
    if (body.test_mode === true) {
      testMode = true;
      triggeredBy = triggeredBy === "cron" ? "test" : `${triggeredBy}_test`;
    }
    if (body.category) {
      forceCategory = body.category;
    }
  } catch {
    // No body or invalid JSON
  }

  console.log(`Starting deadline reminder run: triggered_by=${triggeredBy}, test_mode=${testMode}, forceCategory=${forceCategory}`);

  // Idempotency check: prevent duplicate runs for same week_start + triggered_by
  // Allow manual tests to run repeatedly (they have triggered_by = "manual_test")
  const today = new Date().toISOString().split("T")[0];
  const isManualTest = triggeredBy === "manual_test" || triggeredBy === "manual";
  
  if (!isManualTest && !testMode) {
    // Only enforce idempotency for automatic/cron runs, not manual tests
    const { data: existingRuns } = await supabase
      .from("deadline_reminder_logs")
      .select("id, week_start, is_test")
      .eq("week_start", today)
      .eq("is_test", false)
      .limit(1);
    
    if (existingRuns && existingRuns.length > 0) {
      console.log(`Idempotency check: Production run for ${today} already exists. Aborting to prevent duplicates.`);
      return new Response(
        JSON.stringify({
          warning: `Běh pro ${today} již proběhl. Opakované odeslání bylo zabráněno.`,
          message: "Deadline reminder run already executed for this date",
          triggeredBy,
          testMode,
          emailsSent: 0,
          alreadyRun: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }

  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["reminder_frequency", "reminder_schedule", "deadline_reminder_recipients", "deadline_email_template", "email_provider"]);
  
  let frequency: ReminderFrequency = { 
    type: "weekly", interval_days: 7, start_time: "08:00", 
    timezone: "Europe/Prague", enabled: true 
  };
  let schedule: ReminderSchedule = { enabled: true, day_of_week: 1, skip_weekends: true };
  let moduleRecipients: { user_ids: string[], delivery_mode: string } = { user_ids: [], delivery_mode: "bcc" };
  let moduleEmailTemplate: { subject: string, body: string } | null = null;
  let emailProviderSettings: any = null;
  
  if (settings) {
    for (const s of settings) {
      if (s.key === "reminder_frequency" && s.value && typeof s.value === "object") {
        frequency = { ...frequency, ...(s.value as object) };
      }
      if (s.key === "reminder_schedule" && s.value && typeof s.value === "object") {
        schedule = { ...schedule, ...(s.value as object) };
      }
      if (s.key === "deadline_reminder_recipients" && s.value && typeof s.value === "object") {
        moduleRecipients = s.value as typeof moduleRecipients;
      }
      if (s.key === "deadline_email_template" && s.value && typeof s.value === "object") {
        moduleEmailTemplate = s.value as { subject: string; body: string };
      }
      if (s.key === "email_provider" && s.value && typeof s.value === "object") {
        emailProviderSettings = s.value;
      }
    }
  }
  
  // Check if SMTP is configured
  if (!emailProviderSettings?.smtp_host || !emailProviderSettings?.smtp_from_email) {
    console.log("SMTP server is not configured");
    return new Response(
      JSON.stringify({ error: "SMTP server není nakonfigurován", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  console.log(`Frequency settings: dual_mode=${frequency.dual_mode}, enabled=${frequency.enabled}`);
  console.log(`Module recipients configured: ${moduleRecipients.user_ids?.length || 0} users`);

  const { data: allTemplates } = await supabase
    .from("deadline_reminder_templates")
    .select("*")
    .eq("is_active", true);

  const templatesMap = new Map<string, ReminderTemplate>();
  let defaultTemplate: ReminderTemplate | null = null;
  
  if (allTemplates) {
    for (const t of allTemplates) {
      templatesMap.set(t.id, t as ReminderTemplate);
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

  const allDeadlineItems: DeadlineItem[] = [];
  
  for (const d of deadlines || []) {
    const equipment = d.equipment as any;
    const deadlineType = d.deadline_types as any;
    
    if (!equipment || equipment.status !== "active") continue;
    
    const daysUntil = getDaysUntil(d.next_check_date);
    const remindDays = d.remind_days_before || 30;
    
    if (daysUntil <= remindDays) {
      const templateId = d.reminder_template_id || defaultTemplate.id;
      const template = templatesMap.get(templateId) || defaultTemplate;
      
      const item: DeadlineItem = {
        id: d.id,
        next_check_date: d.next_check_date,
        equipment_name: equipment.name,
        equipment_inventory_number: equipment.inventory_number,
        equipment_id: equipment.id,
        deadline_type_name: deadlineType?.name || "Neznámý typ",
        facility: d.facility,
        days_until: daysUntil,
        template_id: template.id,
        template_name: template.name,
        responsible_person: equipment.responsible_person || null,
        status: daysUntil < 0 ? 'expired' : 'warning',
      };
      
      allDeadlineItems.push(item);
    }
  }

  allDeadlineItems.sort((a, b) => a.days_until - b.days_until);

  const expiredItems = allDeadlineItems.filter(d => d.status === 'expired');
  const warningItems = allDeadlineItems.filter(d => d.status === 'warning');

  console.log(`Found ${expiredItems.length} expired and ${warningItems.length} warning deadlines`);

  let finalRecipientEmails: string[] = [];
  
  if (moduleRecipients.user_ids && moduleRecipients.user_ids.length > 0) {
    const { data: moduleProfiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", moduleRecipients.user_ids);
    
    if (moduleProfiles) {
      // Deduplicate emails (case-insensitive)
      finalRecipientEmails = [...new Set(moduleProfiles.map(p => p.email.toLowerCase()))];
    }
  }
  
  if (finalRecipientEmails.length === 0) {
    console.log("No recipients configured for deadline reminders");
    return new Response(
      JSON.stringify({ info: "No recipients configured for deadline reminders", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  console.log(`Final recipients: ${finalRecipientEmails.join(", ")}`);

  let totalEmailsSent = 0;
  let totalEmailsFailed = 0;
  const results: any[] = [];
  const deliveryMode = moduleRecipients.delivery_mode || "bcc";

  if (frequency.dual_mode) {
    console.log("Dual mode enabled - sending separate emails for expired and warning");

    const shouldSendExpired = forceCategory === 'expired' || forceCategory === 'all' || 
      (testMode && forceCategory !== 'warning') || 
      isDueNow(frequency, schedule, 'expired');
    
    const shouldSendWarning = forceCategory === 'warning' || forceCategory === 'all' || 
      (testMode && forceCategory !== 'expired') || 
      isDueNow(frequency, schedule, 'warning');

    if (shouldSendExpired && expiredItems.length > 0) {
      const weekStart = getRunPeriodKey('expired');
      
      const subjectTemplate = moduleEmailTemplate?.subject || defaultTemplate.email_subject;
      const bodyTemplate = moduleEmailTemplate?.body || defaultTemplate.email_body;
      
      const subject = testMode 
        ? `[TEST] ⚠️ PROŠLÉ TECHNICKÉ UDÁLOSTI - ${replaceVariables(subjectTemplate, expiredItems.length, 0, expiredItems.length, expiredItems)}`
        : `⚠️ PROŠLÉ TECHNICKÉ UDÁLOSTI - ${replaceVariables(subjectTemplate, expiredItems.length, 0, expiredItems.length, expiredItems)}`;
      
      const bodyText = replaceVariables(bodyTemplate, expiredItems.length, 0, expiredItems.length, expiredItems);
      const tableHtml = buildDeadlinesTable(expiredItems, 'expired');
      const fullBody = `${bodyText.replace(/\n/g, "<br>")}<br><br>${tableHtml}`;
      
      const result = await sendViaSMTP(finalRecipientEmails, subject, fullBody, deliveryMode, emailProviderSettings);
      
      await supabase.from("deadline_reminder_logs").insert({
        template_id: defaultTemplate.id,
        template_name: testMode ? "Prošlé technické události (TEST)" : "Prošlé technické události",
        recipient_emails: finalRecipientEmails,
        email_subject: subject,
        email_body: fullBody,
        status: result.success ? "sent" : "failed",
        error_message: result.error || null,
        is_test: testMode,
        week_start: weekStart,
        delivery_mode: deliveryMode,
        deadline_id: expiredItems[0]?.id || null,
        equipment_id: expiredItems[0]?.equipment_id || null,
        days_before: expiredItems[0]?.days_until || null,
      });
      
      if (result.success) {
        totalEmailsSent++;
        console.log(`Sent expired deadline reminder with ${expiredItems.length} items`);
      } else {
        totalEmailsFailed++;
      }
      
      results.push({ type: 'expired', count: expiredItems.length, success: result.success });
    }

    if (shouldSendWarning && warningItems.length > 0) {
      const weekStart = getRunPeriodKey('warning');
      
      const subjectTemplate = moduleEmailTemplate?.subject || defaultTemplate.email_subject;
      const bodyTemplate = moduleEmailTemplate?.body || defaultTemplate.email_body;
      
      const subject = testMode 
        ? `[TEST] 📅 Blížící se technické události - ${replaceVariables(subjectTemplate, warningItems.length, warningItems.length, 0, warningItems)}`
        : `📅 Blížící se technické události - ${replaceVariables(subjectTemplate, warningItems.length, warningItems.length, 0, warningItems)}`;
      
      const bodyText = replaceVariables(bodyTemplate, warningItems.length, warningItems.length, 0, warningItems);
      const tableHtml = buildDeadlinesTable(warningItems, 'warning');
      const fullBody = `${bodyText.replace(/\n/g, "<br>")}<br><br>${tableHtml}`;
      
      const result = await sendViaSMTP(finalRecipientEmails, subject, fullBody, deliveryMode, emailProviderSettings);
      
      await supabase.from("deadline_reminder_logs").insert({
        template_id: defaultTemplate.id,
        template_name: testMode ? "Blížící se technické události (TEST)" : "Blížící se technické události",
        recipient_emails: finalRecipientEmails,
        email_subject: subject,
        email_body: fullBody,
        status: result.success ? "sent" : "failed",
        error_message: result.error || null,
        is_test: testMode,
        week_start: weekStart,
        delivery_mode: deliveryMode,
        deadline_id: warningItems[0]?.id || null,
        equipment_id: warningItems[0]?.equipment_id || null,
        days_before: warningItems[0]?.days_until || null,
      });
      
      if (result.success) {
        totalEmailsSent++;
        console.log(`Sent warning deadline reminder with ${warningItems.length} items`);
      } else {
        totalEmailsFailed++;
      }
      
      results.push({ type: 'warning', count: warningItems.length, success: result.success });
    }
  } else {
    if (allDeadlineItems.length === 0) {
      console.log("No deadlines require reminders");
      return new Response(
        JSON.stringify({ message: "No deadlines require reminders", emailsSent: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const weekStart = getRunPeriodKey('all');
    const expiredCount = expiredItems.length;
    const expiringCount = warningItems.length;
    const totalCount = allDeadlineItems.length;

    const subjectTemplate = moduleEmailTemplate?.subject || defaultTemplate.email_subject;
    const bodyTemplate = moduleEmailTemplate?.body || defaultTemplate.email_body;

    const subject = testMode 
      ? `[TEST] ${replaceVariables(subjectTemplate, totalCount, expiringCount, expiredCount, allDeadlineItems)}`
      : replaceVariables(subjectTemplate, totalCount, expiringCount, expiredCount, allDeadlineItems);
    
    const bodyText = replaceVariables(bodyTemplate, totalCount, expiringCount, expiredCount, allDeadlineItems);
    const tableHtml = buildDeadlinesTable(allDeadlineItems, 'all');
    const fullBody = `${bodyText.replace(/\n/g, "<br>")}<br><br>${tableHtml}`;

    const result = await sendViaSMTP(finalRecipientEmails, subject, fullBody, deliveryMode, emailProviderSettings);

    await supabase.from("deadline_reminder_logs").insert({
      template_id: defaultTemplate.id,
      template_name: moduleEmailTemplate ? "Souhrnný email (Technické lhůty)" : defaultTemplate.name,
      recipient_emails: finalRecipientEmails,
      email_subject: subject,
      email_body: fullBody,
      status: result.success ? "sent" : "failed",
      error_message: result.error || null,
      is_test: testMode,
      week_start: weekStart,
      delivery_mode: deliveryMode,
      deadline_id: allDeadlineItems[0]?.id || null,
      equipment_id: allDeadlineItems[0]?.equipment_id || null,
      days_before: allDeadlineItems[0]?.days_until || null,
    });

    if (result.success) {
      totalEmailsSent++;
      console.log(`Sent deadline reminder to ${finalRecipientEmails.length} recipients with ${allDeadlineItems.length} deadlines`);
    } else {
      totalEmailsFailed++;
      console.error(`Failed to send deadline reminder:`, result.error);
    }

    results.push({
      template: moduleEmailTemplate ? "Souhrnný email (Technické lhůty)" : defaultTemplate.name,
      deadlinesCount: allDeadlineItems.length,
      recipientCount: finalRecipientEmails.length,
      success: result.success,
      error: result.error,
    });
  }

  console.log(`Deadline reminder run completed: ${totalEmailsSent} sent, ${totalEmailsFailed} failed`);

  return new Response(
    JSON.stringify({
      message: "Deadline reminder run completed",
      triggeredBy,
      testMode,
      emailsSent: totalEmailsSent,
      emailsFailed: totalEmailsFailed,
      totalDeadlines: allDeadlineItems.length,
      expiredCount: expiredItems.length,
      warningCount: warningItems.length,
      results,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
};

serve(handler);
