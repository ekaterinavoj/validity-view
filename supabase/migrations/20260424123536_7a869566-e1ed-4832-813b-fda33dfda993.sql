-- =========================================================
-- Probation obstacles + audit triggers for probation fields
-- =========================================================

-- 1) Helper: check if user can view a given employee
CREATE OR REPLACE FUNCTION public.can_view_employee(_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND public.is_user_approved(_user_id)
    AND (
      public.has_role(_user_id, 'admin'::app_role)
      OR public.is_manager_of(_user_id, _employee_id)
      OR _employee_id = public.get_user_employee_id(_user_id)
    );
$$;

-- 2) Probation obstacles table
CREATE TABLE IF NOT EXISTS public.probation_obstacles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date_from date NOT NULL,
  date_to date NOT NULL,
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT probation_obstacles_dates_chk CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS idx_probation_obstacles_employee
  ON public.probation_obstacles(employee_id);

ALTER TABLE public.probation_obstacles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View probation obstacles by employee visibility"
  ON public.probation_obstacles;
CREATE POLICY "View probation obstacles by employee visibility"
  ON public.probation_obstacles
  FOR SELECT
  USING (public.can_view_employee(auth.uid(), employee_id));

DROP POLICY IF EXISTS "Admins and managers can insert probation obstacles"
  ON public.probation_obstacles;
CREATE POLICY "Admins and managers can insert probation obstacles"
  ON public.probation_obstacles
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_user_approved(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (public.has_role(auth.uid(), 'manager'::app_role)
          AND public.is_manager_of(auth.uid(), employee_id))
    )
  );

DROP POLICY IF EXISTS "Admins and managers can update probation obstacles"
  ON public.probation_obstacles;
CREATE POLICY "Admins and managers can update probation obstacles"
  ON public.probation_obstacles
  FOR UPDATE
  USING (
    public.is_user_approved(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (public.has_role(auth.uid(), 'manager'::app_role)
          AND public.is_manager_of(auth.uid(), employee_id))
    )
  );

DROP POLICY IF EXISTS "Admins and managers can delete probation obstacles"
  ON public.probation_obstacles;
CREATE POLICY "Admins and managers can delete probation obstacles"
  ON public.probation_obstacles
  FOR DELETE
  USING (
    public.is_user_approved(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (public.has_role(auth.uid(), 'manager'::app_role)
          AND public.is_manager_of(auth.uid(), employee_id))
    )
  );

-- 3) Validate non-overlapping obstacles per employee
CREATE OR REPLACE FUNCTION public.validate_probation_obstacles_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.probation_obstacles po
    WHERE po.employee_id = NEW.employee_id
      AND po.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NOT (po.date_to < NEW.date_from OR po.date_from > NEW.date_to)
  ) THEN
    RAISE EXCEPTION 'Překážka se překrývá s jiným záznamem pro tohoto zaměstnance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_probation_obstacles_no_overlap ON public.probation_obstacles;
CREATE TRIGGER trg_probation_obstacles_no_overlap
  BEFORE INSERT OR UPDATE ON public.probation_obstacles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_probation_obstacles_no_overlap();

-- 4) Compute total obstacle days for an employee
CREATE OR REPLACE FUNCTION public.sum_probation_obstacle_days(_employee_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM((date_to - date_from) + 1), 0)::integer
  FROM public.probation_obstacles
  WHERE employee_id = _employee_id;
$$;

-- 5) Recalculate probation_end_date after obstacle change
CREATE OR REPLACE FUNCTION public.recalc_probation_end_after_obstacle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_id uuid;
BEGIN
  emp_id := COALESCE(NEW.employee_id, OLD.employee_id);

  -- Touch the employee row so the existing calculate_probation_end_date trigger
  -- (BEFORE INSERT/UPDATE on employees) re-runs and re-computes the end date.
  UPDATE public.employees
  SET updated_at = now()
  WHERE id = emp_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_probation_obstacles_recalc ON public.probation_obstacles;
CREATE TRIGGER trg_probation_obstacles_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.probation_obstacles
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_probation_end_after_obstacle();

-- 6) Update employees probation calculation to include obstacle days
CREATE OR REPLACE FUNCTION public.calculate_probation_end_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_months integer;
  obstacle_days integer;
  auto_end date;
BEGIN
  -- Auto-fill probation_months when missing, based on position
  IF NEW.probation_months IS NULL THEN
    NEW.probation_months := CASE
      WHEN public.is_managerial_position(NEW.position) THEN 8
      ELSE 4
    END;
  END IF;

  IF NEW.start_date IS NULL THEN
    NEW.probation_end_date := NULL;
    NEW.probation_override_reason := NULL;
    RETURN NEW;
  END IF;

  obstacle_days := public.sum_probation_obstacle_days(NEW.id);
  auto_end := (NEW.start_date
               + (NEW.probation_months || ' months')::interval
               + (obstacle_days || ' days')::interval)::date;

  -- If user did not explicitly override the date, snap to auto value and clear reason.
  -- If they did override (different from auto), keep their value and require reason
  -- (validated client-side; DB does not enforce).
  IF NEW.probation_end_date IS NULL OR NEW.probation_end_date = auto_end THEN
    NEW.probation_end_date := auto_end;
    NEW.probation_override_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 7) Audit trigger for probation-related fields on employees
CREATE OR REPLACE FUNCTION public.audit_employee_probation_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[] := ARRAY[]::text[];
  actor_email text;
  actor_name text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN
      changed := array_append(changed, 'start_date');
    END IF;
    IF OLD.probation_months IS DISTINCT FROM NEW.probation_months THEN
      changed := array_append(changed, 'probation_months');
    END IF;
    IF OLD.probation_end_date IS DISTINCT FROM NEW.probation_end_date THEN
      changed := array_append(changed, 'probation_end_date');
    END IF;
    IF OLD.probation_override_reason IS DISTINCT FROM NEW.probation_override_reason THEN
      changed := array_append(changed, 'probation_override_reason');
    END IF;

    IF array_length(changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT email, (first_name || ' ' || last_name) INTO actor_email, actor_name
    FROM public.profiles WHERE id = auth.uid();

    INSERT INTO public.audit_logs (
      table_name, record_id, action, old_data, new_data, changed_fields,
      user_id, user_email, user_name
    ) VALUES (
      'employees_probation', NEW.id, 'UPDATE',
      jsonb_build_object(
        'start_date', OLD.start_date,
        'probation_months', OLD.probation_months,
        'probation_end_date', OLD.probation_end_date,
        'probation_override_reason', OLD.probation_override_reason
      ),
      jsonb_build_object(
        'start_date', NEW.start_date,
        'probation_months', NEW.probation_months,
        'probation_end_date', NEW.probation_end_date,
        'probation_override_reason', NEW.probation_override_reason
      ),
      changed, auth.uid(), actor_email, actor_name
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_employee_probation ON public.employees;
CREATE TRIGGER trg_audit_employee_probation
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_employee_probation_changes();

-- 8) Audit trigger for obstacle table
CREATE OR REPLACE FUNCTION public.audit_probation_obstacles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_email text;
  actor_name text;
  rec RECORD;
  emp_id uuid;
  rec_id uuid;
  action_name text;
BEGIN
  SELECT email, (first_name || ' ' || last_name) INTO actor_email, actor_name
  FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'DELETE' THEN
    rec := OLD;
    emp_id := OLD.employee_id;
    rec_id := OLD.id;
    action_name := 'DELETE';
  ELSE
    rec := NEW;
    emp_id := NEW.employee_id;
    rec_id := NEW.id;
    action_name := TG_OP;
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, old_data, new_data, changed_fields,
    user_id, user_email, user_name, target_user_id
  ) VALUES (
    'probation_obstacles', rec_id, action_name,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE
      jsonb_build_object('employee_id', OLD.employee_id, 'date_from', OLD.date_from,
                         'date_to', OLD.date_to, 'reason', OLD.reason) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE
      jsonb_build_object('employee_id', NEW.employee_id, 'date_from', NEW.date_from,
                         'date_to', NEW.date_to, 'reason', NEW.reason) END,
    ARRAY['date_from','date_to','reason']::text[],
    auth.uid(), actor_email, actor_name, NULL
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_probation_obstacles ON public.probation_obstacles;
CREATE TRIGGER trg_audit_probation_obstacles
  AFTER INSERT OR UPDATE OR DELETE ON public.probation_obstacles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_probation_obstacles();

-- 9) updated_at trigger
DROP TRIGGER IF EXISTS trg_probation_obstacles_updated_at ON public.probation_obstacles;
CREATE TRIGGER trg_probation_obstacles_updated_at
  BEFORE UPDATE ON public.probation_obstacles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();