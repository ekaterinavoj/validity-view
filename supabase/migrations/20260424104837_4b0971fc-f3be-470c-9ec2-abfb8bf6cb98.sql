-- ============================================================
-- SECURITY HARDENING MIGRATION
-- 1) Storage RLS for medical-documents (align with table RLS)
-- 2) RLS on realtime.messages (scope subscriptions)
-- 3) Fix broken responsibility_groups manager policy
-- ============================================================

-- ------------------------------------------------------------
-- 1) STORAGE: medical-documents bucket
-- ------------------------------------------------------------
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete medical documents" ON storage.objects;

-- Helper function: can user access a specific examination?
CREATE OR REPLACE FUNCTION public.can_access_medical_examination(_user_id uuid, _examination_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin: full access
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.medical_examinations me
      WHERE me.id = _examination_id
        AND (
          -- Self: linked employee_id
          me.employee_id = public.get_user_employee_id(_user_id)
          -- Manager: in subordinate hierarchy
          OR public.is_manager_of(_user_id, me.employee_id)
        )
    );
$$;

-- SELECT: admin/manager hierarchy/self
CREATE POLICY "medical_docs_select_authorized"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

-- INSERT: admin/manager hierarchy/self for that examination
CREATE POLICY "medical_docs_insert_authorized"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'medical-documents'
  AND auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

-- UPDATE: admin/manager hierarchy/self
CREATE POLICY "medical_docs_update_authorized"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

-- DELETE: admin/manager hierarchy/self
CREATE POLICY "medical_docs_delete_authorized"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

-- ------------------------------------------------------------
-- 2) REALTIME: scope channel subscriptions
-- ------------------------------------------------------------
-- Enable RLS on realtime.messages (Supabase-supported pattern)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies (idempotent)
DROP POLICY IF EXISTS "authenticated can subscribe" ON realtime.messages;
DROP POLICY IF EXISTS "approved_users_realtime_access" ON realtime.messages;

-- Only approved authenticated users can subscribe to channels
-- This is the minimum baseline — channel-topic level filtering happens
-- in the application via supabase.channel('user:' + auth.uid()) patterns
CREATE POLICY "approved_users_realtime_access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
);

-- Block INSERT/UPDATE/DELETE from clients entirely
-- (broadcasts should originate from server-side / triggers only)
CREATE POLICY "block_client_realtime_writes"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (false);

-- ------------------------------------------------------------
-- 3) FIX: responsibility_groups manager visibility policy
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Managers can view groups they are members of" ON public.responsibility_groups;

CREATE POLICY "Managers can view groups they are members of"
ON public.responsibility_groups
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.responsibility_group_members rgm
    WHERE rgm.group_id = public.responsibility_groups.id
      AND rgm.profile_id = auth.uid()
  )
);