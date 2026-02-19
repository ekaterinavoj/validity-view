import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface ExaminationItem {
  id: string;
  next_examination_date: string;
  employee_first_name: string;
  employee_last_name: string;
  employee_email: string;
  examination_type_name: string;
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

// Replace template variables
function replaceVariables(
  template: string, 
  totalCount: number, 
  expiringCount: number, 
  expiredCount: number
): string {
  const today = new Date();
  return template
    .replace(/\{+totalCount\}+/g, String(totalCount))
    .replace(/\{+expiringCount\}+/g, String(expiringCount))
    .replace(/\{+expiredCount\}+/g, String(expiredCount))
    .replace(/\{+reportDate\}+/g, formatDate(today.toISOString()));
}

// Build HTML table for examinations list
function buildExaminationsTable(examinations: ExaminationItem[]): string {
  if (examinations.length === 0) {
    return "<p>Žádné prohlídky k zobrazení.</p>";
  }

  let html = `
    <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Zaměstnanec</th>
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Email</th>
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Typ prohlídky</th>
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Vyprší</th>
          <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">Dnů</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const e of examinations) {
    const statusColor = e.days_until < 0 ? "#ef4444" : e.days_until <= 7 ? "#f59e0b" : "#22c55e";
    
    html += `
      <tr>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${e.employee_first_name} ${e.employee_last_name}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${e.employee_email}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${e.examination_type_name}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">${formatDate(e.next_examination_date)}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">
          <span style="background-color: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            ${formatDaysLabel(e.days_until)}
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

// Send email via SMTP
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
  const fromName = emailProvider.smtp_from_name || "Medical System";
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

        const boundary = `----=_Part_${Date.now()}`;
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
    console.log("Medical reminder email sent via SMTP");
    return { success: true, provider: "smtp" };
    
  } catch (error: any) {
    console.error("SMTP error:", error.message);
    if (connection) try { connection.close(); } catch {}
    return { success: false, error: error.message, provider: "smtp" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = Deno.env.get("X_CRON_SECRET");

    let isAuthorized = false;

    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      isAuthorized = true;
    }

    if (!isAuthorized && authHeader) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: roles } = await supabaseClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        
        if (roles?.some(r => r.role === "admin")) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Load settings
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["medical_reminder_recipients", "email_provider", "medical_email_template", "reminder_frequency"]);

    const settingsMap: Record<string, any> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value; });

    const recipients = settingsMap["medical_reminder_recipients"] || { user_ids: [], delivery_mode: "bcc" };
    const emailProvider = settingsMap["email_provider"] || {};
    const emailTemplate = settingsMap["medical_email_template"] || {
      subject: "Souhrn lékařských prohlídek - {reportDate}",
      body: "Dobrý den,\n\nzasíláme přehled lékařských prohlídek vyžadujících pozornost.\n\nCelkem: {totalCount}\n- Brzy vypršuje: {expiringCount}\n- Prošlé: {expiredCount}",
    };

    if (!recipients.user_ids || recipients.user_ids.length === 0) {
      console.log("No medical reminder recipients configured");
      return new Response(JSON.stringify({ 
        success: true, 
        info: "No recipients configured for medical reminders" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recipient emails
    const { data: recipientProfiles } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .in("id", recipients.user_ids);

    // Deduplicate emails (case-insensitive)
    const recipientEmails = [...new Set((recipientProfiles?.map(p => p.email.toLowerCase()).filter(Boolean)) || [])];

    if (recipientEmails.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        info: "No valid recipient emails found" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get examinations needing attention (expired or expiring within 30 days)
    const { data: examinations } = await supabase
      .from("medical_examinations")
      .select(`
        id,
        next_examination_date,
        employee:employees!medical_examinations_employee_id_fkey(first_name, last_name, email),
        examination_type:medical_examination_types!medical_examinations_examination_type_id_fkey(name)
      `)
      .eq("is_active", true)
      .is("deleted_at", null)
      .lte("next_examination_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

    if (!examinations || examinations.length === 0) {
      console.log("No examinations need attention");
      return new Response(JSON.stringify({ 
        success: true, 
        info: "No examinations require reminders" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const examinationItems: ExaminationItem[] = examinations.map(e => ({
      id: e.id,
      next_examination_date: e.next_examination_date,
      employee_first_name: (e.employee as any)?.first_name || "",
      employee_last_name: (e.employee as any)?.last_name || "",
      employee_email: (e.employee as any)?.email || "",
      examination_type_name: (e.examination_type as any)?.name || "",
      days_until: getDaysUntil(e.next_examination_date),
    }));

    const expiredItems = examinationItems.filter(e => e.days_until < 0);
    const expiringItems = examinationItems.filter(e => e.days_until >= 0);

    // Build email
    const subject = replaceVariables(
      emailTemplate.subject,
      examinationItems.length,
      expiringItems.length,
      expiredItems.length
    );

    let body = replaceVariables(
      emailTemplate.body,
      examinationItems.length,
      expiringItems.length,
      expiredItems.length
    );

    body = body.replace(/\n/g, "<br>");
    body += buildExaminationsTable(examinationItems);

    // Send email
    const result = await sendViaSMTP(
      recipientEmails,
      subject,
      body,
      recipients.delivery_mode || "bcc",
      emailProvider
    );

    // Log the reminder
    await supabase.from("medical_reminder_logs").insert({
      template_name: "Medical Summary",
      recipient_emails: recipientEmails,
      email_subject: subject,
      email_body: body,
      status: result.success ? "sent" : "failed",
      error_message: result.error || null,
      is_test: false,
      delivery_mode: recipients.delivery_mode || "bcc",
    });

    return new Response(JSON.stringify({ 
      success: result.success,
      emailsSent: result.success ? 1 : 0,
      recipientCount: result.success ? recipientEmails.length : 0,
      examinationsCount: examinationItems.length,
      error: result.error,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in run-medical-reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
