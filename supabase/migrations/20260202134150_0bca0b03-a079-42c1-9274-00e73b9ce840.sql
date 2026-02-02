-- Fix UPDATE policies for trainings: manager can only update within subtree
DROP POLICY IF EXISTS "Users can update trainings" ON public.trainings;

CREATE POLICY "Users can update trainings"
ON public.trainings
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'trainings')
  AND (
    -- Admin can update all
    has_role(auth.uid(), 'admin'::app_role)
    -- Manager can update only within their subtree
    OR (has_role(auth.uid(), 'manager'::app_role) AND is_manager_of(auth.uid(), employee_id))
    -- User can update only their own created records
    OR (created_by = auth.uid())
  )
);

-- Fix UPDATE policies for deadlines: only admin or creator (until responsibility scoping in Phase 2b)
DROP POLICY IF EXISTS "Users can update deadlines" ON public.deadlines;

CREATE POLICY "Users can update deadlines"
ON public.deadlines
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'deadlines')
  AND (
    -- Admin can update all
    has_role(auth.uid(), 'admin'::app_role)
    -- Manager can update their own created records (responsibility scoping in Phase 2b)
    OR (has_role(auth.uid(), 'manager'::app_role) AND created_by = auth.uid())
    -- User can update only their own created records
    OR (created_by = auth.uid())
  )
);

-- Fix UPDATE policies for employees: manager can only update within subtree
DROP POLICY IF EXISTS "Admins and managers can update employees" ON public.employees;

CREATE POLICY "Admins and managers can update employees"
ON public.employees
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND (
    -- Admin can update all
    has_role(auth.uid(), 'admin'::app_role)
    -- Manager can update only within their subtree
    OR (has_role(auth.uid(), 'manager'::app_role) AND is_manager_of(auth.uid(), id))
  )
);