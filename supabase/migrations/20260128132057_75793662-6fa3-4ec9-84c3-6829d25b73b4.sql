-- Fix overly permissive user_roles SELECT policy
-- Remove public access, restrict to: users see own roles, admins/managers see all

DROP POLICY IF EXISTS "Anyone can view user roles" ON public.user_roles;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all roles (for user management)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));