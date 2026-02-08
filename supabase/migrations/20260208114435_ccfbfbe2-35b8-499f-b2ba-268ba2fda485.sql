-- ==========================================
-- RESPONSIBILITY GROUPS AND DEADLINE RESPONSIBLES
-- ==========================================

-- Table for responsibility groups (user-defined groups)
CREATE TABLE public.responsibility_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Members of responsibility groups
CREATE TABLE public.responsibility_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.responsibility_groups(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(group_id, profile_id)
);

-- Junction table: which users/groups are responsible for which deadlines
CREATE TABLE public.deadline_responsibles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deadline_id UUID NOT NULL REFERENCES public.deadlines(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.responsibility_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  -- Either profile_id OR group_id must be set, but not both
  CONSTRAINT check_single_responsible CHECK (
    (profile_id IS NOT NULL AND group_id IS NULL) OR
    (profile_id IS NULL AND group_id IS NOT NULL)
  ),
  -- Unique constraint for profile-deadline or group-deadline pairs
  CONSTRAINT unique_deadline_profile UNIQUE (deadline_id, profile_id),
  CONSTRAINT unique_deadline_group UNIQUE (deadline_id, group_id)
);

-- Indexes for performance
CREATE INDEX idx_deadline_responsibles_deadline ON public.deadline_responsibles(deadline_id);
CREATE INDEX idx_deadline_responsibles_profile ON public.deadline_responsibles(profile_id);
CREATE INDEX idx_deadline_responsibles_group ON public.deadline_responsibles(group_id);
CREATE INDEX idx_group_members_group ON public.responsibility_group_members(group_id);
CREATE INDEX idx_group_members_profile ON public.responsibility_group_members(profile_id);

-- Trigger for updated_at on responsibility_groups
CREATE TRIGGER update_responsibility_groups_updated_at
BEFORE UPDATE ON public.responsibility_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- RLS POLICIES FOR RESPONSIBILITY GROUPS
-- ==========================================

ALTER TABLE public.responsibility_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view active responsibility groups"
ON public.responsibility_groups
FOR SELECT
USING (is_user_approved(auth.uid()) AND is_active = true);

CREATE POLICY "Admins and managers can view all responsibility groups"
ON public.responsibility_groups
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can insert responsibility groups"
ON public.responsibility_groups
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND is_user_approved(auth.uid())
);

CREATE POLICY "Admins and managers can update responsibility groups"
ON public.responsibility_groups
FOR UPDATE
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND is_user_approved(auth.uid())
);

CREATE POLICY "Only admins can delete responsibility groups"
ON public.responsibility_groups
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) AND is_user_approved(auth.uid()));

-- ==========================================
-- RLS POLICIES FOR GROUP MEMBERS
-- ==========================================

ALTER TABLE public.responsibility_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view group members"
ON public.responsibility_group_members
FOR SELECT
USING (is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can manage group members"
ON public.responsibility_group_members
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND is_user_approved(auth.uid())
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND is_user_approved(auth.uid())
);

-- ==========================================
-- RLS POLICIES FOR DEADLINE RESPONSIBLES
-- ==========================================

ALTER TABLE public.deadline_responsibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view deadline responsibles"
ON public.deadline_responsibles
FOR SELECT
USING (is_user_approved(auth.uid()));

CREATE POLICY "Users can insert deadline responsibles for own deadlines"
ON public.deadline_responsibles
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'deadlines'::text)
);

-- Only admins can update/delete responsible assignments
CREATE POLICY "Only admins can update deadline responsibles"
ON public.deadline_responsibles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) AND is_user_approved(auth.uid()));

CREATE POLICY "Only admins can delete deadline responsibles"
ON public.deadline_responsibles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) AND is_user_approved(auth.uid()));

-- ==========================================
-- HELPER FUNCTION: Check if user is responsible for deadline
-- ==========================================

CREATE OR REPLACE FUNCTION public.is_deadline_responsible(_user_id uuid, _deadline_id uuid)
RETURNS boolean
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

-- ==========================================
-- UPDATE DEADLINES RLS TO INCLUDE RESPONSIBLES
-- ==========================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Role-based deadlines visibility" ON public.deadlines;

-- New SELECT policy: admin sees all, responsibles see their deadlines
CREATE POLICY "Role-based deadlines visibility"
ON public.deadlines
FOR SELECT
USING (
  (auth.uid() IS NOT NULL)
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'deadlines'::text)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (created_by = auth.uid())
    OR is_deadline_responsible(auth.uid(), id)
  )
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update deadlines" ON public.deadlines;

-- New UPDATE policy: admins full access, responsibles can update limited fields
CREATE POLICY "Users can update deadlines"
ON public.deadlines
FOR UPDATE
USING (
  (auth.uid() IS NOT NULL)
  AND is_user_approved(auth.uid())
  AND has_module_access(auth.uid(), 'deadlines'::text)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'manager'::app_role) AND (created_by = auth.uid()))
    OR (created_by = auth.uid())
    OR is_deadline_responsible(auth.uid(), id)
  )
);