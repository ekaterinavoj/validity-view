import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSMTP } from "../_shared/smtp-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface ExaminationItem {
  id: string;
  next_examination_date: string;
  employee_id: string;
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

// sendViaSMTP is now imported from _shared/smtp-sender.ts
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
      .in("key", ["medical_reminder_recipients", "email_provider", "medical_email_template", "reminder_frequency", "medical_manager_notifications"]);

    const settingsMap: Record<string, any> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value; });

    const recipients = settingsMap["medical_reminder_recipients"] || { user_ids: [], delivery_mode: "bcc" };
    const emailProvider = settingsMap["email_provider"] || {};
    const managerNotifications = settingsMap["medical_manager_notifications"] || { enabled: false };
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
        employee_id,
        employee:employees!medical_examinations_employee_id_fkey(id, first_name, last_name, email),
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
      employee_id: e.employee_id,
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

    const bodyText = body.replace(/\n/g, "<br>");
    const tableHtml = buildExaminationsTable(examinationItems);
    const fullBody = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          ${bodyText}
        </div>
        ${tableHtml}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          Tento email byl odeslán automaticky systémem evidence PLP.
        </p>
      </div>
    `;

    // Send email
    const result = await sendViaSMTP(
      recipientEmails,
      subject,
      fullBody,
      recipients.delivery_mode || "bcc",
      emailProvider
    );

    // Log the reminder
    await supabase.from("medical_reminder_logs").insert({
      template_name: "Medical Summary",
      recipient_emails: recipientEmails,
      email_subject: subject,
      email_body: fullBody,
      status: result.success ? "sent" : "failed",
      error_message: result.error || null,
      is_test: false,
      delivery_mode: recipients.delivery_mode || "bcc",
    });

    let managerEmailsSent = 0;
    
    // =====================================================================
    // MANAGER NOTIFICATIONS - optional, sends filtered data per manager
    // =====================================================================
    if (managerNotifications.enabled) {
      console.log("Manager notifications enabled for medical module");
      
      // Get all managers (users with manager role linked to employees)
      const { data: managerProfiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, employee_id")
        .not("employee_id", "is", null);
      
      if (managerProfiles && managerProfiles.length > 0) {
        // Check which are actually managers
        const { data: managerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "manager"])
          .in("user_id", managerProfiles.map(p => p.id));
        
        const managerUserIds = new Set(managerRoles?.map(r => r.user_id) || []);
        const managers = managerProfiles.filter(p => managerUserIds.has(p.id) && p.employee_id);
        
        for (const manager of managers) {
          // Skip if manager already receives the main summary
          if (recipientEmails.includes(manager.email.toLowerCase())) continue;
          
          // Get subordinate employee IDs
          const { data: subordinates } = await supabase.rpc("get_subordinate_employee_ids", {
            root_employee_id: manager.employee_id!,
          });
          
          if (!subordinates || subordinates.length <= 1) continue; // Only the manager themselves
          
          const subordinateIds = subordinates.map((s: any) => s.employee_id);
          
          // Filter examinations to only this manager's subordinates
          const managerExams = examinationItems.filter(e => subordinateIds.includes(e.employee_id));
          
          if (managerExams.length === 0) continue;
          
          const mgrExpired = managerExams.filter(e => e.days_until < 0);
          const mgrExpiring = managerExams.filter(e => e.days_until >= 0);
          
          const mgrSubject = `Lékařské prohlídky vašich zaměstnanců (${managerExams.length})`;
          const mgrTableHtml = buildExaminationsTable(managerExams);
          const mgrBody = `
            <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <p>Dobrý den, ${manager.first_name} ${manager.last_name},</p>
                <p>následující lékařské prohlídky vašich podřízených vyžadují pozornost:</p>
                <p>Celkem: <strong>${managerExams.length}</strong> (prošlé: ${mgrExpired.length}, blížící se: ${mgrExpiring.length})</p>
              </div>
              ${mgrTableHtml}
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #9ca3af; font-size: 12px;">Tento email byl odeslán automaticky systémem evidence PLP.</p>
            </div>
          `;
          
          const mgrResult = await sendViaSMTP([manager.email], mgrSubject, mgrBody, "to", emailProvider);
          
          await supabase.from("medical_reminder_logs").insert({
            template_name: "Manager notification",
            recipient_emails: [manager.email],
            email_subject: mgrSubject,
            email_body: mgrBody,
            status: mgrResult.success ? "sent" : "failed",
            error_message: mgrResult.error || null,
            is_test: false,
            delivery_mode: "to",
          });
          
          if (mgrResult.success) {
            managerEmailsSent++;
            console.log(`Sent manager medical notification to ${manager.email} with ${managerExams.length} exams`);
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: result.success,
      emailsSent: (result.success ? 1 : 0) + managerEmailsSent,
      recipientCount: result.success ? recipientEmails.length : 0,
      examinationsCount: examinationItems.length,
      managerEmailsSent,
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
