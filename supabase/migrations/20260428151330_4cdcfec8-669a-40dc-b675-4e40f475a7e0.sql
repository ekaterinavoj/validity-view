-- Lockout policy: ensure default keys exist and add admin RPC for atomic update

INSERT INTO public.system_settings (key, value)
VALUES
  ('security_lockout_max_attempts', '5'::jsonb),
  ('security_lockout_window_minutes', '15'::jsonb),
  ('security_lockout_duration_minutes', '15'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_update_lockout_policy(
  _max_attempts int,
  _window_minutes int,
  _duration_minutes int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can update lockout policy';
  END IF;

  IF _max_attempts IS NULL OR _max_attempts < 1 OR _max_attempts > 50 THEN
    RAISE EXCEPTION 'max_attempts must be between 1 and 50';
  END IF;
  IF _window_minutes IS NULL OR _window_minutes < 1 OR _window_minutes > 1440 THEN
    RAISE EXCEPTION 'window_minutes must be between 1 and 1440';
  END IF;
  IF _duration_minutes IS NULL OR _duration_minutes < 1 OR _duration_minutes > 1440 THEN
    RAISE EXCEPTION 'duration_minutes must be between 1 and 1440';
  END IF;

  INSERT INTO public.system_settings (key, value) VALUES
    ('security_lockout_max_attempts', to_jsonb(_max_attempts)),
    ('security_lockout_window_minutes', to_jsonb(_window_minutes)),
    ('security_lockout_duration_minutes', to_jsonb(_duration_minutes))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.audit_logs (action, table_name, record_id, user_id, new_data)
  VALUES (
    'update_lockout_policy',
    'system_settings',
    gen_random_uuid(),
    v_uid,
    jsonb_build_object(
      'max_attempts', _max_attempts,
      'window_minutes', _window_minutes,
      'duration_minutes', _duration_minutes
    )
  );

  RETURN jsonb_build_object(
    'max_attempts', _max_attempts,
    'window_minutes', _window_minutes,
    'duration_minutes', _duration_minutes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_lockout_policy(int, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_lockout_policy(int, int, int) TO authenticated;

-- Public reader so login screen can show the configured policy in the warning banner
CREATE OR REPLACE FUNCTION public.get_lockout_policy()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'max_attempts', public.get_security_setting_int('security_lockout_max_attempts', 5),
    'window_minutes', public.get_security_setting_int('security_lockout_window_minutes', 15),
    'duration_minutes', public.get_security_setting_int('security_lockout_duration_minutes', 15)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_lockout_policy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lockout_policy() TO anon, authenticated, service_role;