-- Create trigger function for medical examinations status based on employee status
CREATE OR REPLACE FUNCTION public.update_medical_examination_active_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When employee status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Deactivate examinations for inactive statuses
    IF NEW.status IN ('parental_leave', 'sick_leave', 'terminated') THEN
      UPDATE public.medical_examinations
      SET is_active = false
      WHERE employee_id = NEW.id;
    -- Activate examinations for active status
    ELSIF NEW.status = 'employed' THEN
      UPDATE public.medical_examinations
      SET is_active = true
      WHERE employee_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger function to recalculate examination status on employee activation
CREATE OR REPLACE FUNCTION public.recalculate_examination_status_on_activation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When status changes to employed (active), recalculate status of all examinations
  IF NEW.status = 'employed' AND OLD.status != 'employed' THEN
    UPDATE public.medical_examinations
    SET status = calculate_examination_status(next_examination_date)
    WHERE employee_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to update medical examination active status when employee status changes
DROP TRIGGER IF EXISTS update_medical_examination_active_status_trigger ON public.employees;
CREATE TRIGGER update_medical_examination_active_status_trigger
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_medical_examination_active_status();

-- Create trigger to recalculate examination status when employee becomes active
DROP TRIGGER IF EXISTS recalculate_examination_status_on_activation_trigger ON public.employees;
CREATE TRIGGER recalculate_examination_status_on_activation_trigger
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_examination_status_on_activation();