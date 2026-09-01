-- RLS diagnostic tooling (backported from a later app version):
--   - employee_access_logs: best-effort audit trail of who listed/viewed employees
--   - debug_employee_visibility(uuid): admin-only "what would this user see and why"
--   - debug_medical_document_access(uuid): same, for medical examination documents
-- Intentionally does NOT touch any real RLS policy or the audit_logs table —
-- these are read-only diagnostic helpers, not behavior changes.

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
DROP FUNCTION IF EXISTS public.debug_employee_visibility(uuid);

CREATE OR REPLACE FUNCTION public.debug_employee_visibility(_target_user_id uuid)
RETURNS TABLE(
  employee_id uuid,
  employee_name text,
  employee_email text,
  reason text,
  policy_name text,
  policy_branch text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean;
  own_employee uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can run employee visibility debug';
  END IF;

  is_admin := public.has_role(_target_user_id, 'admin'::public.app_role);
  own_employee := public.get_user_employee_id(_target_user_id);

  IF is_admin THEN
    RETURN QUERY
      SELECT
        e.id,
        (e.first_name || ' ' || e.last_name),
        e.email,
        'admin: full access'::text,
        'Role-based employee visibility'::text,
        'has_role(auth.uid(), ''admin'')'::text
      FROM public.employees e
      ORDER BY e.last_name;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      e.id,
      (e.first_name || ' ' || e.last_name) AS employee_name,
      e.email,
      CASE
        WHEN e.id = own_employee THEN 'self: linked profile'
        WHEN public.is_manager_of(_target_user_id, e.id) THEN 'manager: in subordinate hierarchy'
        ELSE 'other'
      END AS reason,
      'Role-based employee visibility'::text AS policy_name,
      CASE
        WHEN e.id = own_employee THEN 'id = get_user_employee_id(auth.uid())'
        WHEN public.is_manager_of(_target_user_id, e.id) THEN 'is_manager_of(auth.uid(), id)'
        ELSE 'none'
      END AS policy_branch
    FROM public.employees e
    WHERE e.id = own_employee
       OR public.is_manager_of(_target_user_id, e.id)
    ORDER BY e.last_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.debug_employee_visibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_employee_visibility(uuid) TO authenticated;

-- 3) Debug RPC: which medical documents would the given user see and why?
CREATE OR REPLACE FUNCTION public.debug_medical_document_access(_target_user_id uuid)
RETURNS TABLE (
  document_id uuid,
  examination_id uuid,
  file_name text,
  file_path text,
  uploaded_by uuid,
  reason text,
  policy_name text,
  policy_branch text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  own_employee uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can run medical document access debug';
  END IF;

  is_admin := public.has_role(_target_user_id, 'admin'::app_role);
  own_employee := public.get_user_employee_id(_target_user_id);

  RETURN QUERY
  SELECT
    d.id AS document_id,
    d.examination_id,
    d.file_name,
    d.file_path,
    d.uploaded_by,
    CASE
      WHEN is_admin THEN 'admin: full access'
      WHEN d.uploaded_by = _target_user_id THEN 'self: uploaded by user'
      WHEN me.employee_id = own_employee THEN 'self: linked employee'
      WHEN public.is_manager_of(_target_user_id, me.employee_id) THEN 'manager: in subordinate hierarchy'
      ELSE 'denied: no matching branch'
    END AS reason,
    'Storage medical-documents access (table can_access_medical_examination)'::text AS policy_name,
    CASE
      WHEN is_admin THEN 'has_role(uid, admin)'
      WHEN d.uploaded_by = _target_user_id THEN 'document.uploaded_by = uid'
      WHEN me.employee_id = own_employee THEN 'examination.employee_id = get_user_employee_id(uid)'
      WHEN public.is_manager_of(_target_user_id, me.employee_id) THEN 'is_manager_of(uid, examination.employee_id)'
      ELSE 'none'
    END AS policy_branch
  FROM public.medical_examination_documents d
  JOIN public.medical_examinations me ON me.id = d.examination_id
  ORDER BY d.uploaded_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.debug_medical_document_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_medical_document_access(uuid) TO authenticated;
