-- Recalculate all statuses honouring fixed_at as an override for negative results
CREATE OR REPLACE FUNCTION public.recalculate_all_statuses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t_updated integer := 0;
  d_updated integer := 0;
  m_updated integer := 0;
BEGIN
  UPDATE public.trainings
  SET status = calculate_training_status(next_training_date)
  WHERE is_active = true
    AND deleted_at IS NULL
    AND (fixed_at IS NOT NULL OR result IS NULL OR result NOT IN ('failed', 'non_compliant', 'unfit'))
    AND status IS DISTINCT FROM calculate_training_status(next_training_date);
  GET DIAGNOSTICS t_updated = ROW_COUNT;

  UPDATE public.deadlines
  SET status = calculate_deadline_status(next_check_date)
  WHERE is_active = true
    AND deleted_at IS NULL
    AND (fixed_at IS NOT NULL OR result IS NULL OR result NOT IN ('failed', 'non_compliant'))
    AND status IS DISTINCT FROM calculate_deadline_status(next_check_date);
  GET DIAGNOSTICS d_updated = ROW_COUNT;

  UPDATE public.medical_examinations
  SET status = calculate_examination_status(next_examination_date)
  WHERE is_active = true
    AND deleted_at IS NULL
    AND (result IS NULL OR result NOT IN ('failed', 'lost_long_term'))
    AND status IS DISTINCT FROM calculate_examination_status(next_examination_date);
  GET DIAGNOSTICS m_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'trainings_updated', t_updated,
    'deadlines_updated', d_updated,
    'medical_updated', m_updated
  );
END;
$function$;

-- Type-period change recalculation: also respect fixed_at
CREATE OR REPLACE FUNCTION public.recalculate_training_dates_on_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE trainings
    SET next_training_date = last_training_date + (NEW.period_days * INTERVAL '1 day'),
        status = CASE
          WHEN result IN ('failed', 'non_compliant', 'unfit') AND fixed_at IS NULL THEN 'expired'
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
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_deadline_dates_on_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE deadlines
    SET next_check_date = last_check_date + (NEW.period_days * INTERVAL '1 day'),
        status = CASE
          WHEN result IN ('failed', 'non_compliant') AND fixed_at IS NULL THEN 'expired'
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
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_training_status_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'employed' AND OLD.status != 'employed' THEN
    UPDATE public.trainings
    SET status = CASE
      WHEN result IN ('failed', 'non_compliant', 'unfit') AND fixed_at IS NULL THEN 'expired'
      ELSE calculate_training_status(next_training_date)
    END
    WHERE employee_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;