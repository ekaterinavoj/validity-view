import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Send email via SMTP
async function sendViaSMTP(
  to: string,
  subject: string,
  body: string,
  config: any
): Promise<{ success: boolean; error?: string; diagnostics?: any }> {
  const diagnostics: any = {
    host: config.smtp_host,
    port: config.smtp_port,
    authEnabled: config.smtp_auth_enabled !== false,
    tlsMode: config.smtp_tls_mode || "starttls",
    fromEmail: config.smtp_from_email,
  };

  try {
    // Build connection config
    const connectionConfig: any = {
      hostname: config.smtp_host,
      port: config.smtp_port || 587,
    };

    // TLS configuration
    if (config.smtp_tls_mode === "smtps") {
      connectionConfig.tls = true;
    } else if (config.smtp_tls_mode === "starttls") {
      connectionConfig.tls = false; // Will upgrade via STARTTLS
    } else {
      connectionConfig.tls = false;
    }

    // Auth configuration - only if enabled
    if (config.smtp_auth_enabled !== false) {
      const smtpPassword = config.smtp_password || Deno.env.get("SMTP_PASSWORD");
      if (!smtpPassword) {
        return { 
          success: false, 
          error: "SMTP heslo není nastaveno. Nastavte heslo v konfiguraci SMTP.",
          diagnostics: { ...diagnostics, errorType: "missing_password" }
        };
      }
      connectionConfig.auth = {
        username: config.smtp_user,
        password: smtpPassword,
      };
    }

    console.log("SMTP connection config:", {
      ...connectionConfig,
      auth: connectionConfig.auth ? { username: connectionConfig.auth.username, password: "***" } : "none"
    });

    const client = new SMTPClient({
      connection: connectionConfig,
    });

    await client.send({
      from: `${config.smtp_from_name || "Training System"} <${config.smtp_from_email}>`,
      to: to,
      subject: subject,
      html: body,
    });

    await client.close();
    return { success: true, diagnostics };
  } catch (error: any) {
    console.error("SMTP error:", error);
    return { 
      success: false, 
      error: error.message,
      diagnostics: { ...diagnostics, errorDetails: error.toString() }
    };
  }
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
