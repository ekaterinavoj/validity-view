-- Create a function to prevent demoting the last admin
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- For DELETE: check if we're deleting an admin role and it's the last one
  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last admin. At least one admin must remain in the system.';
    END IF;
  END IF;
  
  -- For UPDATE: check if we're changing from admin to something else and it's the last admin
  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role != 'admin' THEN
    SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last admin. At least one admin must remain in the system.';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS prevent_last_admin_trigger ON public.user_roles;

CREATE TRIGGER prevent_last_admin_trigger
  BEFORE DELETE OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_admin_removal();

COMMENT ON FUNCTION public.prevent_last_admin_removal() IS 'Prevents the system from having zero admins by blocking deletion or demotion of the last admin.';