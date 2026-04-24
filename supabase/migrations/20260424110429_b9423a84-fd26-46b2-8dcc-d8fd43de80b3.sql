-- =========================================================
-- 1) general-documents: vyžadovat schválený účet
-- =========================================================
DROP POLICY IF EXISTS "Approved users can view general docs" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can upload general docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete general docs" ON storage.objects;
DROP POLICY IF EXISTS "general_docs_select_approved" ON storage.objects;
DROP POLICY IF EXISTS "general_docs_insert_approved" ON storage.objects;
DROP POLICY IF EXISTS "general_docs_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "general_docs_delete_admin" ON storage.objects;

CREATE POLICY "general_docs_select_approved"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'general-documents'
  AND public.is_user_approved(auth.uid())
);

CREATE POLICY "general_docs_insert_approved"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'general-documents'
  AND public.is_user_approved(auth.uid())
);

CREATE POLICY "general_docs_update_admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'general-documents'
  AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid())
)
WITH CHECK (
  bucket_id = 'general-documents'
  AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid())
);

CREATE POLICY "general_docs_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'general-documents'
  AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid())
);

-- =========================================================
-- 2) medical-documents: odstranit příliš volnou DELETE politiku
-- =========================================================
DROP POLICY IF EXISTS "Users can delete their medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their medical documents" ON storage.objects;
-- (politiky medical_docs_*_authorized z předchozí migrace zůstávají)

-- =========================================================
-- 3) training-documents: explicitní UPDATE politika
-- =========================================================
DROP POLICY IF EXISTS "training_docs_update_authorized" ON storage.objects;

CREATE POLICY "training_docs_update_authorized"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'training-documents'
  AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid())
)
WITH CHECK (
  bucket_id = 'training-documents'
  AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid())
);

-- =========================================================
-- 4) deadline-documents: explicitní UPDATE politika
-- =========================================================
DROP POLICY IF EXISTS "deadline_docs_update_authorized" ON storage.objects;

CREATE POLICY "deadline_docs_update_authorized"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'deadline-documents'
  AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid())
)
WITH CHECK (
  bucket_id = 'deadline-documents'
  AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid())
);

-- =========================================================
-- 5) realtime.messages: zúžit podle topic
-- =========================================================
DROP POLICY IF EXISTS "approved_users_realtime_access" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_topic_scoped_select" ON realtime.messages;

-- SELECT: scoped podle topicu
CREATE POLICY "realtime_topic_scoped_select"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  public.is_user_approved(auth.uid())
  AND (
    -- admin smí vše
    public.has_role(auth.uid(), 'admin'::public.app_role)
    -- manager smí manažerské + obecné + vlastní
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND (
        realtime.topic() LIKE 'manager:%'
        OR realtime.topic() LIKE 'public:%'
        OR realtime.topic() = 'notifications:' || auth.uid()::text
      )
    )
    -- běžný user: jen vlastní notifikace + public
    OR realtime.topic() = 'notifications:' || auth.uid()::text
    OR realtime.topic() LIKE 'public:%'
  )
);