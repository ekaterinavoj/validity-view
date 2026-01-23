-- Fix RLS policies: reminder_logs and reminder_runs should be admin-only (not manager)

-- Drop existing manager SELECT policies for reminder_logs
DROP POLICY IF EXISTS "Admins and managers can view reminder logs" ON public.reminder_logs;

-- Create admin-only SELECT policy for reminder_logs
CREATE POLICY "Admins can view reminder logs" 
ON public.reminder_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- reminder_runs already has admin-only policy, verify it exists
-- (no change needed if already correct)