-- The existing notify_employee_age_50() trigger only fires on INSERT/UPDATE of the
-- employees row itself. In practice an employee record is rarely touched exactly on
-- their birthday, so the notification silently never fires for most people who turn 50.
-- This adds a callable, idempotent function that re-checks ALL active employees and can
-- be invoked from a daily/hourly job (see run-medical-reminders), independent of any
-- write to the employees table.

CREATE OR REPLACE FUNCTION public.check_employee_age_milestones()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
  emp_record RECORD;
  emp_name TEXT;
  emp_age INT;
  notified_count INT := 0;
BEGIN
  FOR emp_record IN
    SELECT id, first_name, last_name, birth_date
    FROM public.employees
    WHERE birth_date IS NOT NULL
      AND status = 'employed'
  LOOP
    emp_age := EXTRACT(YEAR FROM age(CURRENT_DATE, emp_record.birth_date));

    IF emp_age = 50 THEN
      -- Dedup: skip if a notification was already created for this employee
      IF EXISTS (
        SELECT 1 FROM public.notifications
        WHERE related_entity_type = 'employee_age_50'
          AND related_entity_id = emp_record.id
      ) THEN
        CONTINUE;
      END IF;

      emp_name := emp_record.first_name || ' ' || emp_record.last_name;

      FOR admin_record IN
        SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
      LOOP
        INSERT INTO public.notifications (
          user_id, title, message, type, related_entity_type, related_entity_id
        ) VALUES (
          admin_record.user_id,
          'Zaměstnanec dosáhl věku 50 let',
          'Zaměstnanec ' || emp_name || ' dosáhl věku 50 let. Podle platné legislativy ' ||
          '(vyhláška č. 79/2013 Sb., o pracovnělékařských službách) se u zaměstnanců ' ||
          'vykonávajících práci zařazenou do kategorie 2 a vyšší od tohoto věku zkracuje ' ||
          'interval pravidelných lékařských prohlídek. Zkontrolujte prosím zařazení do ' ||
          'rizikové kategorie a v případě potřeby naplánujte mimořádnou lékařskou prohlídku ' ||
          'a upravte periodicitu dalších prohlídek.',
          'warning',
          'employee_age_50',
          emp_record.id
        );
      END LOOP;

      notified_count := notified_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('employees_notified', notified_count, 'checked_at', now());
END;
$function$;

-- Keep the write-time trigger in sync with the same, more informative message text so
-- both paths (immediate trigger + daily periodic check) read identically.
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
        'Zaměstnanec ' || emp_name || ' dosáhl věku 50 let. Podle platné legislativy ' ||
        '(vyhláška č. 79/2013 Sb., o pracovnělékařských službách) se u zaměstnanců ' ||
        'vykonávajících práci zařazenou do kategorie 2 a vyšší od tohoto věku zkracuje ' ||
        'interval pravidelných lékařských prohlídek. Zkontrolujte prosím zařazení do ' ||
        'rizikové kategorie a v případě potřeby naplánujte mimořádnou lékařskou prohlídku ' ||
        'a upravte periodicitu dalších prohlídek.',
        'warning',
        'employee_age_50',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
