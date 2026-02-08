-- Fix handle_new_user trigger to not access raw_user_meta_data directly from NEW
-- Instead, create a minimal profile and let the edge function update it

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create minimal profile - edge function will update with full details
  INSERT INTO public.profiles (id, first_name, last_name, email, position)
  VALUES (
    NEW.id,
    '',
    '',
    COALESCE(NEW.email, ''),
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Fallback: try even more minimal insert
  BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, email)
    VALUES (NEW.id, '', '', COALESCE(NEW.email, ''))
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN others THEN
    -- Log but don't fail user creation
    RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;