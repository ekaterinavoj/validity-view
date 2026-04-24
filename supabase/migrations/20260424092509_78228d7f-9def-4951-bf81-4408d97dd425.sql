-- 1. Robustní assign_default_role s izolovaným error handlingem
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
  -- Check if there's an existing admin (safe read)
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles WHERE role = 'admin'
    ) INTO admin_exists;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'assign_default_role: failed to check admin existence for user %: %', NEW.id, SQLERRM;
    admin_exists := true; -- Safe default: assume admin exists, don't grant admin role
  END;

  -- If no admin exists, first user becomes admin
  IF NOT admin_exists THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
      UPDATE public.profiles SET approval_status = 'approved', approved_at = now() WHERE id = NEW.id;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'assign_default_role: failed to assign first admin for user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  -- Get registration mode (safe)
  BEGIN
    reg_mode := get_registration_mode();
  EXCEPTION WHEN others THEN
    RAISE WARNING 'assign_default_role: failed to get registration mode for user %: %', NEW.id, SQLERRM;
    reg_mode := 'self_signup_approval';
  END;

  -- Check for valid invite (safe)
  BEGIN
    SELECT * INTO invite_record
    FROM public.user_invites
    WHERE email = NEW.email
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'assign_default_role: failed to check invites for user %: %', NEW.id, SQLERRM;
    invite_record := NULL;
  END;

  -- If valid invite found, assign the invited role and approve
  IF invite_record.id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, invite_record.role)
      ON CONFLICT DO NOTHING;
      UPDATE public.user_invites
        SET status = 'used', used_at = now(), used_by = NEW.id
        WHERE id = invite_record.id;
      UPDATE public.profiles
        SET approval_status = 'approved', approved_at = now(), approved_by = invite_record.invited_by
        WHERE id = NEW.id;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'assign_default_role: failed to apply invite for user %: %', NEW.id, SQLERRM;
    END;

    -- Audit log (best effort, never blocks)
    BEGIN
      INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
      VALUES ('user_invites', invite_record.id, 'INVITE_USED',
        jsonb_build_object('email', NEW.email, 'role', invite_record.role, 'invited_by', invite_record.invited_by),
        NEW.email, COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    EXCEPTION WHEN others THEN
      RAISE WARNING 'assign_default_role: failed to write invite audit log for user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  -- Handle based on registration mode
  IF reg_mode != 'invite_only' THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'assign_default_role: failed to assign default user role for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- Audit log for pending registration (best effort)
  BEGIN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
    VALUES ('profiles', NEW.id, 'REGISTRATION_PENDING',
      jsonb_build_object('email', NEW.email, 'mode', reg_mode),
      NEW.email, COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  EXCEPTION WHEN others THEN
    RAISE WARNING 'assign_default_role: failed to write registration audit log for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Final safety net: never block user creation
  RAISE WARNING 'assign_default_role: unexpected error for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- 2. Fix search_path on document numbering functions (linter warnings)
CREATE OR REPLACE FUNCTION public.generate_training_doc_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.document_number IS NULL THEN
    NEW.document_number := 'TRN-' || LPAD(nextval('training_doc_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_deadline_doc_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.document_number IS NULL THEN
    NEW.document_number := 'DL-' || LPAD(nextval('deadline_doc_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_medical_doc_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.document_number IS NULL THEN
    NEW.document_number := 'MED-' || LPAD(nextval('medical_doc_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;