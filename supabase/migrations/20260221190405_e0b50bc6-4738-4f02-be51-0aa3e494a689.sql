CREATE OR REPLACE FUNCTION public.get_subordinate_employee_ids(root_employee_id uuid)
RETURNS TABLE(employee_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF root_employee_id IS DISTINCT FROM (
      SELECT p.employee_id FROM public.profiles p WHERE p.id = auth.uid()
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT e.id, 0 AS depth
    FROM public.employees e
    WHERE e.id = root_employee_id
    UNION
    SELECT e2.id, t.depth + 1
    FROM public.employees e2
    JOIN tree t ON e2.manager_employee_id = t.id
    WHERE t.depth < 20
  )
  SELECT tree.id FROM tree;
END;
$func$;