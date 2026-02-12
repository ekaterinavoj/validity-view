
CREATE OR REPLACE FUNCTION public.get_subordinate_employee_ids(root_employee_id uuid)
 RETURNS TABLE(employee_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization: admin can query any root; non-admin only their own employee_id
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF root_employee_id IS DISTINCT FROM (
      SELECT p.employee_id FROM public.profiles p WHERE p.id = auth.uid()
    ) THEN
      -- Return empty result set for unauthorized calls
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT e.id
    FROM public.employees e
    WHERE e.id = root_employee_id
    UNION ALL
    SELECT e2.id
    FROM public.employees e2
    JOIN tree t ON e2.manager_employee_id = t.id
  )
  SELECT tree.id FROM tree;
END;
$function$;
