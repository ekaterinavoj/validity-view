-- ============================================================
-- 1) Audit logs: add target_user_id + actor metadata index
-- ============================================================
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS target_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);

-- ============================================================
-- 2) Backfill target_user_id where logical (user_roles, user_module_access, profile approvals)
-- ============================================================
UPDATE public.audit_logs
SET target_user_id = COALESCE(
  (new_data->>'user_id')::uuid,
  (old_data->>'user_id')::uuid,
  CASE WHEN table_name = 'profiles' THEN record_id ELSE NULL END
)
WHERE target_user_id IS NULL
  AND table_name IN ('user_roles','user_module_access','profiles');

-- ============================================================
-- 3) Server-side audit log filter RPC
--    Returns paginated, filtered audit logs (admin only).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_filtered_audit_logs(
  _user_id uuid DEFAULT NULL,
  _target_user_id uuid DEFAULT NULL,
  _role text DEFAULT NULL,
  _action text DEFAULT NULL,
  _table_name text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit int DEFAULT 200,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  table_name text,
  record_id uuid,
  action text,
  user_id uuid,
  user_email text,
  user_name text,
  target_user_id uuid,
  changed_fields text[],
  created_at timestamptz,
  actor_role text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can read audit logs';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT al.*,
      (
        SELECT ur.role::text
        FROM public.user_roles ur
        WHERE ur.user_id = al.user_id
        ORDER BY (ur.role = 'admin') DESC, (ur.role = 'manager') DESC
        LIMIT 1
      ) AS actor_role
    FROM public.audit_logs al
    WHERE (_user_id IS NULL OR al.user_id = _user_id)
      AND (_target_user_id IS NULL OR al.target_user_id = _target_user_id)
      AND (_action IS NULL OR al.action = _action)
      AND (_table_name IS NULL OR al.table_name = _table_name)
      AND (_from IS NULL OR al.created_at >= _from)
      AND (_to IS NULL OR al.created_at <= _to)
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (_role IS NULL OR base.actor_role = _role)
  ),
  counted AS (
    SELECT count(*) AS c FROM filtered
  )
  SELECT
    f.id, f.table_name, f.record_id, f.action,
    f.user_id, f.user_email, f.user_name,
    f.target_user_id, f.changed_fields, f.created_at,
    f.actor_role, c.c AS total_count
  FROM filtered f, counted c
  ORDER BY f.created_at DESC
  LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_filtered_audit_logs(uuid,uuid,text,text,text,timestamptz,timestamptz,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_filtered_audit_logs(uuid,uuid,text,text,text,timestamptz,timestamptz,int,int) TO authenticated;

-- ============================================================
-- 4) Debug RPC for medical-document access (admin only)
--    Returns each medical_examination_document with branch reason.
-- ============================================================
CREATE OR REPLACE FUNCTION public.debug_medical_document_access(_target_user_id uuid)
RETURNS TABLE (
  document_id uuid,
  examination_id uuid,
  file_name text,
  file_path text,
  uploaded_by uuid,
  reason text,
  policy_name text,
  policy_branch text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  own_employee uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can run medical document access debug';
  END IF;

  is_admin := public.has_role(_target_user_id, 'admin'::app_role);
  own_employee := public.get_user_employee_id(_target_user_id);

  RETURN QUERY
  SELECT
    d.id AS document_id,
    d.examination_id,
    d.file_name,
    d.file_path,
    d.uploaded_by,
    CASE
      WHEN is_admin THEN 'admin: full access'
      WHEN d.uploaded_by = _target_user_id THEN 'self: uploaded by user'
      WHEN me.employee_id = own_employee THEN 'self: linked employee'
      WHEN public.is_manager_of(_target_user_id, me.employee_id) THEN 'manager: in subordinate hierarchy'
      ELSE 'denied: no matching branch'
    END AS reason,
    'Storage medical-documents access (table can_access_medical_examination)'::text AS policy_name,
    CASE
      WHEN is_admin THEN 'has_role(uid, admin)'
      WHEN d.uploaded_by = _target_user_id THEN 'document.uploaded_by = uid'
      WHEN me.employee_id = own_employee THEN 'examination.employee_id = get_user_employee_id(uid)'
      WHEN public.is_manager_of(_target_user_id, me.employee_id) THEN 'is_manager_of(uid, examination.employee_id)'
      ELSE 'none'
    END AS policy_branch
  FROM public.medical_examination_documents d
  JOIN public.medical_examinations me ON me.id = d.examination_id
  ORDER BY d.uploaded_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.debug_medical_document_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_medical_document_access(uuid) TO authenticated;

-- ============================================================
-- 5) Update can_access_medical_examination to include "self uploader" branch
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_access_medical_examination(_user_id uuid, _examination_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.medical_examinations me
      WHERE me.id = _examination_id
        AND (
          me.employee_id = public.get_user_employee_id(_user_id)
          OR public.is_manager_of(_user_id, me.employee_id)
          OR me.created_by = _user_id
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.medical_examination_documents d
      WHERE d.examination_id = _examination_id
        AND d.uploaded_by = _user_id
    );
$$;

-- ============================================================
-- 6) Storage policies: medical-documents — drop broad/duplicate, keep strict
-- ============================================================
DROP POLICY IF EXISTS "Users can upload medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete medical documents" ON storage.objects;

DROP POLICY IF EXISTS "medical_docs_select_authorized" ON storage.objects;
DROP POLICY IF EXISTS "medical_docs_insert_authorized" ON storage.objects;
DROP POLICY IF EXISTS "medical_docs_delete_authorized" ON storage.objects;

CREATE POLICY "medical_docs_select_authorized" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "medical_docs_insert_authorized" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'medical-documents'
  AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "medical_docs_delete_authorized" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND public.is_user_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner = auth.uid()
    OR public.can_access_medical_examination(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- ============================================================
-- 7) Storage policies: training-documents — add approval + ownership
-- ============================================================
DROP POLICY IF EXISTS "Users can upload training documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view training documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete training documents" ON storage.objects;
DROP POLICY IF EXISTS "training_docs_select_authorized" ON storage.objects;
DROP POLICY IF EXISTS "training_docs_insert_authorized" ON storage.objects;
DROP POLICY IF EXISTS "training_docs_delete_authorized" ON storage.objects;

CREATE POLICY "training_docs_select_authorized" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'training-documents'
  AND public.is_user_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.training_documents td
      JOIN public.trainings t ON t.id = td.training_id
      WHERE td.file_path = storage.objects.name
        AND (
          t.created_by = auth.uid()
          OR td.uploaded_by = auth.uid()
          OR t.employee_id = public.get_user_employee_id(auth.uid())
          OR public.is_manager_of(auth.uid(), t.employee_id)
        )
    )
  )
);

CREATE POLICY "training_docs_insert_authorized" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'training-documents'
  AND public.is_user_approved(auth.uid())
  AND owner = auth.uid()
);

CREATE POLICY "training_docs_delete_authorized" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'training-documents'
  AND public.is_user_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner = auth.uid()
  )
);

-- ============================================================
-- 8) Realtime subscribe-denied audit helper (server-side log endpoint)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_realtime_denied(_topic text, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    table_name, record_id, action, new_data,
    user_id, user_email, target_user_id
  ) VALUES (
    'realtime', gen_random_uuid(), 'REALTIME_DENIED',
    jsonb_build_object('topic', COALESCE(_topic,''), 'reason', COALESCE(_reason,'unknown')),
    auth.uid(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_realtime_denied(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_realtime_denied(text, text) TO authenticated;
