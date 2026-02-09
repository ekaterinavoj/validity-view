-- Allow admins to delete deadline_reminder_logs (needed for cascade delete of archived deadlines)
CREATE POLICY "Admins can delete deadline reminder logs"
ON public.deadline_reminder_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete medical_reminder_logs (needed for cascade delete of archived examinations)
CREATE POLICY "Admins can delete medical reminder logs"
ON public.medical_reminder_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete reminder_logs (needed for cascade delete of archived trainings)
CREATE POLICY "Admins can delete reminder logs"
ON public.reminder_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));