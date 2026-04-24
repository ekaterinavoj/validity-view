-- Seed default session timeout settings (configurable in Admin Settings)
INSERT INTO public.system_settings (key, value, description)
VALUES
  ('session_timeout',
   '{"enabled": true, "idle_minutes": 60, "warn_seconds_before": 300}'::jsonb,
   'Auto-logout uživatelů po neaktivitě. idle_minutes = doba neaktivity v minutách, warn_seconds_before = kolik sekund před vypršením zobrazit varování.')
ON CONFLICT (key) DO NOTHING;

-- Allow authenticated users to READ session_timeout (needed by client to know the policy)
-- system_settings already has admin-only write; reading session_timeout must be readable by all logged-in users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_settings'
      AND policyname = 'session_timeout_readable_by_authenticated'
  ) THEN
    CREATE POLICY "session_timeout_readable_by_authenticated"
      ON public.system_settings
      FOR SELECT
      TO authenticated
      USING (key = 'session_timeout');
  END IF;
END $$;