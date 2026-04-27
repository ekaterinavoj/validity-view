-- =========================================================================
-- Funkce: get_account_lockout_status
-- Vrací detailní stav uzamčení pro konkrétní e-mail.
-- Volatelná pro anon (potřeba na login stránce).
-- Vrací informace o aktuální politice (max_attempts, window, lock_minutes)
-- a o aktuálním stavu (is_locked, unlock_at, failed_attempts).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_account_lockout_status(_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attempts int := public.get_security_setting_int('security_lockout_max_attempts', 5);
  v_window_min int := public.get_security_setting_int('security_lockout_window_minutes', 15);
  v_lock_min int := public.get_security_setting_int('security_lockout_duration_minutes', 15);
  v_failed_count int := 0;
  v_last_failed timestamptz;
  v_is_locked boolean := false;
  v_unlock_at timestamptz;
BEGIN
  IF _email IS NULL OR length(_email) = 0 THEN
    RETURN jsonb_build_object(
      'is_locked', false,
      'failed_attempts', 0,
      'max_attempts', v_max_attempts,
      'window_minutes', v_window_min,
      'lock_minutes', v_lock_min
    );
  END IF;

  SELECT count(*), max(created_at)
    INTO v_failed_count, v_last_failed
  FROM public.auth_signin_attempts
  WHERE lower(email) = lower(_email)
    AND status = 'failure'
    AND created_at > NOW() - (v_window_min || ' minutes')::interval;

  IF v_failed_count >= v_max_attempts
     AND v_last_failed > NOW() - (v_lock_min || ' minutes')::interval THEN
    v_is_locked := true;
    v_unlock_at := v_last_failed + (v_lock_min || ' minutes')::interval;
  END IF;

  RETURN jsonb_build_object(
    'is_locked', v_is_locked,
    'unlock_at', v_unlock_at,
    'failed_attempts', v_failed_count,
    'last_failed_at', v_last_failed,
    'max_attempts', v_max_attempts,
    'window_minutes', v_window_min,
    'lock_minutes', v_lock_min
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_account_lockout_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_lockout_status(text) TO anon, authenticated, service_role;

-- =========================================================================
-- Funkce: get_high_risk_signin_attempts
-- Vrací e-maily, které mají v posledních N hodinách >= _threshold neúspěšných
-- pokusů, ale ještě nejsou uzamčené (případně už byly odemčené).
-- Slouží jako "early warning" pro admin dashboard.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_high_risk_signin_attempts(
  _threshold int DEFAULT 3,
  _hours int DEFAULT 24
)
RETURNS TABLE (
  email text,
  failed_attempts bigint,
  last_attempt timestamptz,
  first_attempt timestamptz,
  distinct_user_agents bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    a.email::text,
    count(*)::bigint AS failed_attempts,
    max(a.created_at) AS last_attempt,
    min(a.created_at) AS first_attempt,
    count(DISTINCT a.user_agent)::bigint AS distinct_user_agents
  FROM public.auth_signin_attempts a
  WHERE a.status = 'failure'
    AND a.created_at > NOW() - (_hours || ' hours')::interval
  GROUP BY a.email
  HAVING count(*) >= GREATEST(_threshold, 1)
  ORDER BY count(*) DESC, max(a.created_at) DESC
  LIMIT 50;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_high_risk_signin_attempts(int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_high_risk_signin_attempts(int, int) TO authenticated, service_role;