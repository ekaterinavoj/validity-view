-- Trigger function: notify all admins when an employee reaches age 50
CREATE OR REPLACE FUNCTION public.notify_employee_age_50()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- Dedup: skip if notification already exists for this employee
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
        'Zaměstnanec ' || emp_name || ' dosáhl věku 50 let. Zkontrolujte, zda je naplánována mimořádná lékařská prohlídka.',
        'warning',
        'employee_age_50',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Attach trigger to employees table (fires on INSERT and UPDATE)
DROP TRIGGER IF EXISTS trg_notify_employee_age_50 ON public.employees;
CREATE TRIGGER trg_notify_employee_age_50
  AFTER INSERT OR UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_employee_age_50();