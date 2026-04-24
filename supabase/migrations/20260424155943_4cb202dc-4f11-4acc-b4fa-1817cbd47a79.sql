-- Seed default password_policy into system_settings (idempotent, no overwrite)
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'password_policy',
  jsonb_build_object(
    'min_length', 10,
    'require_uppercase', true,
    'require_lowercase', false,
    'require_digit', true,
    'require_special', true,
    'max_age_enabled', false,
    'max_age_days', 90
  ),
  'Pravidla síly hesla a volitelné vynucování změny hesla po N dnech (admin-only nastavení).'
)
ON CONFLICT (key) DO NOTHING;

-- Allow authenticated users to READ password_policy so client-side validation
-- and review modal can pull the same rules. Admins already have full access via
-- existing system_settings policies.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_settings'
      AND policyname = 'Authenticated can read password_policy'
  ) THEN
    CREATE POLICY "Authenticated can read password_policy"
      ON public.system_settings
      FOR SELECT
      TO authenticated
      USING (key = 'password_policy');
  END IF;
END$$;