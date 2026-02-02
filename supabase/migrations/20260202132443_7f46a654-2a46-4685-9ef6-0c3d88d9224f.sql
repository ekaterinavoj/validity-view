-- =====================================================
-- PHASE 2a: Manager Hierarchy + Remove Viewer Role
-- =====================================================

-- 1) Add manager reference to employees
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS manager_employee_id UUID NULL REFERENCES public.employees(id);

-- 2) Add index for manager lookups
CREATE INDEX IF NOT EXISTS idx_employees_manager ON public.employees(manager_employee_id);

-- 3) Recursive function to get all subordinates (multi-level)
CREATE OR REPLACE FUNCTION public.get_subordinate_employee_ids(root_employee_id uuid)
RETURNS TABLE(employee_id uuid)
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

-- 4) Safe is_manager_of function (returns false if employee_id is NULL)
CREATE OR REPLACE FUNCTION public.is_manager_of(_user_id uuid, _target_employee_id uuid)
RETURNS boolean
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

-- =====================================================
-- 5) UPDATE RLS POLICIES - Remove viewer, add manager subtree
-- =====================================================

-- === EMPLOYEES ===
-- Drop old policies
DROP POLICY IF EXISTS "Role-based employee visibility" ON public.employees;
DROP POLICY IF EXISTS "Admins and managers can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Admins and managers can update employees" ON public.employees;
DROP POLICY IF EXISTS "Only admins can delete employees" ON public.employees;

-- New SELECT: admin all, manager subtree, user self-only
CREATE POLICY "Role-based employee visibility" ON public.employees
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_manager_of(auth.uid(), id)
    OR id = get_user_employee_id(auth.uid())
  )
);

-- INSERT: admin and manager only (no viewer check needed)
CREATE POLICY "Admins and managers can insert employees" ON public.employees
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- UPDATE: admin and manager only
CREATE POLICY "Admins and managers can update employees" ON public.employees
FOR UPDATE USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- DELETE: admin only
CREATE POLICY "Only admins can delete employees" ON public.employees
FOR DELETE USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- === TRAININGS ===
-- Drop old policies
DROP POLICY IF EXISTS "Role-based trainings visibility" ON public.trainings;
DROP POLICY IF EXISTS "Non-viewers can insert trainings" ON public.trainings;
DROP POLICY IF EXISTS "Non-viewers can update trainings" ON public.trainings;
DROP POLICY IF EXISTS "Admins and managers can delete trainings" ON public.trainings;

-- New SELECT: admin all, manager subtree, user self-only
CREATE POLICY "Role-based trainings visibility" ON public.trainings
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'trainings')
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_manager_of(auth.uid(), employee_id)
    OR employee_id = get_user_employee_id(auth.uid())
  )
);

-- INSERT: any approved user with module access (no viewer restriction)
CREATE POLICY "Users can insert trainings" ON public.trainings
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = created_by
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'trainings')
);

-- UPDATE: admin/manager or creator
CREATE POLICY "Users can update trainings" ON public.trainings
FOR UPDATE USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'trainings')
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR created_by = auth.uid()
  )
);

-- DELETE: admin and manager only
CREATE POLICY "Admins and managers can delete trainings" ON public.trainings
FOR DELETE USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- === DEADLINES ===
-- Drop old policies
DROP POLICY IF EXISTS "Role-based deadlines visibility" ON public.deadlines;
DROP POLICY IF EXISTS "Non-viewers can insert deadlines" ON public.deadlines;
DROP POLICY IF EXISTS "Non-viewers can update deadlines" ON public.deadlines;
DROP POLICY IF EXISTS "Admins and managers can delete deadlines" ON public.deadlines;

-- New SELECT: admin all, others created_by only (Phase 2b will add responsibility scoping)
CREATE POLICY "Role-based deadlines visibility" ON public.deadlines
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'deadlines')
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  )
);

-- INSERT: any approved user with module access
CREATE POLICY "Users can insert deadlines" ON public.deadlines
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = created_by
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'deadlines')
);

-- UPDATE: admin/manager or creator
CREATE POLICY "Users can update deadlines" ON public.deadlines
FOR UPDATE USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'deadlines')
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR created_by = auth.uid()
  )
);

-- DELETE: admin and manager only
CREATE POLICY "Admins and managers can delete deadlines" ON public.deadlines
FOR DELETE USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);