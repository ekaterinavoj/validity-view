-- Phase 1b: Security & Access Control (Corrected)
-- Stricter RLS: admin sees all, others see only self/own records

-- 1. Add employee_id to profiles for self-linking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id);

-- 2. Create user_module_access table
CREATE TABLE IF NOT EXISTS public.user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('trainings', 'deadlines')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(user_id, module)
);

ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;

-- RLS for user_module_access
CREATE POLICY "Admins can manage module access"
ON public.user_module_access FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own module access"
ON public.user_module_access FOR SELECT
USING (auth.uid() = user_id);

-- 3. Seed existing users with both modules
INSERT INTO public.user_module_access (user_id, module)
SELECT p.id, m.module
FROM public.profiles p
CROSS JOIN (VALUES ('trainings'), ('deadlines')) AS m(module)
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_module_access uma 
  WHERE uma.user_id = p.id AND uma.module = m.module
);

-- 4. Helper function: has_module_access
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module text)
RETURNS boolean
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

-- 5. Helper function: get_user_employee_id
CREATE OR REPLACE FUNCTION public.get_user_employee_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT employee_id FROM public.profiles WHERE id = _user_id
$$;

-- 6. Trigger to auto-grant modules for new users
CREATE OR REPLACE FUNCTION public.grant_default_modules()
RETURNS trigger
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

DROP TRIGGER IF EXISTS on_profile_created_grant_modules ON public.profiles;
CREATE TRIGGER on_profile_created_grant_modules
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_default_modules();

-- ============================================
-- STRICT RLS POLICIES
-- ============================================

-- EMPLOYEES: Admin sees all, others see only self
DROP POLICY IF EXISTS "Approved authenticated users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Role-based employee visibility" ON public.employees;

CREATE POLICY "Role-based employee visibility"
ON public.employees FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR id = get_user_employee_id(auth.uid())
  )
);

-- EMPLOYEES: Block viewer from INSERT
DROP POLICY IF EXISTS "Approved admins and managers can insert employees" ON public.employees;

CREATE POLICY "Admins and managers can insert employees"
ON public.employees FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND NOT has_role(auth.uid(), 'viewer'::app_role)
);

-- EMPLOYEES: Block viewer from UPDATE
DROP POLICY IF EXISTS "Approved admins and managers can update employees" ON public.employees;

CREATE POLICY "Admins and managers can update employees"
ON public.employees FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND NOT has_role(auth.uid(), 'viewer'::app_role)
);

-- EMPLOYEES: Explicit DELETE policy (block all except admin)
CREATE POLICY "Only admins can delete employees"
ON public.employees FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- TRAININGS: Admin sees all, others see only their own training records
DROP POLICY IF EXISTS "Approved users can view trainings" ON public.trainings;
DROP POLICY IF EXISTS "Role-based trainings visibility" ON public.trainings;

CREATE POLICY "Role-based trainings visibility"
ON public.trainings FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'trainings')
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR employee_id = get_user_employee_id(auth.uid())
  )
);

-- TRAININGS: Block viewer from INSERT
DROP POLICY IF EXISTS "Approved users can insert trainings" ON public.trainings;

CREATE POLICY "Non-viewers can insert trainings"
ON public.trainings FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = created_by
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'trainings')
  AND NOT has_role(auth.uid(), 'viewer'::app_role)
);

-- TRAININGS: Block viewer from UPDATE
DROP POLICY IF EXISTS "Approved users can update trainings" ON public.trainings;

CREATE POLICY "Non-viewers can update trainings"
ON public.trainings FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'trainings')
  AND NOT has_role(auth.uid(), 'viewer'::app_role)
);

-- TRAININGS: Block viewer from DELETE
DROP POLICY IF EXISTS "Approved admins and managers can delete trainings" ON public.trainings;

CREATE POLICY "Admins and managers can delete trainings"
ON public.trainings FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND NOT has_role(auth.uid(), 'viewer'::app_role)
);

-- DEADLINES: Admin sees all, others see only what they created
DROP POLICY IF EXISTS "Approved users can view deadlines" ON public.deadlines;
DROP POLICY IF EXISTS "Role-based deadlines visibility" ON public.deadlines;

CREATE POLICY "Role-based deadlines visibility"
ON public.deadlines FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'deadlines')
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  )
);

-- DEADLINES: Block viewer from INSERT
DROP POLICY IF EXISTS "Approved users can insert deadlines" ON public.deadlines;

CREATE POLICY "Non-viewers can insert deadlines"
ON public.deadlines FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = created_by
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'deadlines')
  AND NOT has_role(auth.uid(), 'viewer'::app_role)
);

-- DEADLINES: Block viewer from UPDATE
DROP POLICY IF EXISTS "Approved users can update deadlines" ON public.deadlines;

CREATE POLICY "Non-viewers can update deadlines"
ON public.deadlines FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'deadlines')
  AND NOT has_role(auth.uid(), 'viewer'::app_role)
);

-- DEADLINES: Block viewer from DELETE
DROP POLICY IF EXISTS "Approved admins and managers can delete deadlines" ON public.deadlines;

CREATE POLICY "Admins and managers can delete deadlines"
ON public.deadlines FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND NOT has_role(auth.uid(), 'viewer'::app_role)
);