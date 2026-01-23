-- Add approval status to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Mark all existing users as approved (they're already in the system)
UPDATE public.profiles SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Create user invites table for invite-only mode
CREATE TABLE public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invited_by uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamp with time zone,
  used_by uuid,
  status text NOT NULL DEFAULT 'pending'
);

-- Enable RLS on user_invites
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_invites
CREATE POLICY "Admins can view all invites"
ON public.user_invites
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create invites"
ON public.user_invites
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invites"
ON public.user_invites
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invites"
ON public.user_invites
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Create function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id AND approval_status = 'approved'
  )
$$;

-- Create function to check registration mode
CREATE OR REPLACE FUNCTION public.get_registration_mode()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value->>'mode' FROM public.system_settings WHERE key = 'registration_mode'),
    'self_signup_approval'
  )
$$;

-- Create function to check if email is allowed
CREATE OR REPLACE FUNCTION public.is_email_allowed(_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowlist jsonb;
  domains jsonb;
  emails jsonb;
  email_domain text;
BEGIN
  -- Get allowlist from settings
  SELECT value INTO allowlist 
  FROM public.system_settings 
  WHERE key = 'registration_allowlist';
  
  -- If no allowlist configured, allow all
  IF allowlist IS NULL THEN
    RETURN true;
  END IF;
  
  domains := COALESCE(allowlist->'domains', '[]'::jsonb);
  emails := COALESCE(allowlist->'emails', '[]'::jsonb);
  
  -- If both lists are empty, allow all
  IF jsonb_array_length(domains) = 0 AND jsonb_array_length(emails) = 0 THEN
    RETURN true;
  END IF;
  
  -- Check if email is in allowed emails list
  IF emails ? _email THEN
    RETURN true;
  END IF;
  
  -- Check if email domain is in allowed domains list
  email_domain := split_part(_email, '@', 2);
  IF domains ? email_domain THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Update assign_default_role trigger to handle registration modes
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    -- Log to audit
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
    VALUES ('user_invites', invite_record.id, 'INVITE_USED', 
      jsonb_build_object('email', NEW.email, 'role', invite_record.role, 'invited_by', invite_record.invited_by),
      NEW.email, COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', ''));
    
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
  
  -- Log pending registration
  INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
  VALUES ('profiles', NEW.id, 'REGISTRATION_PENDING', 
    jsonb_build_object('email', NEW.email, 'mode', reg_mode),
    NEW.email, COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', ''));
  
  RETURN NEW;
END;
$$;

-- Create trigger for audit logging on profile approval changes
CREATE OR REPLACE FUNCTION public.log_profile_approval_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Only log if approval_status changed
  IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    -- Get info about who made the change
    SELECT email, first_name || ' ' || last_name as full_name
    INTO user_profile
    FROM public.profiles
    WHERE id = auth.uid();
    
    INSERT INTO public.audit_logs (
      table_name, record_id, action, old_data, new_data, 
      user_id, user_email, user_name, changed_fields
    ) VALUES (
      'profiles', NEW.id, 
      CASE 
        WHEN NEW.approval_status = 'approved' THEN 'USER_APPROVED'
        WHEN NEW.approval_status = 'rejected' THEN 'USER_REJECTED'
        ELSE 'UPDATE'
      END,
      jsonb_build_object('approval_status', OLD.approval_status),
      jsonb_build_object('approval_status', NEW.approval_status, 'approved_by', NEW.approved_by),
      auth.uid(),
      user_profile.email,
      user_profile.full_name,
      ARRAY['approval_status']
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for approval status changes
DROP TRIGGER IF EXISTS log_profile_approval_trigger ON public.profiles;
CREATE TRIGGER log_profile_approval_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_approval_changes();

-- Insert default system settings for registration
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('registration_mode', '{"mode": "self_signup_approval"}'::jsonb, 'User registration mode: invite_only or self_signup_approval'),
  ('registration_allowlist', '{"domains": [], "emails": []}'::jsonb, 'Allowed email domains and specific emails for registration')
ON CONFLICT (key) DO NOTHING;