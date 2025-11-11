-- Aktualizace funkce pro přiřazení výchozí role
-- První registrovaný uživatel bude automaticky admin, ostatní user
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  -- Zkontrolovat, zda už existuje nějaký admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  ) INTO admin_exists;
  
  -- Pokud neexistuje žádný admin, nastavit nového uživatele jako admina
  IF NOT admin_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    RAISE NOTICE 'First user registered - assigned admin role to user %', NEW.id;
  ELSE
    -- Jinak přiřadit základní roli "user"
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RAISE NOTICE 'Assigned user role to user %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;