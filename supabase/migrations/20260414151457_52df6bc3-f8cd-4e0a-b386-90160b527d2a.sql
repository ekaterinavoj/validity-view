
-- Fix: recalculate triggers must respect negative results (keep expired status)

CREATE OR REPLACE FUNCTION public.recalculate_medical_dates_on_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE medical_examinations
    SET next_examination_date = last_examination_date + (NEW.period_days * INTERVAL '1 day'),
        status = CASE
          WHEN result IN ('failed', 'lost_long_term') THEN 'expired'
          ELSE calculate_examination_status((last_examination_date + (NEW.period_days * INTERVAL '1 day'))::date)
        END,
        updated_at = now()
    WHERE examination_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_training_dates_on_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE trainings
    SET next_training_date = last_training_date + (NEW.period_days * INTERVAL '1 day'),
        status = CASE
          WHEN result IN ('failed', 'non_compliant', 'unfit') THEN 'expired'
          ELSE calculate_training_status((last_training_date + (NEW.period_days * INTERVAL '1 day'))::date)
        END,
        updated_at = now()
    WHERE training_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_deadline_dates_on_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE deadlines
    SET next_check_date = last_check_date + (NEW.period_days * INTERVAL '1 day'),
        status = CASE
          WHEN result IN ('failed', 'non_compliant') THEN 'expired'
          ELSE calculate_deadline_status((last_check_date + (NEW.period_days * INTERVAL '1 day'))::date)
        END,
        updated_at = now()
    WHERE deadline_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
