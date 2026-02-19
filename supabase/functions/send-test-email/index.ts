import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Send email via native SMTP (no external library)
async function sendViaSMTP(
  to: string,
  subject: string,
  body: string,
  config: any
): Promise<{ success: boolean; error?: string; diagnostics?: any }> {
  const host = config.smtp_host;
  const port = config.smtp_port || 587;
  const fromEmail = config.smtp_from_email;
  const fromName = config.smtp_from_name || "Training System";
  const authEnabled = config.smtp_auth_enabled !== false;
  const username = config.smtp_user;
  const password = config.smtp_password;
  const tlsMode = config.smtp_tls_mode || "starttls";

  const diagnostics: any = {
    host,
    port,
    authEnabled,
    tlsMode,
    fromEmail,
  };

  if (!host || !fromEmail) {
    return { 
      success: false, 
      error: "SMTP host and from email are not configured", 
      diagnostics 
    };
  }

  let connection: Deno.TcpConn | Deno.TlsConn | null = null;
  let isTlsConnection = false;

  try {
    console.log(`Connecting to SMTP server ${host}:${port}`);

    // Initial connection
    if (tlsMode === "smtps") {
      connection = await Deno.connectTls({ hostname: host, port });
      isTlsConnection = true;
    } else {
      connection = await Deno.connect({ hostname: host, port });
      isTlsConnection = false;
    }

    const reader = connection.readable.getReader();
    const writer = connection.writable.getWriter();

    // Helper to read response
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

    // Helper to send command
    const sendCommand = async (cmd: string): Promise<{ code: number; msg: string }> => {
      const encoder = new TextEncoder();
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

    // STARTTLS if needed and not already TLS
    if (tlsMode === "starttls" && !isTlsConnection) {
      resp = await sendCommand("STARTTLS");
      if (resp.code === 220) {
        try {
          reader.releaseLock();
          writer.releaseLock();
          connection = await Deno.startTls(connection as Deno.TcpConn, { hostname: host });
          isTlsConnection = true;
          
          const tlsReader = connection.readable.getReader();
          const tlsWriter = connection.writable.getWriter();
          
          await sendEmailContent(tlsWriter, tlsReader, host, authEnabled, username, password, 
            fromEmail, fromName, to, subject, body);
          
          tlsReader.releaseLock();
          tlsWriter.releaseLock();
          connection.close();
          console.log("Test email sent successfully via SMTP with STARTTLS");
          return { success: true, diagnostics };
        } catch (tlsError: any) {
          console.warn(`STARTTLS upgrade failed (${tlsError.message}), reconnecting without TLS`);
          if (connection) try { connection.close(); } catch {}
          
          connection = await Deno.connect({ hostname: host, port });
          const plainReader = connection.readable.getReader();
          const plainWriter = connection.writable.getWriter();
          
          const readPlain = async (): Promise<string> => {
            const decoder = new TextDecoder();
            let resp = "";
            while (true) {
              const { value, done } = await plainReader.read();
              if (done) break;
              resp += decoder.decode(value, { stream: true });
              if (resp.includes("\r\n")) {
                const lines = resp.split("\r\n");
                const lastLine = lines[lines.length - 2] || lines[lines.length - 1];
                if (lastLine.length >= 4 && lastLine[3] !== '-') break;
              }
            }
            return resp;
          };
          
          await readPlain(); // greeting
          
          await sendEmailContent(plainWriter, plainReader, host, authEnabled, username, password,
            fromEmail, fromName, to, subject, body);
          
          plainReader.releaseLock();
          plainWriter.releaseLock();
          connection.close();
          console.log("Test email sent via plain SMTP (STARTTLS fallback)");
          return { success: true, diagnostics };
        }
      }
    }

    // Send email with current connection
    await sendEmailContent(writer, reader, host, authEnabled, username, password,
      fromEmail, fromName, to, subject, body);
    
    reader.releaseLock();
    writer.releaseLock();
    connection.close();
    console.log("Test email sent successfully via SMTP");
    return { success: true, diagnostics };
    
  } catch (error: any) {
    console.error("SMTP error:", error.message);
    if (connection) try { connection.close(); } catch {}
    return { 
      success: false, 
      error: error.message,
      diagnostics: { ...diagnostics, errorDetails: error.toString() }
    };
  }
}

async function sendEmailContent(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  host: string,
  authEnabled: boolean,
  username: string,
  password: string,
  fromEmail: string,
  fromName: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const readResp = async (): Promise<string> => {
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

  const sendCmd = async (cmd: string): Promise<{ code: number; msg: string }> => {
    await writer.write(encoder.encode(cmd + "\r\n"));
    const resp = await readResp();
    return { code: parseInt(resp.substring(0, 3), 10), msg: resp };
  };

  // Re-EHLO after STARTTLS
  let resp = await sendCmd(`EHLO ${host}`);
  if (resp.code !== 250) throw new Error(`EHLO failed: ${resp.msg}`);

  // AUTH if enabled
  if (authEnabled && username && password) {
    resp = await sendCmd("AUTH LOGIN");
    if (resp.code === 334) {
      resp = await sendCmd(btoa(username));
      if (resp.code === 334) {
        resp = await sendCmd(btoa(password));
        if (resp.code !== 235) throw new Error(`AUTH failed: ${resp.msg}`);
      } else throw new Error(`AUTH username failed: ${resp.msg}`);
    } else {
      const authPlain = btoa(`\0${username}\0${password}`);
      resp = await sendCmd(`AUTH PLAIN ${authPlain}`);
      if (resp.code !== 235) throw new Error(`AUTH PLAIN failed: ${resp.msg}`);
    }
  }

  // MAIL FROM
  resp = await sendCmd(`MAIL FROM:<${fromEmail}>`);
  if (resp.code !== 250) throw new Error(`MAIL FROM failed: ${resp.msg}`);

  // RCPT TO
  resp = await sendCmd(`RCPT TO:<${to}>`);
  if (resp.code !== 250 && resp.code !== 251) throw new Error(`RCPT TO failed: ${resp.msg}`);

  // DATA
  resp = await sendCmd("DATA");
  if (resp.code !== 354) throw new Error(`DATA failed: ${resp.msg}`);

  // Build email
  const fromHeader = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
  const date = new Date().toUTCString();
  const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${host}>`;

  let message = `From: ${fromHeader}\r\n`;
  message += `To: ${to}\r\n`;
  message += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\n`;
  message += `Date: ${date}\r\n`;
  message += `Message-ID: ${messageId}\r\n`;
  message += `MIME-Version: 1.0\r\n`;
  message += `Content-Type: text/html; charset=UTF-8\r\n`;
  message += `Content-Transfer-Encoding: base64\r\n\r\n`;
  message += btoa(unescape(encodeURIComponent(body)));
  message += `\r\n.\r\n`;

  await writer.write(encoder.encode(message));
  
  const dataResp = await readResp();
  const dataCode = parseInt(dataResp.substring(0, 3), 10);
  if (dataCode !== 250) throw new Error(`Message rejected: ${dataResp}`);

  await sendCmd("QUIT");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  
  if (claimsError || !claimsData.user) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", claimsData.user.id)
    .eq("role", "admin");

  if (!roles?.length) {
    return new Response(
      JSON.stringify({ error: "Admin access required" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await supabaseService
      .from("system_settings")
      .select("value")
      .eq("key", "email_provider")
      .single();

    const emailProvider = settings?.value || {};
    
    // Check if SMTP is configured
    if (!emailProvider.smtp_host || !emailProvider.smtp_from_email) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "SMTP server není nakonfigurován. Vyplňte SMTP host a email odesílatele.",
          configurationRequired: true,
          provider: "smtp"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subject = "Testovací email - Systém správy školení";
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
          .footer { padding: 15px; text-align: center; color: #64748b; font-size: 12px; }
          .info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .success { color: #16a34a; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Testovací email</h1>
          </div>
          <div class="content">
            <p class="success">Konfigurace SMTP serveru funguje správně!</p>
            <p>Tento email potvrzuje, že váš SMTP server je nakonfigurován a emaily jsou úspěšně odesílány.</p>
            
            <div class="info">
              <strong>Konfigurace:</strong><br>
              Server: ${emailProvider.smtp_host}:${emailProvider.smtp_port || 587}<br>
              Odesílatel: ${emailProvider.smtp_from_email}<br>
              Autorizace: ${emailProvider.smtp_auth_enabled !== false ? "Ano" : "Ne"}<br>
              Zabezpečení: ${emailProvider.smtp_tls_mode || "starttls"}
            </div>
            
            <p>Datum a čas: ${new Date().toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}</p>
          </div>
          <div class="footer">
            <p>Systém správy školení a technických lhůt</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendViaSMTP(email, subject, htmlBody, emailProvider);

    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Nepodařilo se odeslat email: ${result.error}`,
          provider: "smtp",
          diagnostics: result.diagnostics
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Testovací email byl úspěšně odeslán na ${email}`, 
        provider: "smtp",
        diagnostics: result.diagnostics
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-test-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
