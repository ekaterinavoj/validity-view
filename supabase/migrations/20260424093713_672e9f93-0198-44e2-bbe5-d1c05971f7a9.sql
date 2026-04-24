-- ============================================================
-- Security Hardening v2: drop+recreate pg_net, tighten RLS, diagnostics
-- ============================================================

-- 1) Move pg_net out of public (drop & recreate; SET SCHEMA not supported)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_net' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP EXTENSION pg_net CASCADE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    EXECUTE 'CREATE EXTENSION pg_net WITH SCHEMA extensions';
  END IF;
END $$;

-- 2) Tighten RLS: replace USING(true) / WITH CHECK(true) on system tables
DROP POLICY IF EXISTS "System can insert reminder logs" ON public.reminder_logs;
CREATE POLICY "Admins or service can insert reminder logs"
ON public.reminder_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "System can insert deadline reminder logs" ON public.deadline_reminder_logs;
CREATE POLICY "Admins or service can insert deadline reminder logs"
ON public.deadline_reminder_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "System can insert medical reminder logs" ON public.medical_reminder_logs;
CREATE POLICY "Admins or service can insert medical reminder logs"
ON public.medical_reminder_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "System can insert reminder runs" ON public.reminder_runs;
CREATE POLICY "Admins or service can insert reminder runs"
ON public.reminder_runs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "System can update reminder runs" ON public.reminder_runs;
CREATE POLICY "Admins or service can update reminder runs"
ON public.reminder_runs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Admins or service can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Auth diagnostics table for signIn retry telemetry
CREATE TABLE IF NOT EXISTS public.auth_signin_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL,
  http_status integer,
  error_code text,
  error_message text,
  request_id text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_signin_attempts_email_created
  ON public.auth_signin_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_signin_attempts_request
  ON public.auth_signin_attempts(request_id);

ALTER TABLE public.auth_signin_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can log signin attempts" ON public.auth_signin_attempts;
CREATE POLICY "Anyone can log signin attempts"
ON public.auth_signin_attempts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read signin attempts" ON public.auth_signin_attempts;
CREATE POLICY "Admins can read signin attempts"
ON public.auth_signin_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete signin attempts" ON public.auth_signin_attempts;
CREATE POLICY "Admins can delete signin attempts"
ON public.auth_signin_attempts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));