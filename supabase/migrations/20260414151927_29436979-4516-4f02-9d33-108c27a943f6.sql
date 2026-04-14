
-- Fix recalculate_all_statuses to respect negative results
CREATE OR REPLACE FUNCTION public.recalculate_all_statuses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_updated integer := 0;
  d_updated integer := 0;
  m_updated integer := 0;
BEGIN
  -- Trainings: skip records with negative results (they must stay expired)
  UPDATE public.trainings
  SET status = calculate_training_status(next_training_date)
  WHERE is_active = true
    AND deleted_at IS NULL
    AND (result IS NULL OR result NOT IN ('failed', 'non_compliant', 'unfit'))
    AND status IS DISTINCT FROM calculate_training_status(next_training_date);
  GET DIAGNOSTICS t_updated = ROW_COUNT;

  -- Deadlines: skip records with negative results
  UPDATE public.deadlines
  SET status = calculate_deadline_status(next_check_date)
  WHERE is_active = true
    AND deleted_at IS NULL
    AND (result IS NULL OR result NOT IN ('failed', 'non_compliant'))
    AND status IS DISTINCT FROM calculate_deadline_status(next_check_date);
  GET DIAGNOSTICS d_updated = ROW_COUNT;

  -- Medical examinations: skip records with negative results
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
$$;

-- Fix recalculate_training_status_on_activation to respect negative results
CREATE OR REPLACE FUNCTION public.recalculate_training_status_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'employed' AND OLD.status != 'employed' THEN
    UPDATE public.trainings
    SET status = CASE
      WHEN result IN ('failed', 'non_compliant', 'unfit') THEN 'expired'
      ELSE calculate_training_status(next_training_date)
    END
    WHERE employee_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix recalculate_examination_status_on_activation to respect negative results
CREATE OR REPLACE FUNCTION public.recalculate_examination_status_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'employed' AND OLD.status != 'employed' THEN
    UPDATE public.medical_examinations
    SET status = CASE
      WHEN result IN ('failed', 'lost_long_term') THEN 'expired'
      ELSE calculate_examination_status(next_examination_date)
    END
    WHERE employee_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
