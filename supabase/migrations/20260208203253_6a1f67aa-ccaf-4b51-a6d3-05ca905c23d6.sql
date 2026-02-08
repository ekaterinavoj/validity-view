-- Drop the existing policy for admins and managers viewing all groups
DROP POLICY IF EXISTS "Admins and managers can view all responsibility groups" ON public.responsibility_groups;

-- Create new policy: Admins see all, managers only see groups they are members of
CREATE POLICY "Admins can view all responsibility groups"
ON public.responsibility_groups
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view groups they are members of"
ON public.responsibility_groups
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.responsibility_group_members rgm
    WHERE rgm.group_id = id AND rgm.profile_id = auth.uid()
  )
);