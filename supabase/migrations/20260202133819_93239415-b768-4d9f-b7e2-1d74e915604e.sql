-- Revoke general authenticated access first
REVOKE EXECUTE ON FUNCTION public.resolve_manager_from_email() FROM authenticated;

-- Replace function with admin-only check inside
CREATE OR REPLACE FUNCTION public.resolve_manager_from_email()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  -- Only admins can run this function
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: Only admins can resolve manager hierarchy';
  END IF;

  -- Update manager_employee_id based on manager_email matching employee email
  WITH matches AS (
    SELECT 
      e.id as employee_id,
      m.id as manager_id
    FROM public.employees e
    JOIN public.employees m ON lower(e.manager_email) = lower(m.email)
    WHERE e.manager_email IS NOT NULL 
      AND e.manager_employee_id IS NULL
  )
  UPDATE public.employees e
  SET manager_employee_id = matches.manager_id
  FROM matches
  WHERE e.id = matches.employee_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Re-grant execute (function itself blocks non-admins)
GRANT EXECUTE ON FUNCTION public.resolve_manager_from_email() TO authenticated;