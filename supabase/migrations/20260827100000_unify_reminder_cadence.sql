-- Reminders were previously sent using inconsistent logic per module:
--   - trainings/medical: resent every `repeat_days_after` days continuously,
--     starting the moment a record entered its remind_days_before window (so a
--     30-day-before warning kept repeating every N days all the way through
--     expiration too, not just once).
--   - deadlines: had NO per-record deduplication at all — every time the
--     function ran and found deadlines in-window, it re-sent the full digest
--     (and the individual "responsible person" emails) again, every time,
--     regardless of `repeat_days_after`.
--
-- This adds a `reminder_stage` column so each module can track, per record,
-- whether the one-shot "before" and "due" reminders were already sent, and
-- when the last repeating "overdue" reminder went out — see
-- supabase/functions/_shared/reminder-cadence.ts for the actual scheduling
-- logic now shared by all three reminder functions.

ALTER TABLE public.reminder_logs ADD COLUMN IF NOT EXISTS reminder_stage TEXT
  CHECK (reminder_stage IS NULL OR reminder_stage IN ('before', 'due', 'overdue'));

ALTER TABLE public.deadline_reminder_logs ADD COLUMN IF NOT EXISTS reminder_stage TEXT
  CHECK (reminder_stage IS NULL OR reminder_stage IN ('before', 'due', 'overdue'));

ALTER TABLE public.medical_reminder_logs ADD COLUMN IF NOT EXISTS reminder_stage TEXT
  CHECK (reminder_stage IS NULL OR reminder_stage IN ('before', 'due', 'overdue'));

CREATE INDEX IF NOT EXISTS idx_reminder_logs_training_stage ON public.reminder_logs (training_id, reminder_stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deadline_reminder_logs_deadline_stage ON public.deadline_reminder_logs (deadline_id, reminder_stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_reminder_logs_exam_stage ON public.medical_reminder_logs (examination_id, reminder_stage, created_at DESC);

-- "Type" tables get their own default reminder timing so new records can be
-- pre-filled consistently instead of everyone independently starting at the
-- hardcoded 30/30 default. NULL means "no type-level default configured yet",
-- in which case the app falls back to the existing per-record default (30).
ALTER TABLE public.training_types ADD COLUMN IF NOT EXISTS default_remind_days_before INTEGER;
ALTER TABLE public.training_types ADD COLUMN IF NOT EXISTS default_repeat_days_after INTEGER;

ALTER TABLE public.deadline_types ADD COLUMN IF NOT EXISTS default_remind_days_before INTEGER;
ALTER TABLE public.deadline_types ADD COLUMN IF NOT EXISTS default_repeat_days_after INTEGER;

ALTER TABLE public.medical_examination_types ADD COLUMN IF NOT EXISTS default_remind_days_before INTEGER;
ALTER TABLE public.medical_examination_types ADD COLUMN IF NOT EXISTS default_repeat_days_after INTEGER;

-- The weekly "run-reminders" digest duplicated/overlapped with the per-record
-- send-training-reminders function and is being retired in favor of the
-- module-specific reminders. Soft-disable it via its existing settings flag
-- rather than deleting the function outright, so it stays available if ever
-- needed again.
UPDATE public.system_settings
SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{enabled}', 'false'::jsonb)
WHERE key = 'reminder_frequency';
