import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Send email via Resend
async function sendViaResend(to: string, subject: string, body: string, fromEmail: string, fromName: string): Promise<{ success: boolean; error?: string }> {
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
        from: `${fromName} <${fromEmail || "onboarding@resend.dev"}>`,
        to: [to],
        subject,
        html: body,
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
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  if (!smtpPassword) {
    return { success: false, error: "SMTP_PASSWORD not configured" };
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: config.smtp_host,
        port: config.smtp_port || 587,
        tls: config.smtp_tls_mode === "smtps",
        auth: {
          username: config.smtp_user,
          password: smtpPassword,
        },
      },
    });

    await client.send({
      from: `${config.smtp_from_name || "Training System"} <${config.smtp_from_email}>`,
      to: to,
      subject: subject,
      html: body,
    });

    await client.close();
    return { success: true };
  } catch (error: any) {
    console.error("SMTP error:", error);
    return { success: false, error: error.message };
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

    const emailProvider = settings?.value || { provider: "resend" };
    const subject = "Testovací email - Systém správy školení";
    const htmlBody = `
      <h1>Testovací email</h1>
      <p>Tento email potvrzuje, že konfigurace emailů funguje správně.</p>
      <p>Poskytovatel: <strong>${emailProvider.provider}</strong></p>
      <p>Datum a čas: ${new Date().toLocaleString("cs-CZ")}</p>
      <hr>
      <p><small>Systém správy školení</small></p>
    `;

    let result: { success: boolean; error?: string };
    let providerUsed = emailProvider.provider;

    if (emailProvider.provider === "smtp" || emailProvider.provider === "smtp_with_resend_fallback") {
      result = await sendViaSMTP(email, subject, htmlBody, emailProvider);
      providerUsed = "smtp";
      
      // Fallback to Resend if SMTP fails
      if (!result.success && emailProvider.provider === "smtp_with_resend_fallback") {
        console.log("SMTP failed, falling back to Resend:", result.error);
        result = await sendViaResend(email, subject, htmlBody, emailProvider.smtp_from_email, emailProvider.smtp_from_name);
        if (result.success) {
          providerUsed = "resend (fallback)";
        }
      }
    } else {
      result = await sendViaResend(email, subject, htmlBody, "onboarding@resend.dev", "Training System");
      providerUsed = "resend";
    }

    if (!result.success) {
      // Check if it's a configuration issue vs actual sending error
      const isConfigError = result.error?.includes("not configured");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: isConfigError 
            ? `Email služba není nakonfigurována. Pro odesílání emailů nastavte RESEND_API_KEY nebo SMTP.`
            : `Nepodařilo se odeslat: ${result.error}`, 
          provider: providerUsed,
          configurationRequired: isConfigError
        }),
        { status: isConfigError ? 200 : 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Test email sent via ${providerUsed}`, provider: providerUsed }),
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