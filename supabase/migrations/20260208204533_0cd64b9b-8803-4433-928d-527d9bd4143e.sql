-- Add policy to allow approved users to view other approved profiles (for responsible person selection)
CREATE POLICY "Approved users can view approved profiles"
ON public.profiles
FOR SELECT
USING (
  is_user_approved(auth.uid()) 
  AND approval_status = 'approved'
);