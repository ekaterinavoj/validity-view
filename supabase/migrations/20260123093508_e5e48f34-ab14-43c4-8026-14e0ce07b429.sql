-- Add delivery_mode column to reminder_logs for tracking
ALTER TABLE public.reminder_logs 
ADD COLUMN IF NOT EXISTS delivery_mode text DEFAULT 'bcc';

-- Add comment
COMMENT ON COLUMN public.reminder_logs.delivery_mode IS 'Email delivery mode used: bcc, to, or cc';