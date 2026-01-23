-- Add resent_from_log_id column for audit trail of resent emails
ALTER TABLE public.reminder_logs 
ADD COLUMN IF NOT EXISTS resent_from_log_id uuid REFERENCES public.reminder_logs(id);

-- Add comment
COMMENT ON COLUMN public.reminder_logs.resent_from_log_id IS 'Reference to the original failed log entry that was resent';