-- Fix RLS policies to block pending users from accessing data
-- (Only approved users can access trainings, employees, training_types)

-- 1. Drop and recreate SELECT policies with approval check

DROP POLICY IF EXISTS "Anyone can view trainings" ON public.trainings;
CREATE POLICY "Approved users can view trainings" 
ON public.trainings 
FOR SELECT 
USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view employees" ON public.employees;
CREATE POLICY "Approved users can view employees" 
ON public.employees 
FOR SELECT 
USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view training types" ON public.training_types;
CREATE POLICY "Approved users can view training types" 
ON public.training_types 
FOR SELECT 
USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view departments" ON public.departments;
CREATE POLICY "Approved users can view departments" 
ON public.departments 
FOR SELECT 
USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active reminder templates" ON public.reminder_templates;
CREATE POLICY "Approved users can view active reminder templates" 
ON public.reminder_templates 
FOR SELECT 
USING (is_active = true AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Users can view training documents" ON public.training_documents;
CREATE POLICY "Approved users can view training documents" 
ON public.training_documents 
FOR SELECT 
USING (is_user_approved(auth.uid()));

-- Also update INSERT/UPDATE/DELETE policies to require approval
DROP POLICY IF EXISTS "Authenticated users can insert trainings" ON public.trainings;
CREATE POLICY "Approved users can insert trainings" 
ON public.trainings 
FOR INSERT 
WITH CHECK (auth.uid() = created_by AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update trainings" ON public.trainings;
CREATE POLICY "Approved users can update trainings" 
ON public.trainings 
FOR UPDATE 
USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can insert employees" ON public.employees;
CREATE POLICY "Approved admins and managers can insert employees" 
ON public.employees 
FOR INSERT 
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can update employees" ON public.employees;
CREATE POLICY "Approved admins and managers can update employees" 
ON public.employees 
FOR UPDATE 
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can insert training types" ON public.training_types;
CREATE POLICY "Approved admins and managers can insert training types" 
ON public.training_types 
FOR INSERT 
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can update training types" ON public.training_types;
CREATE POLICY "Approved admins and managers can update training types" 
ON public.training_types 
FOR UPDATE 
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can delete training types" ON public.training_types;
CREATE POLICY "Approved admins and managers can delete training types" 
ON public.training_types 
FOR DELETE 
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can delete trainings" ON public.trainings;
CREATE POLICY "Approved admins and managers can delete trainings" 
ON public.trainings 
FOR DELETE 
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can insert departments" ON public.departments;
CREATE POLICY "Approved admins and managers can insert departments" 
ON public.departments 
FOR INSERT 
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can update departments" ON public.departments;
CREATE POLICY "Approved admins and managers can update departments" 
ON public.departments 
FOR UPDATE 
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can delete departments" ON public.departments;
CREATE POLICY "Approved admins and managers can delete departments" 
ON public.departments 
FOR DELETE 
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can insert reminder templates" ON public.reminder_templates;
CREATE POLICY "Approved admins and managers can insert reminder templates" 
ON public.reminder_templates 
FOR INSERT 
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can update reminder templates" ON public.reminder_templates;
CREATE POLICY "Approved admins and managers can update reminder templates" 
ON public.reminder_templates 
FOR UPDATE 
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can delete reminder templates" ON public.reminder_templates;
CREATE POLICY "Approved admins and managers can delete reminder templates" 
ON public.reminder_templates 
FOR DELETE 
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Users can upload training documents" ON public.training_documents;
CREATE POLICY "Approved users can upload training documents" 
ON public.training_documents 
FOR INSERT 
WITH CHECK (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.training_documents;
CREATE POLICY "Approved users can delete their own documents" 
ON public.training_documents 
FOR DELETE 
USING (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

-- 2. Fix is_email_allowed function to use proper JSON array membership check
CREATE OR REPLACE FUNCTION public.is_email_allowed(_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  allowlist jsonb;
  domains jsonb;
  emails jsonb;
  email_domain text;
  domain_item text;
  email_item text;
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
  
  -- Check if email is in allowed emails list (using jsonb_array_elements_text)
  FOR email_item IN SELECT jsonb_array_elements_text(emails)
  LOOP
    IF lower(_email) = lower(email_item) THEN
      RETURN true;
    END IF;
  END LOOP;
  
  -- Check if email domain is in allowed domains list
  email_domain := lower(split_part(_email, '@', 2));
  FOR domain_item IN SELECT jsonb_array_elements_text(domains)
  LOOP
    IF email_domain = lower(domain_item) THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$function$;

-- 3. Fix log_profile_approval_changes to handle NULL auth.uid() (system operations)
CREATE OR REPLACE FUNCTION public.log_profile_approval_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_profile RECORD;
  actor_email text;
  actor_name text;
BEGIN
  -- Only log if approval_status changed
  IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    -- Get info about who made the change (may be NULL for system operations)
    IF auth.uid() IS NOT NULL THEN
      SELECT email, first_name || ' ' || last_name as full_name
      INTO user_profile
      FROM public.profiles
      WHERE id = auth.uid();
      
      actor_email := user_profile.email;
      actor_name := user_profile.full_name;
    ELSE
      actor_email := 'system@internal';
      actor_name := 'Systém';
    END IF;
    
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
      actor_email,
      actor_name,
      ARRAY['approval_status']
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Create table for admin notification settings (which admins receive notifications)
INSERT INTO public.system_settings (key, value, description)
VALUES ('pending_user_notifications', '{"notify_all_admins": true, "additional_emails": []}'::jsonb, 'Settings for pending user approval notifications')
ON CONFLICT (key) DO NOTHING;