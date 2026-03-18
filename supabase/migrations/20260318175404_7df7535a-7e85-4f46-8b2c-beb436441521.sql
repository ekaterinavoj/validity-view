-- Add date of long-term loss of medical fitness to PLP examinations
ALTER TABLE public.medical_examinations
ADD COLUMN IF NOT EXISTS long_term_fitness_loss_date date;

COMMENT ON COLUMN public.medical_examinations.long_term_fitness_loss_date IS 'Date when the employee lost long-term medical fitness for work.';

-- Validate PLP result combinations without using check constraints
CREATE OR REPLACE FUNCTION public.validate_medical_examination_result_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.result = 'lost_long_term' AND NEW.long_term_fitness_loss_date IS NULL THEN
    RAISE EXCEPTION 'long_term_fitness_loss_date is required when result = lost_long_term';
  END IF;

  IF NEW.result IS DISTINCT FROM 'lost_long_term' THEN
    NEW.long_term_fitness_loss_date := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_medical_examination_result_fields_trigger ON public.medical_examinations;
CREATE TRIGGER validate_medical_examination_result_fields_trigger
BEFORE INSERT OR UPDATE ON public.medical_examinations
FOR EACH ROW
EXECUTE FUNCTION public.validate_medical_examination_result_fields();