
-- Audit trigger for user_module_access changes (same pattern as log_role_changes)
CREATE OR REPLACE FUNCTION public.log_module_access_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
  target_user_profile RECORD;
  old_json JSONB;
  new_json JSONB;
BEGIN
  -- Get info about who made the change
  SELECT 
    p.email,
    p.first_name || ' ' || p.last_name as full_name
  INTO user_profile
  FROM public.profiles p
  WHERE p.id = auth.uid();

  -- Get info about the target user
  SELECT 
    p.email,
    p.first_name || ' ' || p.last_name as full_name
  INTO target_user_profile
  FROM public.profiles p
  WHERE p.id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'DELETE' THEN
    old_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'module', OLD.module
    );
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'module', NEW.module
    );
  ELSE
    old_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'module', OLD.module
    );
    new_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'module', NEW.module
    );
  END IF;

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    user_email,
    user_name,
    changed_fields
  ) VALUES (
    'user_module_access',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    old_json,
    new_json,
    auth.uid(),
    user_profile.email,
    user_profile.full_name,
    ARRAY['module']
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

CREATE TRIGGER log_module_access_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_module_access
FOR EACH ROW
EXECUTE FUNCTION public.log_module_access_changes();
