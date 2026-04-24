-- 1) Move pg_net to dedicated extensions schema (drop + recreate for consistency)
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    EXECUTE 'DROP EXTENSION pg_net CASCADE';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Enhanced debug_employee_visibility with policy name + branch
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