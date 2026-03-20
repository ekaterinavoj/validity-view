CREATE INDEX IF NOT EXISTS idx_reminder_logs_training_template_created 
  ON public.reminder_logs (training_id, template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deadline_reminder_logs_deadline_template_created 
  ON public.deadline_reminder_logs (deadline_id, template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medical_reminder_logs_examination_created 
  ON public.medical_reminder_logs (examination_id, created_at DESC);