-- System settings table for storing all configurable options
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view and modify settings
CREATE POLICY "Admins can view system settings"
ON public.system_settings FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert system settings"
ON public.system_settings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update system settings"
ON public.system_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete system settings"
ON public.system_settings FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Reminder run logs table for tracking each cron execution
CREATE TABLE public.reminder_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  emails_sent integer DEFAULT 0,
  emails_failed integer DEFAULT 0,
  error_message text,
  error_details jsonb,
  week_start date NOT NULL,
  triggered_by text NOT NULL DEFAULT 'cron' CHECK (triggered_by IN ('cron', 'manual', 'pg_cron')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminder_runs ENABLE ROW LEVEL SECURITY;

-- Admins can view reminder runs
CREATE POLICY "Admins can view reminder runs"
ON public.reminder_runs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- System can insert reminder runs (for edge functions)
CREATE POLICY "System can insert reminder runs"
ON public.reminder_runs FOR INSERT
WITH CHECK (true);

-- System can update reminder runs
CREATE POLICY "System can update reminder runs"
ON public.reminder_runs FOR UPDATE
USING (true);

-- Add week_start column to reminder_logs for idempotency tracking
ALTER TABLE public.reminder_logs ADD COLUMN IF NOT EXISTS week_start date;

-- Add index for idempotency checks
CREATE INDEX IF NOT EXISTS idx_reminder_logs_idempotency 
ON public.reminder_logs (training_id, week_start);

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description) VALUES
('reminder_schedule', '{"enabled": true, "day_of_week": 1, "time": "08:00", "skip_weekends": true}', 'Weekly reminder schedule configuration'),
('reminder_days', '{"days_before": [30, 14, 7]}', 'Days before expiration to send reminders'),
('email_provider', '{"provider": "resend", "smtp_host": "", "smtp_port": 587, "smtp_user": "", "smtp_from_email": "", "smtp_from_name": "Training System", "smtp_secure": true}', 'Email provider configuration (smtp or resend)'),
('email_template', '{"subject": "Upozornění: Školení {trainingName} brzy vyprší", "body": "Dobrý den {firstName} {lastName},\n\nvaše školení \"{trainingName}\" vyprší dne {expiresOn} (za {daysLeft} dní).\n\nProsím zajistěte si včasné obnovení školení.\n\nS pozdravem,\nVáš systém školení"}', 'Email template with variable placeholders')
ON CONFLICT (key) DO NOTHING;