-- Add columns for tracking retry attempts
ALTER TABLE public.reminder_logs
ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS attempt_errors JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS final_status TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.reminder_logs.attempt_number IS 'Current attempt number (1 = first attempt)';
COMMENT ON COLUMN public.reminder_logs.max_attempts IS 'Total number of attempts made';
COMMENT ON COLUMN public.reminder_logs.attempt_errors IS 'JSON array of error messages from each failed attempt';
COMMENT ON COLUMN public.reminder_logs.final_status IS 'Final status after all retries: sent, failed, or null if still in progress';