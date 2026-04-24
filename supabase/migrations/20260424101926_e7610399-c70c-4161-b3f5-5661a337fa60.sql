-- Tighten SELECT RLS on public.employees
-- Previously: any approved user could read all employees (PII exposure).
-- Now: admin sees all, manager sees subordinates, user sees only own employee record.

DROP POLICY IF EXISTS "Approved users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Role-based employee visibility" ON public.employees;

CREATE POLICY "Role-based employee visibility"
ON public.employees
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_manager_of(auth.uid(), id)
    OR id = public.get_user_employee_id(auth.uid())
  )
);