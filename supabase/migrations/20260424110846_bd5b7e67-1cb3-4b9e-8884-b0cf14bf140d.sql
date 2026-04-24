-- =====================================================================
-- 1) REALTIME: Zúžit public:* topic jen na admin + manager
-- =====================================================================
DROP POLICY IF EXISTS "realtime_topic_scoped_select" ON realtime.messages;

CREATE POLICY "realtime_topic_scoped_select" ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.is_user_approved(auth.uid()) AND (
    -- Admin: full access to all topics
    public.has_role(auth.uid(), 'admin'::public.app_role)
    -- Manager: manager:*, public:*, and own notifications
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND (
        realtime.topic() LIKE 'manager:%'
        OR realtime.topic() LIKE 'public:%'
        OR realtime.topic() = 'notifications:' || auth.uid()::text
      )
    )
    -- Regular user: only own notifications channel
    OR realtime.topic() = 'notifications:' || auth.uid()::text
  )
);

-- =====================================================================
-- 2) STORAGE: Úklid medical-documents DELETE politik
-- Odstranit jakoukoliv duplicitní/volnou politiku, ponechat jen striktní
-- =====================================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND p.polcmd = 'd'  -- DELETE
      AND p.polname <> 'medical_docs_delete_authorized'
      AND (
        p.polname ILIKE '%medical%'
        OR pg_get_expr(p.polqual, p.polrelid) ILIKE '%medical-documents%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
    RAISE NOTICE 'Dropped legacy medical-documents DELETE policy: %', pol.polname;
  END LOOP;
END $$;

-- Zajistit, že striktní politika existuje (idempotentní)
DROP POLICY IF EXISTS "medical_docs_delete_authorized" ON storage.objects;

CREATE POLICY "medical_docs_delete_authorized" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND public.is_user_approved(auth.uid())
  AND (
    -- Admin
    public.has_role(auth.uid(), 'admin'::public.app_role)
    -- Owner of the uploaded file
    OR owner = auth.uid()
    -- Manager in hierarchy of the examined employee (path: examinations/<examination_id>/...)
    OR EXISTS (
      SELECT 1
      FROM public.medical_examination_documents d
      JOIN public.medical_examinations me ON me.id = d.examination_id
      WHERE d.file_path = storage.objects.name
        AND (
          d.uploaded_by = auth.uid()
          OR me.employee_id = public.get_user_employee_id(auth.uid())
          OR public.is_manager_of(auth.uid(), me.employee_id)
        )
    )
  )
);