-- Add missing columns to reminder_logs for granular idempotency
ALTER TABLE public.reminder_logs 
ADD COLUMN IF NOT EXISTS employee_id uuid,
ADD COLUMN IF NOT EXISTS days_before integer;

-- Create unique constraint for idempotency: per employee + training + rule + week
ALTER TABLE public.reminder_logs
ADD CONSTRAINT reminder_logs_idempotency_unique 
UNIQUE (training_id, employee_id, days_before, week_start);

-- Create partial unique index on reminder_runs to prevent concurrent runs for same week
CREATE UNIQUE INDEX IF NOT EXISTS reminder_runs_week_running_unique 
ON public.reminder_runs (week_start) 
WHERE status = 'running';