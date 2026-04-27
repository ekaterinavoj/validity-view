-- =========================================================
-- Bezpečnost: retence logů + ochrana proti brute-force
-- =========================================================

-- 1) Výchozí nastavení (idempotentní)
INSERT INTO public.system_settings (key, value)
VALUES
  ('security_retention_audit_days', '365'::jsonb),
  ('security_retention_reminder_days', '90'::jsonb),
  ('security_retention_signin_days', '180'::jsonb),
  ('security_lockout_max_attempts', '5'::jsonb),
  ('security_lockout_window_minutes', '15'::jsonb),
  ('security_lockout_duration_minutes', '15'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2) Helper – načte int hodnotu z system_settings s fallbackem
CREATE OR REPLACE FUNCTION public.get_security_setting_int(
  _key text,
  _default int
)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value)::text::int FROM public.system_settings WHERE key = _key),
    _default
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_security_setting_int(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_security_setting_int(text, int) TO authenticated, service_role;

-- 3) Cleanup funkce
CREATE OR REPLACE FUNCTION public.cleanup_old_security_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_days int := public.get_security_setting_int('security_retention_audit_days', 365);
  v_reminder_days int := public.get_security_setting_int('security_retention_reminder_days', 90);
  v_signin_days int := public.get_security_setting_int('security_retention_signin_days', 180);
  v_audit_deleted int := 0;
  v_rem_deleted int := 0;
  v_drem_deleted int := 0;
  v_mrem_deleted int := 0;
  v_signin_deleted int := 0;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - (v_audit_days || ' days')::interval;
  GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;

  DELETE FROM public.reminder_logs
  WHERE sent_at < NOW() - (v_reminder_days || ' days')::interval;
  GET DIAGNOSTICS v_rem_deleted = ROW_COUNT;

  DELETE FROM public.deadline_reminder_logs
  WHERE sent_at < NOW() - (v_reminder_days || ' days')::interval;
  GET DIAGNOSTICS v_drem_deleted = ROW_COUNT;

  DELETE FROM public.medical_reminder_logs
  WHERE sent_at < NOW() - (v_reminder_days || ' days')::interval;
  GET DIAGNOSTICS v_mrem_deleted = ROW_COUNT;

  DELETE FROM public.auth_signin_attempts
  WHERE created_at < NOW() - (v_signin_days || ' days')::interval;
  GET DIAGNOSTICS v_signin_deleted = ROW_COUNT;

  -- Audit záznam
  BEGIN
    INSERT INTO public.audit_logs (action, entity_type, details)
    VALUES (
      'security_cleanup',
      'system',
      jsonb_build_object(
        'audit_deleted', v_audit_deleted,
        'reminder_deleted', v_rem_deleted,
        'deadline_reminder_deleted', v_drem_deleted,
        'medical_reminder_deleted', v_mrem_deleted,
        'signin_attempts_deleted', v_signin_deleted,
        'retention_audit_days', v_audit_days,
        'retention_reminder_days', v_reminder_days,
        'retention_signin_days', v_signin_days
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- audit log selhal, ale cleanup proběhl
    NULL;
  END;

  RETURN jsonb_build_object(
    'audit_deleted', v_audit_deleted,
    'reminder_deleted', v_rem_deleted,
    'deadline_reminder_deleted', v_drem_deleted,
    'medical_reminder_deleted', v_mrem_deleted,
    'signin_attempts_deleted', v_signin_deleted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_security_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_security_logs() TO service_role;

-- 4) pg_cron job (idempotent: unschedule pokud existuje, pak schedule)
DO $$
DECLARE
  v_jobid int;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'cleanup_old_security_logs_daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'cleanup_old_security_logs_daily',
    '30 3 * * *',
    $cron$ SELECT public.cleanup_old_security_logs(); $cron$
  );
END $$;

-- 5) Brute-force lockout check
CREATE OR REPLACE FUNCTION public.is_account_locked(_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attempts int := public.get_security_setting_int('security_lockout_max_attempts', 5);
  v_window_min int := public.get_security_setting_int('security_lockout_window_minutes', 15);
  v_lock_min int := public.get_security_setting_int('security_lockout_duration_minutes', 15);
  v_failed_count int;
  v_last_failed timestamptz;
BEGIN
  IF _email IS NULL OR length(_email) = 0 THEN
    RETURN false;
  END IF;

  SELECT count(*), max(created_at)
    INTO v_failed_count, v_last_failed
  FROM public.auth_signin_attempts
  WHERE lower(email) = lower(_email)
    AND status = 'failed'
    AND created_at > NOW() - (v_window_min || ' minutes')::interval;

  IF v_failed_count >= v_max_attempts
     AND v_last_failed > NOW() - (v_lock_min || ' minutes')::interval THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_account_locked(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_locked(text) TO anon, authenticated, service_role;

-- 6) Statistika lockout pro admin UI
CREATE OR REPLACE FUNCTION public.get_locked_accounts()
RETURNS TABLE (
  email text,
  failed_attempts bigint,
  last_attempt timestamptz,
  unlock_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attempts int := public.get_security_setting_int('security_lockout_max_attempts', 5);
  v_window_min int := public.get_security_setting_int('security_lockout_window_minutes', 15);
  v_lock_min int := public.get_security_setting_int('security_lockout_duration_minutes', 15);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    a.email::text,
    count(*)::bigint AS failed_attempts,
    max(a.created_at) AS last_attempt,
    max(a.created_at) + (v_lock_min || ' minutes')::interval AS unlock_at
  FROM public.auth_signin_attempts a
  WHERE a.status = 'failed'
    AND a.created_at > NOW() - (v_window_min || ' minutes')::interval
  GROUP BY a.email
  HAVING count(*) >= v_max_attempts
     AND max(a.created_at) > NOW() - (v_lock_min || ' minutes')::interval;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_locked_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_locked_accounts() TO authenticated, service_role;