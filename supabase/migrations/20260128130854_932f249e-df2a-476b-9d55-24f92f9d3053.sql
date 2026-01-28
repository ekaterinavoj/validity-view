-- Fix employees table RLS policy to explicitly require authentication
DROP POLICY IF EXISTS "Approved users can view employees" ON public.employees;

CREATE POLICY "Approved authenticated users can view employees"
  ON public.employees
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_user_approved(auth.uid())
  );