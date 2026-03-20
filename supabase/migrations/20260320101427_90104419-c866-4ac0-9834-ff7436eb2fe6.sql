ALTER TABLE public.reminder_templates 
  DROP COLUMN IF EXISTS remind_days_before,
  DROP COLUMN IF EXISTS repeat_interval_days;