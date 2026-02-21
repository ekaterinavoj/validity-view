
-- Create a trigger function that fires when an employee returns from sick leave to active
-- It creates in-app notifications for all admin users
CREATE OR REPLACE FUNCTION public.notify_extraordinary_medical_exam()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
  emp_name TEXT;
BEGIN
  -- Only when status changes from sick_leave to employed
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'sick_leave'
     AND NEW.status = 'employed'
  THEN
    emp_name := NEW.first_name || ' ' || NEW.last_name;

    -- Insert notification for every admin user
    FOR admin_record IN
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        user_id, title, message, type, related_entity_type, related_entity_id
      ) VALUES (
        admin_record.user_id,
        'Mimořádná lékařská prohlídka',
        'Zaměstnanec ' || emp_name || ' se vrátil z nemocenské. Doporučujeme naplánovat mimořádnou lékařskou prohlídku.',
        'warning',
        'employee',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Attach the trigger to the employees table
CREATE TRIGGER trg_notify_extraordinary_medical_exam
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_extraordinary_medical_exam();
