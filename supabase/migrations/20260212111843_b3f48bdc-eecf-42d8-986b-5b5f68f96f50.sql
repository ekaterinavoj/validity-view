-- Restrict audit_logs SELECT to admin only (was admin + manager)
DROP POLICY IF EXISTS "Admins and managers can view audit logs" ON public.audit_logs;

CREATE POLICY "Only admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));