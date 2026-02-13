
-- Atomic role change function: delete+insert in one transaction
-- Prevents user from losing role if insert fails after delete
CREATE OR REPLACE FUNCTION public.set_user_role(_target_user_id uuid, _new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can change roles
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: Only admins can change user roles';
  END IF;

  -- Delete existing roles and insert new one atomically
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (_target_user_id, _new_role, auth.uid());
END;
$$;
