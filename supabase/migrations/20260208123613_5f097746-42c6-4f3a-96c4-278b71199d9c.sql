-- Drop existing constraint and add expanded one
ALTER TABLE public.reminder_runs DROP CONSTRAINT IF EXISTS reminder_runs_triggered_by_check;

ALTER TABLE public.reminder_runs ADD CONSTRAINT reminder_runs_triggered_by_check 
CHECK (triggered_by = ANY (ARRAY['cron', 'manual', 'pg_cron', 'test', 'manual_test', 'resend', 'single_test']::text[]));