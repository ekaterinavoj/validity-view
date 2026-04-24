DROP POLICY IF EXISTS "Anyone can log signin attempts" ON public.auth_signin_attempts;

CREATE POLICY "Validated signin attempt logging"
ON public.auth_signin_attempts
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 3 AND 320
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND status IN ('success', 'failure', 'retry')
  AND (error_message IS NULL OR length(error_message) <= 2000)
  AND attempt_number BETWEEN 1 AND 10
);