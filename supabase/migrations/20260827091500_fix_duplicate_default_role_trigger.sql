-- CRITICAL FIX: two triggers on public.profiles both call assign_default_role()
-- after every INSERT:
--   - assign_default_role_on_signup   (created 2025-11-11, never removed)
--   - on_profile_created_assign_role  (created 2026-02-16 to harden search_path,
--                                       the author assumed it was renaming the
--                                       trigger above but only dropped its own
--                                       older copy, leaving both attached)
--
-- assign_default_role() does a plain INSERT INTO public.user_roles(user_id, role)
-- with no ON CONFLICT clause. With both triggers firing for the same row, the
-- second call always hits the (user_id, role) unique constraint and raises an
-- exception — which aborts the profiles INSERT itself. handle_new_user() catches
-- that, retries a minimal insert, hits the same duplicate trigger again, and
-- gives up silently (RAISE WARNING only). Net effect: every new user (self-signup
-- AND admin-created) ends up with an auth.users row but NO profiles row, so they
-- can log in but see nothing and cannot be approved/managed from the UI.

DROP TRIGGER IF EXISTS assign_default_role_on_signup ON public.profiles;

-- Defense in depth: make the function idempotent regardless of how many times
-- (or from how many trigger names) it ends up firing for the same user/role.
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_exists BOOLEAN;
  reg_mode text;
  invite_record RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  ) INTO admin_exists;

  IF NOT admin_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles SET approval_status = 'approved', approved_at = now() WHERE id = NEW.id;

    RAISE NOTICE 'First user registered - assigned admin role to user %', NEW.id;
    RETURN NEW;
  END IF;

  reg_mode := get_registration_mode();

  SELECT * INTO invite_record
  FROM public.user_invites
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_record.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invite_record.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.user_invites
    SET status = 'used', used_at = now(), used_by = NEW.id
    WHERE id = invite_record.id;

    UPDATE public.profiles
    SET approval_status = 'approved', approved_at = now(), approved_by = invite_record.invited_by
    WHERE id = NEW.id;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
    VALUES ('user_invites', invite_record.id, 'INVITE_USED',
      jsonb_build_object('email', NEW.email, 'role', invite_record.role, 'invited_by', invite_record.invited_by),
      NEW.email, COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

    RAISE NOTICE 'User % registered via invite with role %', NEW.id, invite_record.role;
    RETURN NEW;
  END IF;

  IF reg_mode = 'invite_only' THEN
    RAISE NOTICE 'User % registered in invite-only mode without invite - pending approval', NEW.id;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'User % registered in self-signup mode - pending approval', NEW.id;
  END IF;

  INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
  VALUES ('profiles', NEW.id, 'REGISTRATION_PENDING',
    jsonb_build_object('email', NEW.email, 'mode', reg_mode),
    NEW.email, COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

  RETURN NEW;
END;
$function$;
