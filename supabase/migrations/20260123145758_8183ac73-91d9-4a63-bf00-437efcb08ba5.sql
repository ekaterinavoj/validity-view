-- Drop existing policies
DROP POLICY IF EXISTS "Approved users can view active reminder templates" ON reminder_templates;
DROP POLICY IF EXISTS "Approved admins and managers can update reminder templates" ON reminder_templates;

-- Create new SELECT policy - admins/managers see all, others see only active
CREATE POLICY "Users can view reminder templates based on role"
ON reminder_templates
FOR SELECT
USING (
  -- Admins and managers can see all templates
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  OR
  -- Other approved users can only see active templates
  (is_active = true AND is_user_approved(auth.uid()))
);

-- Create new UPDATE policy with both USING and WITH CHECK
CREATE POLICY "Approved admins and managers can update reminder templates"
ON reminder_templates
FOR UPDATE
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) 
  AND is_user_approved(auth.uid())
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) 
  AND is_user_approved(auth.uid())
);