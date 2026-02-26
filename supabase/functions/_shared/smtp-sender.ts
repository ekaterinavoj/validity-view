// Shared SMTP sender with M365 OAuth2 (XOAUTH2) support
// Used by all reminder and test email edge functions

export interface SmtpConfig {
  smtp_host: string;
  smtp_port?: number;
  smtp_from_email: string;
  smtp_from_name?: string;
  smtp_auth_enabled?: boolean;
  smtp_auth_type?: "basic" | "oauth2_m365";
  smtp_user?: string;
  smtp_password?: string;
  smtp_tls_mode?: string;
  smtp_ignore_tls?: boolean;
  // M365 OAuth2 fields
  smtp_oauth_tenant_id?: string;
  smtp_oauth_client_id?: string;
  smtp_oauth_client_secret?: string;
}

interface SmtpResult {
  success: boolean;
  error?: string;
  provider: string;
}

// ---- M365 OAuth2 helpers ----

async function getM365OAuthToken(config: SmtpConfig): Promise<string> {
  const { smtp_oauth_tenant_id, smtp_oauth_client_id, smtp_oauth_client_secret } = config;
  if (!smtp_oauth_tenant_id || !smtp_oauth_client_id || !smtp_oauth_client_secret) {
    throw new Error("M365 OAuth2: tenant_id, client_id a client_secret jsou povinné");
  }
  const tokenUrl = `https://login.microsoftonline.com/${smtp_oauth_tenant_id}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: smtp_oauth_client_id,
    client_secret: smtp_oauth_client_secret,
    scope: "https://outlook.office365.com/.default",
  });
  console.log(`Fetching M365 OAuth token...`);
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`M365 OAuth token error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  if (!data.access_token) throw new Error("M365 OAuth: access_token not found");
  console.log("M365 OAuth token obtained");
  return data.access_token;
}

function buildXOAuth2Token(user: string, accessToken: string): string {
  return btoa(`user=${user}\x01auth=Bearer ${accessToken}\x01\x01`);
}

// ---- Low-level SMTP helpers ----

function makeReadResponse(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  return async (): Promise<string> => {
    let response = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      response += decoder.decode(value, { stream: true });
      if (response.includes("\r\n")) {
        const lines = response.split("\r\n");
        const lastLine = lines[lines.length - 2] || lines[lines.length - 1];
        if (lastLine.length >= 4 && lastLine[3] !== "-") break;
      }
    }
    return response;
  };
}

function makeSendCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  readResponse: () => Promise<string>
) {
  const encoder = new TextEncoder();
  return async (cmd: string): Promise<{ code: number; msg: string }> => {
    await writer.write(encoder.encode(cmd + "\r\n"));
    const resp = await readResponse();
    return { code: parseInt(resp.substring(0, 3), 10), msg: resp };
  };
}

async function performAuth(
  sendCmd: (cmd: string) => Promise<{ code: number; msg: string }>,
  config: SmtpConfig
): Promise<void> {
  const authEnabled = config.smtp_auth_enabled !== false;
  if (!authEnabled) return;
  const authType = config.smtp_auth_type || "basic";

  if (authType === "oauth2_m365") {
    const user = config.smtp_from_email || config.smtp_user || "";
    const accessToken = await getM365OAuthToken(config);
    const xoauth2Token = buildXOAuth2Token(user, accessToken);
    const resp = await sendCmd(`AUTH XOAUTH2 ${xoauth2Token}`);
    if (resp.code !== 235) throw new Error(`AUTH XOAUTH2 failed (${resp.code}): ${resp.msg}`);
    console.log("SMTP AUTH XOAUTH2 successful");
  } else {
    const username = config.smtp_user;
    const password = config.smtp_password;
    if (!username || !password) return;
    let resp = await sendCmd("AUTH LOGIN");
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
}

async function sendEmailData(
  sendCmd: (cmd: string) => Promise<{ code: number; msg: string }>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  readResponse: () => Promise<string>,
  fromEmail: string,
  fromName: string,
  toRecipients: string[],
  bccRecipients: string[],
  allRecipients: string[],
  subject: string,
  body: string,
  host: string
): Promise<void> {
  let resp = await sendCmd(`MAIL FROM:<${fromEmail}>`);
  if (resp.code !== 250) throw new Error(`MAIL FROM failed: ${resp.msg}`);
  for (const rcpt of allRecipients) {
    resp = await sendCmd(`RCPT TO:<${rcpt}>`);
    if (resp.code !== 250 && resp.code !== 251) throw new Error(`RCPT TO failed: ${resp.msg}`);
  }
  resp = await sendCmd("DATA");
  if (resp.code !== 354) throw new Error(`DATA failed: ${resp.msg}`);

  const emailData = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${toRecipients.join(", ")}`,
    bccRecipients.length > 0 ? `Bcc: ${bccRecipients.join(", ")}` : "",
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).substring(2)}@${host}>`,
    "MIME-Version: 1.0",
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    btoa(unescape(encodeURIComponent(body))),
    ".",
  ].filter(Boolean).join("\r\n");

  await writer.write(new TextEncoder().encode(emailData + "\r\n"));
  const dataResp = await readResponse();
  const dataCode = parseInt(dataResp.substring(0, 3), 10);
  if (dataCode !== 250) throw new Error(`Message rejected: ${dataResp}`);
  await sendCmd("QUIT");
}

// ---- Full SMTP session with STARTTLS + fallback ----

async function doSmtpSession(
  connection: Deno.TcpConn | Deno.TlsConn,
  host: string,
  config: SmtpConfig,
  fromEmail: string,
  fromName: string,
  toRecipients: string[],
  bccRecipients: string[],
  allRecipients: string[],
  subject: string,
  body: string
): Promise<void> {
  const reader = connection.readable.getReader();
  const writer = connection.writable.getWriter();
  const readResponse = makeReadResponse(reader);
  const sendCommand = makeSendCommand(writer, readResponse);

  const greeting = await readResponse();
  if (!greeting.startsWith("220")) throw new Error(`Invalid greeting: ${greeting}`);

  let resp = await sendCommand(`EHLO ${host}`);
  if (resp.code !== 250) {
    resp = await sendCommand(`HELO ${host}`);
    if (resp.code !== 250) throw new Error(`HELO failed: ${resp.msg}`);
  }

  const tlsMode = config.smtp_tls_mode || "starttls";

  if (tlsMode === "starttls") {
    resp = await sendCommand("STARTTLS");
    if (resp.code === 220) {
      try {
        reader.releaseLock();
        writer.releaseLock();
        const tlsConn = await Deno.startTls(connection as Deno.TcpConn, { hostname: host });

        const tlsReader = tlsConn.readable.getReader();
        const tlsWriter = tlsConn.writable.getWriter();
        const tlsReadResponse = makeReadResponse(tlsReader);
        const tlsSendCommand = makeSendCommand(tlsWriter, tlsReadResponse);

        await tlsSendCommand(`EHLO ${host}`);
        await performAuth(tlsSendCommand, config);
        await sendEmailData(
          tlsSendCommand, tlsWriter, tlsReadResponse,
          fromEmail, fromName, toRecipients, bccRecipients, allRecipients,
          subject, body, host
        );

        tlsReader.releaseLock();
        tlsWriter.releaseLock();
        tlsConn.close();
        return;
      } catch (tlsError: any) {
        console.warn(`STARTTLS failed (${tlsError.message}), reconnecting plain`);
        try { connection.close(); } catch {}
        // Fallback: reconnect without TLS
        const plainConn = await Deno.connect({ hostname: host, port: config.smtp_port || 587 });
        const pr = plainConn.readable.getReader();
        const pw = plainConn.writable.getWriter();
        const pRead = makeReadResponse(pr);
        const pSend = makeSendCommand(pw, pRead);
        await pRead(); // greeting
        await pSend(`EHLO ${host}`);
        await performAuth(pSend, config);
        await sendEmailData(pSend, pw, pRead, fromEmail, fromName, toRecipients, bccRecipients, allRecipients, subject, body, host);
        pr.releaseLock();
        pw.releaseLock();
        plainConn.close();
        return;
      }
    }
  }

  // Non-STARTTLS path (smtps or none)
  await performAuth(sendCommand, config);
  await sendEmailData(
    sendCommand, writer, readResponse,
    fromEmail, fromName, toRecipients, bccRecipients, allRecipients,
    subject, body, host
  );
  reader.releaseLock();
  writer.releaseLock();
  connection.close();
}

/**
 * Send email via SMTP. Supports basic auth and M365 OAuth2 (XOAUTH2).
 */
export async function sendViaSMTP(
  recipients: string[],
  subject: string,
  body: string,
  deliveryMode: string,
  emailProvider: SmtpConfig
): Promise<SmtpResult> {
  const host = emailProvider.smtp_host;
  const port = emailProvider.smtp_port || 587;
  const fromEmail = emailProvider.smtp_from_email;
  const fromName = emailProvider.smtp_from_name || "System";
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

  try {
    console.log(`Connecting to SMTP ${host}:${port} (${tlsMode})`);
    let connection: Deno.TcpConn | Deno.TlsConn;
    if (tlsMode === "smtps") {
      connection = await Deno.connectTls({ hostname: host, port });
    } else {
      connection = await Deno.connect({ hostname: host, port });
    }

    await doSmtpSession(
      connection, host, emailProvider,
      fromEmail, fromName, toRecipients, bccRecipients, allRecipients,
      subject, body
    );

    console.log("Email sent via SMTP");
    return { success: true, provider: "smtp" };
  } catch (error: any) {
    console.error("SMTP error:", error.message);
    return { success: false, error: error.message, provider: "smtp" };
  }
}

/**
 * Send a single test email (simpler interface)
 */
export async function sendSingleViaSMTP(
  to: string,
  subject: string,
  body: string,
  config: SmtpConfig
): Promise<{ success: boolean; error?: string; diagnostics?: any }> {
  const result = await sendViaSMTP([to], subject, body, "to", config);
  return {
    success: result.success,
    error: result.error,
    diagnostics: {
      host: config.smtp_host,
      port: config.smtp_port || 587,
      authType: config.smtp_auth_type || "basic",
      authEnabled: config.smtp_auth_enabled !== false,
      tlsMode: config.smtp_tls_mode || "starttls",
      fromEmail: config.smtp_from_email,
    },
  };
}
