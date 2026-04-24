-- =============================================
-- Probation period tracking for employees
-- =============================================

-- 1. Add columns to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS probation_end_date date,
  ADD COLUMN IF NOT EXISTS probation_months integer;

COMMENT ON COLUMN public.employees.start_date IS 'Datum nástupu zaměstnance do pracovního poměru';
COMMENT ON COLUMN public.employees.probation_end_date IS 'Datum konce zkušební doby (ručně upravitelné kvůli překážkám v práci dle ZP 2026)';
COMMENT ON COLUMN public.employees.probation_months IS 'Délka zkušební doby v měsících (default 4 pro běžné, 8 pro vedoucí dle novely ZP 2026)';

-- 2. Helper function: detect "vedoucí" position by keyword
CREATE OR REPLACE FUNCTION public.is_managerial_position(_position text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _position IS NOT NULL AND (
    LOWER(_position) LIKE '%vedouc%' OR
    LOWER(_position) LIKE '%manaž%' OR
    LOWER(_position) LIKE '%manag%' OR
    LOWER(_position) LIKE '%ředitel%' OR
    LOWER(_position) LIKE '%reditel%' OR
    LOWER(_position) LIKE '%head%' OR
    LOWER(_position) LIKE '%chief%' OR
    LOWER(_position) LIKE '%director%'
  )
$$;

-- 3. Auto-calculate probation_end_date when start_date is set/changed
CREATE OR REPLACE FUNCTION public.calculate_probation_end_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_months integer;
BEGIN
  -- If start_date is null, clear probation_end_date too
  IF NEW.start_date IS NULL THEN
    NEW.probation_end_date := NULL;
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

  -- Only auto-calculate if probation_end_date wasn't manually set in this operation
  -- (allows admins to override for překážky v práci)
  IF TG_OP = 'INSERT' OR (
    OLD.start_date IS DISTINCT FROM NEW.start_date OR
    OLD.probation_months IS DISTINCT FROM NEW.probation_months
  ) THEN
    -- Only override probation_end_date if it equals the previously computed value
    -- or is null. This preserves manual overrides.
    IF TG_OP = 'INSERT' AND NEW.probation_end_date IS NULL THEN
      NEW.probation_end_date := NEW.start_date + (v_months || ' months')::interval;
    ELSIF TG_OP = 'UPDATE' AND (
      NEW.probation_end_date IS NULL OR
      NEW.probation_end_date = OLD.probation_end_date
    ) THEN
      NEW.probation_end_date := NEW.start_date + (v_months || ' months')::interval;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_probation_end_date ON public.employees;
CREATE TRIGGER trg_calculate_probation_end_date
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_probation_end_date();

-- 4. Index for fast lookup of upcoming probations
CREATE INDEX IF NOT EXISTS idx_employees_probation_end_date
  ON public.employees(probation_end_date)
  WHERE probation_end_date IS NOT NULL AND status = 'employed';

-- 5. Notification function – generate in-app notifications for upcoming probation ends
CREATE OR REPLACE FUNCTION public.check_probation_period_endings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_warning_date date := CURRENT_DATE + INTERVAL '14 days';
  v_employee RECORD;
  v_admin RECORD;
  v_manager_user_id uuid;
  v_notif_type text;
  v_notif_title text;
  v_notif_message text;
  v_days_left integer;
  v_existing_count integer;
  v_total_created integer := 0;
  v_employees_processed integer := 0;
BEGIN
  -- Loop through active employees with probation ending today or in 14 days
  FOR v_employee IN
    SELECT e.id, e.first_name, e.last_name, e.position,
           e.probation_end_date, e.manager_employee_id,
           e.start_date, e.probation_months
    FROM public.employees e
    WHERE e.status = 'employed'
      AND e.probation_end_date IS NOT NULL
      AND e.probation_end_date IN (v_today, v_warning_date)
  LOOP
    v_employees_processed := v_employees_processed + 1;
    v_days_left := v_employee.probation_end_date - v_today;

    IF v_days_left = 0 THEN
      v_notif_type := 'warning';
      v_notif_title := 'Konec zkušební doby DNES';
      v_notif_message := format(
        'Zaměstnanci %s %s (%s) dnes končí zkušební doba. Rozhodněte o pokračování pracovního poměru.',
        v_employee.first_name, v_employee.last_name,
        COALESCE(v_employee.position, 'pozice neuvedena')
      );
    ELSE
      v_notif_type := 'info';
      v_notif_title := 'Zkušební doba končí za 14 dní';
      v_notif_message := format(
        'Zaměstnanci %s %s (%s) končí zkušební doba %s.',
        v_employee.first_name, v_employee.last_name,
        COALESCE(v_employee.position, 'pozice neuvedena'),
        to_char(v_employee.probation_end_date, 'DD.MM.YYYY')
      );
    END IF;

    -- Notify all admins
    FOR v_admin IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'
    LOOP
      -- Skip duplicates (same user, same employee, same notif type, today)
      SELECT COUNT(*) INTO v_existing_count
      FROM public.notifications
      WHERE user_id = v_admin.user_id
        AND related_entity_type = 'probation_period'
        AND related_entity_id = v_employee.id
        AND type = v_notif_type
        AND created_at::date = v_today;

      IF v_existing_count = 0 THEN
        INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
        VALUES (v_admin.user_id, v_notif_title, v_notif_message, v_notif_type, 'probation_period', v_employee.id);
        v_total_created := v_total_created + 1;
      END IF;
    END LOOP;

    -- Notify direct manager (if exists and has linked profile)
    IF v_employee.manager_employee_id IS NOT NULL THEN
      SELECT p.id INTO v_manager_user_id
      FROM public.profiles p
      WHERE p.employee_id = v_employee.manager_employee_id
      LIMIT 1;

      IF v_manager_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_existing_count
        FROM public.notifications
        WHERE user_id = v_manager_user_id
          AND related_entity_type = 'probation_period'
          AND related_entity_id = v_employee.id
          AND type = v_notif_type
          AND created_at::date = v_today;

        IF v_existing_count = 0 THEN
          INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
          VALUES (v_manager_user_id, v_notif_title, v_notif_message, v_notif_type, 'probation_period', v_employee.id);
          v_total_created := v_total_created + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'employees_processed', v_employees_processed,
    'notifications_created', v_total_created,
    'run_at', now()
  );
END;
$$;

-- 6. Backfill probation_end_date for existing employees with start_date but no probation_end_date
-- (will be done by trigger on next update; for safety also do it here)
UPDATE public.employees
SET probation_months = CASE
  WHEN public.is_managerial_position(position) THEN 8
  ELSE 4
END
WHERE start_date IS NOT NULL
  AND probation_months IS NULL;

UPDATE public.employees
SET probation_end_date = start_date + (probation_months || ' months')::interval
WHERE start_date IS NOT NULL
  AND probation_end_date IS NULL
  AND probation_months IS NOT NULL;

-- 7. Schedule daily cron job to check probation endings (08:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('check-probation-period-endings-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-probation-period-endings-daily');

    PERFORM cron.schedule(
      'check-probation-period-endings-daily',
      '0 8 * * *',
      $cron$ SELECT public.check_probation_period_endings(); $cron$
    );
  END IF;
END $$;