-- Fix assign_default_role function to not access raw_user_meta_data from profiles table
-- This trigger runs on profiles, not auth.users, so NEW doesn't have raw_user_meta_data

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
  -- Check if there's an existing admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  ) INTO admin_exists;
  
  -- If no admin exists, first user becomes admin and is auto-approved
  IF NOT admin_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    -- Auto-approve first admin
    UPDATE public.profiles SET approval_status = 'approved', approved_at = now() WHERE id = NEW.id;
    
    RAISE NOTICE 'First user registered - assigned admin role to user %', NEW.id;
    RETURN NEW;
  END IF;
  
  -- Get registration mode
  reg_mode := get_registration_mode();
  
  -- Check for valid invite
  SELECT * INTO invite_record
  FROM public.user_invites
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If valid invite found, assign the invited role and approve
  IF invite_record.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invite_record.role);
    
    -- Mark invite as used
    UPDATE public.user_invites 
    SET status = 'used', used_at = now(), used_by = NEW.id
    WHERE id = invite_record.id;
    
    -- Auto-approve invited users
    UPDATE public.profiles 
    SET approval_status = 'approved', approved_at = now(), approved_by = invite_record.invited_by 
    WHERE id = NEW.id;
    
    -- Log to audit (using only data available from profiles table)
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
    VALUES ('user_invites', invite_record.id, 'INVITE_USED', 
      jsonb_build_object('email', NEW.email, 'role', invite_record.role, 'invited_by', invite_record.invited_by),
      NEW.email, COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    
    RAISE NOTICE 'User % registered via invite with role %', NEW.id, invite_record.role;
    RETURN NEW;
  END IF;
  
  -- Handle based on registration mode
  IF reg_mode = 'invite_only' THEN
    -- In invite-only mode without valid invite, user stays pending with no role
    RAISE NOTICE 'User % registered in invite-only mode without invite - pending approval', NEW.id;
  ELSE
    -- In self-signup mode, assign 'user' role but keep pending status
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RAISE NOTICE 'User % registered in self-signup mode - pending approval', NEW.id;
  END IF;
  
  -- Log pending registration (using only data available from profiles table)
  INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
  VALUES ('profiles', NEW.id, 'REGISTRATION_PENDING', 
    jsonb_build_object('email', NEW.email, 'mode', reg_mode),
    NEW.email, COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  
  RETURN NEW;
END;
$function$;