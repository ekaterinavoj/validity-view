-- Trigger: when manager's name/email changes, propagate to all direct subordinates
CREATE OR REPLACE FUNCTION public.propagate_manager_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only propagate if name or email actually changed
  IF (OLD.first_name IS DISTINCT FROM NEW.first_name)
     OR (OLD.last_name IS DISTINCT FROM NEW.last_name)
     OR (OLD.email IS DISTINCT FROM NEW.email)
  THEN
    UPDATE public.employees
    SET
      manager_first_name = NEW.first_name,
      manager_last_name = NEW.last_name,
      manager_email = NEW.email
    WHERE manager_employee_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_manager_details ON public.employees;
CREATE TRIGGER trg_propagate_manager_details
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_manager_details();