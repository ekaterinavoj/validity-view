-- Allow long_term_fitness_loss_date to be set for ANY result, not only 'lost_long_term'.
-- The date is now treated as an independent fact: an employee can be 'passed' AND have
-- lost long-term fitness for a different, specific activity (e.g. after returning from
-- sick leave). This is NOT an invalid examination — it's a doctor's note that must stay
-- visible (see the "Současně pozbyl(a) dlouhodobě zdravotní způsobilosti" checkbox in
-- NewMedicalExamination/EditMedicalExamination and the additional badge in ResultBadge/
-- ScheduledExaminations).
--
-- The previous trigger (20260318175404) forced this column to NULL whenever
-- result != 'lost_long_term', which blocked the combined flow entirely.
CREATE OR REPLACE FUNCTION public.validate_medical_examination_result_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Legacy behaviour: if the main result is still the old 'lost_long_term' value,
  -- the date remains mandatory.
  IF NEW.result = 'lost_long_term' AND NEW.long_term_fitness_loss_date IS NULL THEN
    RAISE EXCEPTION 'long_term_fitness_loss_date is required when result = lost_long_term';
  END IF;

  -- The date is now allowed independently for any result — do NOT clear it any more.
  RETURN NEW;
END;
$function$;
