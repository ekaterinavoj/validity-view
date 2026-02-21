
-- Function: auto-link profile to employee when emails match
-- Runs on profiles INSERT/UPDATE and employees INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.auto_link_profile_employee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Case 1: Trigger on profiles table
  IF TG_TABLE_NAME = 'profiles' THEN
    -- Only if employee_id is NULL and email is not empty
    IF NEW.employee_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
      UPDATE public.profiles
      SET employee_id = e.id
      FROM public.employees e
      WHERE e.email = NEW.email
        AND public.profiles.id = NEW.id
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p2
          WHERE p2.employee_id = e.id AND p2.id != NEW.id
        );
    END IF;
  END IF;

  -- Case 2: Trigger on employees table
  IF TG_TABLE_NAME = 'employees' THEN
    -- Try to link a profile that has matching email and no employee_id
    UPDATE public.profiles
    SET employee_id = NEW.id
    WHERE email = NEW.email
      AND employee_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p2
        WHERE p2.employee_id = NEW.id
      );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on profiles
CREATE TRIGGER trg_auto_link_profile_employee
AFTER INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_profile_employee();

-- Trigger on employees
CREATE TRIGGER trg_auto_link_employee_profile
AFTER INSERT OR UPDATE OF email ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_profile_employee();
