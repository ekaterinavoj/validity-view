-- =====================================================================
-- 1) PROFILES & USER_ROLES: explicitní TO authenticated (defense-in-depth)
-- =====================================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Approved users can view approved profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Approved users can view approved profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_user_approved(auth.uid()) AND approval_status = 'approved');

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert user roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update user roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =====================================================================
-- 2) STORAGE: deadline-documents s ownership checkem
-- =====================================================================
-- Helper: kontrola, jestli má uživatel přístup k deadline na základě file_path
CREATE OR REPLACE FUNCTION public.can_access_deadline_file(_user_id uuid, _file_path text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.deadline_documents dd
      JOIN public.deadlines d ON d.id = dd.deadline_id
      LEFT JOIN public.equipment_responsibles er ON er.equipment_id = d.equipment_id
      WHERE dd.file_path = _file_path
        AND (
          d.created_by = _user_id
          OR public.is_deadline_responsible(_user_id, d.id)
          OR er.profile_id = _user_id
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_deadline_file(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_deadline_file(uuid, text) TO authenticated;

-- Drop staré volné politiky
DROP POLICY IF EXISTS "Approved users can upload deadline documents to storage" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can view deadline documents in storage" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can delete their deadline documents from storage" ON storage.objects;
DROP POLICY IF EXISTS "deadline_docs_update_authorized" ON storage.objects;
DROP POLICY IF EXISTS "deadline_docs_select_authorized" ON storage.objects;
DROP POLICY IF EXISTS "deadline_docs_insert_authorized" ON storage.objects;
DROP POLICY IF EXISTS "deadline_docs_delete_authorized" ON storage.objects;

-- SELECT: admin / autor / odpovědná osoba události / odpovědná osoba zařízení
CREATE POLICY "deadline_docs_select_authorized" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'deadline-documents'
  AND public.is_user_approved(auth.uid())
  AND public.can_access_deadline_file(auth.uid(), name)
);

-- INSERT: admin / autor deadline / odpovědná osoba (cesta = deadlines/<deadline_id>/...)
-- Při INSERT záznam ještě nemusí být v deadline_documents, takže kontrolujeme deadline_id z cesty.
CREATE POLICY "deadline_docs_insert_authorized" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'deadline-documents'
  AND public.is_user_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.deadlines d
      LEFT JOIN public.equipment_responsibles er ON er.equipment_id = d.equipment_id
      WHERE d.id::text = (storage.foldername(storage.objects.name))[1]
        AND (
          d.created_by = auth.uid()
          OR public.is_deadline_responsible(auth.uid(), d.id)
          OR er.profile_id = auth.uid()
        )
    )
  )
);

-- UPDATE: admin nebo vlastník souboru
CREATE POLICY "deadline_docs_update_authorized" ON storage.objects
FOR UPDATE TO authenticated
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

-- DELETE: admin / vlastník / odpovědná osoba události
CREATE POLICY "deadline_docs_delete_authorized" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'deadline-documents'
  AND public.is_user_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR owner = auth.uid()
    OR public.can_access_deadline_file(auth.uid(), name)
  )
);

-- =====================================================================
-- 3) REALTIME: odebrat citlivé tabulky z publikace
-- (zabraňuje broadcastu změn napříč RLS hranicemi)
-- =====================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'employees', 'medical_examinations', 'medical_examination_documents',
    'audit_logs', 'profiles', 'user_roles', 'user_invites',
    'deadlines', 'deadline_documents', 'equipment',
    'trainings', 'training_documents'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', tbl);
    EXCEPTION WHEN undefined_object OR undefined_table THEN
      -- Tabulka v publikaci nebyla, OK
      NULL;
    END;
  END LOOP;
END $$;