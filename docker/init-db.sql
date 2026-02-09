-- =============================================
-- Database Initialization Script
-- Kompletní schéma pro produkční nasazení
-- Verze: 1.0.0
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CUSTOM TYPES
-- =============================================

DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'manager', 'user', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- CORE TABLES
-- =============================================

-- Departments
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Facilities
CREATE TABLE IF NOT EXISTS public.facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employees
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    position TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id),
    status TEXT NOT NULL DEFAULT 'employed',
    status_start_date DATE,
    termination_date DATE,
    work_category INTEGER,
    notes TEXT,
    manager_email TEXT,
    manager_first_name TEXT,
    manager_last_name TEXT,
    manager_employee_id UUID REFERENCES public.employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    position TEXT,
    department_id UUID REFERENCES public.departments(id),
    employee_id UUID REFERENCES public.employees(id),
    approval_status TEXT NOT NULL DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    UNIQUE (user_id, role)
);

-- User module access
CREATE TABLE IF NOT EXISTS public.user_module_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    module TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    UNIQUE (user_id, module)
);

-- User invites
CREATE TABLE IF NOT EXISTS public.user_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    invited_by UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    used_at TIMESTAMPTZ,
    used_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    related_entity_type TEXT,
    related_entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- RESPONSIBILITY GROUPS
-- =============================================

CREATE TABLE IF NOT EXISTS public.responsibility_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.responsibility_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.responsibility_groups(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id, profile_id)
);

-- =============================================
-- EQUIPMENT MODULE
-- =============================================

CREATE TABLE IF NOT EXISTS public.equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    equipment_type TEXT NOT NULL,
    facility TEXT NOT NULL,
    description TEXT,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    location TEXT,
    department_id UUID REFERENCES public.departments(id),
    responsible_person TEXT,
    purchase_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_responsibles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (equipment_id, profile_id)
);

-- =============================================
-- TRAINING MODULE
-- =============================================

CREATE TABLE IF NOT EXISTS public.training_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    facility TEXT NOT NULL,
    period_days INTEGER NOT NULL,
    duration_hours NUMERIC DEFAULT 1.0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminder_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    remind_days_before INTEGER NOT NULL DEFAULT 30,
    repeat_interval_days INTEGER,
    target_user_ids UUID[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility TEXT NOT NULL,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    training_type_id UUID NOT NULL REFERENCES public.training_types(id),
    last_training_date DATE NOT NULL,
    next_training_date DATE NOT NULL,
    trainer TEXT,
    company TEXT,
    requester TEXT,
    reminder_template TEXT,
    reminder_template_id UUID REFERENCES public.reminder_templates(id),
    remind_days_before INTEGER DEFAULT 30,
    repeat_days_after INTEGER DEFAULT 30,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'valid',
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    description TEXT,
    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_id UUID REFERENCES public.trainings(id) ON DELETE SET NULL,
    employee_id UUID,
    template_id UUID REFERENCES public.reminder_templates(id) ON DELETE SET NULL,
    template_name TEXT NOT NULL,
    recipient_emails TEXT[] NOT NULL,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    error_message TEXT,
    provider_used TEXT,
    delivery_mode TEXT DEFAULT 'bcc',
    days_before INTEGER,
    week_start DATE,
    is_test BOOLEAN NOT NULL DEFAULT false,
    resent_from_log_id UUID REFERENCES public.reminder_logs(id),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL DEFAULT 1,
    attempt_errors JSONB,
    final_status TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminder_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL,
    triggered_by TEXT NOT NULL DEFAULT 'cron',
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    emails_sent INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- DEADLINE MODULE
-- =============================================

CREATE TABLE IF NOT EXISTS public.deadline_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    facility TEXT NOT NULL,
    period_days INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deadline_reminder_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    remind_days_before INTEGER NOT NULL DEFAULT 30,
    repeat_interval_days INTEGER,
    target_user_ids UUID[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility TEXT NOT NULL,
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    deadline_type_id UUID NOT NULL REFERENCES public.deadline_types(id),
    last_check_date DATE NOT NULL,
    next_check_date DATE NOT NULL,
    performer TEXT,
    company TEXT,
    requester TEXT,
    reminder_template_id UUID REFERENCES public.deadline_reminder_templates(id),
    remind_days_before INTEGER DEFAULT 30,
    repeat_days_after INTEGER DEFAULT 30,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'valid',
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deadline_responsibles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deadline_id UUID NOT NULL REFERENCES public.deadlines(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.responsibility_groups(id) ON DELETE CASCADE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (profile_id IS NOT NULL OR group_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.deadline_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deadline_id UUID NOT NULL REFERENCES public.deadlines(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    description TEXT,
    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deadline_reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deadline_id UUID REFERENCES public.deadlines(id) ON DELETE SET NULL,
    equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
    template_id UUID REFERENCES public.deadline_reminder_templates(id) ON DELETE SET NULL,
    template_name TEXT NOT NULL,
    recipient_emails TEXT[] NOT NULL,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    error_message TEXT,
    delivery_mode TEXT DEFAULT 'bcc',
    days_before INTEGER,
    week_start DATE,
    is_test BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- MEDICAL EXAMINATION MODULE
-- =============================================

CREATE TABLE IF NOT EXISTS public.medical_examination_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    facility TEXT NOT NULL,
    period_days INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medical_reminder_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    remind_days_before INTEGER NOT NULL DEFAULT 30,
    repeat_interval_days INTEGER,
    target_user_ids UUID[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medical_examinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility TEXT NOT NULL,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    examination_type_id UUID NOT NULL REFERENCES public.medical_examination_types(id),
    last_examination_date DATE NOT NULL,
    next_examination_date DATE NOT NULL,
    doctor TEXT,
    medical_facility TEXT,
    result TEXT,
    requester TEXT,
    reminder_template_id UUID REFERENCES public.medical_reminder_templates(id),
    remind_days_before INTEGER DEFAULT 30,
    repeat_days_after INTEGER DEFAULT 30,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'valid',
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medical_examination_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examination_id UUID NOT NULL REFERENCES public.medical_examinations(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    description TEXT,
    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medical_reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examination_id UUID REFERENCES public.medical_examinations(id) ON DELETE SET NULL,
    employee_id UUID,
    template_id UUID REFERENCES public.medical_reminder_templates(id) ON DELETE SET NULL,
    template_name TEXT NOT NULL,
    recipient_emails TEXT[] NOT NULL,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    error_message TEXT,
    delivery_mode TEXT DEFAULT 'bcc',
    days_before INTEGER,
    week_start DATE,
    is_test BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get all user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- Check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id UUID)
RETURNS BOOLEAN
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

-- Check module access
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id UUID, _module TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_module_access
      WHERE user_id = _user_id AND module = _module
    )
$$;

-- Get user's employee ID
CREATE OR REPLACE FUNCTION public.get_user_employee_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT employee_id FROM public.profiles WHERE id = _user_id
$$;

-- Get subordinate employee IDs (recursive)
CREATE OR REPLACE FUNCTION public.get_subordinate_employee_ids(root_employee_id UUID)
RETURNS TABLE(employee_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT e.id
    FROM public.employees e
    WHERE e.id = root_employee_id
    UNION ALL
    SELECT e2.id
    FROM public.employees e2
    JOIN tree t ON e2.manager_employee_id = t.id
  )
  SELECT id FROM tree;
$$;

-- Check if user is manager of employee
CREATE OR REPLACE FUNCTION public.is_manager_of(_user_id UUID, _target_employee_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT employee_id FROM public.profiles WHERE id = _user_id) IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.get_subordinate_employee_ids(
        (SELECT employee_id FROM public.profiles WHERE id = _user_id)
      ) sub
      WHERE sub.employee_id = _target_employee_id
    )
  END;
$$;

-- Check if user is deadline responsible
CREATE OR REPLACE FUNCTION public.is_deadline_responsible(_user_id UUID, _deadline_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Direct responsibility
    SELECT 1 FROM public.deadline_responsibles dr
    JOIN public.profiles p ON p.id = dr.profile_id
    WHERE dr.deadline_id = _deadline_id AND p.id = _user_id
  )
  OR EXISTS (
    -- Responsibility via group membership
    SELECT 1 FROM public.deadline_responsibles dr
    JOIN public.responsibility_group_members rgm ON rgm.group_id = dr.group_id
    WHERE dr.deadline_id = _deadline_id AND rgm.profile_id = _user_id
  )
$$;

-- Calculate training status
CREATE OR REPLACE FUNCTION public.calculate_training_status(next_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF next_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF next_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'warning';
  ELSE
    RETURN 'valid';
  END IF;
END;
$$;

-- Calculate deadline status
CREATE OR REPLACE FUNCTION public.calculate_deadline_status(next_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF next_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF next_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'warning';
  ELSE
    RETURN 'valid';
  END IF;
END;
$$;

-- Calculate examination status
CREATE OR REPLACE FUNCTION public.calculate_examination_status(next_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF next_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF next_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'warning';
  ELSE
    RETURN 'valid';
  END IF;
END;
$$;

-- Get registration mode
CREATE OR REPLACE FUNCTION public.get_registration_mode()
RETURNS TEXT
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

-- Check if email is allowed
CREATE OR REPLACE FUNCTION public.is_email_allowed(_email TEXT)
RETURNS BOOLEAN
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
  domain_item text;
  email_item text;
BEGIN
  SELECT value INTO allowlist 
  FROM public.system_settings 
  WHERE key = 'registration_allowlist';
  
  IF allowlist IS NULL THEN
    RETURN true;
  END IF;
  
  domains := COALESCE(allowlist->'domains', '[]'::jsonb);
  emails := COALESCE(allowlist->'emails', '[]'::jsonb);
  
  IF jsonb_array_length(domains) = 0 AND jsonb_array_length(emails) = 0 THEN
    RETURN true;
  END IF;
  
  FOR email_item IN SELECT jsonb_array_elements_text(emails)
  LOOP
    IF lower(_email) = lower(email_item) THEN
      RETURN true;
    END IF;
  END LOOP;
  
  email_domain := lower(split_part(_email, '@', 2));
  FOR domain_item IN SELECT jsonb_array_elements_text(domains)
  LOOP
    IF email_domain = lower(domain_item) THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$;

-- Resolve manager from email
CREATE OR REPLACE FUNCTION public.resolve_manager_from_email()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: Only admins can resolve manager hierarchy';
  END IF;

  WITH matches AS (
    SELECT 
      e.id as employee_id,
      m.id as manager_id
    FROM public.employees e
    JOIN public.employees m ON lower(e.manager_email) = lower(m.email)
    WHERE e.manager_email IS NOT NULL 
      AND e.manager_employee_id IS NULL
  )
  UPDATE public.employees e
  SET manager_employee_id = matches.manager_id
  FROM matches
  WHERE e.id = matches.employee_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Prevent last admin removal
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last admin. At least one admin must remain in the system.';
    END IF;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role != 'admin' THEN
    SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last admin. At least one admin must remain in the system.';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update training active status based on employee status
CREATE OR REPLACE FUNCTION public.update_training_active_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('parental_leave', 'sick_leave', 'terminated') THEN
      UPDATE public.trainings
      SET is_active = false
      WHERE employee_id = NEW.id;
    ELSIF NEW.status = 'employed' THEN
      UPDATE public.trainings
      SET is_active = true
      WHERE employee_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update deadline active status based on equipment status
CREATE OR REPLACE FUNCTION public.update_deadline_active_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('inactive', 'decommissioned') THEN
      UPDATE public.deadlines
      SET is_active = false
      WHERE equipment_id = NEW.id;
    ELSIF NEW.status = 'active' THEN
      UPDATE public.deadlines
      SET is_active = true
      WHERE equipment_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Update medical examination active status
CREATE OR REPLACE FUNCTION public.update_medical_examination_active_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('parental_leave', 'sick_leave', 'terminated') THEN
      UPDATE public.medical_examinations
      SET is_active = false
      WHERE employee_id = NEW.id;
    ELSIF NEW.status = 'employed' THEN
      UPDATE public.medical_examinations
      SET is_active = true
      WHERE employee_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recalculate training status on employee activation
CREATE OR REPLACE FUNCTION public.recalculate_training_status_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'employed' AND OLD.status != 'employed' THEN
    UPDATE public.trainings
    SET status = calculate_training_status(next_training_date)
    WHERE employee_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recalculate examination status on employee activation
CREATE OR REPLACE FUNCTION public.recalculate_examination_status_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'employed' AND OLD.status != 'employed' THEN
    UPDATE public.medical_examinations
    SET status = calculate_examination_status(next_examination_date)
    WHERE employee_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Set termination note
CREATE OR REPLACE FUNCTION public.set_termination_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'terminated' AND NEW.termination_date IS NOT NULL THEN
    NEW.notes = 'Ukončen ke dni ' || TO_CHAR(NEW.termination_date, 'DD.MM.YYYY');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Grant default modules to new profiles
CREATE OR REPLACE FUNCTION public.grant_default_modules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_module_access (user_id, module)
  VALUES (NEW.id, 'trainings'), (NEW.id, 'deadlines')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Handle new user (create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, position)
  VALUES (
    NEW.id,
    '',
    '',
    COALESCE(NEW.email, ''),
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN others THEN
  BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, email)
    VALUES (NEW.id, '', '', COALESCE(NEW.email, ''))
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Assign default role
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    VALUES (NEW.id, 'admin');
    
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
    VALUES (NEW.id, invite_record.role);
    
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
    VALUES (NEW.id, 'user');
    
    RAISE NOTICE 'User % registered in self-signup mode - pending approval', NEW.id;
  END IF;
  
  INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
  VALUES ('profiles', NEW.id, 'REGISTRATION_PENDING', 
    jsonb_build_object('email', NEW.email, 'mode', reg_mode),
    NEW.email, COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  
  RETURN NEW;
END;
$$;

-- Log role changes
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
  target_user_profile RECORD;
  old_json JSONB;
  new_json JSONB;
BEGIN
  SELECT 
    p.email,
    p.first_name || ' ' || p.last_name as full_name
  INTO user_profile
  FROM public.profiles p
  WHERE p.id = auth.uid();

  SELECT 
    p.email,
    p.first_name || ' ' || p.last_name as full_name
  INTO target_user_profile
  FROM public.profiles p
  WHERE p.id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'DELETE' THEN
    old_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'role', OLD.role
    );
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'role', NEW.role
    );
  ELSE
    old_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'role', OLD.role
    );
    new_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'role', NEW.role
    );
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, old_data, new_data,
    user_id, user_email, user_name, changed_fields
  ) VALUES (
    'user_roles', COALESCE(NEW.id, OLD.id), TG_OP,
    old_json, new_json,
    auth.uid(), user_profile.email, user_profile.full_name,
    ARRAY['role']
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Log training changes
CREATE OR REPLACE FUNCTION public.log_training_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
  changed_fields TEXT[];
  old_json JSONB;
  new_json JSONB;
BEGIN
  SELECT 
    p.email,
    p.first_name || ' ' || p.last_name as full_name
  INTO user_profile
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF TG_OP = 'UPDATE' THEN
    changed_fields := ARRAY[]::TEXT[];
    
    IF OLD.facility IS DISTINCT FROM NEW.facility THEN
      changed_fields := array_append(changed_fields, 'facility');
    END IF;
    IF OLD.employee_id IS DISTINCT FROM NEW.employee_id THEN
      changed_fields := array_append(changed_fields, 'employee_id');
    END IF;
    IF OLD.training_type_id IS DISTINCT FROM NEW.training_type_id THEN
      changed_fields := array_append(changed_fields, 'training_type_id');
    END IF;
    IF OLD.last_training_date IS DISTINCT FROM NEW.last_training_date THEN
      changed_fields := array_append(changed_fields, 'last_training_date');
    END IF;
    IF OLD.next_training_date IS DISTINCT FROM NEW.next_training_date THEN
      changed_fields := array_append(changed_fields, 'next_training_date');
    END IF;
    IF OLD.trainer IS DISTINCT FROM NEW.trainer THEN
      changed_fields := array_append(changed_fields, 'trainer');
    END IF;
    IF OLD.company IS DISTINCT FROM NEW.company THEN
      changed_fields := array_append(changed_fields, 'company');
    END IF;
    IF OLD.note IS DISTINCT FROM NEW.note THEN
      changed_fields := array_append(changed_fields, 'note');
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      changed_fields := array_append(changed_fields, 'status');
    END IF;
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      changed_fields := array_append(changed_fields, 'is_active');
    END IF;
    IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
      changed_fields := array_append(changed_fields, 'deleted_at');
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := to_jsonb(NEW);
  ELSE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, old_data, new_data,
    user_id, user_email, user_name, changed_fields
  ) VALUES (
    TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
    old_json, new_json,
    auth.uid(), user_profile.email, user_profile.full_name,
    changed_fields
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Log profile approval changes
CREATE OR REPLACE FUNCTION public.log_profile_approval_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
  actor_email text;
  actor_name text;
BEGIN
  IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
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
$$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Prevent last admin removal
CREATE TRIGGER prevent_last_admin_removal_trigger
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_admin_removal();

-- Updated_at triggers
CREATE TRIGGER update_facilities_updated_at
BEFORE UPDATE ON public.facilities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trainings_updated_at
BEFORE UPDATE ON public.trainings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deadlines_updated_at
BEFORE UPDATE ON public.deadlines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medical_examinations_updated_at
BEFORE UPDATE ON public.medical_examinations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_responsibility_groups_updated_at
BEFORE UPDATE ON public.responsibility_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminder_templates_updated_at
BEFORE UPDATE ON public.reminder_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deadline_reminder_templates_updated_at
BEFORE UPDATE ON public.deadline_reminder_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medical_reminder_templates_updated_at
BEFORE UPDATE ON public.medical_reminder_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Employee status triggers
CREATE TRIGGER update_training_active_on_employee_status
AFTER UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_training_active_status();

CREATE TRIGGER update_medical_active_on_employee_status
AFTER UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_medical_examination_active_status();

CREATE TRIGGER recalculate_training_status_trigger
AFTER UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_training_status_on_activation();

CREATE TRIGGER recalculate_examination_status_trigger
AFTER UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_examination_status_on_activation();

CREATE TRIGGER set_termination_note_trigger
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.set_termination_note();

-- Equipment status trigger
CREATE TRIGGER update_deadline_active_on_equipment_status
AFTER UPDATE ON public.equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_deadline_active_status();

-- Audit triggers
CREATE TRIGGER log_training_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.trainings
FOR EACH ROW
EXECUTE FUNCTION public.log_training_changes();

CREATE TRIGGER log_role_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_changes();

CREATE TRIGGER log_profile_approval_trigger
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_approval_changes();

-- Profile triggers
CREATE TRIGGER grant_default_modules_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_default_modules();

CREATE TRIGGER assign_default_role_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_role();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_examinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_examination_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_examination_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsibility_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsibility_group_members ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - USER MANAGEMENT
-- =============================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert user roles" ON public.user_roles
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update user roles" ON public.user_roles
  FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete user roles" ON public.user_roles
  FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- User module access
CREATE POLICY "Users can view own module access" ON public.user_module_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage module access" ON public.user_module_access
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- User invites
CREATE POLICY "Admins can view all invites" ON public.user_invites
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create invites" ON public.user_invites
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invites" ON public.user_invites
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invites" ON public.user_invites
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - EMPLOYEES
-- =============================================

CREATE POLICY "Role-based employee visibility" ON public.employees
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND (
      has_role(auth.uid(), 'admin') 
      OR is_manager_of(auth.uid(), id) 
      OR id = get_user_employee_id(auth.uid())
    )
  );

CREATE POLICY "Admins and managers can insert employees" ON public.employees
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins and managers can update employees" ON public.employees
  FOR UPDATE USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND (
      has_role(auth.uid(), 'admin') 
      OR (has_role(auth.uid(), 'manager') AND is_manager_of(auth.uid(), id))
    )
  );

CREATE POLICY "Only admins can delete employees" ON public.employees
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND has_role(auth.uid(), 'admin')
  );

-- =============================================
-- RLS POLICIES - DEPARTMENTS & FACILITIES
-- =============================================

CREATE POLICY "Approved users can view departments" ON public.departments
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can insert departments" ON public.departments
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update departments" ON public.departments
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete departments" ON public.departments
  FOR DELETE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can view facilities" ON public.facilities
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can insert facilities" ON public.facilities
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update facilities" ON public.facilities
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete facilities" ON public.facilities
  FOR DELETE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

-- =============================================
-- RLS POLICIES - EQUIPMENT
-- =============================================

CREATE POLICY "Approved users can view equipment" ON public.equipment
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can insert equipment" ON public.equipment
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update equipment" ON public.equipment
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete equipment" ON public.equipment
  FOR DELETE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can view equipment responsibles" ON public.equipment_responsibles
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can insert equipment responsibles" ON public.equipment_responsibles
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update equipment responsibles" ON public.equipment_responsibles
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete equipment responsibles" ON public.equipment_responsibles
  FOR DELETE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

-- =============================================
-- RLS POLICIES - TRAININGS
-- =============================================

CREATE POLICY "Role-based trainings visibility" ON public.trainings
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND has_module_access(auth.uid(), 'trainings') 
    AND (
      has_role(auth.uid(), 'admin') 
      OR is_manager_of(auth.uid(), employee_id) 
      OR employee_id = get_user_employee_id(auth.uid())
    )
  );

CREATE POLICY "Users can insert trainings" ON public.trainings
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth.uid() = created_by 
    AND is_user_approved(auth.uid()) 
    AND has_module_access(auth.uid(), 'trainings')
  );

CREATE POLICY "Users can update trainings" ON public.trainings
  FOR UPDATE USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND has_module_access(auth.uid(), 'trainings') 
    AND (
      has_role(auth.uid(), 'admin') 
      OR (has_role(auth.uid(), 'manager') AND is_manager_of(auth.uid(), employee_id)) 
      OR created_by = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can delete trainings" ON public.trainings
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Approved users can view training types" ON public.training_types
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can insert training types" ON public.training_types
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update training types" ON public.training_types
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete training types" ON public.training_types
  FOR DELETE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can view training documents" ON public.training_documents
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved users can upload training documents" ON public.training_documents
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can delete their own documents" ON public.training_documents
  FOR DELETE USING (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

-- =============================================
-- RLS POLICIES - REMINDER TEMPLATES & LOGS
-- =============================================

CREATE POLICY "Users can view reminder templates based on role" ON public.reminder_templates
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'manager') 
    OR (is_active = true AND is_user_approved(auth.uid()))
  );

CREATE POLICY "Approved admins and managers can insert reminder templates" ON public.reminder_templates
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update reminder templates" ON public.reminder_templates
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete reminder templates" ON public.reminder_templates
  FOR DELETE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins can view reminder logs" ON public.reminder_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert reminder logs" ON public.reminder_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view reminder runs" ON public.reminder_runs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert reminder runs" ON public.reminder_runs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update reminder runs" ON public.reminder_runs
  FOR UPDATE USING (true);

-- =============================================
-- RLS POLICIES - DEADLINES
-- =============================================

CREATE POLICY "Role-based deadlines visibility" ON public.deadlines
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND has_module_access(auth.uid(), 'deadlines') 
    AND (
      has_role(auth.uid(), 'admin') 
      OR created_by = auth.uid() 
      OR is_deadline_responsible(auth.uid(), id)
    )
  );

CREATE POLICY "Users can insert deadlines" ON public.deadlines
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth.uid() = created_by 
    AND is_user_approved(auth.uid()) 
    AND has_module_access(auth.uid(), 'deadlines')
  );

CREATE POLICY "Users can update deadlines" ON public.deadlines
  FOR UPDATE USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND has_module_access(auth.uid(), 'deadlines') 
    AND (
      has_role(auth.uid(), 'admin') 
      OR (has_role(auth.uid(), 'manager') AND created_by = auth.uid()) 
      OR created_by = auth.uid() 
      OR is_deadline_responsible(auth.uid(), id)
    )
  );

CREATE POLICY "Admins and managers can delete deadlines" ON public.deadlines
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Approved users can view deadline types" ON public.deadline_types
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can insert deadline types" ON public.deadline_types
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update deadline types" ON public.deadline_types
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete deadline types" ON public.deadline_types
  FOR DELETE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can view deadline documents" ON public.deadline_documents
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved users can upload deadline documents" ON public.deadline_documents
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can delete their own deadline documents" ON public.deadline_documents
  FOR DELETE USING (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can view deadline responsibles" ON public.deadline_responsibles
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Users can insert deadline responsibles for own deadlines" ON public.deadline_responsibles
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND has_module_access(auth.uid(), 'deadlines')
  );

CREATE POLICY "Only admins can update deadline responsibles" ON public.deadline_responsibles
  FOR UPDATE USING (has_role(auth.uid(), 'admin') AND is_user_approved(auth.uid()));

CREATE POLICY "Only admins can delete deadline responsibles" ON public.deadline_responsibles
  FOR DELETE USING (has_role(auth.uid(), 'admin') AND is_user_approved(auth.uid()));

-- Deadline reminder templates
CREATE POLICY "Users can view deadline reminder templates based on role" ON public.deadline_reminder_templates
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'manager') 
    OR (is_active = true AND is_user_approved(auth.uid()))
  );

CREATE POLICY "Approved admins and managers can insert deadline reminder templ" ON public.deadline_reminder_templates
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update deadline reminder templ" ON public.deadline_reminder_templates
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete deadline reminder templ" ON public.deadline_reminder_templates
  FOR DELETE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins can view deadline reminder logs" ON public.deadline_reminder_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert deadline reminder logs" ON public.deadline_reminder_logs
  FOR INSERT WITH CHECK (true);

-- =============================================
-- RLS POLICIES - MEDICAL EXAMINATIONS
-- =============================================

CREATE POLICY "Role-based examinations visibility" ON public.medical_examinations
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND has_module_access(auth.uid(), 'plp') 
    AND (
      has_role(auth.uid(), 'admin') 
      OR is_manager_of(auth.uid(), employee_id) 
      OR employee_id = get_user_employee_id(auth.uid())
    )
  );

CREATE POLICY "Users can insert examinations" ON public.medical_examinations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth.uid() = created_by 
    AND is_user_approved(auth.uid()) 
    AND has_module_access(auth.uid(), 'plp')
  );

CREATE POLICY "Users can update examinations" ON public.medical_examinations
  FOR UPDATE USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND has_module_access(auth.uid(), 'plp') 
    AND (
      has_role(auth.uid(), 'admin') 
      OR (has_role(auth.uid(), 'manager') AND is_manager_of(auth.uid(), employee_id)) 
      OR created_by = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can delete examinations" ON public.medical_examinations
  FOR DELETE USING (
    auth.uid() IS NOT NULL 
    AND is_user_approved(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Approved users can view examination types" ON public.medical_examination_types
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can insert examination types" ON public.medical_examination_types
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can update examination types" ON public.medical_examination_types
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can delete examination types" ON public.medical_examination_types
  FOR DELETE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can view examination documents" ON public.medical_examination_documents
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved users can upload examination documents" ON public.medical_examination_documents
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

CREATE POLICY "Users can delete their own examination documents" ON public.medical_examination_documents
  FOR DELETE USING (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

-- Medical reminder templates
CREATE POLICY "Users can view medical reminder templates based on role" ON public.medical_reminder_templates
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'manager') 
    OR (is_active = true AND is_user_approved(auth.uid()))
  );

CREATE POLICY "Admins and managers can insert medical reminder templates" ON public.medical_reminder_templates
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can update medical reminder templates" ON public.medical_reminder_templates
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can delete medical reminder templates" ON public.medical_reminder_templates
  FOR DELETE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins can view medical reminder logs" ON public.medical_reminder_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert medical reminder logs" ON public.medical_reminder_logs
  FOR INSERT WITH CHECK (true);

-- =============================================
-- RLS POLICIES - SYSTEM & NOTIFICATIONS
-- =============================================

CREATE POLICY "Admins can view system settings" ON public.system_settings
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert system settings" ON public.system_settings
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update system settings" ON public.system_settings
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete system settings" ON public.system_settings
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Audit logs
CREATE POLICY "Admins and managers can view audit logs" ON public.audit_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "No manual modifications to audit logs" ON public.audit_logs
  FOR ALL USING (false);

-- =============================================
-- RLS POLICIES - RESPONSIBILITY GROUPS
-- =============================================

CREATE POLICY "Admins can view all responsibility groups" ON public.responsibility_groups
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view active responsibility groups" ON public.responsibility_groups
  FOR SELECT USING (is_user_approved(auth.uid()) AND is_active = true);

CREATE POLICY "Managers can view groups they are members of" ON public.responsibility_groups
  FOR SELECT USING (
    has_role(auth.uid(), 'manager') 
    AND EXISTS (
      SELECT 1 FROM responsibility_group_members rgm
      WHERE rgm.group_id = id AND rgm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can insert responsibility groups" ON public.responsibility_groups
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can update responsibility groups" ON public.responsibility_groups
  FOR UPDATE USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Only admins can delete responsibility groups" ON public.responsibility_groups
  FOR DELETE USING (has_role(auth.uid(), 'admin') AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can view group members" ON public.responsibility_group_members
  FOR SELECT USING (is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can manage group members" ON public.responsibility_group_members
  FOR ALL USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Create storage buckets for document uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('training-documents', 'training-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('deadline-documents', 'deadline-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('medical-documents', 'medical-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies: Approved users can upload/view/delete their own files
CREATE POLICY "Approved users can upload training documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'training-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Approved users can view training documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'training-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Approved users can delete own training documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'training-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Approved users can upload deadline documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deadline-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Approved users can view deadline documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deadline-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Approved users can delete own deadline documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'deadline-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Approved users can upload medical documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'medical-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Approved users can view medical documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'medical-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Approved users can delete own medical documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'medical-documents' AND auth.uid() IS NOT NULL);

-- =============================================
-- DEFAULT SYSTEM SETTINGS
-- =============================================

INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('registration_mode', '{"mode": "admin_only"}'::jsonb, 'Režim registrace uživatelů'),
  ('smtp_settings', '{}'::jsonb, 'Nastavení SMTP serveru'),
  ('app_settings', '{"app_name": "Systém školení", "company_name": ""}'::jsonb, 'Obecná nastavení aplikace')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users';
COMMENT ON TABLE public.user_roles IS 'User role assignments';
COMMENT ON TABLE public.employees IS 'Employee records';
COMMENT ON TABLE public.trainings IS 'Training records for employees';
COMMENT ON TABLE public.deadlines IS 'Technical deadline records for equipment';
COMMENT ON TABLE public.medical_examinations IS 'Medical examination records for employees';
COMMENT ON TABLE public.system_settings IS 'System-wide configuration settings';
COMMENT ON TABLE public.audit_logs IS 'Audit trail for important changes';

-- =============================================
-- ADMIN USER SETUP
-- =============================================
-- 
-- IMPORTANT: První uživatel, který se zaregistruje, bude automaticky
-- povýšen na administrátora díky triggeru 'assign_default_role'.
--
-- Pro ruční vytvoření admina použijte Edge funkci 'admin-create-user'
-- nebo vytvořte uživatele přes Supabase Auth a pak:
--
-- INSERT INTO public.profiles (id, email, first_name, last_name, approval_status, approved_at)
-- VALUES ('USER_UUID', 'admin@example.com', 'Admin', 'User', 'approved', now());
--
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('USER_UUID', 'admin');
--
-- =============================================

-- End of initialization script
