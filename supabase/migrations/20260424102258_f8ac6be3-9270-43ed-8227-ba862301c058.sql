-- 1) Audit log table for employees reads
CREATE TABLE IF NOT EXISTS public.employee_access_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  user_email text,
  user_role text,
  action text NOT NULL DEFAULT 'list',
  rows_returned integer,
  filters jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_access_logs_user_created
  ON public.employee_access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emp_access_logs_created
  ON public.employee_access_logs(created_at DESC);

ALTER TABLE public.employee_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read employee access logs" ON public.employee_access_logs;
CREATE POLICY "Admins can read employee access logs"
ON public.employee_access_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users can insert their access logs" ON public.employee_access_logs;
CREATE POLICY "Authenticated users can insert their access logs"
ON public.employee_access_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND action IN ('list', 'detail', 'inactive_list', 'export')
  AND (rows_returned IS NULL OR rows_returned BETWEEN 0 AND 100000)
);

DROP POLICY IF EXISTS "Admins can delete employee access logs" ON public.employee_access_logs;
CREATE POLICY "Admins can delete employee access logs"
ON public.employee_access_logs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Debug RPC: which employees would the given user see and why?
CREATE OR REPLACE FUNCTION public.debug_employee_visibility(_target_user_id uuid)
RETURNS TABLE (
  employee_id uuid,
  employee_name text,
  employee_email text,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  own_employee uuid;
BEGIN
  -- Only admins may run this debug
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can run employee visibility debug';
  END IF;

  is_admin := public.has_role(_target_user_id, 'admin'::public.app_role);
  own_employee := public.get_user_employee_id(_target_user_id);

  IF is_admin THEN
    RETURN QUERY
      SELECT e.id, (e.first_name || ' ' || e.last_name), e.email,
             'admin: full access'::text
      FROM public.employees e
      ORDER BY e.last_name;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT e.id,
           (e.first_name || ' ' || e.last_name) AS employee_name,
           e.email,
           CASE
             WHEN e.id = own_employee THEN 'self: linked profile'
             WHEN public.is_manager_of(_target_user_id, e.id) THEN 'manager: in subordinate hierarchy'
             ELSE 'other'
           END AS reason
    FROM public.employees e
    WHERE e.id = own_employee
       OR public.is_manager_of(_target_user_id, e.id)
    ORDER BY e.last_name;
END;
$$;

REVOKE ALL ON FUNCTION public.debug_employee_visibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_employee_visibility(uuid) TO authenticated;