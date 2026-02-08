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

// Send email via SMTP with BCC/To/CC support
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
  const fromName = emailProvider.smtp_from_name || "Technical Reminders";
  const authEnabled = emailProvider.smtp_auth_enabled !== false;
  const username = emailProvider.smtp_user;
  const password = emailProvider.smtp_password;
  const tlsMode = emailProvider.smtp_tls_mode || "starttls";

  if (!host || !fromEmail) {
    return { success: false, error: "SMTP host and from email are not configured", provider: "smtp" };
  }

  // Build recipient lists based on delivery mode
  let toRecipients: string[] = [];
  let ccRecipients: string[] = [];
  let bccRecipients: string[] = [];

  if (deliveryMode === "bcc") {
    toRecipients = [fromEmail];
    bccRecipients = recipients;
  } else if (deliveryMode === "cc") {
    toRecipients = [recipients[0]];
    if (recipients.length > 1) {
      ccRecipients = recipients.slice(1);
    }
  } else {
    toRecipients = recipients;
  }

  const allRecipients = [...toRecipients, ...ccRecipients, ...bccRecipients].filter(Boolean);

  if (allRecipients.length === 0) {
    return { success: false, error: "No recipients specified", provider: "smtp" };
  }

  let connection: Deno.TcpConn | Deno.TlsConn | null = null;

  try {
    console.log(`Connecting to SMTP server ${host}:${port}`);

    if (tlsMode === "smtps") {
      connection = await Deno.connectTls({ hostname: host, port });
    } else {
      connection = await Deno.connect({ hostname: host, port });
    }

    const reader = connection.readable.getReader();
    const writer = connection.writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readResponse = async (): Promise<string> => {
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
      await writer.write(encoder.encode(cmd + "\r\n"));
      const resp = await readResponse();
      return { code: parseInt(resp.substring(0, 3), 10), msg: resp };
    };

    // Read greeting
    const greeting = await readResponse();
    if (!greeting.startsWith("220")) throw new Error(`Invalid greeting: ${greeting}`);

    // EHLO
    let resp = await sendCommand(`EHLO ${host}`);
    if (resp.code !== 250) {
      resp = await sendCommand(`HELO ${host}`);
      if (resp.code !== 250) throw new Error(`HELO failed: ${resp.msg}`);
    }

    // STARTTLS if needed
    if (tlsMode === "starttls" && connection instanceof Deno.TcpConn) {
      resp = await sendCommand("STARTTLS");
      if (resp.code === 220) {
        reader.releaseLock();
        writer.releaseLock();
        connection = await Deno.startTls(connection, { hostname: host });
        
        const tlsReader = connection.readable.getReader();
        const tlsWriter = connection.writable.getWriter();

        const readTlsResp = async (): Promise<string> => {
          let response = "";
          while (true) {
            const { value, done } = await tlsReader.read();
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

        const sendTlsCmd = async (cmd: string): Promise<{ code: number; msg: string }> => {
          await tlsWriter.write(encoder.encode(cmd + "\r\n"));
          const r = await readTlsResp();
          return { code: parseInt(r.substring(0, 3), 10), msg: r };
        };

        // Re-EHLO after STARTTLS
        resp = await sendTlsCmd(`EHLO ${host}`);
        if (resp.code !== 250) throw new Error(`EHLO after STARTTLS failed: ${resp.msg}`);

        // AUTH if enabled
        if (authEnabled && username && password) {
          resp = await sendTlsCmd("AUTH LOGIN");
          if (resp.code === 334) {
            resp = await sendTlsCmd(btoa(username));
            if (resp.code === 334) {
              resp = await sendTlsCmd(btoa(password));
              if (resp.code !== 235) throw new Error(`AUTH failed: ${resp.msg}`);
            } else throw new Error(`AUTH username failed: ${resp.msg}`);
          } else {
            const authPlain = btoa(`\0${username}\0${password}`);
            resp = await sendTlsCmd(`AUTH PLAIN ${authPlain}`);
            if (resp.code !== 235) throw new Error(`AUTH PLAIN failed: ${resp.msg}`);
          }
        }

        // MAIL FROM
        resp = await sendTlsCmd(`MAIL FROM:<${fromEmail}>`);
        if (resp.code !== 250) throw new Error(`MAIL FROM failed: ${resp.msg}`);

        // RCPT TO
        for (const recipient of allRecipients) {
          resp = await sendTlsCmd(`RCPT TO:<${recipient}>`);
          if (resp.code !== 250 && resp.code !== 251) throw new Error(`RCPT TO failed: ${resp.msg}`);
        }

        // DATA
        resp = await sendTlsCmd("DATA");
        if (resp.code !== 354) throw new Error(`DATA failed: ${resp.msg}`);

        // Build email
        const fromHeader = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
        const date = new Date().toUTCString();
        const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${host}>`;

        let message = `From: ${fromHeader}\r\n`;
        message += `To: ${toRecipients.join(", ")}\r\n`;
        if (ccRecipients.length > 0) message += `Cc: ${ccRecipients.join(", ")}\r\n`;
        message += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\n`;
        message += `Date: ${date}\r\n`;
        message += `Message-ID: ${messageId}\r\n`;
        message += `MIME-Version: 1.0\r\n`;
        message += `Content-Type: text/html; charset=UTF-8\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n\r\n`;
        message += btoa(unescape(encodeURIComponent(body)));
        message += `\r\n.\r\n`;

        await tlsWriter.write(encoder.encode(message));
        const dataResp = await readTlsResp();
        const dataCode = parseInt(dataResp.substring(0, 3), 10);
        if (dataCode !== 250) throw new Error(`Message rejected: ${dataResp}`);

        await sendTlsCmd("QUIT");
        tlsReader.releaseLock();
        tlsWriter.releaseLock();
        connection.close();
        console.log("Email sent successfully via SMTP");
        return { success: true, provider: "smtp" };
      }
    }

    // Non-STARTTLS path (or STARTTLS not supported)
    if (authEnabled && username && password) {
      resp = await sendCommand("AUTH LOGIN");
      if (resp.code === 334) {
        resp = await sendCommand(btoa(username));
        if (resp.code === 334) {
          resp = await sendCommand(btoa(password));
          if (resp.code !== 235) throw new Error(`AUTH failed: ${resp.msg}`);
        } else throw new Error(`AUTH username failed: ${resp.msg}`);
      } else {
        const authPlain = btoa(`\0${username}\0${password}`);
        resp = await sendCommand(`AUTH PLAIN ${authPlain}`);
        if (resp.code !== 235) throw new Error(`AUTH PLAIN failed: ${resp.msg}`);
      }
    }

    // MAIL FROM
    resp = await sendCommand(`MAIL FROM:<${fromEmail}>`);
    if (resp.code !== 250) throw new Error(`MAIL FROM failed: ${resp.msg}`);

    // RCPT TO
    for (const recipient of allRecipients) {
      resp = await sendCommand(`RCPT TO:<${recipient}>`);
      if (resp.code !== 250 && resp.code !== 251) throw new Error(`RCPT TO failed: ${resp.msg}`);
    }

    // DATA
    resp = await sendCommand("DATA");
    if (resp.code !== 354) throw new Error(`DATA failed: ${resp.msg}`);

    // Build email
    const fromHeader = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
    const date = new Date().toUTCString();
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${host}>`;

    let message = `From: ${fromHeader}\r\n`;
    message += `To: ${toRecipients.join(", ")}\r\n`;
    if (ccRecipients.length > 0) message += `Cc: ${ccRecipients.join(", ")}\r\n`;
    message += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\n`;
    message += `Date: ${date}\r\n`;
    message += `Message-ID: ${messageId}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    message += `Content-Type: text/html; charset=UTF-8\r\n`;
    message += `Content-Transfer-Encoding: base64\r\n\r\n`;
    message += btoa(unescape(encodeURIComponent(body)));
    message += `\r\n.\r\n`;

    await writer.write(encoder.encode(message));
    const dataResp = await readResponse();
    const dataCode = parseInt(dataResp.substring(0, 3), 10);
    if (dataCode !== 250) throw new Error(`Message rejected: ${dataResp}`);

    await sendCommand("QUIT");
    reader.releaseLock();
    writer.releaseLock();
    connection.close();
    console.log("Email sent successfully via SMTP");
    return { success: true, provider: "smtp" };

  } catch (error: any) {
    console.error("SMTP error:", error.message);
    if (connection) try { connection.close(); } catch {}
    return { success: false, error: error.message, provider: "smtp" };
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

  // Fetch module-specific recipients and template settings from system_settings
  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["deadline_reminder_recipients", "deadline_email_template", "email_provider"]);
  
  let moduleRecipients: { user_ids: string[], delivery_mode: string } = { user_ids: [], delivery_mode: "bcc" };
  let moduleEmailTemplate: { subject: string, body: string } | null = null;
  let emailProviderSettings: { smtp_from_email: string, smtp_from_name: string } | null = null;
  
  if (settings) {
    for (const s of settings) {
      if (s.key === "deadline_reminder_recipients" && s.value && typeof s.value === "object") {
        moduleRecipients = s.value as typeof moduleRecipients;
      }
      if (s.key === "deadline_email_template" && s.value && typeof s.value === "object") {
        moduleEmailTemplate = s.value as { subject: string; body: string };
      }
      if (s.key === "email_provider" && s.value && typeof s.value === "object") {
        emailProviderSettings = s.value as typeof emailProviderSettings;
      }
    }
  }
  
  console.log(`Module recipients configured: ${moduleRecipients.user_ids?.length || 0} users, delivery_mode: ${moduleRecipients.delivery_mode}`);

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

  // Fetch deadline_responsibles junction table (new system)
  const deadlineIds = (deadlines || []).map(d => d.id).filter(Boolean);
  
  // Map: deadline_id -> Set of profile_ids (both direct and via groups)
  let deadlineResponsiblesMap = new Map<string, Set<string>>();
  
  if (deadlineIds.length > 0) {
    // Fetch direct profile responsibles
    const { data: directResponsibles } = await supabase
      .from("deadline_responsibles")
      .select("deadline_id, profile_id")
      .in("deadline_id", deadlineIds)
      .not("profile_id", "is", null);
    
    if (directResponsibles) {
      for (const r of directResponsibles) {
        const existing = deadlineResponsiblesMap.get(r.deadline_id) || new Set();
        existing.add(r.profile_id);
        deadlineResponsiblesMap.set(r.deadline_id, existing);
      }
    }
    
    // Fetch group responsibles and their members
    const { data: groupResponsibles } = await supabase
      .from("deadline_responsibles")
      .select("deadline_id, group_id")
      .in("deadline_id", deadlineIds)
      .not("group_id", "is", null);
    
    if (groupResponsibles && groupResponsibles.length > 0) {
      const groupIds = groupResponsibles.map(r => r.group_id);
      
      // Fetch members of these groups
      const { data: groupMembers } = await supabase
        .from("responsibility_group_members")
        .select("group_id, profile_id")
        .in("group_id", groupIds);
      
      if (groupMembers) {
        // Build group -> members map
        const groupMembersMap = new Map<string, string[]>();
        for (const m of groupMembers) {
          const existing = groupMembersMap.get(m.group_id) || [];
          existing.push(m.profile_id);
          groupMembersMap.set(m.group_id, existing);
        }
        
        // Add group members to deadline responsibles
        for (const gr of groupResponsibles) {
          const members = groupMembersMap.get(gr.group_id) || [];
          const existing = deadlineResponsiblesMap.get(gr.deadline_id) || new Set();
          members.forEach(m => existing.add(m));
          deadlineResponsiblesMap.set(gr.deadline_id, existing);
        }
      }
    }
  }

  // Collect all profile IDs for email lookup
  const allProfileIds = new Set<string>();
  for (const profileSet of deadlineResponsiblesMap.values()) {
    profileSet.forEach(id => allProfileIds.add(id));
  }
  // Also add template target_user_ids
  for (const template of templatesMap.values()) {
    if (template.target_user_ids) {
      template.target_user_ids.forEach(id => allProfileIds.add(id));
    }
  }
  
  const profileEmailMap = new Map<string, string>();
  
  if (allProfileIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", Array.from(allProfileIds));
    
    if (profiles) {
      for (const p of profiles) {
        profileEmailMap.set(p.id, p.email);
      }
    }
  }

  // Group deadlines by template for batch sending
  const deadlinesByTemplate = new Map<string, DeadlineItem[]>();
  // Track recipients per deadline (from deadline_responsibles)
  const recipientsByDeadline = new Map<string, Set<string>>();
  
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
        equipment_id: equipment.id,
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
      
      // Collect recipients from deadline_responsibles (new system)
      const deadlineProfileIds = deadlineResponsiblesMap.get(d.id) || new Set();
      const recipientSet = new Set<string>();
      
      for (const profileId of deadlineProfileIds) {
        const email = profileEmailMap.get(profileId);
        if (email) {
          recipientSet.add(email);
        }
      }
      
      recipientsByDeadline.set(d.id, recipientSet);
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

  // Combine all deadlines into a single summary email (using module-level configuration)
  // rather than per-template batching
  const allDeadlineItems: DeadlineItem[] = [];
  for (const items of deadlinesByTemplate.values()) {
    allDeadlineItems.push(...items);
  }
  
  // Sort by days until expiration (most urgent first)
  allDeadlineItems.sort((a, b) => a.days_until - b.days_until);

  // Build final recipient list: module recipients from system_settings
  // (priority) then fallback to template targets / responsible persons
  let finalRecipientEmails: string[] = [];
  
  // 1. First try module-level recipients from system_settings
  if (moduleRecipients.user_ids && moduleRecipients.user_ids.length > 0) {
    console.log(`Using module-level recipients: ${moduleRecipients.user_ids.length} users`);
    for (const profileId of moduleRecipients.user_ids) {
      const email = profileEmailMap.get(profileId);
      if (email) {
        finalRecipientEmails.push(email);
      }
    }
    
    // If profile emails not loaded yet, fetch them
    if (finalRecipientEmails.length === 0 && moduleRecipients.user_ids.length > 0) {
      const { data: moduleProfiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", moduleRecipients.user_ids);
      
      if (moduleProfiles) {
        for (const p of moduleProfiles) {
          finalRecipientEmails.push(p.email);
        }
      }
    }
  }
  
  // 2. Fallback to deadline_responsibles (new system) if no module recipients configured
  if (finalRecipientEmails.length === 0) {
    console.log("No module recipients, falling back to deadline responsibles");
    const allResponsibleEmails = new Set<string>();
    
    // Collect all emails from deadline_responsibles
    for (const [deadlineId, recipientSet] of recipientsByDeadline) {
      recipientSet.forEach(email => allResponsibleEmails.add(email));
    }
    
    // Fallback to template target_user_ids if still empty
    if (allResponsibleEmails.size === 0 && defaultTemplate.target_user_ids && defaultTemplate.target_user_ids.length > 0) {
      console.log("No responsible persons, using template target_user_ids as fallback");
      for (const profileId of defaultTemplate.target_user_ids) {
        const email = profileEmailMap.get(profileId);
        if (email) {
          allResponsibleEmails.add(email);
        }
      }
    }
    
    finalRecipientEmails = Array.from(allResponsibleEmails);
  }
  
  if (finalRecipientEmails.length === 0) {
    console.log("No recipients configured for deadline reminders");
    return new Response(
      JSON.stringify({ info: "No recipients configured for deadline reminders", emailsSent: 0 }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  
  console.log(`Final recipients: ${finalRecipientEmails.join(", ")}`);
  
  // Prepare email content using module-level template (from system_settings)
  // or fallback to the default deadline_reminder_template
  const expiredCount = allDeadlineItems.filter(d => d.days_until < 0).length;
  const expiringCount = allDeadlineItems.filter(d => d.days_until >= 0).length;
  const totalCount = allDeadlineItems.length;

  // Use moduleEmailTemplate if set, otherwise use default template
  const subjectTemplate = moduleEmailTemplate?.subject || defaultTemplate.email_subject;
  const bodyTemplate = moduleEmailTemplate?.body || defaultTemplate.email_body;

  const subject = testMode 
    ? `[TEST] ${replaceVariables(subjectTemplate, totalCount, expiringCount, expiredCount)}`
    : replaceVariables(subjectTemplate, totalCount, expiringCount, expiredCount);
  
  const bodyText = replaceVariables(bodyTemplate, totalCount, expiringCount, expiredCount);
  const tableHtml = buildDeadlinesTable(allDeadlineItems);
  const fullBody = `${bodyText}${tableHtml}`;
  
  const deliveryMode = moduleRecipients.delivery_mode || "bcc";
  const fromEmail = (emailProviderSettings as { smtp_from_email?: string, smtp_from_name?: string } | null)?.smtp_from_email;
  const fromName = (emailProviderSettings as { smtp_from_email?: string, smtp_from_name?: string } | null)?.smtp_from_name;

  // Send email
  const result = await sendViaResend(finalRecipientEmails, subject, fullBody, deliveryMode, fromEmail, fromName);

  // Log the send attempt
  const { error: logError } = await supabase
    .from("deadline_reminder_logs")
    .insert({
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

  if (logError) {
    console.error("Failed to log deadline reminder:", logError);
  }

  if (result.success) {
    totalEmailsSent++;
    console.log(`Sent deadline reminder to ${finalRecipientEmails.length} recipients with ${allDeadlineItems.length} deadlines`);
  } else {
    totalEmailsFailed++;
    console.error(`Failed to send deadline reminder:`, result.error);
  }

  results.push({
    template: moduleEmailTemplate ? "Souhrnný email (Technické lhůty)" : defaultTemplate.name,
    templateId: defaultTemplate.id,
    deadlinesCount: allDeadlineItems.length,
    recipientCount: finalRecipientEmails.length,
    recipientSource: moduleRecipients.user_ids?.length > 0 ? "module_settings" : "fallback",
    success: result.success,
    error: result.error,
  });

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
