-- Allow long_term_fitness_loss_date to be set for ANY result, not only 'lost_long_term'.
-- The date is now treated as an independent fact: an employee can be 'passed' AND have lost long-term fitness.
-- Previous trigger forced the column to NULL whenever result != 'lost_long_term'. That blocked the new combined flow.
CREATE OR REPLACE FUNCTION public.validate_medical_examination_result_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- If the main result is 'lost_long_term', the date is mandatory (legacy behaviour).
  IF NEW.result = 'lost_long_term' AND NEW.long_term_fitness_loss_date IS NULL THEN
    RAISE EXCEPTION 'long_term_fitness_loss_date is required when result = lost_long_term';
  END IF;

  -- The date is now allowed independently for any result, so do NOT clear it any more.
  RETURN NEW;
END;
$function$;