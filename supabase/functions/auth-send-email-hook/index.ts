// GoTrue "Send Email" Auth Hook.
//
// When enabled (GOTRUE_HOOK_SEND_EMAIL_ENABLED=true in docker-compose.supabase.yml),
// GoTrue stops sending auth emails (signup confirmation, password recovery, invite,
// email change, magic link, ...) through its own built-in SMTP mailer and instead
// POSTs the email payload here. This lets every auth email go through the SAME
// OAuth2-capable SMTP sender (_shared/smtp-sender.ts) already used for training
// reminders, configured once in Administrace → Připomínky (system_settings.email_provider)
// — instead of needing a second, separate basic-auth-only SMTP setup for GoTrue itself.
// This matters in particular for Microsoft 365: modern tenants increasingly disable
// basic-auth SMTP entirely, so GoTrue's native mailer (username+password only) often
// can't authenticate against M365 at all, while the OAuth2 client-credentials flow
// used here still works.
//
// Request verification follows the Standard Webhooks spec GoTrue uses for HTTP hooks:
// headers `webhook-id` / `webhook-timestamp` / `webhook-signature`, secret configured
// as GOTRUE_HOOK_SEND_EMAIL_SECRETS in the form "v1,whsec_<base64>". See
// https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSingleViaSMTP, type SmtpConfig } from "../_shared/smtp-sender.ts";

// Standard Webhooks tolerance: reject requests whose timestamp is further than
// this many seconds from "now" in either direction (clock skew + replay protection).
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function hmacSha256Base64(secretBytes: Uint8Array, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToBase64(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// GOTRUE_HOOK_SEND_EMAIL_SECRETS may hold several comma-separated secrets
// (for rotation), each "v1,whsec_<base64>". We accept a match against any of them.
function parseSecrets(raw: string): Uint8Array[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("whsec_"))
    .map((part) => base64ToBytes(part.slice("whsec_".length)));
}

async function verifyWebhookSignature(req: Request, rawBody: string): Promise<{ ok: boolean; error?: string }> {
  const secretsRaw = Deno.env.get("AUTH_HOOK_SECRET") || "";
  if (!secretsRaw) {
    return { ok: false, error: "AUTH_HOOK_SECRET is not configured on the functions service" };
  }

  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const signatureHeader = req.headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) {
    return { ok: false, error: "Missing webhook-id/webhook-timestamp/webhook-signature headers" };
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, error: "Invalid webhook-timestamp" };
  }
  const nowSeconds = Date.now() / 1000;
  if (Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, error: "webhook-timestamp outside tolerance window" };
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const secrets = parseSecrets(secretsRaw);
  if (secrets.length === 0) {
    return { ok: false, error: "AUTH_HOOK_SECRET has no valid whsec_ entries" };
  }

  // webhook-signature can contain multiple space-separated "v1,<sig>" values.
  const providedSignatures = signatureHeader
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.includes(",") ? s.split(",")[1] : s));

  for (const secretBytes of secrets) {
    const expected = await hmacSha256Base64(secretBytes, signedContent);
    for (const provided of providedSignatures) {
      if (timingSafeEqual(expected, provided)) {
        return { ok: true };
      }
    }
  }

  return { ok: false, error: "Signature verification failed" };
}

interface HookPayload {
  user: { email?: string };
  email_data: {
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    token_hash_new?: string;
    old_email?: string;
  };
}

function buildEmail(payload: HookPayload, apiExternalUrl: string): { subject: string; html: string } {
  const { email_action_type, token_hash, redirect_to, token_hash_new } = payload.email_data;
  const email = payload.user.email || "";

  // Mirrors GoTrue's own default template link shape: hitting /auth/v1/verify
  // validates the token and redirects the browser on to redirect_to with a
  // session established, exactly like the built-in mailer's links do.
  const verifyLink = (type: string, hash: string) =>
    `${apiExternalUrl}/auth/v1/verify?token=${encodeURIComponent(hash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(redirect_to)}`;

  const wrap = (title: string, bodyHtml: string) => `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">${title}</h1>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
          ${bodyHtml}
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Lhůtník — systém správy školení a technických lhůt</p>
      </div>
    </body>
    </html>
  `;

  switch (email_action_type) {
    case "recovery":
      return {
        subject: "Obnovení hesla — Lhůtník",
        html: wrap(
          "Obnovení hesla",
          `<p>Dobrý den,</p>
           <p>obdrželi jsme žádost o obnovení hesla k účtu <strong>${email}</strong>.</p>
           <p><a href="${verifyLink("recovery", token_hash)}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Nastavit nové heslo</a></p>
           <p style="color:#64748b;font-size:13px;">Pokud jste o obnovení hesla nežádali, tento email ignorujte — vaše heslo zůstane beze změny.</p>`,
        ),
      };
    case "invite":
      return {
        subject: "Pozvánka do systému Lhůtník",
        html: wrap(
          "Byli jste pozváni",
          `<p>Dobrý den,</p>
           <p>byl pro vás vytvořen účet v systému Lhůtník (<strong>${email}</strong>).</p>
           <p><a href="${verifyLink("invite", token_hash)}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Dokončit nastavení účtu</a></p>`,
        ),
      };
    case "email_change":
      return {
        subject: "Potvrzení změny emailu — Lhůtník",
        html: wrap(
          "Změna emailové adresy",
          `<p>Dobrý den,</p>
           <p>potvrďte prosím změnu emailové adresy vašeho účtu na <strong>${email}</strong>.</p>
           <p><a href="${verifyLink("email_change", token_hash_new || token_hash)}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Potvrdit novou adresu</a></p>`,
        ),
      };
    case "magiclink":
      return {
        subject: "Přihlašovací odkaz — Lhůtník",
        html: wrap(
          "Přihlášení",
          `<p>Dobrý den,</p>
           <p><a href="${verifyLink("magiclink", token_hash)}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Přihlásit se</a></p>`,
        ),
      };
    case "signup":
      return {
        subject: "Potvrzení registrace — Lhůtník",
        html: wrap(
          "Potvrďte svůj účet",
          `<p>Dobrý den,</p>
           <p><a href="${verifyLink("signup", token_hash)}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Potvrdit email</a></p>`,
        ),
      };
    default:
      // Any auth email type we don't special-case (reauthentication, MFA/notification
      // emails, ...) still gets a usable, generic message instead of silently failing.
      return {
        subject: `Lhůtník — ${email_action_type}`,
        html: wrap(
          "Upozornění systému Lhůtník",
          `<p>Dobrý den,</p>
           <p>${token_hash ? `<a href="${verifyLink(email_action_type, token_hash)}">Pokračovat</a>` : "Byla provedena akce týkající se zabezpečení vašeho účtu."}</p>`,
        ),
      };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  const rawBody = await req.text();

  const verification = await verifyWebhookSignature(req, rawBody);
  if (!verification.ok) {
    console.error("auth-send-email-hook: rejected request —", verification.error);
    return new Response(
      JSON.stringify({ error: { http_code: 401, message: verification.error || "Unauthorized" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(
      JSON.stringify({ error: { http_code: 400, message: "Invalid JSON payload" } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const toEmail = payload.email_data?.old_email && payload.email_data.email_action_type === "email_change"
    ? payload.email_data.old_email // confirm the change on the OLD address first, matching GoTrue's default double-confirmation flow when enabled
    : payload.user?.email;

  if (!toEmail) {
    console.error("auth-send-email-hook: payload has no recipient email", payload);
    return new Response(
      JSON.stringify({ error: { http_code: 400, message: "No recipient email in payload" } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: settings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "email_provider")
      .single();

    const emailProvider = (settings?.value || {}) as SmtpConfig;
    if (!emailProvider.smtp_host || !emailProvider.smtp_from_email) {
      // Don't fail loudly for the whole auth flow if SMTP just isn't configured yet —
      // but do report it clearly so it's visible in the functions container logs.
      console.error("auth-send-email-hook: SMTP not configured in system_settings.email_provider");
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "SMTP not configured" } }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const apiExternalUrl = Deno.env.get("API_EXTERNAL_URL") || supabaseUrl;
    const { subject, html } = buildEmail(payload, apiExternalUrl);

    const result = await sendSingleViaSMTP(toEmail, subject, html, emailProvider);
    if (!result.success) {
      console.error("auth-send-email-hook: SMTP send failed —", result.error);
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: result.error || "SMTP send failed" } }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Empty 200 response = success, per the Send Email Hook contract.
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("auth-send-email-hook: unexpected error", error);
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: error instanceof Error ? error.message : "Unexpected error" } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

serve(handler);
