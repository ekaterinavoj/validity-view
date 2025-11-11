import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting training reminder check...");

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

        const userIds = userRoles?.map(r => r.user_id) || [];
        
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

        // Odeslat email všem příjemcům
        try {
          const emailResponse = await resend.emails.send({
            from: "Školení <onboarding@resend.dev>",
            to: recipients,
            subject: subject,
            html: `
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
            `,
          });

          console.log(`Email sent for training ${training.id}:`, emailResponse);
          totalEmailsSent++;

          results.push({
            training_id: training.id,
            template: template.name,
            recipients: recipients.length,
            status: "sent",
          });
        } catch (emailError: any) {
          console.error(`Failed to send email for training ${training.id}:`, emailError);
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
