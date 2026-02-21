/**
 * Migration Registry
 * 
 * This file contains all database migrations that need to be applied.
 * For fresh Docker installs, docker/init-db.sql handles the full schema.
 * This registry is used for incremental updates on running systems.
 * 
 * IMPORTANT: When a new migration is created in supabase/migrations/,
 * add it here as well so the self-hosted admin can apply it.
 * 
 * Migrations already included in docker/init-db.sql should be listed
 * with sql: null (they're marked as applied during fresh install).
 */

export interface MigrationEntry {
  version: string;
  name: string;
  sql: string | null; // null = included in init-db.sql base schema
}

/**
 * All known migrations in chronological order.
 * Base migrations (included in init-db.sql) have sql: null.
 * New migrations added after the latest init-db.sql sync must include their SQL.
 */
export const MIGRATION_REGISTRY: MigrationEntry[] = [
  // ===== Base migrations (covered by docker/init-db.sql) =====
  { version: "20251111133942", name: "initial_schema", sql: null },
  { version: "20251111134841", name: "training_types", sql: null },
  { version: "20251111140105", name: "trainings_table", sql: null },
  { version: "20251111154720", name: "employees_updates", sql: null },
  { version: "20251111161816", name: "departments", sql: null },
  { version: "20251111163852", name: "rls_policies", sql: null },
  { version: "20251111165542", name: "reminder_system", sql: null },
  { version: "20251111170120", name: "reminder_templates", sql: null },
  { version: "20251111170638", name: "email_settings", sql: null },
  { version: "20251111170911", name: "audit_logs", sql: null },
  { version: "20251111171200", name: "user_roles", sql: null },
  { version: "20251111175341", name: "system_settings", sql: null },
  { version: "20251111175418", name: "profile_updates", sql: null },
  { version: "20251111175535", name: "notifications", sql: null },
  { version: "20251111181455", name: "facilities", sql: null },
  { version: "20260123083452", name: "deadlines_module", sql: null },
  { version: "20260123084505", name: "deadline_types", sql: null },
  { version: "20260123085605", name: "equipment_table", sql: null },
  { version: "20260123091947", name: "deadline_reminders", sql: null },
  { version: "20260123092622", name: "deadline_templates", sql: null },
  { version: "20260123093508", name: "deadline_policies", sql: null },
  { version: "20260123094231", name: "deadline_documents", sql: null },
  { version: "20260123094657", name: "deadline_responsibles", sql: null },
  { version: "20260123110519", name: "module_access", sql: null },
  { version: "20260123111351", name: "responsibility_groups", sql: null },
  { version: "20260123113132", name: "equipment_responsibles", sql: null },
  { version: "20260123114539", name: "deadline_logs", sql: null },
  { version: "20260123114820", name: "deadline_status_functions", sql: null },
  { version: "20260123130603", name: "training_documents", sql: null },
  { version: "20260123145758", name: "medical_module", sql: null },
  { version: "20260124131411", name: "medical_types", sql: null },
  { version: "20260124132521", name: "medical_documents", sql: null },
  { version: "20260128130854", name: "medical_reminders", sql: null },
  { version: "20260128132057", name: "medical_policies", sql: null },
  { version: "20260129080349", name: "user_invites", sql: null },
  { version: "20260202130142", name: "employee_manager", sql: null },
  { version: "20260202130538", name: "manager_hierarchy", sql: null },
  { version: "20260202132443", name: "role_based_visibility", sql: null },
  { version: "20260202133445", name: "work_categories", sql: null },
  { version: "20260202133819", name: "employee_status_updates", sql: null },
  { version: "20260202134150", name: "medical_exam_triggers", sql: null },
  { version: "20260202144831", name: "approval_system", sql: null },
  { version: "20260203100728", name: "onboarding_settings", sql: null },
  { version: "20260208111743", name: "reminder_logs_update", sql: null },
  { version: "20260208112105", name: "reminder_runs", sql: null },
  { version: "20260208112156", name: "reminder_delivery_mode", sql: null },
  { version: "20260208114435", name: "reminder_hardening", sql: null },
  { version: "20260208115715", name: "deadline_responsibles_constraints", sql: null },
  { version: "20260208123613", name: "notification_indexes", sql: null },
  { version: "20260208131607", name: "must_change_password", sql: null },
  { version: "20260208133830", name: "subordinate_auth_check", sql: null },
  { version: "20260208174914", name: "profile_employee_unique", sql: null },
  { version: "20260208182011", name: "work_category_check", sql: null },
  { version: "20260208201019", name: "module_access_check", sql: null },
  { version: "20260208203253", name: "audit_admin_only", sql: null },
  { version: "20260208204533", name: "approved_profiles_view", sql: null },
  { version: "20260209131703", name: "reminder_run_id", sql: null },
  { version: "20260209133919", name: "reminder_runs_policies", sql: null },
  { version: "20260211150346", name: "registration_functions", sql: null },
  { version: "20260212111843", name: "admin_provisioning", sql: null },
  { version: "20260212120227", name: "admin_edge_functions", sql: null },
  { version: "20260212135709", name: "user_management_updates", sql: null },
  { version: "20260212153318", name: "equipment_department", sql: null },
  { version: "20260213154948", name: "reminder_run_correlation", sql: null },
  { version: "20260213195037", name: "set_user_role_function", sql: null },
  { version: "20260216193430", name: "trigger_recreation", sql: null },

  {
    version: "20260219100000",
    name: "general_documents",
    sql: `
-- Create general_documents table for the Documentation module
CREATE TABLE IF NOT EXISTS public.general_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.general_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view general documents"
ON public.general_documents FOR SELECT
USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved users can upload general documents"
ON public.general_documents FOR INSERT
WITH CHECK (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can delete general documents"
ON public.general_documents FOR DELETE
USING (
  is_user_approved(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR auth.uid() = uploaded_by
  )
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('general-documents', 'general-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  CREATE POLICY "Approved users can upload general docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'general-documents' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Approved users can view general docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'general-documents' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete general docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'general-documents' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`
  },
  {
    version: "20260221000001",
    name: "employee_number_optional",
    sql: `
-- Make employee_number nullable (optional field)
ALTER TABLE public.employees ALTER COLUMN employee_number DROP NOT NULL;
ALTER TABLE public.employees ALTER COLUMN employee_number SET DEFAULT '';
`
  },
  {
    version: "20260221150000",
    name: "recalculate_all_statuses",
    sql: `
-- Function to recalculate all statuses (trainings, deadlines, medical)
CREATE OR REPLACE FUNCTION public.recalculate_all_statuses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t_updated integer := 0;
  d_updated integer := 0;
  m_updated integer := 0;
BEGIN
  UPDATE public.trainings
  SET status = calculate_training_status(next_training_date)
  WHERE is_active = true AND deleted_at IS NULL
    AND status IS DISTINCT FROM calculate_training_status(next_training_date);
  GET DIAGNOSTICS t_updated = ROW_COUNT;

  UPDATE public.deadlines
  SET status = calculate_deadline_status(next_check_date)
  WHERE is_active = true AND deleted_at IS NULL
    AND status IS DISTINCT FROM calculate_deadline_status(next_check_date);
  GET DIAGNOSTICS d_updated = ROW_COUNT;

  UPDATE public.medical_examinations
  SET status = calculate_examination_status(next_examination_date)
  WHERE is_active = true AND deleted_at IS NULL
    AND status IS DISTINCT FROM calculate_examination_status(next_examination_date);
  GET DIAGNOSTICS m_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'trainings_updated', t_updated,
    'deadlines_updated', d_updated,
    'medical_updated', m_updated
  );
END;
$$;
`
  },
  {
    version: "20260221165235",
    name: "notify_extraordinary_medical_exam",
    sql: `
-- Create a trigger function that fires when an employee returns from sick leave to active
CREATE OR REPLACE FUNCTION public.notify_extraordinary_medical_exam()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
  emp_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'sick_leave'
     AND NEW.status = 'employed'
  THEN
    emp_name := NEW.first_name || ' ' || NEW.last_name;
    FOR admin_record IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        user_id, title, message, type, related_entity_type, related_entity_id
      ) VALUES (
        admin_record.user_id,
        'Mimořádná lékařská prohlídka',
        'Zaměstnanec ' || emp_name || ' se vrátil z nemocenské. Doporučujeme naplánovat mimořádnou lékařskou prohlídku.',
        'warning',
        'employee',
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_extraordinary_medical_exam ON public.employees;
CREATE TRIGGER trg_notify_extraordinary_medical_exam
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_extraordinary_medical_exam();
`
  },
  {
    version: "20260221173502",
    name: "training_supervisor",
    sql: `
-- Add supervisor column to trainings table
ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS supervisor text;
`
  },
];

/**
 * Get migrations that have SQL and need to be applied
 * (excludes base schema migrations with sql: null)
 */
export function getPendingMigrations(
  appliedVersions: Set<string>
): MigrationEntry[] {
  return MIGRATION_REGISTRY.filter(
    (m) => m.sql !== null && !appliedVersions.has(m.version)
  );
}

/**
 * Get all migration versions (including base ones) for status display
 */
export function getAllMigrationVersions(): string[] {
  return MIGRATION_REGISTRY.map((m) => m.version);
}
