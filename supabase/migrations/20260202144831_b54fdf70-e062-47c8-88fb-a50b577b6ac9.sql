-- Fix handle_new_user trigger to handle missing raw_user_meta_data field gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  meta_data jsonb;
BEGIN
  -- Safely get user_metadata from either raw_user_meta_data or user_metadata
  meta_data := COALESCE(
    NEW.raw_user_meta_data,
    NEW.user_metadata,
    '{}'::jsonb
  );
  
  INSERT INTO public.profiles (id, first_name, last_name, email, position)
  VALUES (
    NEW.id,
    COALESCE(meta_data->>'first_name', ''),
    COALESCE(meta_data->>'last_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(meta_data->>'position', '')
  );
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Fallback: create minimal profile if anything fails
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (NEW.id, '', '', COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;