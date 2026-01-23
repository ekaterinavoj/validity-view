import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authorization
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

  // Verify user is admin
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  
  if (claimsError || !claimsData.user) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Check if user has admin role
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

    // Load email provider settings
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

    // Send test email
    if (emailProvider.provider === "resend") {
      const apiKey = Deno.env.get("RESEND_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "RESEND_API_KEY not configured" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: "Training System <onboarding@resend.dev>",
          to: [email],
          subject: "Testovací email - Systém správy školení",
          html: `
            <h1>Testovací email</h1>
            <p>Tento email potvrzuje, že konfigurace emailů funguje správně.</p>
            <p>Datum a čas: ${new Date().toLocaleString("cs-CZ")}</p>
            <hr>
            <p><small>Systém správy školení</small></p>
          `,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return new Response(
          JSON.stringify({ error: `Failed to send email: ${error}` }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Test email sent successfully" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      // SMTP
      return new Response(
        JSON.stringify({ error: "SMTP sending not yet implemented" }),
        { status: 501, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: any) {
    console.error("Error in send-test-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);