-- Add run_id column to reminder_logs for proper run correlation
ALTER TABLE public.reminder_logs
  ADD COLUMN run_id uuid REFERENCES public.reminder_runs(id) ON DELETE SET NULL;

-- Index for fast lookup by run_id
CREATE INDEX idx_reminder_logs_run_id ON public.reminder_logs(run_id);
