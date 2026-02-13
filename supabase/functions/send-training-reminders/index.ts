import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface ReminderTemplate {
  id: string;
  name: string;
  remind_days_before: number;
  repeat_interval_days: number | null;
  email_subject: string;
  email_body: string;
  is_active: boolean;
  target_user_ids: string[] | null;
}

interface Training {
  id: string;
  next_training_date: string;
  employee_id: string;
  reminder_template_id: string | null;
  training_types: Array<{
    name: string;
  }> | { name: string } | null;
  employees: Array<{
    first_name: string;
    last_name: string;
    email: string;
  }> | { first_name: string; last_name: string; email: string } | null;
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
  const fromName = emailProvider.smtp_from_name || "Training System";
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
    console.log("Training reminder email sent via SMTP");
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

  // Verify authorization (cron secret or admin JWT)
  const cronSecret = req.headers.get("x-cron-secret");
  const envCronSecret = Deno.env.get("X_CRON_SECRET") || Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization");
  
  const isCronRequest = cronSecret && envCronSecret && cronSecret === envCronSecret;
  let isAuthorizedAdmin = false;

  if (!isCronRequest && authHeader?.startsWith("Bearer ")) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting training reminder check...");

    // Get email provider settings
    const { data: providerSettings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "email_provider")
      .single();

    const emailProvider = providerSettings?.value || {};

    // Check if SMTP is configured
    if (!emailProvider.smtp_host || !emailProvider.smtp_from_email) {
      console.warn("SMTP server is not configured");
      return new Response(
        JSON.stringify({ 
          message: "SMTP server není nakonfigurován",
          info: "Pro odesílání emailů je potřeba nastavit SMTP server v administraci.",
          total_emails_sent: 0,
          results: []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Získat všechny aktivní šablony připomínek
    const { data: templates, error: templatesError } = await supabase
      .from("reminder_templates")
      .select("*")
      .eq("is_active", true);

    if (templatesError) {
      console.error("Error fetching templates:", templatesError);
      throw templatesError;
    }

    if (!templates || templates.length === 0) {
      console.log("No active reminder templates found");
      return new Response(
        JSON.stringify({ message: "No active templates", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${templates.length} active reminder templates`);

    let totalEmailsSent = 0;
    const results = [];

    // Projít všechny šablony
    for (const template of templates as ReminderTemplate[]) {
      console.log(`Processing template: ${template.name} (${template.id})`);

      // Najít školení, která potřebují připomínku podle této šablony
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + template.remind_days_before);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      console.log(`Looking for trainings with next_training_date around ${targetDateStr}`);

      const { data: trainings, error: trainingsError } = await supabase
        .from("trainings")
        .select(`
          id,
          next_training_date,
          employee_id,
          reminder_template_id,
          training_types (name),
          employees (first_name, last_name, email)
        `)
        .eq("is_active", true)
        .is("deleted_at", null)
        .lte("next_training_date", targetDateStr)
        .gte("next_training_date", new Date().toISOString().split("T")[0]);

      if (trainingsError) {
        console.error("Error fetching trainings:", trainingsError);
        continue;
      }

      console.log(`Found ${trainings?.length || 0} trainings for this template`);

      if (!trainings || trainings.length === 0) continue;

      // Získat seznam příjemců
      let recipients: string[] = [];
      
      if (template.target_user_ids && template.target_user_ids.length > 0) {
        // Konkrétní uživatelé ze šablony
        const { data: users, error: usersError } = await supabase
          .from("profiles")
          .select("email")
          .in("id", template.target_user_ids);

        if (usersError) {
          console.error("Error fetching target users:", usersError);
          continue;
        }

        recipients = users?.map(u => u.email).filter(Boolean) || [];
      } else {
        // Všichni admins a managers
        const { data: userRoles, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "manager"]);

        if (rolesError) {
          console.error("Error fetching user roles:", rolesError);
          continue;
        }

        // Deduplicate user IDs (user can have both admin and manager roles)
        const userIds = [...new Set(userRoles?.map(r => r.user_id) || [])];
        
        if (userIds.length > 0) {
          const { data: users, error: usersError } = await supabase
            .from("profiles")
            .select("email")
            .in("id", userIds);

          if (usersError) {
            console.error("Error fetching users:", usersError);
            continue;
          }

          recipients = users?.map(u => u.email).filter(Boolean) || [];
        }
      }
      
      // Deduplicate recipient emails (case-insensitive)
      recipients = [...new Set(recipients.map(e => e.toLowerCase()))];

      if (recipients.length === 0) {
        console.log(`No recipients found for template ${template.name}`);
        continue;
      }

      console.log(`Sending reminders to ${recipients.length} recipients`);

      // Odeslat email pro každé školení
      for (const training of trainings as Training[]) {
        const daysRemaining = Math.ceil(
          (new Date(training.next_training_date).getTime() - new Date().getTime()) / 
          (1000 * 60 * 60 * 24)
        );

        // Nahradit proměnné v šabloně
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
        
        const subject = template.email_subject
          .replace(/\{\{training_name\}\}/g, trainingName)
          .replace(/\{\{days_remaining\}\}/g, daysRemaining.toString())
          .replace(/\{\{employee_name\}\}/g, employeeName);

        const body = template.email_body
          .replace(/\{\{training_name\}\}/g, trainingName)
          .replace(/\{\{days_remaining\}\}/g, daysRemaining.toString())
          .replace(/\{\{employee_name\}\}/g, employeeName);

        // Odeslat email všem příjemcům via SMTP
        try {
          const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Připomínka školení</h2>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                ${body.split('\n').map(line => `<p style="margin: 10px 0;">${line}</p>`).join('')}
              </div>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">
                Tento email byl odeslán automaticky systémem evidence školení.
              </p>
            </div>
          `;

          const result = await sendViaSMTP(recipients, subject, htmlBody, "bcc", emailProvider);

          if (result.success) {
            console.log(`Email sent for training ${training.id}`);
            totalEmailsSent++;

            // Uložit log o odeslaném emailu
            const { error: logError } = await supabase
              .from("reminder_logs")
              .insert({
                training_id: training.id,
                template_id: template.id,
                template_name: template.name,
                recipient_emails: recipients,
                email_subject: subject,
                email_body: body,
                status: "sent",
                provider_used: "smtp",
              });

            if (logError) {
              console.error("Failed to log email:", logError);
            }

            results.push({
              training_id: training.id,
              template: template.name,
              recipients: recipients.length,
              status: "sent",
            });
          } else {
            throw new Error(result.error);
          }
        } catch (emailError: any) {
          console.error(`Failed to send email for training ${training.id}:`, emailError);
          
          // Uložit log o chybě
          const { error: logError } = await supabase
            .from("reminder_logs")
            .insert({
              training_id: training.id,
              template_id: template.id,
              template_name: template.name,
              recipient_emails: recipients,
              email_subject: subject,
              email_body: body,
              status: "failed",
              error_message: emailError.message,
              provider_used: "smtp",
            });

          if (logError) {
            console.error("Failed to log error:", logError);
          }

          results.push({
            training_id: training.id,
            template: template.name,
            status: "failed",
            error: emailError.message,
          });
        }
      }
    }

    console.log(`Reminder check completed. Total emails sent: ${totalEmailsSent}`);

    return new Response(
      JSON.stringify({
        message: "Reminder check completed",
        total_emails_sent: totalEmailsSent,
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-training-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
