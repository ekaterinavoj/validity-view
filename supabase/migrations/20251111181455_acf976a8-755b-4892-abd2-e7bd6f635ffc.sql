-- Vytvoření tabulky pro logy odeslaných připomínek
CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.reminder_templates(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins and managers can view reminder logs"
ON public.reminder_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "System can insert reminder logs"
ON public.reminder_logs
FOR INSERT
WITH CHECK (true);

-- Index pro rychlejší vyhledávání
CREATE INDEX idx_reminder_logs_training_id ON public.reminder_logs(training_id);
CREATE INDEX idx_reminder_logs_sent_at ON public.reminder_logs(sent_at DESC);
CREATE INDEX idx_reminder_logs_template_id ON public.reminder_logs(template_id);