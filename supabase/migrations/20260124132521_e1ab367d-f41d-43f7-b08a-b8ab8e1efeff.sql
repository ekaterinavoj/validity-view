-- Fix calculate_deadline_status: IMMUTABLE → STABLE (uses CURRENT_DATE)
CREATE OR REPLACE FUNCTION public.calculate_deadline_status(next_date date)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF next_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF next_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'warning';
  ELSE
    RETURN 'valid';
  END IF;
END;
$function$;

-- Also fix calculate_training_status for consistency
CREATE OR REPLACE FUNCTION public.calculate_training_status(next_date date)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF next_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF next_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'warning';
  ELSE
    RETURN 'valid';
  END IF;
END;
$function$;