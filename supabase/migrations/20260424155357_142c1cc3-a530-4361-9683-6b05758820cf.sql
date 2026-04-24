-- Add password review tracking columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS must_review_password boolean NOT NULL DEFAULT false;

-- Backfill: mark all existing users as needing password review
-- (we cannot read their existing password to verify strength, so we ask everyone to confirm/change)
UPDATE public.profiles
SET must_review_password = true
WHERE password_updated_at IS NULL;

-- Helper RPC: called by client after a successful password change with a strong password.
-- Resets the review flag and stamps the change time.
CREATE OR REPLACE FUNCTION public.mark_password_reviewed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET must_review_password = false,
      password_updated_at = now(),
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_password_reviewed() TO authenticated;

-- Admin overview RPC: list users whose password needs review, with counts.
-- Only admins can call.
CREATE OR REPLACE FUNCTION public.get_password_review_summary()
RETURNS TABLE(
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  password_updated_at timestamptz,
  must_review_password boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.first_name, p.last_name, p.password_updated_at, p.must_review_password
  FROM public.profiles p
  WHERE p.must_review_password = true
  ORDER BY p.last_name, p.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_password_review_summary() TO authenticated;