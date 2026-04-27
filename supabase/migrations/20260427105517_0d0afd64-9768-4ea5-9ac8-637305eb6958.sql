-- Oprava: status v auth_signin_attempts je 'failure', ne 'failed'
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
    AND status = 'failure'
    AND created_at > NOW() - (v_window_min || ' minutes')::interval;

  IF v_failed_count >= v_max_attempts
     AND v_last_failed > NOW() - (v_lock_min || ' minutes')::interval THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

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
  WHERE a.status = 'failure'
    AND a.created_at > NOW() - (v_window_min || ' minutes')::interval
  GROUP BY a.email
  HAVING count(*) >= v_max_attempts
     AND max(a.created_at) > NOW() - (v_lock_min || ' minutes')::interval;
END;
$$;