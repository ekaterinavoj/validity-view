
-- Drop the propagate_manager_details trigger and function
DROP TRIGGER IF EXISTS trg_propagate_manager_details ON public.employees;
DROP FUNCTION IF EXISTS public.propagate_manager_details();

-- Drop the denormalized columns
ALTER TABLE public.employees DROP COLUMN IF EXISTS manager_first_name;
ALTER TABLE public.employees DROP COLUMN IF EXISTS manager_last_name;
ALTER TABLE public.employees DROP COLUMN IF EXISTS manager_email;

-- Drop the index on manager_email
DROP INDEX IF EXISTS idx_employees_manager_email;

-- Update resolve_manager_from_email to work without manager_email column
-- This function is no longer needed since we resolve in application code
DROP FUNCTION IF EXISTS public.resolve_manager_from_email();
