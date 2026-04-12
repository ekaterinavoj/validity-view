CREATE OR REPLACE FUNCTION public.notify_employee_age_50()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
  emp_name TEXT;
  emp_age INT;
BEGIN
  IF NEW.birth_date IS NULL THEN
    RETURN NEW;
  END IF;

  emp_age := EXTRACT(YEAR FROM age(CURRENT_DATE, NEW.birth_date));

  IF emp_age = 50 THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE related_entity_type = 'employee_age_50'
        AND related_entity_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    emp_name := NEW.first_name || ' ' || NEW.last_name;

    FOR admin_record IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        user_id, title, message, type, related_entity_type, related_entity_id
      ) VALUES (
        admin_record.user_id,
        'Zaměstnanec dosáhl věku 50 let',
        'Zaměstnanec ' || emp_name || ' dosáhl věku 50 let.',
        'warning',
        'employee_age_50',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;