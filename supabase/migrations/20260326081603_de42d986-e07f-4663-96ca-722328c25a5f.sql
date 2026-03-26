
-- Trigger function: recalculate next dates on training_types.period_days change
CREATE OR REPLACE FUNCTION recalculate_training_dates_on_type_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE trainings
    SET next_training_date = last_training_date + (NEW.period_days * INTERVAL '1 day'),
        updated_at = now()
    WHERE training_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_training_dates_on_type_change ON training_types;
CREATE TRIGGER trg_recalc_training_dates_on_type_change
  AFTER UPDATE OF period_days ON training_types
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_training_dates_on_type_change();

-- Trigger function: recalculate next dates on deadline_types.period_days change
CREATE OR REPLACE FUNCTION recalculate_deadline_dates_on_type_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE deadlines
    SET next_check_date = last_check_date + (NEW.period_days * INTERVAL '1 day'),
        updated_at = now()
    WHERE deadline_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_deadline_dates_on_type_change ON deadline_types;
CREATE TRIGGER trg_recalc_deadline_dates_on_type_change
  AFTER UPDATE OF period_days ON deadline_types
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_deadline_dates_on_type_change();

-- Trigger function: recalculate next dates on medical_examination_types.period_days change
CREATE OR REPLACE FUNCTION recalculate_medical_dates_on_type_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE medical_examinations
    SET next_examination_date = last_examination_date + (NEW.period_days * INTERVAL '1 day'),
        updated_at = now()
    WHERE examination_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_medical_dates_on_type_change ON medical_examination_types;
CREATE TRIGGER trg_recalc_medical_dates_on_type_change
  AFTER UPDATE OF period_days ON medical_examination_types
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_medical_dates_on_type_change();
