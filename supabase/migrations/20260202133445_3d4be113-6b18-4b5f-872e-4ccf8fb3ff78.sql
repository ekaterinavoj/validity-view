-- Add manager columns for import purposes (email-based matching)
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS manager_email text,
ADD COLUMN IF NOT EXISTS manager_first_name text,
ADD COLUMN IF NOT EXISTS manager_last_name text;

-- Create function to resolve manager_email to manager_employee_id
-- Can be called after import to populate FK from email
CREATE OR REPLACE FUNCTION public.resolve_manager_from_email()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
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

-- Grant execute to authenticated users (admins will call this after import)
GRANT EXECUTE ON FUNCTION public.resolve_manager_from_email() TO authenticated;

-- Create index on manager_email for faster lookups during resolution
CREATE INDEX IF NOT EXISTS idx_employees_manager_email ON public.employees(lower(manager_email)) WHERE manager_email IS NOT NULL;