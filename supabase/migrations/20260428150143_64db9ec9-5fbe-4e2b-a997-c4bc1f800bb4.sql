-- Admin RPC: okamžité odemknutí uzamčeného účtu vymazáním neúspěšných pokusů
CREATE OR REPLACE FUNCTION public.admin_unlock_account(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_deleted_count int := 0;
  v_normalized_email text;
BEGIN
  -- Pouze admin
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: only admins can unlock accounts';
  END IF;

  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  v_normalized_email := lower(trim(_email));

  -- Smaž všechny neúspěšné pokusy daného e-mailu (resetuje lockout counter)
  DELETE FROM public.auth_signin_attempts
  WHERE lower(email) = v_normalized_email
    AND status = 'failure';
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Audit log
  INSERT INTO public.audit_logs (
    action, table_name, record_id, user_id,
    new_data
  )
  VALUES (
    'admin_unlock_account',
    'auth_signin_attempts',
    gen_random_uuid(),
    v_caller,
    jsonb_build_object(
      'target_email', v_normalized_email,
      'deleted_failed_attempts', v_deleted_count,
      'unlocked_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'email', v_normalized_email,
    'deleted_attempts', v_deleted_count
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.admin_unlock_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unlock_account(text) TO authenticated, service_role;