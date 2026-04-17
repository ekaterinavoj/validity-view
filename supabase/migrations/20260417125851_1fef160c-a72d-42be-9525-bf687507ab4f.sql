
-- ============================================================
-- 1) Auto-recalc next_*_date when period_days_override changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_training_on_override_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  effective_period integer;
  type_period integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.period_days_override IS NOT DISTINCT FROM OLD.period_days_override
     AND NEW.last_training_date IS NOT DISTINCT FROM OLD.last_training_date THEN
    RETURN NEW;
  END IF;

  IF NEW.period_days_override IS NOT NULL THEN
    effective_period := NEW.period_days_override;
  ELSE
    SELECT period_days INTO type_period FROM public.training_types WHERE id = NEW.training_type_id;
    effective_period := type_period;
  END IF;

  IF effective_period IS NOT NULL AND NEW.last_training_date IS NOT NULL THEN
    NEW.next_training_date := (NEW.last_training_date + (effective_period * INTERVAL '1 day'))::date;
    NEW.status := CASE
      WHEN NEW.result IN ('failed', 'non_compliant', 'unfit') AND NEW.fixed_at IS NULL THEN 'expired'
      ELSE calculate_training_status(NEW.next_training_date)
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_override_recalc ON public.trainings;
CREATE TRIGGER trg_training_override_recalc
BEFORE INSERT OR UPDATE OF period_days_override, last_training_date ON public.trainings
FOR EACH ROW EXECUTE FUNCTION public.recalculate_training_on_override_change();

CREATE OR REPLACE FUNCTION public.recalculate_deadline_on_override_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  effective_period integer;
  type_period integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.period_days_override IS NOT DISTINCT FROM OLD.period_days_override
     AND NEW.last_check_date IS NOT DISTINCT FROM OLD.last_check_date THEN
    RETURN NEW;
  END IF;

  IF NEW.period_days_override IS NOT NULL THEN
    effective_period := NEW.period_days_override;
  ELSE
    SELECT period_days INTO type_period FROM public.deadline_types WHERE id = NEW.deadline_type_id;
    effective_period := type_period;
  END IF;

  IF effective_period IS NOT NULL AND NEW.last_check_date IS NOT NULL THEN
    NEW.next_check_date := (NEW.last_check_date + (effective_period * INTERVAL '1 day'))::date;
    NEW.status := CASE
      WHEN NEW.result IN ('failed', 'non_compliant') AND NEW.fixed_at IS NULL THEN 'expired'
      ELSE calculate_deadline_status(NEW.next_check_date)
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deadline_override_recalc ON public.deadlines;
CREATE TRIGGER trg_deadline_override_recalc
BEFORE INSERT OR UPDATE OF period_days_override, last_check_date ON public.deadlines
FOR EACH ROW EXECUTE FUNCTION public.recalculate_deadline_on_override_change();

CREATE OR REPLACE FUNCTION public.recalculate_examination_on_override_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  effective_period integer;
  type_period integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.period_days_override IS NOT DISTINCT FROM OLD.period_days_override
     AND NEW.last_examination_date IS NOT DISTINCT FROM OLD.last_examination_date THEN
    RETURN NEW;
  END IF;

  IF NEW.period_days_override IS NOT NULL THEN
    effective_period := NEW.period_days_override;
  ELSE
    SELECT period_days INTO type_period FROM public.medical_examination_types WHERE id = NEW.examination_type_id;
    effective_period := type_period;
  END IF;

  IF effective_period IS NOT NULL AND NEW.last_examination_date IS NOT NULL THEN
    NEW.next_examination_date := (NEW.last_examination_date + (effective_period * INTERVAL '1 day'))::date;
    NEW.status := CASE
      WHEN NEW.result IN ('failed', 'lost_long_term') THEN 'expired'
      ELSE calculate_examination_status(NEW.next_examination_date)
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_examination_override_recalc ON public.medical_examinations;
CREATE TRIGGER trg_examination_override_recalc
BEFORE INSERT OR UPDATE OF period_days_override, last_examination_date ON public.medical_examinations
FOR EACH ROW EXECUTE FUNCTION public.recalculate_examination_on_override_change();

-- ============================================================
-- 2) Notify responsibles/managers when expired record is fixed
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_training_fixed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  emp_record RECORD;
  manager_profile_id uuid;
  admin_user RECORD;
  notif_title text;
  notif_message text;
  fixer_label text;
BEGIN
  IF NEW.fixed_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.fixed_at IS NOT DISTINCT FROM NEW.fixed_at) THEN
    RETURN NEW;
  END IF;

  SELECT e.id, e.first_name, e.last_name, e.manager_employee_id
    INTO emp_record
  FROM public.employees e WHERE e.id = NEW.employee_id;

  fixer_label := COALESCE(NEW.fixed_by_name, 'systém');

  notif_title := 'Školení označeno jako opraveno';
  notif_message := 'Záznam školení pro ' || COALESCE(emp_record.first_name || ' ' || emp_record.last_name, 'zaměstnance')
    || ' byl opraven dne ' || to_char(NEW.fixed_at, 'DD.MM.YYYY')
    || ' (' || fixer_label || ').';

  -- Notify manager via profile linked to manager_employee_id
  IF emp_record.manager_employee_id IS NOT NULL THEN
    SELECT p.id INTO manager_profile_id FROM public.profiles p
    WHERE p.employee_id = emp_record.manager_employee_id LIMIT 1;
    IF manager_profile_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (manager_profile_id, notif_title, notif_message, 'success', 'training', NEW.id);
    END IF;
  END IF;

  -- Notify all admins (but not the fixer themselves)
  FOR admin_user IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
  LOOP
    IF admin_user.user_id <> COALESCE(NEW.fixed_by_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND admin_user.user_id <> COALESCE(manager_profile_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (admin_user.user_id, notif_title, notif_message, 'success', 'training', NEW.id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_training_fixed ON public.trainings;
CREATE TRIGGER trg_notify_training_fixed
AFTER UPDATE OF fixed_at ON public.trainings
FOR EACH ROW EXECUTE FUNCTION public.notify_training_fixed();

CREATE OR REPLACE FUNCTION public.notify_deadline_fixed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  eq_name text;
  resp RECORD;
  admin_user RECORD;
  notif_title text;
  notif_message text;
  fixer_label text;
  notified_users uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NEW.fixed_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.fixed_at IS NOT DISTINCT FROM NEW.fixed_at) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO eq_name FROM public.equipment WHERE id = NEW.equipment_id;
  fixer_label := COALESCE(NEW.fixed_by_name, 'systém');

  notif_title := 'Technická událost označena jako opraveno';
  notif_message := 'Záznam pro ' || COALESCE(eq_name, 'zařízení')
    || ' byl opraven dne ' || to_char(NEW.fixed_at, 'DD.MM.YYYY')
    || ' (' || fixer_label || ').';

  -- Direct deadline responsibles (profile_id)
  FOR resp IN
    SELECT DISTINCT profile_id FROM public.deadline_responsibles
    WHERE deadline_id = NEW.id AND profile_id IS NOT NULL
    UNION
    SELECT DISTINCT rgm.profile_id FROM public.deadline_responsibles dr
    JOIN public.responsibility_group_members rgm ON rgm.group_id = dr.group_id
    WHERE dr.deadline_id = NEW.id AND dr.group_id IS NOT NULL
    UNION
    SELECT DISTINCT er.profile_id FROM public.equipment_responsibles er
    WHERE er.equipment_id = NEW.equipment_id
  LOOP
    IF resp.profile_id IS NOT NULL
       AND resp.profile_id <> COALESCE(NEW.fixed_by_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND NOT (resp.profile_id = ANY(notified_users)) THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (resp.profile_id, notif_title, notif_message, 'success', 'deadline', NEW.id);
      notified_users := array_append(notified_users, resp.profile_id);
    END IF;
  END LOOP;

  -- Admins
  FOR admin_user IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' LOOP
    IF admin_user.user_id <> COALESCE(NEW.fixed_by_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND NOT (admin_user.user_id = ANY(notified_users)) THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (admin_user.user_id, notif_title, notif_message, 'success', 'deadline', NEW.id);
      notified_users := array_append(notified_users, admin_user.user_id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deadline_fixed ON public.deadlines;
CREATE TRIGGER trg_notify_deadline_fixed
AFTER UPDATE OF fixed_at ON public.deadlines
FOR EACH ROW EXECUTE FUNCTION public.notify_deadline_fixed();
