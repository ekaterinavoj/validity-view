-- Add is_test column to reminder_logs for test mode idempotency separation
ALTER TABLE public.reminder_logs 
ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Add provider_used column to track which provider sent each email
ALTER TABLE public.reminder_logs 
ADD COLUMN IF NOT EXISTS provider_used text;

-- Drop the old unique constraint
ALTER TABLE public.reminder_logs
DROP CONSTRAINT IF EXISTS reminder_logs_idempotency_unique;

-- Create new unique constraint including is_test to separate test from real runs
ALTER TABLE public.reminder_logs
ADD CONSTRAINT reminder_logs_idempotency_unique 
UNIQUE (training_id, employee_id, days_before, week_start, is_test);