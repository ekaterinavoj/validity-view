-- Add column for tracking the reason behind manual override of probation_end_date
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS probation_override_reason text;

COMMENT ON COLUMN public.employees.probation_override_reason IS 
  'Důvod ručního přepsání data konce zkušební doby (povinné při manuální úpravě, např. překážky v práci dle ZP 2026)';

-- Update trigger: clear override reason when probation_end_date is auto-recomputed
CREATE OR REPLACE FUNCTION public.calculate_probation_end_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_months integer;
  v_auto_end date;
BEGIN
  -- If start_date is null, clear all probation fields
  IF NEW.start_date IS NULL THEN
    NEW.probation_end_date := NULL;
    NEW.probation_override_reason := NULL;
    RETURN NEW;
  END IF;

  -- Determine probation length
  IF NEW.probation_months IS NOT NULL THEN
    v_months := NEW.probation_months;
  ELSIF public.is_managerial_position(NEW.position) THEN
    v_months := 8;
    NEW.probation_months := 8;
  ELSE
    v_months := 4;
    NEW.probation_months := 4;
  END IF;

  v_auto_end := NEW.start_date + (v_months || ' months')::interval;

  IF TG_OP = 'INSERT' THEN
    IF NEW.probation_end_date IS NULL THEN
      NEW.probation_end_date := v_auto_end;
      NEW.probation_override_reason := NULL;
    ELSIF NEW.probation_end_date = v_auto_end THEN
      -- Same as auto-calculated -> not really an override
      NEW.probation_override_reason := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If start_date or probation_months changed AND end_date wasn't manually changed in this update,
    -- recompute end_date and clear override reason
    IF (OLD.start_date IS DISTINCT FROM NEW.start_date OR OLD.probation_months IS DISTINCT FROM NEW.probation_months)
       AND (NEW.probation_end_date IS NULL OR NEW.probation_end_date = OLD.probation_end_date) THEN
      NEW.probation_end_date := v_auto_end;
      NEW.probation_override_reason := NULL;
    -- If end_date was reset to match the auto-calculated value, clear override reason
    ELSIF NEW.probation_end_date = v_auto_end THEN
      NEW.probation_override_reason := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;