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
  { version: "20260217200531", name: "schema_migrations_table", sql: null },
  { version: "20260219100000", name: "general_documents", sql: null },
  { version: "20260221000001", name: "employee_number_optional", sql: null },
  { version: "20260221150000", name: "recalculate_all_statuses", sql: null },
  { version: "20260221165235", name: "notify_extraordinary_medical_exam", sql: null },
  { version: "20260221173502", name: "add_training_supervisor", sql: null },
  { version: "20260221174512", name: "drop_training_supervisor", sql: null },
  { version: "20260221175145", name: "propagate_manager_details", sql: null },
  { version: "20260221182753", name: "cleanup_manager_propagation", sql: null },
  { version: "20260221183742", name: "schema_reload", sql: null },
  { version: "20260221185611", name: "subordinate_function_update", sql: null },
  { version: "20260221190405", name: "subordinate_function_v2", sql: null },
  { version: "20260221200000", name: "auto_link_profile_employee", sql: null },

  // These migrations are now included in init-db.sql base schema
  { version: "20260226201357", name: "result_column", sql: null },
  { version: "20260310092500", name: "work_category_to_text", sql: null },
  { version: "20260316100000", name: "enable_realtime_tables", sql: null },
  { version: "20260316120000", name: "employee_birth_date", sql: null },
  { version: "20260318105142", name: "medical_examination_health_risks", sql: null },

  // These migrations are now included in init-db.sql base schema
  { version: "20260318130500", name: "record_period_overrides", sql: null },
  { version: "20260318175404", name: "long_term_fitness_loss_date_and_validation", sql: null },
  { version: "20260320110000", name: "reminder_deduplication_indexes", sql: null },
  { version: "20260320115314", name: "notify_employee_age_50", sql: null },
  { version: "20260320120000", name: "remove_timing_from_reminder_templates", sql: null },

  // ===== Incremental migrations (not yet in init-db.sql) =====
  {
    version: "20260326120000",
    name: "version_history_triggers",
    sql: `-- Add original_record_id column to track version history
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS original_record_id uuid;
ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS original_record_id uuid;
ALTER TABLE medical_examinations ADD COLUMN IF NOT EXISTS original_record_id uuid;

-- Training: archive old version before edit
CREATE OR REPLACE FUNCTION archive_training_before_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN RETURN NEW; END IF;
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN RETURN NEW; END IF;
  IF OLD.original_record_id IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.last_training_date IS DISTINCT FROM NEW.last_training_date
     OR OLD.training_type_id IS DISTINCT FROM NEW.training_type_id
     OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
     OR OLD.facility IS DISTINCT FROM NEW.facility
     OR OLD.trainer IS DISTINCT FROM NEW.trainer
     OR OLD.company IS DISTINCT FROM NEW.company
     OR OLD.requester IS DISTINCT FROM NEW.requester
     OR OLD.note IS DISTINCT FROM NEW.note
     OR OLD.period_days_override IS DISTINCT FROM NEW.period_days_override
     OR OLD.result IS DISTINCT FROM NEW.result
  THEN
    INSERT INTO trainings (
      employee_id, training_type_id, facility, last_training_date, next_training_date,
      trainer, company, requester, note, status, is_active, deleted_at,
      period_days_override, result, reminder_template_id, remind_days_before,
      repeat_days_after, reminder_template, created_by, created_at, original_record_id
    ) VALUES (
      OLD.employee_id, OLD.training_type_id, OLD.facility, OLD.last_training_date, OLD.next_training_date,
      OLD.trainer, OLD.company, OLD.requester, OLD.note, OLD.status, false, now(),
      OLD.period_days_override, OLD.result, OLD.reminder_template_id, OLD.remind_days_before,
      OLD.repeat_days_after, OLD.reminder_template, OLD.created_by, OLD.created_at, OLD.id
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_archive_training_before_edit ON trainings;
CREATE TRIGGER trg_archive_training_before_edit
  BEFORE UPDATE ON trainings FOR EACH ROW
  EXECUTE FUNCTION archive_training_before_edit();

-- Deadline: archive old version before edit
CREATE OR REPLACE FUNCTION archive_deadline_before_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN RETURN NEW; END IF;
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN RETURN NEW; END IF;
  IF OLD.original_record_id IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.last_check_date IS DISTINCT FROM NEW.last_check_date
     OR OLD.deadline_type_id IS DISTINCT FROM NEW.deadline_type_id
     OR OLD.equipment_id IS DISTINCT FROM NEW.equipment_id
     OR OLD.facility IS DISTINCT FROM NEW.facility
     OR OLD.performer IS DISTINCT FROM NEW.performer
     OR OLD.company IS DISTINCT FROM NEW.company
     OR OLD.requester IS DISTINCT FROM NEW.requester
     OR OLD.note IS DISTINCT FROM NEW.note
     OR OLD.period_days_override IS DISTINCT FROM NEW.period_days_override
     OR OLD.result IS DISTINCT FROM NEW.result
  THEN
    INSERT INTO deadlines (
      equipment_id, deadline_type_id, facility, last_check_date, next_check_date,
      performer, company, requester, note, status, is_active, deleted_at,
      period_days_override, result, reminder_template_id, remind_days_before,
      repeat_days_after, created_by, created_at, original_record_id
    ) VALUES (
      OLD.equipment_id, OLD.deadline_type_id, OLD.facility, OLD.last_check_date, OLD.next_check_date,
      OLD.performer, OLD.company, OLD.requester, OLD.note, OLD.status, false, now(),
      OLD.period_days_override, OLD.result, OLD.reminder_template_id, OLD.remind_days_before,
      OLD.repeat_days_after, OLD.created_by, OLD.created_at, OLD.id
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_archive_deadline_before_edit ON deadlines;
CREATE TRIGGER trg_archive_deadline_before_edit
  BEFORE UPDATE ON deadlines FOR EACH ROW
  EXECUTE FUNCTION archive_deadline_before_edit();

-- Medical examination: archive old version before edit
CREATE OR REPLACE FUNCTION archive_medical_exam_before_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN RETURN NEW; END IF;
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN RETURN NEW; END IF;
  IF OLD.original_record_id IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.last_examination_date IS DISTINCT FROM NEW.last_examination_date
     OR OLD.examination_type_id IS DISTINCT FROM NEW.examination_type_id
     OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
     OR OLD.facility IS DISTINCT FROM NEW.facility
     OR OLD.doctor IS DISTINCT FROM NEW.doctor
     OR OLD.medical_facility IS DISTINCT FROM NEW.medical_facility
     OR OLD.note IS DISTINCT FROM NEW.note
     OR OLD.period_days_override IS DISTINCT FROM NEW.period_days_override
     OR OLD.result IS DISTINCT FROM NEW.result
     OR OLD.requester IS DISTINCT FROM NEW.requester
  THEN
    INSERT INTO medical_examinations (
      employee_id, examination_type_id, facility, last_examination_date, next_examination_date,
      doctor, medical_facility, requester, note, status, is_active, deleted_at,
      period_days_override, result, reminder_template_id, remind_days_before,
      repeat_days_after, created_by, created_at, original_record_id,
      long_term_fitness_loss_date, zdravotni_rizika
    ) VALUES (
      OLD.employee_id, OLD.examination_type_id, OLD.facility, OLD.last_examination_date, OLD.next_examination_date,
      OLD.doctor, OLD.medical_facility, OLD.requester, OLD.note, OLD.status, false, now(),
      OLD.period_days_override, OLD.result, OLD.reminder_template_id, OLD.remind_days_before,
      OLD.repeat_days_after, OLD.created_by, OLD.created_at, OLD.id,
      OLD.long_term_fitness_loss_date, OLD.zdravotni_rizika
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_archive_medical_exam_before_edit ON medical_examinations;
CREATE TRIGGER trg_archive_medical_exam_before_edit
  BEFORE UPDATE ON medical_examinations FOR EACH ROW
  EXECUTE FUNCTION archive_medical_exam_before_edit();`,
  },
  {
    version: "20260318194000",
    name: "plp_inactive_visibility_toggle",
    sql: `-- UI-only PLP visibility change, no database schema updates required.
SELECT 1;`,
  },
  {
    version: "20260318203000",
    name: "unify_display_date_format",
    sql: `-- UI-only date format unification, no database schema updates required.
SELECT 1;`,
  },
  {
    version: "20260318212000",
    name: "plp_note_tooltip_unification",
    sql: `-- UI-only PLP note tooltip unification, no database schema updates required.
SELECT 1;`,
  },
  {
    version: "20260318214500",
    name: "history_note_tooltip_unification",
    sql: `-- UI-only history note tooltip unification, no database schema updates required.
SELECT 1;`,
  },
  {
    version: "20260320100000",
    name: "expandable_row_detail_tables",
    sql: `-- UI-only expandable row detail in overview tables, no database schema updates required.
SELECT 1;`,
  },
  {
    version: "20260326081600",
    name: "recalculate_dates_on_type_period_change",
    sql: `-- Trigger: recalculate next dates on training_types.period_days change
CREATE OR REPLACE FUNCTION recalculate_training_dates_on_type_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE trainings
    SET next_training_date = last_training_date + (NEW.period_days * INTERVAL '1 day'), updated_at = now()
    WHERE training_type_id = NEW.id AND is_active = true AND deleted_at IS NULL AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_training_dates_on_type_change ON training_types;
CREATE TRIGGER trg_recalc_training_dates_on_type_change
  AFTER UPDATE OF period_days ON training_types FOR EACH ROW
  EXECUTE FUNCTION recalculate_training_dates_on_type_change();

-- Trigger: recalculate next dates on deadline_types.period_days change
CREATE OR REPLACE FUNCTION recalculate_deadline_dates_on_type_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE deadlines
    SET next_check_date = last_check_date + (NEW.period_days * INTERVAL '1 day'), updated_at = now()
    WHERE deadline_type_id = NEW.id AND is_active = true AND deleted_at IS NULL AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_deadline_dates_on_type_change ON deadline_types;
CREATE TRIGGER trg_recalc_deadline_dates_on_type_change
  AFTER UPDATE OF period_days ON deadline_types FOR EACH ROW
  EXECUTE FUNCTION recalculate_deadline_dates_on_type_change();

-- Trigger: recalculate next dates on medical_examination_types.period_days change
CREATE OR REPLACE FUNCTION recalculate_medical_dates_on_type_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE medical_examinations
    SET next_examination_date = last_examination_date + (NEW.period_days * INTERVAL '1 day'), updated_at = now()
    WHERE examination_type_id = NEW.id AND is_active = true AND deleted_at IS NULL AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_medical_dates_on_type_change ON medical_examination_types;
CREATE TRIGGER trg_recalc_medical_dates_on_type_change
  AFTER UPDATE OF period_days ON medical_examination_types FOR EACH ROW
     EXECUTE FUNCTION recalculate_medical_dates_on_type_change();`,
  },
  {
    version: "20260327084800",
    name: "copy_documents_to_version_snapshots",
    sql: `-- Update training versioning trigger to also copy documents
CREATE OR REPLACE FUNCTION archive_training_before_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  snapshot_id uuid;
BEGIN
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN RETURN NEW; END IF;
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN RETURN NEW; END IF;
  IF OLD.original_record_id IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.last_training_date IS DISTINCT FROM NEW.last_training_date
     OR OLD.training_type_id IS DISTINCT FROM NEW.training_type_id
     OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
     OR OLD.facility IS DISTINCT FROM NEW.facility
     OR OLD.trainer IS DISTINCT FROM NEW.trainer
     OR OLD.company IS DISTINCT FROM NEW.company
     OR OLD.requester IS DISTINCT FROM NEW.requester
     OR OLD.note IS DISTINCT FROM NEW.note
     OR OLD.period_days_override IS DISTINCT FROM NEW.period_days_override
     OR OLD.result IS DISTINCT FROM NEW.result
  THEN
    snapshot_id := gen_random_uuid();
    INSERT INTO trainings (
      id, employee_id, training_type_id, facility, last_training_date, next_training_date,
      trainer, company, requester, note, status, is_active, deleted_at,
      period_days_override, result, reminder_template_id, remind_days_before,
      repeat_days_after, reminder_template, created_by, created_at, original_record_id
    ) VALUES (
      snapshot_id, OLD.employee_id, OLD.training_type_id, OLD.facility, OLD.last_training_date, OLD.next_training_date,
      OLD.trainer, OLD.company, OLD.requester, OLD.note, OLD.status, false, now(),
      OLD.period_days_override, OLD.result, OLD.reminder_template_id, OLD.remind_days_before,
      OLD.repeat_days_after, OLD.reminder_template, OLD.created_by, OLD.created_at, OLD.id
    );
    INSERT INTO training_documents (training_id, file_name, file_path, file_type, file_size, document_type, description, uploaded_by, uploaded_at)
    SELECT snapshot_id, file_name, file_path, file_type, file_size, document_type, description, uploaded_by, uploaded_at
    FROM training_documents WHERE training_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION archive_deadline_before_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  snapshot_id uuid;
BEGIN
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN RETURN NEW; END IF;
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN RETURN NEW; END IF;
  IF OLD.original_record_id IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.last_check_date IS DISTINCT FROM NEW.last_check_date
     OR OLD.deadline_type_id IS DISTINCT FROM NEW.deadline_type_id
     OR OLD.equipment_id IS DISTINCT FROM NEW.equipment_id
     OR OLD.facility IS DISTINCT FROM NEW.facility
     OR OLD.performer IS DISTINCT FROM NEW.performer
     OR OLD.company IS DISTINCT FROM NEW.company
     OR OLD.requester IS DISTINCT FROM NEW.requester
     OR OLD.note IS DISTINCT FROM NEW.note
     OR OLD.period_days_override IS DISTINCT FROM NEW.period_days_override
     OR OLD.result IS DISTINCT FROM NEW.result
  THEN
    snapshot_id := gen_random_uuid();
    INSERT INTO deadlines (
      id, equipment_id, deadline_type_id, facility, last_check_date, next_check_date,
      performer, company, requester, note, status, is_active, deleted_at,
      period_days_override, result, reminder_template_id, remind_days_before,
      repeat_days_after, created_by, created_at, original_record_id
    ) VALUES (
      snapshot_id, OLD.equipment_id, OLD.deadline_type_id, OLD.facility, OLD.last_check_date, OLD.next_check_date,
      OLD.performer, OLD.company, OLD.requester, OLD.note, OLD.status, false, now(),
      OLD.period_days_override, OLD.result, OLD.reminder_template_id, OLD.remind_days_before,
      OLD.repeat_days_after, OLD.created_by, OLD.created_at, OLD.id
    );
    INSERT INTO deadline_documents (deadline_id, file_name, file_path, file_type, file_size, document_type, description, uploaded_by, uploaded_at)
    SELECT snapshot_id, file_name, file_path, file_type, file_size, document_type, description, uploaded_by, uploaded_at
    FROM deadline_documents WHERE deadline_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION archive_medical_exam_before_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  snapshot_id uuid;
BEGIN
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN RETURN NEW; END IF;
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN RETURN NEW; END IF;
  IF OLD.original_record_id IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.last_examination_date IS DISTINCT FROM NEW.last_examination_date
     OR OLD.examination_type_id IS DISTINCT FROM NEW.examination_type_id
     OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
     OR OLD.facility IS DISTINCT FROM NEW.facility
     OR OLD.doctor IS DISTINCT FROM NEW.doctor
     OR OLD.medical_facility IS DISTINCT FROM NEW.medical_facility
     OR OLD.note IS DISTINCT FROM NEW.note
     OR OLD.period_days_override IS DISTINCT FROM NEW.period_days_override
     OR OLD.result IS DISTINCT FROM NEW.result
     OR OLD.requester IS DISTINCT FROM NEW.requester
  THEN
    snapshot_id := gen_random_uuid();
    INSERT INTO medical_examinations (
      id, employee_id, examination_type_id, facility, last_examination_date, next_examination_date,
      doctor, medical_facility, requester, note, status, is_active, deleted_at,
      period_days_override, result, reminder_template_id, remind_days_before,
      repeat_days_after, created_by, created_at, original_record_id,
      long_term_fitness_loss_date, zdravotni_rizika
    ) VALUES (
      snapshot_id, OLD.employee_id, OLD.examination_type_id, OLD.facility, OLD.last_examination_date, OLD.next_examination_date,
      OLD.doctor, OLD.medical_facility, OLD.requester, OLD.note, OLD.status, false, now(),
      OLD.period_days_override, OLD.result, OLD.reminder_template_id, OLD.remind_days_before,
      OLD.repeat_days_after, OLD.created_by, OLD.created_at, OLD.id,
      OLD.long_term_fitness_loss_date, OLD.zdravotni_rizika
    );
    INSERT INTO medical_examination_documents (examination_id, file_name, file_path, file_type, file_size, document_type, description, uploaded_by, uploaded_at)
    SELECT snapshot_id, file_name, file_path, file_type, file_size, document_type, description, uploaded_by, uploaded_at
    FROM medical_examination_documents WHERE examination_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;`,
  },
  {
    version: "20260327105100",
    name: "document_numbering_system",
    sql: `-- Add document_number column to all 3 document tables
ALTER TABLE training_documents ADD COLUMN IF NOT EXISTS document_number text;
ALTER TABLE deadline_documents ADD COLUMN IF NOT EXISTS document_number text;
ALTER TABLE medical_examination_documents ADD COLUMN IF NOT EXISTS document_number text;

CREATE SEQUENCE IF NOT EXISTS training_doc_seq START 1;
CREATE SEQUENCE IF NOT EXISTS deadline_doc_seq START 1;
CREATE SEQUENCE IF NOT EXISTS medical_doc_seq START 1;

CREATE OR REPLACE FUNCTION generate_training_doc_number()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.document_number IS NULL THEN
    NEW.document_number := 'TRN-' || LPAD(nextval('training_doc_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION generate_deadline_doc_number()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.document_number IS NULL THEN
    NEW.document_number := 'DL-' || LPAD(nextval('deadline_doc_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION generate_medical_doc_number()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.document_number IS NULL THEN
    NEW.document_number := 'MED-' || LPAD(nextval('medical_doc_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_training_doc_number ON training_documents;
CREATE TRIGGER trg_training_doc_number BEFORE INSERT ON training_documents FOR EACH ROW EXECUTE FUNCTION generate_training_doc_number();

DROP TRIGGER IF EXISTS trg_deadline_doc_number ON deadline_documents;
CREATE TRIGGER trg_deadline_doc_number BEFORE INSERT ON deadline_documents FOR EACH ROW EXECUTE FUNCTION generate_deadline_doc_number();

DROP TRIGGER IF EXISTS trg_medical_doc_number ON medical_examination_documents;
CREATE TRIGGER trg_medical_doc_number BEFORE INSERT ON medical_examination_documents FOR EACH ROW EXECUTE FUNCTION generate_medical_doc_number();

DO $do$
DECLARE rec RECORD; counter INTEGER := 0;
BEGIN
  counter := 0;
  FOR rec IN SELECT id FROM training_documents WHERE document_number IS NULL ORDER BY uploaded_at ASC LOOP
    counter := counter + 1;
    UPDATE training_documents SET document_number = 'TRN-' || LPAD(counter::text, 5, '0') WHERE id = rec.id;
  END LOOP;
  IF counter > 0 THEN PERFORM setval('training_doc_seq', counter); END IF;

  counter := 0;
  FOR rec IN SELECT id FROM deadline_documents WHERE document_number IS NULL ORDER BY uploaded_at ASC LOOP
    counter := counter + 1;
    UPDATE deadline_documents SET document_number = 'DL-' || LPAD(counter::text, 5, '0') WHERE id = rec.id;
  END LOOP;
  IF counter > 0 THEN PERFORM setval('deadline_doc_seq', counter); END IF;

  counter := 0;
  FOR rec IN SELECT id FROM medical_examination_documents WHERE document_number IS NULL ORDER BY uploaded_at ASC LOOP
    counter := counter + 1;
    UPDATE medical_examination_documents SET document_number = 'MED-' || LPAD(counter::text, 5, '0') WHERE id = rec.id;
  END LOOP;
  IF counter > 0 THEN PERFORM setval('medical_doc_seq', counter); END IF;
END;
$do$;`,
  },
  {
    version: "20260331070900",
    name: "independent_deadline_reminder_frequency",
    sql: `-- Insert default deadline_reminder_frequency setting (independent from training)
INSERT INTO system_settings (key, value, description)
VALUES (
  'deadline_reminder_frequency',
  '{"type": "weekly", "interval_days": 7, "start_time": "08:00", "timezone": "Europe/Prague", "enabled": true}'::jsonb,
  'Frekvence odesílání souhrnů technických událostí (nezávislé na školení)'
)
ON CONFLICT (key) DO NOTHING;

-- Insert default deadline_reminder_schedule setting
INSERT INTO system_settings (key, value, description)
VALUES (
  'deadline_reminder_schedule',
  '{"enabled": true, "day_of_week": 1, "skip_weekends": true}'::jsonb,
  'Rozvrh odesílání souhrnů technických událostí'
)
ON CONFLICT (key) DO NOTHING;`,
  },
  {
    version: "20260331090000",
    name: "medical_reminder_frequency_setting",
    sql: `-- Insert default medical_reminder_frequency setting
INSERT INTO system_settings (key, value, description)
VALUES (
  'medical_reminder_frequency',
  '{"enabled": true, "skip_weekends": true}'::jsonb,
  'Zapnutí/vypnutí odesílání souhrnů PLP (lékařské prohlídky)'
)
ON CONFLICT (key) DO NOTHING;`,
  },
  {
    version: "20260331100000",
    name: "simplify_age50_notification_text",
    sql: `-- Simplify notification text for employee age 50
CREATE OR REPLACE FUNCTION public.notify_employee_age_50()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
  emp_name TEXT;
  emp_age INT;
BEGIN
  IF NEW.birth_date IS NULL THEN
    RETURN NEW;
  END IF;

  emp_age := EXTRACT(YEAR FROM age(CURRENT_DATE, NEW.birth_date));

  IF emp_age = 50 THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE related_entity_type = 'employee_age_50'
        AND related_entity_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    emp_name := NEW.first_name || ' ' || NEW.last_name;

    FOR admin_record IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        user_id, title, message, type, related_entity_type, related_entity_id
      ) VALUES (
        admin_record.user_id,
        'Zaměstnanec dosáhl věku 50 let',
        'Zaměstnanec ' || emp_name || ' dosáhl věku 50 let.',
        'warning',
        'employee_age_50',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;`,
  },
  {
    version: "20260331110000",
    name: "update_sick_leave_return_notification",
    sql: `-- Update notification for return from sick leave: add 8-week condition and updated text
CREATE OR REPLACE FUNCTION public.notify_extraordinary_medical_exam()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
  emp_name TEXT;
  sick_start DATE;
  sick_duration INT;
BEGIN
  -- Only when status changes from sick_leave to employed
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'sick_leave'
     AND NEW.status = 'employed'
  THEN
    -- Determine how long the sick leave lasted
    sick_start := OLD.status_start_date;
    IF sick_start IS NOT NULL THEN
      sick_duration := CURRENT_DATE - sick_start;
    ELSE
      sick_duration := 0;
    END IF;

    -- Only notify if sick leave was longer than 8 weeks (56 days)
    IF sick_duration < 56 THEN
      RETURN NEW;
    END IF;

    emp_name := NEW.first_name || ' ' || NEW.last_name;

    FOR admin_record IN
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        user_id, title, message, type, related_entity_type, related_entity_id
      ) VALUES (
        admin_record.user_id,
        'Mimořádná pracovně-lékařská prohlídka',
        'Zaměstnanec ' || emp_name || ' se vrátil z nemocenské (délka ' || sick_duration || ' dní). Naplánujte mimořádnou pracovně-lékařskou prohlídku.',
        'warning',
        'employee',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;`,
  },
  {
    version: "20260331120000",
    name: "notify_failed_deadline_result",
    sql: `-- Notify admins when a deadline result is set to 'failed'
CREATE OR REPLACE FUNCTION public.notify_failed_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
  eq_name TEXT;
  dl_type_name TEXT;
BEGIN
  -- Only on INSERT or when result changes to 'failed'
  IF (TG_OP = 'INSERT' AND NEW.result = 'failed')
     OR (TG_OP = 'UPDATE' AND NEW.result = 'failed' AND OLD.result IS DISTINCT FROM 'failed')
  THEN
    -- Skip archived records
    IF NEW.original_record_id IS NOT NULL THEN RETURN NEW; END IF;

    SELECT e.name INTO eq_name FROM public.equipment e WHERE e.id = NEW.equipment_id;
    SELECT dt.name INTO dl_type_name FROM public.deadline_types dt WHERE dt.id = NEW.deadline_type_id;

    FOR admin_record IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        user_id, title, message, type, related_entity_type, related_entity_id
      ) VALUES (
        admin_record.user_id,
        'Nevyhovující technická kontrola',
        'Zařízení ' || COALESCE(eq_name, '?') || ' (' || COALESCE(dl_type_name, '?') || ') bylo vyhodnoceno jako nevyhovující. Zkontrolujte opravu.',
        'warning',
        'deadline',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_failed_deadline ON public.deadlines;
CREATE TRIGGER trg_notify_failed_deadline
  AFTER INSERT OR UPDATE ON public.deadlines
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_failed_deadline();`,
  },
  {
    version: "20260331120100",
    name: "notify_failed_training_result",
    sql: `-- Notify admins when a training result is set to 'failed'
CREATE OR REPLACE FUNCTION public.notify_failed_training()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
  emp_name TEXT;
  tr_type_name TEXT;
BEGIN
  -- Only on INSERT or when result changes to 'failed'
  IF (TG_OP = 'INSERT' AND NEW.result = 'failed')
     OR (TG_OP = 'UPDATE' AND NEW.result = 'failed' AND OLD.result IS DISTINCT FROM 'failed')
  THEN
    -- Skip archived records
    IF NEW.original_record_id IS NOT NULL THEN RETURN NEW; END IF;

    SELECT e.first_name || ' ' || e.last_name INTO emp_name FROM public.employees e WHERE e.id = NEW.employee_id;
    SELECT tt.name INTO tr_type_name FROM public.training_types tt WHERE tt.id = NEW.training_type_id;

    FOR admin_record IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        user_id, title, message, type, related_entity_type, related_entity_id
      ) VALUES (
        admin_record.user_id,
        'Nesplněné školení',
        'Zaměstnanec ' || COALESCE(emp_name, '?') || ' nesplnil školení ' || COALESCE(tr_type_name, '?') || '. Zkontrolujte nápravu.',
        'warning',
        'training',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_failed_training ON public.trainings;
CREATE TRIGGER trg_notify_failed_training
  AFTER INSERT OR UPDATE ON public.trainings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_failed_training();`,
  },
  {
    version: "20260331120000",
    name: "bulk_import_batch_fallback",
    sql: null, // Frontend-only change: row-by-row fallback for deadline/equipment batch imports
  },
  {
    version: "20260331121000",
    name: "fix_equipment_duplicate_detection_logic",
    sql: null, // Frontend-only change: duplicate detection now requires both inventory_number AND equipment_type to match
  },
  {
    version: "20260331130000",
    name: "import_export_column_mapping_compatibility",
    sql: null, // Frontend-only: imports now accept Czech column names from exports across all modules (deadlines, trainings, medical)
  },
  {
    version: "20260331140000",
    name: "move_imports_to_module_pages",
    sql: null, // Frontend-only: import buttons moved from Admin Data tab to individual module pages (Trainings, Medical); Data tab removed from admin
  },
  {
    version: "20260331150000",
    name: "unify_import_export_templates_and_compatibility",
    sql: null, // Frontend-only: templates now use Czech headers matching exports, employee import handles Czech status labels and formatted department codes
  },
  {
    version: "20260331160000",
    name: "fix_import_status_mapping_and_czech_descriptions",
    sql: null, // Frontend-only: added equipment status mapping in BulkDeadlineImport, fixed employee status fallback, updated all import descriptions to Czech column names
  },
  {
    version: "20260331170000",
    name: "unify_bulk_import_ui_across_modules",
    sql: null, // Frontend-only: unified visual layout of all bulk import components (ImportDescription, summary bar, button toggles for duplicates, badge results)
  },
  {
    version: "20260331180000",
    name: "unify_form_layouts_across_modules",
    sql: null, // Frontend-only: unified New/Edit page layouts (max-w-2xl, h1 text-2xl, Card+CardContent) and bulk edit dialog sizing (max-w-lg, max-h-[90vh])
  },
  {
    version: "20260331190000",
    name: "add_import_export_to_config_pages",
    sql: null, // Frontend-only: added CSV export/import with bidirectional compatibility to Departments, Facilities, DeadlineTypes, TrainingTypes, MedicalExaminationTypes pages
  },
  {
    version: "20260331200000",
    name: "periodicity_text_import_export",
    sql: null, // Frontend-only: exports now use Czech text ("každé 4 roky") instead of raw days; imports accept both text and numbers via parsePeriodicityText
  },
  {
    version: "20260331210000",
    name: "remove_query_limits_and_status_warnings",
    sql: null, // Frontend-only: raised Supabase query limits from default 1000 to 50000 on all data hooks; added warnings for unknown status values in employee and equipment imports
  },
  {
    version: "20260331220000",
    name: "export_all_data_not_filtered",
    sql: null, // Frontend-only: all CSV exports now export ALL data by default (not just filtered/paginated view); when items are selected via checkboxes, only selected items are exported
  },
  {
    version: "20260331230000",
    name: "plp_export_import_health_risks_and_category",
    sql: null, // Frontend-only: PLP CSV export now includes 6 health risk columns and work category; import maps these columns back and saves zdravotni_rizika JSONB on insert/update
  },
  {
    version: "20260331230100",
    name: "fix_plp_history_missing_column_cell",
    sql: null, // Frontend-only: added missing data cell for "Datum pozbytí ZD způsobilosti" in MedicalExaminationHistory causing column misalignment in "Předchozí verze" view
  },
  {
    version: "20260331230200",
    name: "plp_import_result_labels_and_all_fields",
    sql: null, // Frontend-only: PLP import now maps Czech result labels back to DB values (passed/passed_with_reservations/failed/lost_long_term), imports requester and long_term_fitness_loss_date, and overrides status to "expired" for failed/lost_long_term results
  },
  {
    version: "20260401000000",
    name: "auto_populate_deadline_responsibles_from_equipment",
    sql: null, // Frontend-only: NewDeadline auto-populates responsibles from equipment_responsibles when selecting equipment; EditDeadline does the same when equipment is changed by the user
  },
  {
    version: "20260401001000",
    name: "equipment_duplicate_detection_exact_match_all_fields",
    sql: null, // Frontend-only: equipment import duplicate detection requires exact match on ALL key fields (inv.číslo + název + typ + výrobce + sér.číslo). Same inv.číslo with any different parameter is NOT a duplicate. Applied to both BulkEquipmentImport and BulkDeadlineImport.
  },
  {
    version: "20260401002000",
    name: "status_priority_sorting_all_modules",
    sql: null, // Frontend-only: all modules (deadlines, trainings, medical examinations) now sort by status priority first (expired → warning → valid), then by date ascending within each group.
  },
  {
    version: "20260401003000",
    name: "attach_recalculate_triggers_to_type_tables",
    sql: `
-- Attach recalculate triggers to type tables (functions already exist)
DROP TRIGGER IF EXISTS recalculate_training_dates_on_type_change ON public.training_types;
CREATE TRIGGER recalculate_training_dates_on_type_change
AFTER UPDATE ON public.training_types
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_training_dates_on_type_change();

DROP TRIGGER IF EXISTS recalculate_deadline_dates_on_type_change ON public.deadline_types;
CREATE TRIGGER recalculate_deadline_dates_on_type_change
AFTER UPDATE ON public.deadline_types
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_deadline_dates_on_type_change();

DROP TRIGGER IF EXISTS recalculate_medical_dates_on_type_change ON public.medical_examination_types;
CREATE TRIGGER recalculate_medical_dates_on_type_change
AFTER UPDATE ON public.medical_examination_types
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_medical_dates_on_type_change();
    `.trim(),
  },
  {
    version: "20260401004000",
    name: "deadline_filter_label_performers",
    sql: null, // Frontend-only: renamed trainer filter label in deadline modules from "Všichni školitelé" to "Všichni kontroloři" (performers)
  },
  {
    version: "20260401005000",
    name: "add_filters_to_listing_pages",
    sql: null, // Frontend-only: added search and filter controls to Equipment, DeadlineTypes, TrainingTypes, MedicalExaminationTypes, Departments, and Facilities pages
  },
  {
    version: "20260401006000",
    name: "manager_visibility_deadlines",
    sql: `
-- Allow managers to see deadlines for equipment they are responsible for
DROP POLICY IF EXISTS "Role-based deadlines visibility" ON public.deadlines;
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
    OR (
      has_role(auth.uid(), 'manager'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.equipment_responsibles er
        WHERE er.equipment_id = deadlines.equipment_id
          AND er.profile_id = auth.uid()
      )
    )
  )
);

-- Also allow managers who are equipment responsibles to update those deadlines
DROP POLICY IF EXISTS "Users can update deadlines" ON public.deadlines;
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
    OR (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM public.equipment_responsibles er
      WHERE er.equipment_id = deadlines.equipment_id
        AND er.profile_id = auth.uid()
    ))
    OR (created_by = auth.uid())
    OR is_deadline_responsible(auth.uid(), id)
  )
);
    `.trim(),
  },
  {
    version: "20260401007000",
    name: "event_types_overview_page",
    sql: null, // Frontend-only: added read-only event types overview page for managers at /event-types
  },
  {
    version: "20260402001000",
    name: "fix_type_period_triggers_calendar_arithmetic",
    sql: `
-- Helper: convert period_days to a calendar-aware interval (years/months/days)
CREATE OR REPLACE FUNCTION public.period_days_to_interval(p_days INT)
RETURNS INTERVAL
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_days >= 365 AND p_days % 365 = 0 THEN
    RETURN make_interval(years => p_days / 365);
  ELSIF p_days >= 30 AND p_days % 30 = 0 THEN
    RETURN make_interval(months => p_days / 30);
  ELSE
    RETURN make_interval(days => p_days);
  END IF;
END;
$$;

-- Fix training trigger to use calendar arithmetic
CREATE OR REPLACE FUNCTION public.recalculate_training_dates_on_type_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE trainings
    SET next_training_date = last_training_date + period_days_to_interval(NEW.period_days),
        updated_at = now()
    WHERE training_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix deadline trigger to use calendar arithmetic
CREATE OR REPLACE FUNCTION public.recalculate_deadline_dates_on_type_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE deadlines
    SET next_check_date = last_check_date + period_days_to_interval(NEW.period_days),
        updated_at = now()
    WHERE deadline_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix medical trigger to use calendar arithmetic
CREATE OR REPLACE FUNCTION public.recalculate_medical_dates_on_type_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE medical_examinations
    SET next_examination_date = last_examination_date + period_days_to_interval(NEW.period_days),
        updated_at = now()
    WHERE examination_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Recalculate ALL existing records to fix any mismatched dates
-- Trainings without override: use type period
UPDATE trainings t
SET next_training_date = t.last_training_date + period_days_to_interval(tt.period_days),
    updated_at = now()
FROM training_types tt
WHERE t.training_type_id = tt.id
  AND t.is_active = true
  AND t.deleted_at IS NULL
  AND t.period_days_override IS NULL;

-- Trainings with override: use override period
UPDATE trainings t
SET next_training_date = t.last_training_date + period_days_to_interval(t.period_days_override),
    updated_at = now()
WHERE t.is_active = true
  AND t.deleted_at IS NULL
  AND t.period_days_override IS NOT NULL;

-- Deadlines without override
UPDATE deadlines d
SET next_check_date = d.last_check_date + period_days_to_interval(dt.period_days),
    updated_at = now()
FROM deadline_types dt
WHERE d.deadline_type_id = dt.id
  AND d.is_active = true
  AND d.deleted_at IS NULL
  AND d.period_days_override IS NULL;

-- Deadlines with override
UPDATE deadlines d
SET next_check_date = d.last_check_date + period_days_to_interval(d.period_days_override),
    updated_at = now()
WHERE d.is_active = true
  AND d.deleted_at IS NULL
  AND d.period_days_override IS NOT NULL;

-- Medical without override
UPDATE medical_examinations me
SET next_examination_date = me.last_examination_date + period_days_to_interval(met.period_days),
    updated_at = now()
FROM medical_examination_types met
WHERE me.examination_type_id = met.id
  AND me.is_active = true
  AND me.deleted_at IS NULL
  AND me.period_days_override IS NULL;

-- Medical with override
UPDATE medical_examinations me
SET next_examination_date = me.last_examination_date + period_days_to_interval(me.period_days_override),
    updated_at = now()
WHERE me.is_active = true
  AND me.deleted_at IS NULL
  AND me.period_days_override IS NOT NULL;
    `.trim(),
  },
  {
    version: "20260402002000",
    name: "force_reapply_calendar_period_triggers_for_selfhost",
    sql: `
-- Recreate helper with calendar-aware arithmetic used by the frontend
CREATE OR REPLACE FUNCTION public.period_days_to_interval(p_days integer)
RETURNS interval
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_days IS NULL THEN
    RETURN NULL;
  ELSIF p_days >= 365 AND p_days % 365 = 0 THEN
    RETURN make_interval(years => p_days / 365);
  ELSIF p_days >= 30 AND p_days % 30 = 0 THEN
    RETURN make_interval(months => p_days / 30);
  ELSE
    RETURN make_interval(days => p_days);
  END IF;
END;
$$;

-- Replace trigger functions so type period changes use calendar arithmetic
CREATE OR REPLACE FUNCTION public.recalculate_training_dates_on_type_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE public.trainings
    SET next_training_date = last_training_date + public.period_days_to_interval(NEW.period_days),
        updated_at = now()
    WHERE training_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_deadline_dates_on_type_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE public.deadlines
    SET next_check_date = last_check_date + public.period_days_to_interval(NEW.period_days),
        updated_at = now()
    WHERE deadline_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_medical_dates_on_type_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE public.medical_examinations
    SET next_examination_date = last_examination_date + public.period_days_to_interval(NEW.period_days),
        updated_at = now()
    WHERE examination_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure each table has exactly one recalculation trigger attached
DROP TRIGGER IF EXISTS trg_recalc_training_dates_on_type_change ON public.training_types;
DROP TRIGGER IF EXISTS recalculate_training_dates_on_type_change ON public.training_types;
CREATE TRIGGER trg_recalc_training_dates_on_type_change
  AFTER UPDATE OF period_days ON public.training_types
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_training_dates_on_type_change();

DROP TRIGGER IF EXISTS trg_recalc_deadline_dates_on_type_change ON public.deadline_types;
DROP TRIGGER IF EXISTS recalculate_deadline_dates_on_type_change ON public.deadline_types;
CREATE TRIGGER trg_recalc_deadline_dates_on_type_change
  AFTER UPDATE OF period_days ON public.deadline_types
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_deadline_dates_on_type_change();

DROP TRIGGER IF EXISTS trg_recalc_medical_dates_on_type_change ON public.medical_examination_types;
DROP TRIGGER IF EXISTS recalculate_medical_dates_on_type_change ON public.medical_examination_types;
CREATE TRIGGER trg_recalc_medical_dates_on_type_change
  AFTER UPDATE OF period_days ON public.medical_examination_types
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_medical_dates_on_type_change();

-- Recalculate all current records so self-hosted instances fix already-saved dates
UPDATE public.trainings t
SET next_training_date = t.last_training_date + public.period_days_to_interval(tt.period_days),
    updated_at = now()
FROM public.training_types tt
WHERE t.training_type_id = tt.id
  AND t.is_active = true
  AND t.deleted_at IS NULL
  AND t.period_days_override IS NULL;

UPDATE public.trainings t
SET next_training_date = t.last_training_date + public.period_days_to_interval(t.period_days_override),
    updated_at = now()
WHERE t.is_active = true
  AND t.deleted_at IS NULL
  AND t.period_days_override IS NOT NULL;

UPDATE public.deadlines d
SET next_check_date = d.last_check_date + public.period_days_to_interval(dt.period_days),
    updated_at = now()
FROM public.deadline_types dt
WHERE d.deadline_type_id = dt.id
  AND d.is_active = true
  AND d.deleted_at IS NULL
  AND d.period_days_override IS NULL;

UPDATE public.deadlines d
SET next_check_date = d.last_check_date + public.period_days_to_interval(d.period_days_override),
    updated_at = now()
WHERE d.is_active = true
  AND d.deleted_at IS NULL
  AND d.period_days_override IS NOT NULL;

UPDATE public.medical_examinations me
SET next_examination_date = me.last_examination_date + public.period_days_to_interval(met.period_days),
    updated_at = now()
FROM public.medical_examination_types met
WHERE me.examination_type_id = met.id
  AND me.is_active = true
  AND me.deleted_at IS NULL
  AND me.period_days_override IS NULL;

UPDATE public.medical_examinations me
SET next_examination_date = me.last_examination_date + public.period_days_to_interval(me.period_days_override),
    updated_at = now()
WHERE me.is_active = true
  AND me.deleted_at IS NULL
  AND me.period_days_override IS NOT NULL;

SELECT public.recalculate_all_statuses();
    `.trim(),
  },
  {
    version: "20260412001000",
    name: "shorten_age_50_notification_text",
    sql: `
CREATE OR REPLACE FUNCTION public.notify_employee_age_50()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
  emp_name TEXT;
  emp_age INT;
BEGIN
  IF NEW.birth_date IS NULL THEN
    RETURN NEW;
  END IF;

  emp_age := EXTRACT(YEAR FROM age(CURRENT_DATE, NEW.birth_date));

  IF emp_age = 50 THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE related_entity_type = 'employee_age_50'
        AND related_entity_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    emp_name := NEW.first_name || ' ' || NEW.last_name;

    FOR admin_record IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        user_id, title, message, type, related_entity_type, related_entity_id
      ) VALUES (
        admin_record.user_id,
        'Zaměstnanec dosáhl věku 50 let',
        'Zaměstnanec ' || emp_name || ' dosáhl věku 50 let.',
        'warning',
        'employee_age_50',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
    `.trim(),
  },
  {
    version: "20260414145300",
    name: "update_type_period_triggers_recalc_status",
    sql: `
CREATE OR REPLACE FUNCTION public.recalculate_training_dates_on_type_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE trainings
    SET next_training_date = last_training_date + (NEW.period_days * INTERVAL '1 day'),
        status = calculate_training_status((last_training_date + (NEW.period_days * INTERVAL '1 day'))::text),
        updated_at = now()
    WHERE training_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_medical_dates_on_type_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE medical_examinations
    SET next_examination_date = last_examination_date + (NEW.period_days * INTERVAL '1 day'),
        status = calculate_examination_status((last_examination_date + (NEW.period_days * INTERVAL '1 day'))::text),
        updated_at = now()
    WHERE examination_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_deadline_dates_on_type_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE deadlines
    SET next_check_date = last_check_date + (NEW.period_days * INTERVAL '1 day'),
        status = calculate_deadline_status((last_check_date + (NEW.period_days * INTERVAL '1 day'))::text),
        updated_at = now()
    WHERE deadline_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
    `.trim(),
  },
  {
    version: "20260414145900",
    name: "fix_type_period_triggers_date_cast",
    sql: `
CREATE OR REPLACE FUNCTION public.recalculate_training_dates_on_type_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE trainings
    SET next_training_date = last_training_date + (NEW.period_days * INTERVAL '1 day'),
        status = calculate_training_status((last_training_date + (NEW.period_days * INTERVAL '1 day'))::date),
        updated_at = now()
    WHERE training_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_medical_dates_on_type_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE medical_examinations
    SET next_examination_date = last_examination_date + (NEW.period_days * INTERVAL '1 day'),
        status = calculate_examination_status((last_examination_date + (NEW.period_days * INTERVAL '1 day'))::date),
        updated_at = now()
    WHERE examination_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_deadline_dates_on_type_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE deadlines
    SET next_check_date = last_check_date + (NEW.period_days * INTERVAL '1 day'),
        status = calculate_deadline_status((last_check_date + (NEW.period_days * INTERVAL '1 day'))::date),
        updated_at = now()
    WHERE deadline_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
    `.trim(),
  },
  {
    version: "20260414150200",
    name: "remove_duplicate_type_period_triggers",
    sql: `
DROP TRIGGER IF EXISTS recalculate_training_dates_on_type_change ON public.training_types;
DROP TRIGGER IF EXISTS recalculate_medical_dates_on_type_change ON public.medical_examination_types;
DROP TRIGGER IF EXISTS recalculate_deadline_dates_on_type_change ON public.deadline_types;
    `.trim(),
  },
  {
    version: "20260414151400",
    name: "fix_type_triggers_respect_negative_results",
    sql: `
CREATE OR REPLACE FUNCTION public.recalculate_medical_dates_on_type_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE medical_examinations
    SET next_examination_date = last_examination_date + (NEW.period_days * INTERVAL '1 day'),
        status = CASE
          WHEN result IN ('failed', 'lost_long_term') THEN 'expired'
          ELSE calculate_examination_status((last_examination_date + (NEW.period_days * INTERVAL '1 day'))::date)
        END,
        updated_at = now()
    WHERE examination_type_id = NEW.id AND is_active = true AND deleted_at IS NULL AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_training_dates_on_type_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE trainings
    SET next_training_date = last_training_date + (NEW.period_days * INTERVAL '1 day'),
        status = CASE
          WHEN result IN ('failed', 'non_compliant', 'unfit') THEN 'expired'
          ELSE calculate_training_status((last_training_date + (NEW.period_days * INTERVAL '1 day'))::date)
        END,
        updated_at = now()
    WHERE training_type_id = NEW.id AND is_active = true AND deleted_at IS NULL AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_deadline_dates_on_type_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE deadlines
    SET next_check_date = last_check_date + (NEW.period_days * INTERVAL '1 day'),
        status = CASE
          WHEN result IN ('failed', 'non_compliant') THEN 'expired'
          ELSE calculate_deadline_status((last_check_date + (NEW.period_days * INTERVAL '1 day'))::date)
        END,
        updated_at = now()
    WHERE deadline_type_id = NEW.id AND is_active = true AND deleted_at IS NULL AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
    `.trim(),
  },
  {
    version: "20260414151900",
    name: "fix_all_status_recalc_respect_negative_results",
    sql: `
CREATE OR REPLACE FUNCTION public.recalculate_all_statuses()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t_updated integer := 0;
  d_updated integer := 0;
  m_updated integer := 0;
BEGIN
  UPDATE public.trainings
  SET status = calculate_training_status(next_training_date)
  WHERE is_active = true AND deleted_at IS NULL
    AND (result IS NULL OR result NOT IN ('failed', 'non_compliant', 'unfit'))
    AND status IS DISTINCT FROM calculate_training_status(next_training_date);
  GET DIAGNOSTICS t_updated = ROW_COUNT;

  UPDATE public.deadlines
  SET status = calculate_deadline_status(next_check_date)
  WHERE is_active = true AND deleted_at IS NULL
    AND (result IS NULL OR result NOT IN ('failed', 'non_compliant'))
    AND status IS DISTINCT FROM calculate_deadline_status(next_check_date);
  GET DIAGNOSTICS d_updated = ROW_COUNT;

  UPDATE public.medical_examinations
  SET status = calculate_examination_status(next_examination_date)
  WHERE is_active = true AND deleted_at IS NULL
    AND (result IS NULL OR result NOT IN ('failed', 'lost_long_term'))
    AND status IS DISTINCT FROM calculate_examination_status(next_examination_date);
  GET DIAGNOSTICS m_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'trainings_updated', t_updated,
    'deadlines_updated', d_updated,
    'medical_updated', m_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_training_status_on_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'employed' AND OLD.status != 'employed' THEN
    UPDATE public.trainings
    SET status = CASE
      WHEN result IN ('failed', 'non_compliant', 'unfit') THEN 'expired'
      ELSE calculate_training_status(next_training_date)
    END
    WHERE employee_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_examination_status_on_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'employed' AND OLD.status != 'employed' THEN
    UPDATE public.medical_examinations
    SET status = CASE
      WHEN result IN ('failed', 'lost_long_term') THEN 'expired'
      ELSE calculate_examination_status(next_examination_date)
    END
    WHERE employee_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
    `.trim(),
  },
  {
    version: "20260417124200",
    name: "plp_allow_loss_date_for_any_result",
    sql: `
-- Allow long_term_fitness_loss_date to be set for ANY result, not only 'lost_long_term'.
-- The date is now treated as an independent fact: an employee can be 'passed' AND have lost long-term fitness.
-- Previous trigger forced the column to NULL whenever result != 'lost_long_term'. That blocked the new combined flow.
CREATE OR REPLACE FUNCTION public.validate_medical_examination_result_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- If the main result is 'lost_long_term', the date is mandatory (legacy behaviour).
  IF NEW.result = 'lost_long_term' AND NEW.long_term_fitness_loss_date IS NULL THEN
    RAISE EXCEPTION 'long_term_fitness_loss_date is required when result = lost_long_term';
  END IF;

  -- The date is now allowed independently for any result, so do NOT clear it any more.
  RETURN NEW;
END;
$$;
    `.trim(),
  },
  {
    version: "20260417125053",
    name: "trainings_deadlines_fixed_tracking",
    sql: `
-- Add "Fixed" tracking columns to trainings and deadlines
ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS fixed_at date,
  ADD COLUMN IF NOT EXISTS fixed_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fixed_by_name text,
  ADD COLUMN IF NOT EXISTS fixed_note text;

ALTER TABLE public.deadlines
  ADD COLUMN IF NOT EXISTS fixed_at date,
  ADD COLUMN IF NOT EXISTS fixed_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fixed_by_name text,
  ADD COLUMN IF NOT EXISTS fixed_note text;

-- Update archive trigger for trainings to include fixed_* fields in snapshot + change detection
CREATE OR REPLACE FUNCTION public.archive_training_before_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  snapshot_id uuid;
BEGIN
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN RETURN NEW; END IF;
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN RETURN NEW; END IF;
  IF OLD.original_record_id IS NOT NULL THEN RETURN NEW; END IF;

  IF OLD.last_training_date IS DISTINCT FROM NEW.last_training_date
     OR OLD.training_type_id IS DISTINCT FROM NEW.training_type_id
     OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
     OR OLD.facility IS DISTINCT FROM NEW.facility
     OR OLD.trainer IS DISTINCT FROM NEW.trainer
     OR OLD.company IS DISTINCT FROM NEW.company
     OR OLD.requester IS DISTINCT FROM NEW.requester
     OR OLD.note IS DISTINCT FROM NEW.note
     OR OLD.period_days_override IS DISTINCT FROM NEW.period_days_override
     OR OLD.result IS DISTINCT FROM NEW.result
     OR OLD.fixed_at IS DISTINCT FROM NEW.fixed_at
     OR OLD.fixed_by_profile_id IS DISTINCT FROM NEW.fixed_by_profile_id
     OR OLD.fixed_by_name IS DISTINCT FROM NEW.fixed_by_name
     OR OLD.fixed_note IS DISTINCT FROM NEW.fixed_note
  THEN
    snapshot_id := gen_random_uuid();
    INSERT INTO trainings (
      id, employee_id, training_type_id, facility, last_training_date, next_training_date,
      trainer, company, requester, note, status, is_active, deleted_at,
      period_days_override, result, reminder_template_id, remind_days_before,
      repeat_days_after, reminder_template, created_by, created_at, original_record_id,
      fixed_at, fixed_by_profile_id, fixed_by_name, fixed_note
    ) VALUES (
      snapshot_id, OLD.employee_id, OLD.training_type_id, OLD.facility, OLD.last_training_date, OLD.next_training_date,
      OLD.trainer, OLD.company, OLD.requester, OLD.note, OLD.status, false, now(),
      OLD.period_days_override, OLD.result, OLD.reminder_template_id, OLD.remind_days_before,
      OLD.repeat_days_after, OLD.reminder_template, OLD.created_by, OLD.created_at, OLD.id,
      OLD.fixed_at, OLD.fixed_by_profile_id, OLD.fixed_by_name, OLD.fixed_note
    );
    INSERT INTO training_documents (training_id, file_name, file_path, file_type, file_size, document_type, description, uploaded_by, uploaded_at)
    SELECT snapshot_id, file_name, file_path, file_type, file_size, document_type, description, uploaded_by, uploaded_at
    FROM training_documents WHERE training_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_deadline_before_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  snapshot_id uuid;
BEGIN
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN RETURN NEW; END IF;
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN RETURN NEW; END IF;
  IF OLD.original_record_id IS NOT NULL THEN RETURN NEW; END IF;

  IF OLD.last_check_date IS DISTINCT FROM NEW.last_check_date
     OR OLD.deadline_type_id IS DISTINCT FROM NEW.deadline_type_id
     OR OLD.equipment_id IS DISTINCT FROM NEW.equipment_id
     OR OLD.facility IS DISTINCT FROM NEW.facility
     OR OLD.performer IS DISTINCT FROM NEW.performer
     OR OLD.company IS DISTINCT FROM NEW.company
     OR OLD.requester IS DISTINCT FROM NEW.requester
     OR OLD.note IS DISTINCT FROM NEW.note
     OR OLD.period_days_override IS DISTINCT FROM NEW.period_days_override
     OR OLD.result IS DISTINCT FROM NEW.result
     OR OLD.fixed_at IS DISTINCT FROM NEW.fixed_at
     OR OLD.fixed_by_profile_id IS DISTINCT FROM NEW.fixed_by_profile_id
     OR OLD.fixed_by_name IS DISTINCT FROM NEW.fixed_by_name
     OR OLD.fixed_note IS DISTINCT FROM NEW.fixed_note
  THEN
    snapshot_id := gen_random_uuid();
    INSERT INTO deadlines (
      id, equipment_id, deadline_type_id, facility, last_check_date, next_check_date,
      performer, company, requester, note, status, is_active, deleted_at,
      period_days_override, result, reminder_template_id, remind_days_before,
      repeat_days_after, created_by, created_at, original_record_id,
      fixed_at, fixed_by_profile_id, fixed_by_name, fixed_note
    ) VALUES (
      snapshot_id, OLD.equipment_id, OLD.deadline_type_id, OLD.facility, OLD.last_check_date, OLD.next_check_date,
      OLD.performer, OLD.company, OLD.requester, OLD.note, OLD.status, false, now(),
      OLD.period_days_override, OLD.result, OLD.reminder_template_id, OLD.remind_days_before,
      OLD.repeat_days_after, OLD.created_by, OLD.created_at, OLD.id,
      OLD.fixed_at, OLD.fixed_by_profile_id, OLD.fixed_by_name, OLD.fixed_note
    );
    INSERT INTO deadline_documents (deadline_id, file_name, file_path, file_type, file_size, document_type, description, uploaded_by, uploaded_at)
    SELECT snapshot_id, file_name, file_path, file_type, file_size, document_type, description, uploaded_by, uploaded_at
    FROM deadline_documents WHERE deadline_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;
    `.trim(),
  },
  {
    version: "20260417125146",
    name: "fixed_at_overrides_negative_status",
    sql: `
-- Make fixed_at override the negative-result lockdown across status logic
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
  WHERE is_active = true
    AND deleted_at IS NULL
    AND (fixed_at IS NOT NULL OR result IS NULL OR result NOT IN ('failed', 'non_compliant', 'unfit'))
    AND status IS DISTINCT FROM calculate_training_status(next_training_date);
  GET DIAGNOSTICS t_updated = ROW_COUNT;

  UPDATE public.deadlines
  SET status = calculate_deadline_status(next_check_date)
  WHERE is_active = true
    AND deleted_at IS NULL
    AND (fixed_at IS NOT NULL OR result IS NULL OR result NOT IN ('failed', 'non_compliant'))
    AND status IS DISTINCT FROM calculate_deadline_status(next_check_date);
  GET DIAGNOSTICS d_updated = ROW_COUNT;

  UPDATE public.medical_examinations
  SET status = calculate_examination_status(next_examination_date)
  WHERE is_active = true
    AND deleted_at IS NULL
    AND (result IS NULL OR result NOT IN ('failed', 'lost_long_term'))
    AND status IS DISTINCT FROM calculate_examination_status(next_examination_date);
  GET DIAGNOSTICS m_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'trainings_updated', t_updated,
    'deadlines_updated', d_updated,
    'medical_updated', m_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_training_dates_on_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE trainings
    SET next_training_date = last_training_date + (NEW.period_days * INTERVAL '1 day'),
        status = CASE
          WHEN result IN ('failed', 'non_compliant', 'unfit') AND fixed_at IS NULL THEN 'expired'
          ELSE calculate_training_status((last_training_date + (NEW.period_days * INTERVAL '1 day'))::date)
        END,
        updated_at = now()
    WHERE training_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_deadline_dates_on_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.period_days IS DISTINCT FROM NEW.period_days THEN
    UPDATE deadlines
    SET next_check_date = last_check_date + (NEW.period_days * INTERVAL '1 day'),
        status = CASE
          WHEN result IN ('failed', 'non_compliant') AND fixed_at IS NULL THEN 'expired'
          ELSE calculate_deadline_status((last_check_date + (NEW.period_days * INTERVAL '1 day'))::date)
        END,
        updated_at = now()
    WHERE deadline_type_id = NEW.id
      AND is_active = true
      AND deleted_at IS NULL
      AND period_days_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_training_status_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'employed' AND OLD.status != 'employed' THEN
    UPDATE public.trainings
    SET status = CASE
      WHEN result IN ('failed', 'non_compliant', 'unfit') AND fixed_at IS NULL THEN 'expired'
      ELSE calculate_training_status(next_training_date)
    END
    WHERE employee_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
    `.trim(),
  },
  {
    version: "20260417125851",
    name: "override_recalc_and_fixed_notifications",
    sql: `
-- Auto-recalc next_*_date when period_days_override changes (or last date)
CREATE OR REPLACE FUNCTION public.recalculate_training_on_override_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE effective_period integer; type_period integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.period_days_override IS NOT DISTINCT FROM OLD.period_days_override
     AND NEW.last_training_date IS NOT DISTINCT FROM OLD.last_training_date THEN
    RETURN NEW;
  END IF;
  IF NEW.period_days_override IS NOT NULL THEN
    effective_period := NEW.period_days_override;
  ELSE
    SELECT period_days INTO type_period FROM public.training_types WHERE id = NEW.training_type_id;
    effective_period := type_period;
  END IF;
  IF effective_period IS NOT NULL AND NEW.last_training_date IS NOT NULL THEN
    NEW.next_training_date := (NEW.last_training_date + (effective_period * INTERVAL '1 day'))::date;
    NEW.status := CASE
      WHEN NEW.result IN ('failed','non_compliant','unfit') AND NEW.fixed_at IS NULL THEN 'expired'
      ELSE calculate_training_status(NEW.next_training_date)
    END;
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_training_override_recalc ON public.trainings;
CREATE TRIGGER trg_training_override_recalc BEFORE INSERT OR UPDATE OF period_days_override, last_training_date ON public.trainings
FOR EACH ROW EXECUTE FUNCTION public.recalculate_training_on_override_change();

CREATE OR REPLACE FUNCTION public.recalculate_deadline_on_override_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE effective_period integer; type_period integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.period_days_override IS NOT DISTINCT FROM OLD.period_days_override
     AND NEW.last_check_date IS NOT DISTINCT FROM OLD.last_check_date THEN
    RETURN NEW;
  END IF;
  IF NEW.period_days_override IS NOT NULL THEN
    effective_period := NEW.period_days_override;
  ELSE
    SELECT period_days INTO type_period FROM public.deadline_types WHERE id = NEW.deadline_type_id;
    effective_period := type_period;
  END IF;
  IF effective_period IS NOT NULL AND NEW.last_check_date IS NOT NULL THEN
    NEW.next_check_date := (NEW.last_check_date + (effective_period * INTERVAL '1 day'))::date;
    NEW.status := CASE
      WHEN NEW.result IN ('failed','non_compliant') AND NEW.fixed_at IS NULL THEN 'expired'
      ELSE calculate_deadline_status(NEW.next_check_date)
    END;
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_deadline_override_recalc ON public.deadlines;
CREATE TRIGGER trg_deadline_override_recalc BEFORE INSERT OR UPDATE OF period_days_override, last_check_date ON public.deadlines
FOR EACH ROW EXECUTE FUNCTION public.recalculate_deadline_on_override_change();

CREATE OR REPLACE FUNCTION public.recalculate_examination_on_override_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE effective_period integer; type_period integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.period_days_override IS NOT DISTINCT FROM OLD.period_days_override
     AND NEW.last_examination_date IS NOT DISTINCT FROM OLD.last_examination_date THEN
    RETURN NEW;
  END IF;
  IF NEW.period_days_override IS NOT NULL THEN
    effective_period := NEW.period_days_override;
  ELSE
    SELECT period_days INTO type_period FROM public.medical_examination_types WHERE id = NEW.examination_type_id;
    effective_period := type_period;
  END IF;
  IF effective_period IS NOT NULL AND NEW.last_examination_date IS NOT NULL THEN
    NEW.next_examination_date := (NEW.last_examination_date + (effective_period * INTERVAL '1 day'))::date;
    NEW.status := CASE
      WHEN NEW.result IN ('failed','lost_long_term') THEN 'expired'
      ELSE calculate_examination_status(NEW.next_examination_date)
    END;
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_examination_override_recalc ON public.medical_examinations;
CREATE TRIGGER trg_examination_override_recalc BEFORE INSERT OR UPDATE OF period_days_override, last_examination_date ON public.medical_examinations
FOR EACH ROW EXECUTE FUNCTION public.recalculate_examination_on_override_change();

-- Notify responsibles/managers when expired record is fixed
CREATE OR REPLACE FUNCTION public.notify_training_fixed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE emp_record RECORD; manager_profile_id uuid; admin_user RECORD; notif_title text; notif_message text; fixer_label text;
BEGIN
  IF NEW.fixed_at IS NULL OR (TG_OP='UPDATE' AND OLD.fixed_at IS NOT DISTINCT FROM NEW.fixed_at) THEN RETURN NEW; END IF;
  SELECT e.id, e.first_name, e.last_name, e.manager_employee_id INTO emp_record FROM public.employees e WHERE e.id = NEW.employee_id;
  fixer_label := COALESCE(NEW.fixed_by_name, 'systém');
  notif_title := 'Školení označeno jako opraveno';
  notif_message := 'Záznam školení pro ' || COALESCE(emp_record.first_name || ' ' || emp_record.last_name, 'zaměstnance') || ' byl opraven dne ' || to_char(NEW.fixed_at, 'DD.MM.YYYY') || ' (' || fixer_label || ').';
  IF emp_record.manager_employee_id IS NOT NULL THEN
    SELECT p.id INTO manager_profile_id FROM public.profiles p WHERE p.employee_id = emp_record.manager_employee_id LIMIT 1;
    IF manager_profile_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id) VALUES (manager_profile_id, notif_title, notif_message, 'success', 'training', NEW.id);
    END IF;
  END IF;
  FOR admin_user IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role='admin' LOOP
    IF admin_user.user_id <> COALESCE(NEW.fixed_by_profile_id,'00000000-0000-0000-0000-000000000000'::uuid)
       AND admin_user.user_id <> COALESCE(manager_profile_id,'00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id) VALUES (admin_user.user_id, notif_title, notif_message, 'success', 'training', NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_notify_training_fixed ON public.trainings;
CREATE TRIGGER trg_notify_training_fixed AFTER UPDATE OF fixed_at ON public.trainings FOR EACH ROW EXECUTE FUNCTION public.notify_training_fixed();

CREATE OR REPLACE FUNCTION public.notify_deadline_fixed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE eq_name text; resp RECORD; admin_user RECORD; notif_title text; notif_message text; fixer_label text; notified_users uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NEW.fixed_at IS NULL OR (TG_OP='UPDATE' AND OLD.fixed_at IS NOT DISTINCT FROM NEW.fixed_at) THEN RETURN NEW; END IF;
  SELECT name INTO eq_name FROM public.equipment WHERE id = NEW.equipment_id;
  fixer_label := COALESCE(NEW.fixed_by_name, 'systém');
  notif_title := 'Technická událost označena jako opraveno';
  notif_message := 'Záznam pro ' || COALESCE(eq_name, 'zařízení') || ' byl opraven dne ' || to_char(NEW.fixed_at, 'DD.MM.YYYY') || ' (' || fixer_label || ').';
  FOR resp IN
    SELECT DISTINCT profile_id FROM public.deadline_responsibles WHERE deadline_id = NEW.id AND profile_id IS NOT NULL
    UNION
    SELECT DISTINCT rgm.profile_id FROM public.deadline_responsibles dr JOIN public.responsibility_group_members rgm ON rgm.group_id = dr.group_id WHERE dr.deadline_id = NEW.id AND dr.group_id IS NOT NULL
    UNION
    SELECT DISTINCT er.profile_id FROM public.equipment_responsibles er WHERE er.equipment_id = NEW.equipment_id
  LOOP
    IF resp.profile_id IS NOT NULL AND resp.profile_id <> COALESCE(NEW.fixed_by_profile_id,'00000000-0000-0000-0000-000000000000'::uuid) AND NOT (resp.profile_id = ANY(notified_users)) THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id) VALUES (resp.profile_id, notif_title, notif_message, 'success', 'deadline', NEW.id);
      notified_users := array_append(notified_users, resp.profile_id);
    END IF;
  END LOOP;
  FOR admin_user IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role='admin' LOOP
    IF admin_user.user_id <> COALESCE(NEW.fixed_by_profile_id,'00000000-0000-0000-0000-000000000000'::uuid) AND NOT (admin_user.user_id = ANY(notified_users)) THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id) VALUES (admin_user.user_id, notif_title, notif_message, 'success', 'deadline', NEW.id);
      notified_users := array_append(notified_users, admin_user.user_id);
    END IF;
  END LOOP;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_notify_deadline_fixed ON public.deadlines;
CREATE TRIGGER trg_notify_deadline_fixed AFTER UPDATE OF fixed_at ON public.deadlines FOR EACH ROW EXECUTE FUNCTION public.notify_deadline_fixed();
    `.trim(),
  },
  {
    version: "20260417130500",
    name: "fix_dialog_promotes_result_to_passed",
    sql: `-- UI semantics change: MarkAsFixedDialog now also sets result='passed' (in addition to fixed_at + status='valid')
-- and lets the user attach new protocol documents.
-- The original negative result remains preserved in the auto-archived snapshot row
-- (see archive_training_before_edit / archive_deadline_before_edit which fire when result IS DISTINCT FROM).
-- No schema change is required, but we record this version so the migration log captures the behavioural change.
SELECT 1;`,
  },
  {
    version: "20260417140000",
    name: "reset_fixed_state_on_negative_result",
    sql: `
-- When a previously fixed record is changed back to a negative result
-- (failed / non_compliant / unfit), the fixed_at / fixed_by_* fields must
-- be cleared so the "Mark as fixed" action becomes available again, and
-- status should fall back to expired. This trigger runs BEFORE UPDATE so
-- it cooperates with the existing override-recalc triggers.

-- ============ Trainings ============
CREATE OR REPLACE FUNCTION public.reset_training_fixed_on_negative_result()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.result IS DISTINCT FROM OLD.result
     AND NEW.result IN ('failed', 'non_compliant', 'unfit') THEN
    NEW.fixed_at := NULL;
    NEW.fixed_by_profile_id := NULL;
    NEW.fixed_by_name := NULL;
    NEW.fixed_note := NULL;
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_reset_training_fixed_on_negative ON public.trainings;
CREATE TRIGGER trg_reset_training_fixed_on_negative
  BEFORE UPDATE OF result ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION public.reset_training_fixed_on_negative_result();

-- ============ Deadlines ============
CREATE OR REPLACE FUNCTION public.reset_deadline_fixed_on_negative_result()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.result IS DISTINCT FROM OLD.result
     AND NEW.result IN ('failed', 'non_compliant', 'unfit') THEN
    NEW.fixed_at := NULL;
    NEW.fixed_by_profile_id := NULL;
    NEW.fixed_by_name := NULL;
    NEW.fixed_note := NULL;
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_reset_deadline_fixed_on_negative ON public.deadlines;
CREATE TRIGGER trg_reset_deadline_fixed_on_negative
  BEFORE UPDATE OF result ON public.deadlines
  FOR EACH ROW EXECUTE FUNCTION public.reset_deadline_fixed_on_negative_result();
`.trim(),
  },
  {
    version: "20260417150000",
    name: "drop_equipment_inventory_number_unique",
    sql: `
-- Allow multiple equipment records to share the same inventory number
-- (e.g. legacy "Různé" records). Duplicate prevention is now handled
-- in the UI with a soft warning instead of a hard DB constraint.
ALTER TABLE public.equipment
  DROP CONSTRAINT IF EXISTS equipment_inventory_number_key;
`.trim(),
  },
  {
    version: "20260417160000",
    name: "deadlines_equipment_id_optional",
    sql: `
-- Make equipment_id optional on deadlines so that general inspections
-- (not tied to a specific piece of equipment) can be recorded.
ALTER TABLE public.deadlines
  ALTER COLUMN equipment_id DROP NOT NULL;
`.trim(),
  },
  {
    version: "20260424092039",
    name: "auth_admin_grants",
    sql: `
-- Grant supabase_auth_admin permissions on public schema so that
-- handle_new_user / assign_default_role triggers don't fail with
-- "Database error granting user" during signIn / token refresh.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'user_roles', 'user_module_access',
    'user_invites', 'audit_logs', 'system_settings'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO supabase_auth_admin', t);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'handle_new_user()', 'assign_default_role()', 'grant_default_modules()',
    'get_registration_mode()', 'is_email_allowed(text)'
  ]
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO supabase_auth_admin', fn);
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO supabase_auth_admin;
`.trim(),
  },
  {
    version: "20260424092509",
    name: "harden_assign_default_role_trigger",
    sql: `
-- Wrap each step of assign_default_role in its own EXCEPTION block so a single
-- failure (e.g. audit log insert) cannot block user creation / token grant.
-- Also fix search_path on doc-number trigger functions.

CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  admin_exists BOOLEAN;
  reg_mode text;
  invite_record RECORD;
BEGIN
  BEGIN
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO admin_exists;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'assign_default_role: admin check failed for %: %', NEW.id, SQLERRM;
    admin_exists := true;
  END;

  IF NOT admin_exists THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
      UPDATE public.profiles SET approval_status = 'approved', approved_at = now() WHERE id = NEW.id;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'assign_default_role: first-admin assign failed for %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  BEGIN
    reg_mode := public.get_registration_mode();
  EXCEPTION WHEN others THEN
    reg_mode := 'self_signup_approval';
  END;

  BEGIN
    SELECT * INTO invite_record FROM public.user_invites
      WHERE email = NEW.email AND status = 'pending' AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1;
  EXCEPTION WHEN others THEN
    invite_record := NULL;
  END;

  IF invite_record.id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, invite_record.role) ON CONFLICT DO NOTHING;
      UPDATE public.user_invites SET status = 'used', used_at = now(), used_by = NEW.id WHERE id = invite_record.id;
      UPDATE public.profiles SET approval_status = 'approved', approved_at = now(), approved_by = invite_record.invited_by WHERE id = NEW.id;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'assign_default_role: invite apply failed for %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  IF reg_mode != 'invite_only' THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'assign_default_role: default user role failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'assign_default_role: unexpected error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$func$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_training_doc_number') THEN
    EXECUTE 'ALTER FUNCTION public.generate_training_doc_number() SET search_path = public';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_deadline_doc_number') THEN
    EXECUTE 'ALTER FUNCTION public.generate_deadline_doc_number() SET search_path = public';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_medical_doc_number') THEN
    EXECUTE 'ALTER FUNCTION public.generate_medical_doc_number() SET search_path = public';
  END IF;
END $$;
`.trim(),
  },
  {
    version: "20260424093646",
    name: "security_hardening_extension_rls_diagnostics",
    sql: `
-- Move pg_net out of public + tighten RLS on system tables + add signin diagnostics
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_net' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP EXTENSION pg_net CASCADE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    EXECUTE 'CREATE EXTENSION pg_net WITH SCHEMA extensions';
  END IF;
END $$;

DROP POLICY IF EXISTS "System can insert reminder logs" ON public.reminder_logs;
CREATE POLICY "Admins or service can insert reminder logs"
ON public.reminder_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "System can insert deadline reminder logs" ON public.deadline_reminder_logs;
CREATE POLICY "Admins or service can insert deadline reminder logs"
ON public.deadline_reminder_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "System can insert medical reminder logs" ON public.medical_reminder_logs;
CREATE POLICY "Admins or service can insert medical reminder logs"
ON public.medical_reminder_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "System can insert reminder runs" ON public.reminder_runs;
CREATE POLICY "Admins or service can insert reminder runs"
ON public.reminder_runs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "System can update reminder runs" ON public.reminder_runs;
CREATE POLICY "Admins or service can update reminder runs"
ON public.reminder_runs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Admins or service can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.auth_signin_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL,
  http_status integer,
  error_code text,
  error_message text,
  request_id text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_signin_attempts_email_created
  ON public.auth_signin_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_signin_attempts_request
  ON public.auth_signin_attempts(request_id);

ALTER TABLE public.auth_signin_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Validated signin attempt logging" ON public.auth_signin_attempts;
CREATE POLICY "Validated signin attempt logging"
ON public.auth_signin_attempts FOR INSERT TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 3 AND 320
  AND email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
  AND status IN ('success', 'failure', 'retry')
  AND (error_message IS NULL OR length(error_message) <= 2000)
  AND attempt_number BETWEEN 1 AND 10
);

DROP POLICY IF EXISTS "Admins can read signin attempts" ON public.auth_signin_attempts;
CREATE POLICY "Admins can read signin attempts"
ON public.auth_signin_attempts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete signin attempts" ON public.auth_signin_attempts;
CREATE POLICY "Admins can delete signin attempts"
ON public.auth_signin_attempts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
`.trim(),
  },
  {
    version: "20260424100000",
    name: "tighten_employees_select_rls",
    sql: `
-- Tighten SELECT RLS on public.employees
-- Previously: any approved user could read all employees (PII exposure).
-- Now: admin sees all, manager sees subordinates, user sees only own employee record.

DROP POLICY IF EXISTS "Approved users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Role-based employee visibility" ON public.employees;

CREATE POLICY "Role-based employee visibility"
ON public.employees
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_manager_of(auth.uid(), id)
    OR id = public.get_user_employee_id(auth.uid())
  )
);
`.trim(),
  },
  {
    version: "20260424102258",
    name: "employee_access_audit_and_debug_rpc",
    sql: `
-- Audit log table for employees reads
CREATE TABLE IF NOT EXISTS public.employee_access_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  user_email text,
  user_role text,
  action text NOT NULL DEFAULT 'list',
  rows_returned integer,
  filters jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_access_logs_user_created
  ON public.employee_access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emp_access_logs_created
  ON public.employee_access_logs(created_at DESC);

ALTER TABLE public.employee_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read employee access logs" ON public.employee_access_logs;
CREATE POLICY "Admins can read employee access logs"
ON public.employee_access_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users can insert their access logs" ON public.employee_access_logs;
CREATE POLICY "Authenticated users can insert their access logs"
ON public.employee_access_logs FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND action IN ('list', 'detail', 'inactive_list', 'export')
  AND (rows_returned IS NULL OR rows_returned BETWEEN 0 AND 100000)
);

DROP POLICY IF EXISTS "Admins can delete employee access logs" ON public.employee_access_logs;
CREATE POLICY "Admins can delete employee access logs"
ON public.employee_access_logs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.debug_employee_visibility(_target_user_id uuid)
RETURNS TABLE (
  employee_id uuid,
  employee_name text,
  employee_email text,
  reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  is_admin boolean;
  own_employee uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can run employee visibility debug';
  END IF;
  is_admin := public.has_role(_target_user_id, 'admin'::public.app_role);
  own_employee := public.get_user_employee_id(_target_user_id);
  IF is_admin THEN
    RETURN QUERY SELECT e.id, (e.first_name || ' ' || e.last_name), e.email,
      'admin: full access'::text
      FROM public.employees e ORDER BY e.last_name;
    RETURN;
  END IF;
  RETURN QUERY SELECT e.id, (e.first_name || ' ' || e.last_name), e.email,
    CASE
      WHEN e.id = own_employee THEN 'self: linked profile'
      WHEN public.is_manager_of(_target_user_id, e.id) THEN 'manager: in subordinate hierarchy'
      ELSE 'other'
    END
    FROM public.employees e
    WHERE e.id = own_employee OR public.is_manager_of(_target_user_id, e.id)
    ORDER BY e.last_name;
END;
$fn$;

REVOKE ALL ON FUNCTION public.debug_employee_visibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_employee_visibility(uuid) TO authenticated;
`.trim(),
  },
  {
    version: "20260424104244",
    name: "debug_visibility_policy_info_and_pgnet_relocation",
    sql: `
-- Move pg_net to dedicated 'extensions' schema (drop+recreate to avoid SET SCHEMA pitfalls)
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    EXECUTE 'DROP EXTENSION pg_net CASCADE';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enhanced debug RPC: also returns the RLS policy name and the matching branch
DROP FUNCTION IF EXISTS public.debug_employee_visibility(uuid);

CREATE OR REPLACE FUNCTION public.debug_employee_visibility(_target_user_id uuid)
RETURNS TABLE (
  employee_id uuid,
  employee_name text,
  employee_email text,
  reason text,
  policy_name text,
  policy_branch text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  is_admin boolean;
  own_employee uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can run employee visibility debug';
  END IF;

  is_admin := public.has_role(_target_user_id, 'admin'::public.app_role);
  own_employee := public.get_user_employee_id(_target_user_id);

  IF is_admin THEN
    RETURN QUERY SELECT
      e.id,
      (e.first_name || ' ' || e.last_name),
      e.email,
      'admin: full access'::text,
      'Role-based employee visibility'::text,
      'has_role(auth.uid(), ''admin'')'::text
    FROM public.employees e ORDER BY e.last_name;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    e.id,
    (e.first_name || ' ' || e.last_name) AS employee_name,
    e.email,
    CASE
      WHEN e.id = own_employee THEN 'self: linked profile'
      WHEN public.is_manager_of(_target_user_id, e.id) THEN 'manager: in subordinate hierarchy'
      ELSE 'other'
    END AS reason,
    'Role-based employee visibility'::text AS policy_name,
    CASE
      WHEN e.id = own_employee THEN 'id = get_user_employee_id(auth.uid())'
      WHEN public.is_manager_of(_target_user_id, e.id) THEN 'is_manager_of(auth.uid(), id)'
      ELSE 'none'
    END AS policy_branch
  FROM public.employees e
  WHERE e.id = own_employee OR public.is_manager_of(_target_user_id, e.id)
  ORDER BY e.last_name;
END;
$fn$;

REVOKE ALL ON FUNCTION public.debug_employee_visibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_employee_visibility(uuid) TO authenticated;
`.trim(),
  },
  {
    version: "20260424104837",
    name: "security_hardening_storage_realtime_responsibility_groups",
    sql: `
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- 1) Storage RLS for medical-documents (align with table RLS)
-- 2) RLS on realtime.messages (scope subscriptions)
-- 3) Fix broken responsibility_groups manager policy
-- ============================================================

-- 1) STORAGE: medical-documents bucket
DROP POLICY IF EXISTS "Users can view medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete medical documents" ON storage.objects;

CREATE OR REPLACE FUNCTION public.can_access_medical_examination(_user_id uuid, _examination_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.medical_examinations me
      WHERE me.id = _examination_id
        AND (
          me.employee_id = public.get_user_employee_id(_user_id)
          OR public.is_manager_of(_user_id, me.employee_id)
        )
    );
$fn$;

CREATE POLICY "medical_docs_select_authorized"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "medical_docs_insert_authorized"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'medical-documents'
  AND auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "medical_docs_update_authorized"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "medical_docs_delete_authorized"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 2) REALTIME: scope channel subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can subscribe" ON realtime.messages;
DROP POLICY IF EXISTS "approved_users_realtime_access" ON realtime.messages;
DROP POLICY IF EXISTS "block_client_realtime_writes" ON realtime.messages;

CREATE POLICY "approved_users_realtime_access"
ON realtime.messages FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_user_approved(auth.uid())
);

CREATE POLICY "block_client_realtime_writes"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (false);

-- 3) FIX: responsibility_groups manager visibility policy
DROP POLICY IF EXISTS "Managers can view groups they are members of" ON public.responsibility_groups;

CREATE POLICY "Managers can view groups they are members of"
ON public.responsibility_groups FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND is_active = true
  AND EXISTS (
    SELECT 1 FROM public.responsibility_group_members rgm
    WHERE rgm.group_id = public.responsibility_groups.id
      AND rgm.profile_id = auth.uid()
  )
);
`.trim(),
  },
  {
    version: "20260424105523",
    name: "audit_target_user_debug_medical_docs_storage_hardening",
    sql: `
-- ============================================================
-- AUDIT TARGET USER + DEBUG MEDICAL DOCS + STORAGE HARDENING
-- ============================================================

-- 1) audit_logs: target_user_id + indexes
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS target_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);

UPDATE public.audit_logs
SET target_user_id = COALESCE(
  (new_data->>'user_id')::uuid,
  (old_data->>'user_id')::uuid,
  CASE WHEN table_name = 'profiles' THEN record_id ELSE NULL END
)
WHERE target_user_id IS NULL
  AND table_name IN ('user_roles','user_module_access','profiles');

-- 2) Server-side filtered audit logs RPC (admin only)
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
  id uuid, table_name text, record_id uuid, action text,
  user_id uuid, user_email text, user_name text,
  target_user_id uuid, changed_fields text[], created_at timestamptz,
  actor_role text, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can read audit logs';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT al.*, (
      SELECT ur.role::text FROM public.user_roles ur
      WHERE ur.user_id = al.user_id
      ORDER BY (ur.role = 'admin') DESC, (ur.role = 'manager') DESC LIMIT 1
    ) AS actor_role
    FROM public.audit_logs al
    WHERE (_user_id IS NULL OR al.user_id = _user_id)
      AND (_target_user_id IS NULL OR al.target_user_id = _target_user_id)
      AND (_action IS NULL OR al.action = _action)
      AND (_table_name IS NULL OR al.table_name = _table_name)
      AND (_from IS NULL OR al.created_at >= _from)
      AND (_to IS NULL OR al.created_at <= _to)
  ),
  filtered AS (SELECT * FROM base WHERE (_role IS NULL OR base.actor_role = _role)),
  counted AS (SELECT count(*) AS c FROM filtered)
  SELECT f.id, f.table_name, f.record_id, f.action, f.user_id, f.user_email, f.user_name,
         f.target_user_id, f.changed_fields, f.created_at, f.actor_role, c.c
  FROM filtered f, counted c
  ORDER BY f.created_at DESC
  LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0);
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_filtered_audit_logs(uuid,uuid,text,text,text,timestamptz,timestamptz,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_filtered_audit_logs(uuid,uuid,text,text,text,timestamptz,timestamptz,int,int) TO authenticated;

-- 3) Debug medical document access RPC (admin only)
CREATE OR REPLACE FUNCTION public.debug_medical_document_access(_target_user_id uuid)
RETURNS TABLE (
  document_id uuid, examination_id uuid, file_name text, file_path text,
  uploaded_by uuid, reason text, policy_name text, policy_branch text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
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
  SELECT d.id, d.examination_id, d.file_name, d.file_path, d.uploaded_by,
    CASE
      WHEN is_admin THEN 'admin: full access'
      WHEN d.uploaded_by = _target_user_id THEN 'self: uploaded by user'
      WHEN me.employee_id = own_employee THEN 'self: linked employee'
      WHEN public.is_manager_of(_target_user_id, me.employee_id) THEN 'manager: in subordinate hierarchy'
      ELSE 'denied: no matching branch'
    END,
    'Storage medical-documents access (table can_access_medical_examination)'::text,
    CASE
      WHEN is_admin THEN 'has_role(uid, admin)'
      WHEN d.uploaded_by = _target_user_id THEN 'document.uploaded_by = uid'
      WHEN me.employee_id = own_employee THEN 'examination.employee_id = get_user_employee_id(uid)'
      WHEN public.is_manager_of(_target_user_id, me.employee_id) THEN 'is_manager_of(uid, examination.employee_id)'
      ELSE 'none'
    END
  FROM public.medical_examination_documents d
  JOIN public.medical_examinations me ON me.id = d.examination_id
  ORDER BY d.uploaded_at DESC LIMIT 500;
END;
$fn$;

REVOKE ALL ON FUNCTION public.debug_medical_document_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_medical_document_access(uuid) TO authenticated;

-- 4) Extended can_access_medical_examination (also for examination author + uploader)
CREATE OR REPLACE FUNCTION public.can_access_medical_examination(_user_id uuid, _examination_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.medical_examinations me
      WHERE me.id = _examination_id
        AND (
          me.employee_id = public.get_user_employee_id(_user_id)
          OR public.is_manager_of(_user_id, me.employee_id)
          OR me.created_by = _user_id
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.medical_examination_documents d
      WHERE d.examination_id = _examination_id AND d.uploaded_by = _user_id
    );
$fn$;

-- 5) Storage: medical-documents — strict policies only
DROP POLICY IF EXISTS "Users can upload medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete medical documents" ON storage.objects;
DROP POLICY IF EXISTS "medical_docs_select_authorized" ON storage.objects;
DROP POLICY IF EXISTS "medical_docs_insert_authorized" ON storage.objects;
DROP POLICY IF EXISTS "medical_docs_delete_authorized" ON storage.objects;

CREATE POLICY "medical_docs_select_authorized" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'medical-documents' AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "medical_docs_insert_authorized" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'medical-documents' AND public.is_user_approved(auth.uid())
  AND public.can_access_medical_examination(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "medical_docs_delete_authorized" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'medical-documents' AND public.is_user_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner = auth.uid()
    OR public.can_access_medical_examination(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- 6) Storage: training-documents — add approval + ownership/role
DROP POLICY IF EXISTS "Users can upload training documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view training documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete training documents" ON storage.objects;
DROP POLICY IF EXISTS "training_docs_select_authorized" ON storage.objects;
DROP POLICY IF EXISTS "training_docs_insert_authorized" ON storage.objects;
DROP POLICY IF EXISTS "training_docs_delete_authorized" ON storage.objects;

CREATE POLICY "training_docs_select_authorized" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'training-documents' AND public.is_user_approved(auth.uid())
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
CREATE POLICY "training_docs_insert_authorized" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'training-documents' AND public.is_user_approved(auth.uid()) AND owner = auth.uid()
);
CREATE POLICY "training_docs_delete_authorized" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'training-documents' AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR owner = auth.uid())
);

-- 7) Realtime denied logger
CREATE OR REPLACE FUNCTION public.log_realtime_denied(_topic text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_id, user_email, target_user_id)
  VALUES ('realtime', gen_random_uuid(), 'REALTIME_DENIED',
    jsonb_build_object('topic', COALESCE(_topic,''), 'reason', COALESCE(_reason,'unknown')),
    auth.uid(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    auth.uid());
END;
$fn$;

REVOKE ALL ON FUNCTION public.log_realtime_denied(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_realtime_denied(text, text) TO authenticated;
`.trim(),
  },
  {
    version: "20260424110430",
    name: "harden_storage_and_realtime_policies",
    sql: `-- 1) general-documents: vyžadovat schválený účet
DROP POLICY IF EXISTS "Approved users can view general docs" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can upload general docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete general docs" ON storage.objects;
DROP POLICY IF EXISTS "general_docs_select_approved" ON storage.objects;
DROP POLICY IF EXISTS "general_docs_insert_approved" ON storage.objects;
DROP POLICY IF EXISTS "general_docs_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "general_docs_delete_admin" ON storage.objects;

CREATE POLICY "general_docs_select_approved" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'general-documents' AND public.is_user_approved(auth.uid()));

CREATE POLICY "general_docs_insert_approved" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'general-documents' AND public.is_user_approved(auth.uid()));

CREATE POLICY "general_docs_update_admin" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'general-documents' AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid()))
WITH CHECK (bucket_id = 'general-documents' AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid()));

CREATE POLICY "general_docs_delete_admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'general-documents' AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid()));

-- 2) medical-documents: odstranit příliš volné politiky
DROP POLICY IF EXISTS "Users can delete their medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their medical documents" ON storage.objects;

-- 3) training-documents: explicitní UPDATE politika
DROP POLICY IF EXISTS "training_docs_update_authorized" ON storage.objects;
CREATE POLICY "training_docs_update_authorized" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'training-documents' AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid()))
WITH CHECK (bucket_id = 'training-documents' AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid()));

-- 4) deadline-documents: explicitní UPDATE politika
DROP POLICY IF EXISTS "deadline_docs_update_authorized" ON storage.objects;
CREATE POLICY "deadline_docs_update_authorized" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'deadline-documents' AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid()))
WITH CHECK (bucket_id = 'deadline-documents' AND public.is_user_approved(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid()));

-- 5) realtime.messages: zúžit podle topicu
DROP POLICY IF EXISTS "approved_users_realtime_access" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_topic_scoped_select" ON realtime.messages;

CREATE POLICY "realtime_topic_scoped_select" ON realtime.messages FOR SELECT TO authenticated
USING (
  public.is_user_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND (
        realtime.topic() LIKE 'manager:%'
        OR realtime.topic() LIKE 'public:%'
        OR realtime.topic() = 'notifications:' || auth.uid()::text
      )
    )
    OR realtime.topic() = 'notifications:' || auth.uid()::text
    OR realtime.topic() LIKE 'public:%'
  )
);`,
  },
  {
    version: "20260424113000",
    name: "restrict_realtime_public_topic_and_cleanup_medical_delete",
    sql: `-- 1) REALTIME: Zúžit public:* topic jen na admin + manager
DROP POLICY IF EXISTS "realtime_topic_scoped_select" ON realtime.messages;

CREATE POLICY "realtime_topic_scoped_select" ON realtime.messages
FOR SELECT TO authenticated
USING (
  public.is_user_approved(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND (
        realtime.topic() LIKE 'manager:%'
        OR realtime.topic() LIKE 'public:%'
        OR realtime.topic() = 'notifications:' || auth.uid()::text
      )
    )
    OR realtime.topic() = 'notifications:' || auth.uid()::text
  )
);

-- 2) STORAGE: Úklid duplicitních DELETE politik na medical-documents
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
      AND p.polcmd = 'd'
      AND p.polname <> 'medical_docs_delete_authorized'
      AND (
        p.polname ILIKE '%medical%'
        OR pg_get_expr(p.polqual, p.polrelid) ILIKE '%medical-documents%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "medical_docs_delete_authorized" ON storage.objects;
CREATE POLICY "medical_docs_delete_authorized" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'medical-documents'
  AND public.is_user_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR owner = auth.uid()
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
);`,
  },
  {
    version: "20260424111235",
    name: "harden_anon_rls_and_deadline_storage_ownership",
    sql: `-- 1) profiles & user_roles: explicit TO authenticated
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Approved users can view approved profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Approved users can view approved profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_user_approved(auth.uid()) AND approval_status = 'approved');
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update user roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) deadline-documents storage ownership
CREATE OR REPLACE FUNCTION public.can_access_deadline_file(_user_id uuid, _file_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.deadline_documents dd
      JOIN public.deadlines d ON d.id = dd.deadline_id
      LEFT JOIN public.equipment_responsibles er ON er.equipment_id = d.equipment_id
      WHERE dd.file_path = _file_path
        AND (d.created_by = _user_id OR public.is_deadline_responsible(_user_id, d.id) OR er.profile_id = _user_id)
    );
$fn$;
REVOKE ALL ON FUNCTION public.can_access_deadline_file(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_deadline_file(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Approved users can upload deadline documents to storage" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can view deadline documents in storage" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can delete their deadline documents from storage" ON storage.objects;
DROP POLICY IF EXISTS "deadline_docs_update_authorized" ON storage.objects;
DROP POLICY IF EXISTS "deadline_docs_select_authorized" ON storage.objects;
DROP POLICY IF EXISTS "deadline_docs_insert_authorized" ON storage.objects;
DROP POLICY IF EXISTS "deadline_docs_delete_authorized" ON storage.objects;

CREATE POLICY "deadline_docs_select_authorized" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'deadline-documents' AND public.is_user_approved(auth.uid()) AND public.can_access_deadline_file(auth.uid(), name));

CREATE POLICY "deadline_docs_insert_authorized" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'deadline-documents' AND public.is_user_approved(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.deadlines d
      LEFT JOIN public.equipment_responsibles er ON er.equipment_id = d.equipment_id
      WHERE d.id::text = (storage.foldername(storage.objects.name))[1]
        AND (d.created_by = auth.uid() OR public.is_deadline_responsible(auth.uid(), d.id) OR er.profile_id = auth.uid())
    )
  )
);

CREATE POLICY "deadline_docs_update_authorized" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'deadline-documents' AND public.is_user_approved(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid()))
WITH CHECK (bucket_id = 'deadline-documents' AND public.is_user_approved(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid()));

CREATE POLICY "deadline_docs_delete_authorized" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'deadline-documents' AND public.is_user_approved(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid() OR public.can_access_deadline_file(auth.uid(), name)));

-- 3) Realtime: odebrat citlivé tabulky z publikace
DO $do$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['employees','medical_examinations','medical_examination_documents','audit_logs','profiles','user_roles','user_invites','deadlines','deadline_documents','equipment','trainings','training_documents'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', tbl);
    EXCEPTION WHEN undefined_object OR undefined_table THEN NULL;
    END;
  END LOOP;
END $do$;`,
  },
  {
    version: "20260424120000",
    name: "ui_unify_role_based_navigation_guards",
    sql: `-- UI-only: sjednocení role-based přístupu napříč záložkami.
-- Přidány ProtectedRoute guards (admin/manager) na stránky Správa dat
-- (/employees, /training-types, /departments, /facilities, /inactive),
-- aktualizována matice oprávnění (RolePermissionsInfo) a text stránky NoAccess.
-- Žádné databázové změny nejsou potřeba — RLS politiky už striktně vynucují
-- role na úrovni databáze; tato migrace pouze ladí UI tak, aby odpovídalo
-- skutečným oprávněním a uživatelé nedostávali prázdné stránky / chyby RLS.
SELECT 1;`,
  },
  {
    version: "20260424130000",
    name: "ui_role_audit_and_plp_write_lock",
    sql: `-- UI-only: další zpřísnění role guardů a transparentnost oprávnění.
-- 1) PLP zápis (/plp/new, /plp/edit/:id) je nyní v App.tsx omezen na admin
--    (manažeři ani s modulovým přístupem nemohou vytvářet/upravovat prohlídky).
-- 2) Catch-all 404 route je obalena ProtectedRoute, takže nepřihlášený uživatel
--    je přesměrován na /auth místo zobrazení interní 404 stránky.
-- 3) Přidána stránka /my-permissions (MyPermissions), která uživateli ukazuje
--    aktuální role, přiřazené moduly a kompletní seznam stránek s indikací
--    přístupu (mirror logiky ProtectedRoute v helperu canAccessRoute).
-- 4) Stránka NoAccess nyní nabízí konkrétní dostupné odkazy podle role
--    (Dokumenty, Profil, Moje oprávnění; manažer + Zaměstnanci/Statistiky).
-- 5) Přidány vitest unit testy (src/test/route-access.test.ts) pokrývající
--    matici Admin/Manager/User × klíčové stránky, včetně PLP write-locku.
-- Databázové změny nejsou potřeba — RLS na DB úrovni už zápis PLP omezuje
-- pomocí policy 'only admins can write medical_examinations'.
SELECT 1;`,
  },
  {
    version: "20260424140000",
    name: "ui_statistics_page_bugfixes",
    sql: `-- UI-only: oprava 3 bugů na stránce /statistics.
-- 1) Tabulka "Odškolené hodiny podle roků" — rok se nyní parsuje přímo z ISO
--    řetězce (lastTrainingDate.slice(0,4)) místo new Date(...).getFullYear(),
--    aby se data ze začátku/konce roku nepřesouvala do sousedního roku kvůli
--    časovému pásmu (typicky chyběl rok 2025 v záporných TZ).
--    Stejné parsování bylo aplikováno i na filtr roku (yearFilteredTrainings)
--    a na seznam dostupných roků v <Select>.
-- 2) Graf "Školení podle oddělení" — popisek na ose X už nezobrazuje surový
--    kód střediska (např. "2002000001 - LOG"), ale lidsky čitelný název
--    s kódem v závorce ("LOG (2002000001)"). Nezařazené záznamy zůstávají
--    pod popiskem "Nezařazeno".
-- 3) Statistiky doručování emailů — "Průměr pokusů" ukazoval 1.0 i při
--    nulovém datasetu. Default 1 byl nahrazen 0 a v UI se při 0 odeslaných
--    + 0 neúspěšných emailech zobrazí pomlčka "—".
-- Žádné databázové změny nejsou potřeba.
SELECT 1;`,
  },
  {
    version: "20260424150000",
    name: "ui_statistics_test_coverage_and_empty_states",
    sql: `-- UI-only: rozšíření testovacího pokrytí a hardening empty states pro /statistics.
-- 1) Vytvořen modul src/lib/statisticsHelpers.ts s čistými helpery:
--    parseYearFromISO, parseMonthFromISO, isInYear, buildDepartmentLabel,
--    computeAvgAttempts, formatAvgAttempts, formatStatCount.
--    Helpery jsou nyní jediným zdrojem pravdy pro:
--      • parsování roku/měsíce nezávislé na časovém pásmu (tabulky i grafy),
--      • mapování čitelného popisku oddělení v grafech,
--      • výpočet průměru pokusů emailů (0 místo 1 při prázdném datasetu).
-- 2) Statistics.tsx a EmailDeliveryStats.tsx byly refaktorovány tak, aby
--    používaly tyto helpery — sjednocení parsování dat napříč všemi tabulkami
--    i grafy (rok, měsíc, filtr, dropdown).
-- 3) Měsíční přehled (monthlyDistribution) nyní také parsuje měsíc bez
--    new Date() — odstraněn poslední TZ-citlivý bod na stránce.
-- 4) Empty state pro prázdný rok: pokud uživatel vybere rok, pro který nejsou
--    žádná školení, ale jiné roky data mají, zobrazí se nápověda „Zkuste vybrat
--    jiný rok / Všechny roky" místo generického „přidejte školení".
-- 5) Přidány vitest unit testy:
--      • src/test/statistics-regressions.test.ts — pokrývá všechny 3 bugy
--        z migrace 20260424140000 + parseMonthFromISO TZ edge cases.
--      • src/test/statistics-route-access.test.ts — pinuje matici
--        Admin/Manager/User × /statistics tak, aby budoucí změna guardů
--        v App.tsx / routeAccess.ts neuvolnila přístup pro běžné uživatele.
-- Žádné databázové změny nejsou potřeba.
SELECT 1;`,
  },
  {
    version: "20260424160000",
    name: "probation_period_tracking",
    sql: `-- Sledování zkušební doby zaměstnanců (Zákoník práce 2026: 4 měs. běžní / 8 měs. vedoucí)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS probation_end_date date,
  ADD COLUMN IF NOT EXISTS probation_months integer;

CREATE OR REPLACE FUNCTION public.is_managerial_position(_position text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $f$
  SELECT _position IS NOT NULL AND (
    LOWER(_position) LIKE '%vedouc%' OR LOWER(_position) LIKE '%manaž%' OR
    LOWER(_position) LIKE '%manag%' OR LOWER(_position) LIKE '%ředitel%' OR
    LOWER(_position) LIKE '%reditel%' OR LOWER(_position) LIKE '%head%' OR
    LOWER(_position) LIKE '%chief%' OR LOWER(_position) LIKE '%director%'
  )
$f$;

CREATE OR REPLACE FUNCTION public.calculate_probation_end_date()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $f$
DECLARE v_months integer;
BEGIN
  IF NEW.start_date IS NULL THEN NEW.probation_end_date := NULL; RETURN NEW; END IF;
  IF NEW.probation_months IS NOT NULL THEN v_months := NEW.probation_months;
  ELSIF public.is_managerial_position(NEW.position) THEN v_months := 8; NEW.probation_months := 8;
  ELSE v_months := 4; NEW.probation_months := 4; END IF;
  IF TG_OP = 'INSERT' AND NEW.probation_end_date IS NULL THEN
    NEW.probation_end_date := NEW.start_date + (v_months || ' months')::interval;
  ELSIF TG_OP = 'UPDATE' AND (
    OLD.start_date IS DISTINCT FROM NEW.start_date OR OLD.probation_months IS DISTINCT FROM NEW.probation_months
  ) AND (NEW.probation_end_date IS NULL OR NEW.probation_end_date = OLD.probation_end_date) THEN
    NEW.probation_end_date := NEW.start_date + (v_months || ' months')::interval;
  END IF;
  RETURN NEW;
END; $f$;

DROP TRIGGER IF EXISTS trg_calculate_probation_end_date ON public.employees;
CREATE TRIGGER trg_calculate_probation_end_date BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.calculate_probation_end_date();

CREATE INDEX IF NOT EXISTS idx_employees_probation_end_date
  ON public.employees(probation_end_date) WHERE probation_end_date IS NOT NULL AND status = 'employed';

CREATE OR REPLACE FUNCTION public.check_probation_period_endings()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_today date := CURRENT_DATE; v_warn date := CURRENT_DATE + INTERVAL '14 days';
  v_emp RECORD; v_admin RECORD; v_mgr_uid uuid;
  v_type text; v_title text; v_msg text; v_days int; v_exists int; v_total int := 0;
BEGIN
  FOR v_emp IN SELECT id, first_name, last_name, position, probation_end_date, manager_employee_id
    FROM public.employees WHERE status = 'employed'
      AND probation_end_date IS NOT NULL AND probation_end_date IN (v_today, v_warn)
  LOOP
    v_days := v_emp.probation_end_date - v_today;
    IF v_days = 0 THEN v_type := 'warning'; v_title := 'Konec zkušební doby DNES';
      v_msg := format('Zaměstnanci %s %s (%s) dnes končí zkušební doba.',
        v_emp.first_name, v_emp.last_name, COALESCE(v_emp.position, ''));
    ELSE v_type := 'info'; v_title := 'Zkušební doba končí za 14 dní';
      v_msg := format('Zaměstnanci %s %s (%s) končí zkušební doba %s.',
        v_emp.first_name, v_emp.last_name, COALESCE(v_emp.position, ''),
        to_char(v_emp.probation_end_date, 'DD.MM.YYYY'));
    END IF;
    FOR v_admin IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      SELECT COUNT(*) INTO v_exists FROM public.notifications
        WHERE user_id = v_admin.user_id AND related_entity_type = 'probation_period'
          AND related_entity_id = v_emp.id AND type = v_type AND created_at::date = v_today;
      IF v_exists = 0 THEN
        INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
        VALUES (v_admin.user_id, v_title, v_msg, v_type, 'probation_period', v_emp.id);
        v_total := v_total + 1;
      END IF;
    END LOOP;
    IF v_emp.manager_employee_id IS NOT NULL THEN
      SELECT id INTO v_mgr_uid FROM public.profiles WHERE employee_id = v_emp.manager_employee_id LIMIT 1;
      IF v_mgr_uid IS NOT NULL THEN
        SELECT COUNT(*) INTO v_exists FROM public.notifications
          WHERE user_id = v_mgr_uid AND related_entity_type = 'probation_period'
            AND related_entity_id = v_emp.id AND type = v_type AND created_at::date = v_today;
        IF v_exists = 0 THEN
          INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
          VALUES (v_mgr_uid, v_title, v_msg, v_type, 'probation_period', v_emp.id);
          v_total := v_total + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('notifications_created', v_total, 'run_at', now());
END; $f$;

UPDATE public.employees SET probation_months = CASE WHEN public.is_managerial_position(position) THEN 8 ELSE 4 END
  WHERE start_date IS NOT NULL AND probation_months IS NULL;
UPDATE public.employees SET probation_end_date = start_date + (probation_months || ' months')::interval
  WHERE start_date IS NOT NULL AND probation_end_date IS NULL AND probation_months IS NOT NULL;

DO $f$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('check-probation-period-endings-daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-probation-period-endings-daily');
    PERFORM cron.schedule('check-probation-period-endings-daily', '0 8 * * *',
      $cron$ SELECT public.check_probation_period_endings(); $cron$);
  END IF;
END $f$;`,
  },
  {
    version: "20260424180000",
    name: "probation_obstacles_and_audit",
    sql: `-- Tabulka překážek v práci během zkušební doby + audit triggery
-- (start_date, probation_months, probation_end_date, override, obstacles).
-- Manuální override v UI zachován; auto-přepočet uvažuje SUM dnů překážek.

CREATE OR REPLACE FUNCTION public.can_view_employee(_user_id uuid, _employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $f$
  SELECT _user_id IS NOT NULL AND public.is_user_approved(_user_id) AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR public.is_manager_of(_user_id, _employee_id)
    OR _employee_id = public.get_user_employee_id(_user_id)
  );
$f$;

CREATE TABLE IF NOT EXISTS public.probation_obstacles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date_from date NOT NULL,
  date_to date NOT NULL,
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT probation_obstacles_dates_chk CHECK (date_to >= date_from)
);
CREATE INDEX IF NOT EXISTS idx_probation_obstacles_employee ON public.probation_obstacles(employee_id);
ALTER TABLE public.probation_obstacles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View probation obstacles by employee visibility" ON public.probation_obstacles;
CREATE POLICY "View probation obstacles by employee visibility" ON public.probation_obstacles
  FOR SELECT USING (public.can_view_employee(auth.uid(), employee_id));

DROP POLICY IF EXISTS "Admins and managers can insert probation obstacles" ON public.probation_obstacles;
CREATE POLICY "Admins and managers can insert probation obstacles" ON public.probation_obstacles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND public.is_user_approved(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'manager'::app_role) AND public.is_manager_of(auth.uid(), employee_id))));

DROP POLICY IF EXISTS "Admins and managers can update probation obstacles" ON public.probation_obstacles;
CREATE POLICY "Admins and managers can update probation obstacles" ON public.probation_obstacles
  FOR UPDATE USING (public.is_user_approved(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'manager'::app_role) AND public.is_manager_of(auth.uid(), employee_id))));

DROP POLICY IF EXISTS "Admins and managers can delete probation obstacles" ON public.probation_obstacles;
CREATE POLICY "Admins and managers can delete probation obstacles" ON public.probation_obstacles
  FOR DELETE USING (public.is_user_approved(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'manager'::app_role) AND public.is_manager_of(auth.uid(), employee_id))));

CREATE OR REPLACE FUNCTION public.validate_probation_obstacles_no_overlap()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $f$
BEGIN
  IF EXISTS (SELECT 1 FROM public.probation_obstacles po
    WHERE po.employee_id = NEW.employee_id
      AND po.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NOT (po.date_to < NEW.date_from OR po.date_from > NEW.date_to)) THEN
    RAISE EXCEPTION 'Překážka se překrývá s jiným záznamem pro tohoto zaměstnance';
  END IF;
  RETURN NEW;
END; $f$;

DROP TRIGGER IF EXISTS trg_probation_obstacles_no_overlap ON public.probation_obstacles;
CREATE TRIGGER trg_probation_obstacles_no_overlap BEFORE INSERT OR UPDATE ON public.probation_obstacles
  FOR EACH ROW EXECUTE FUNCTION public.validate_probation_obstacles_no_overlap();

CREATE OR REPLACE FUNCTION public.sum_probation_obstacle_days(_employee_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $f$
  SELECT COALESCE(SUM((date_to - date_from) + 1), 0)::integer
  FROM public.probation_obstacles WHERE employee_id = _employee_id;
$f$;

CREATE OR REPLACE FUNCTION public.recalc_probation_end_after_obstacle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE emp_id uuid;
BEGIN
  emp_id := COALESCE(NEW.employee_id, OLD.employee_id);
  UPDATE public.employees SET updated_at = now() WHERE id = emp_id;
  RETURN NULL;
END; $f$;

DROP TRIGGER IF EXISTS trg_probation_obstacles_recalc ON public.probation_obstacles;
CREATE TRIGGER trg_probation_obstacles_recalc AFTER INSERT OR UPDATE OR DELETE ON public.probation_obstacles
  FOR EACH ROW EXECUTE FUNCTION public.recalc_probation_end_after_obstacle();

-- Přepočet konce ZD s ohledem na součet dnů překážek
CREATE OR REPLACE FUNCTION public.calculate_probation_end_date()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE default_months integer; obstacle_days integer; auto_end date;
BEGIN
  IF NEW.probation_months IS NULL THEN
    NEW.probation_months := CASE WHEN public.is_managerial_position(NEW.position) THEN 8 ELSE 4 END;
  END IF;
  IF NEW.start_date IS NULL THEN
    NEW.probation_end_date := NULL; NEW.probation_override_reason := NULL; RETURN NEW;
  END IF;
  obstacle_days := public.sum_probation_obstacle_days(NEW.id);
  auto_end := (NEW.start_date + (NEW.probation_months || ' months')::interval + (obstacle_days || ' days')::interval)::date;
  IF NEW.probation_end_date IS NULL OR NEW.probation_end_date = auto_end THEN
    NEW.probation_end_date := auto_end; NEW.probation_override_reason := NULL;
  END IF;
  RETURN NEW;
END; $f$;

-- Audit changes on employees probation fields → audit_logs (table_name='employees_probation')
CREATE OR REPLACE FUNCTION public.audit_employee_probation_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE changed text[] := ARRAY[]::text[]; actor_email text; actor_name text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN changed := array_append(changed, 'start_date'); END IF;
    IF OLD.probation_months IS DISTINCT FROM NEW.probation_months THEN changed := array_append(changed, 'probation_months'); END IF;
    IF OLD.probation_end_date IS DISTINCT FROM NEW.probation_end_date THEN changed := array_append(changed, 'probation_end_date'); END IF;
    IF OLD.probation_override_reason IS DISTINCT FROM NEW.probation_override_reason THEN changed := array_append(changed, 'probation_override_reason'); END IF;
    IF array_length(changed, 1) IS NULL THEN RETURN NEW; END IF;
    SELECT email, (first_name || ' ' || last_name) INTO actor_email, actor_name FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_email, user_name)
    VALUES ('employees_probation', NEW.id, 'UPDATE',
      jsonb_build_object('start_date', OLD.start_date, 'probation_months', OLD.probation_months,
        'probation_end_date', OLD.probation_end_date, 'probation_override_reason', OLD.probation_override_reason),
      jsonb_build_object('start_date', NEW.start_date, 'probation_months', NEW.probation_months,
        'probation_end_date', NEW.probation_end_date, 'probation_override_reason', NEW.probation_override_reason),
      changed, auth.uid(), actor_email, actor_name);
  END IF;
  RETURN NEW;
END; $f$;

DROP TRIGGER IF EXISTS trg_audit_employee_probation ON public.employees;
CREATE TRIGGER trg_audit_employee_probation AFTER UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.audit_employee_probation_changes();

CREATE OR REPLACE FUNCTION public.audit_probation_obstacles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE actor_email text; actor_name text; rec_id uuid; action_name text;
BEGIN
  SELECT email, (first_name || ' ' || last_name) INTO actor_email, actor_name FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'DELETE' THEN rec_id := OLD.id; action_name := 'DELETE';
  ELSE rec_id := NEW.id; action_name := TG_OP; END IF;
  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_email, user_name)
  VALUES ('probation_obstacles', rec_id, action_name,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object('employee_id', OLD.employee_id, 'date_from', OLD.date_from, 'date_to', OLD.date_to, 'reason', OLD.reason) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object('employee_id', NEW.employee_id, 'date_from', NEW.date_from, 'date_to', NEW.date_to, 'reason', NEW.reason) END,
    ARRAY['date_from','date_to','reason']::text[], auth.uid(), actor_email, actor_name);
  RETURN COALESCE(NEW, OLD);
END; $f$;

DROP TRIGGER IF EXISTS trg_audit_probation_obstacles ON public.probation_obstacles;
CREATE TRIGGER trg_audit_probation_obstacles AFTER INSERT OR UPDATE OR DELETE ON public.probation_obstacles
  FOR EACH ROW EXECUTE FUNCTION public.audit_probation_obstacles();

DROP TRIGGER IF EXISTS trg_probation_obstacles_updated_at ON public.probation_obstacles;
CREATE TRIGGER trg_probation_obstacles_updated_at BEFORE UPDATE ON public.probation_obstacles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();`,
  },
  {
    version: "20260424170000",
    name: "probation_override_reason",
    sql: `-- Důvod ručního přepsání data konce zkušební doby
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS probation_override_reason text;

COMMENT ON COLUMN public.employees.probation_override_reason IS
  'Důvod ručního přepsání data konce zkušební doby (povinné při manuální úpravě, např. překážky v práci dle ZP 2026)';

-- Aktualizace triggeru: vyčistí důvod při auto-přepočtu
CREATE OR REPLACE FUNCTION public.calculate_probation_end_date()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $f$
DECLARE
  v_months integer;
  v_auto_end date;
BEGIN
  IF NEW.start_date IS NULL THEN
    NEW.probation_end_date := NULL;
    NEW.probation_override_reason := NULL;
    RETURN NEW;
  END IF;

  IF NEW.probation_months IS NOT NULL THEN v_months := NEW.probation_months;
  ELSIF public.is_managerial_position(NEW.position) THEN v_months := 8; NEW.probation_months := 8;
  ELSE v_months := 4; NEW.probation_months := 4; END IF;

  v_auto_end := NEW.start_date + (v_months || ' months')::interval;

  IF TG_OP = 'INSERT' THEN
    IF NEW.probation_end_date IS NULL THEN
      NEW.probation_end_date := v_auto_end;
      NEW.probation_override_reason := NULL;
    ELSIF NEW.probation_end_date = v_auto_end THEN
      NEW.probation_override_reason := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.start_date IS DISTINCT FROM NEW.start_date OR OLD.probation_months IS DISTINCT FROM NEW.probation_months)
       AND (NEW.probation_end_date IS NULL OR NEW.probation_end_date = OLD.probation_end_date) THEN
      NEW.probation_end_date := v_auto_end;
      NEW.probation_override_reason := NULL;
    ELSIF NEW.probation_end_date = v_auto_end THEN
      NEW.probation_override_reason := NULL;
    END IF;
  END IF;

  RETURN NEW;
END; $f$;`,
  },
  {
    version: "20260424190000",
    name: "probations_compact_view_and_adaptive_preview",
    sql: `-- UI-only změny:
--   • /probations: přepínač pro zobrazení bez záložek (jen přehled)
--   • FilePreviewDialog: adaptivní rozměry dialogu podle formátu (PDF/obrázek)
--   • Vitest kontrakty pro RLS audit_logs a probation_obstacles
-- Žádná změna databázového schématu.
SELECT 1;`,
  },
  {
    version: "20260424200000",
    name: "user_preferences_table",
    sql: `-- Per-user UI preferences synced across devices.
-- Client uses localStorage as a cache; this table is the source of truth.
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete their own preferences"
  ON public.user_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();`,
  },
  {
    version: "20260424210000",
    name: "probation_deeplinks_and_notification_routing",
    sql: `-- UI-only změny:
--   • /probations: klikací řádky + tlačítko „Upravit ZD" otevře editaci zaměstnance
--     a scrollne přímo na sekci „Zkušební doba" (?edit=<id>&focus=probation)
--   • Employees: deep-link handler v useEffect (useSearchParams), id="probation-section"
--   • NotificationBell: kliknutí na notifikaci routuje podle related_entity_type
--     (probation_period → /employees?edit=<empId>&focus=probation)
--   • Popover „Kde najdu ZD" rozšířen o tip ke klikání řádků
-- Žádná změna databázového schématu (využívá stávající related_entity_type='probation_period').
SELECT 1;`,
  },
  {
    version: "20260424220000",
    name: "notification_filter_and_hierarchy_tree_filter",
    sql: `-- UI-only změny:
--   • NotificationBell: filtr podle kategorie (ZD / Školení / Lhůty / PLP / Ostatní)
--     + přepínač „jen nepřečtené"; badge počtů per kategorie z lokálních dat.
--   • EmployeeHierarchyTree: skrývá zaměstnance se status='terminated' a „povyšuje"
--     jejich podřízené pod nejbližšího aktivního manažera (řetězení nahoru).
--     Plochý přehled zaměstnanců (status='all'/'terminated') zůstává nezměněn –
--     bývalý nadřízený je tedy stále vidí v seznamu (RLS: is_manager_of dle
--     manager_employee_id, který se při ukončení nemaže).
-- Žádná změna databázového schématu.
SELECT 1;`,
  },
  {
    version: "20260424230000",
    name: "notification_action_button_and_tree_hint",
    sql: `-- UI-only změny:
--   • NotificationBell: explicitní akční tlačítko ("Otevřít ZD zaměstnance" /
--     "Otevřít školení" / "Otevřít lhůtu" / "Otevřít PLP") v každé notifikaci
--     vedle časového razítka. Stav nepřečtených je persistovaný v notifications.is_read
--     (server-side, cross-device přes existující RLS).
--   • EmployeeHierarchyTree: info banner "Skryto N ukončených" + nápověda,
--     jak je dohledat v tabulkovém zobrazení (filtr stavu = Ukončený / Všichni).
--     RLS is_manager_of zachovává přístup bývalého nadřízeného.
--   • Employees deep-link (?edit=<id>&focus=probation):
--     - ResizeObserver na #probation-section + window resize listener,
--     - re-scroll a obnova ring-highlight při změně velikosti / responsivního layoutu.
--   • Validace override "Konec ZD": probíhá přes superRefine v zod schema +
--     existující DB trigger trg_audit_employee_probation zapisuje JEDEN konzistentní
--     audit_logs záznam (table_name='employees_probation') s old/new pro všechna
--     4 ZD pole (start_date, probation_months, probation_end_date, probation_override_reason)
--     a polem changed_fields. Žádná schema změna není potřeba.
--   • Export ZD do CSV/PDF (vč. sloupců Datum nástupu, Konec ZD, Důvod úpravy)
--     je již implementován na /probations.
SELECT 1;`,
  },
  {
    version: "20260424235000",
    name: "notification_filters_cross_device_persistence",
    sql: `-- UI-only změna (žádné schema):
--   • NotificationBell filtry (kategorie ZD/Školení/Lhůty/PLP/Ostatní + "Jen nepřečtené")
--     se nyní ukládají do tabulky public.user_preferences přes useUserPreferences hook,
--     takže se přenášejí napříč zařízeními.
--   • Stav nepřečtených notifikací per kategorie je řízen sloupcem notifications.is_read,
--     který je v DB od počátku — agregace per kategorie probíhá na klientovi z DB záznamů,
--     takže je konzistentní napříč zařízeními bez nutnosti nové tabulky.
--   • ZD notifikace (check_probation_period_endings): běží denně přes pg_cron,
--     generuje 14-denní (info) a 0-denní (warning) notifikace pro adminy a přímého
--     manažera, s deduplikací per den. Žádná změna není potřeba.
SELECT 1;`,
  },
  {
    version: "20260424240000",
    name: "auditlog_probation_labels_and_filters",
    sql: `-- UI-only změna (žádné DB schema):
--   • AuditLog.tsx: přidány lokalizované labely pro tabulky 'employees_probation',
--     'probation_obstacles', 'deadlines', 'medical_examinations'.
--   • Field labels rozšířeny o ZD pole: start_date, probation_months,
--     probation_end_date, probation_override_reason, date_from, date_to, reason.
--   • formatChangeDetails formátuje datumová pole dd.MM.yyyy a override reason
--     se zobrazuje plně (i prázdná hodnota "—") pro tři scénáře:
--       (1) ruční úprava end_date,
--       (2) zadání/změna probation_override_reason,
--       (3) změna start_date / probation_months → trigger zachytí všechna
--           změněná pole v jednom audit_logs záznamu (changed_fields).
--   • Filtr "Tabulka" v AuditLogu nyní zahrnuje Zkušební dobu, Překážky v ZD,
--     Technické události, PLP — admin si může vyfiltrovat jen ZD audit.
--   • Historie ZD je dohledatelná na třech místech:
--       (a) /probations záložka "Historie" (filtr na 'employees_probation' a 'probation_obstacles'),
--       (b) /audit-log s filtrem tabulky,
--       (c) DB triggery trg_audit_employee_probation + trg_audit_probation_obstacles
--           zapisují JEDEN konzistentní záznam per UPDATE napříč všemi vstupy
--           (formulář editace zaměstnance, hromadné úpravy, override end_date).
SELECT 1;`,
  },
  {
    version: "20260424250000",
    name: "ui_simplified_matrix_export_and_import_buttons",
    sql: `-- UI-only změna (žádné DB schema):
--   • Maticový export školení (ScheduledTrainings → "Matice") nyní obsahuje pouze
--     sloupec "Zaměstnanec" + sloupce typů školení s ✓ (má) / prázdné (nemá).
--     Odstraněny sloupce Středisko, Pozice, Stav, Nadřízený a souhrnný řádek.
--   • PLP přehled (ScheduledExaminations → "Přehled") nyní obsahuje pouze:
--     Zaměstnanec | Datum prohlídky | Konec platnosti | Typ prohlídky |
--     Kategorie práce | Zdravotní rizika | Výsledek | Poznámka.
--   • Z tlačítek Export/Import odstraněn suffix s formátem (CSV/XLSX).
--     Formát se nyní zobrazuje pouze jako tooltip při najetí myší (HTML title attr).
--   • Z bulk importů (Školení, PLP, Zařízení, Tech. lhůty, Zaměstnanci) odstraněna
--     tlačítka "Šablona CSV / XLSX" — uživatelé používají export jako šablonu
--     díky obousměrné kompatibilitě hlaviček (export → editace → import).
SELECT 1;`,
  },
  {
    version: "20260424260000",
    name: "ui_unified_filters_and_equipment_export_responsibles",
    sql: `-- UI-only změna (žádné DB schema):
--   • PLP filtry (ScheduledExaminations) rozšířeny o "Výsledek" a "Kategorie práce".
--     Sjednocené filtry napříč rolemi: stejné UI, různý obsah dle RLS
--     (admin = vše, manager = podřízení, user = vlastní).
--   • Export Zařízení (Equipment) obsahuje nový sloupec "Odpovědné osoby"
--     jako e-maily oddělené středníkem (";") pro round-trip kompatibilitu
--     s BulkEquipmentImport (který tyto e-maily mapuje na profily).
--     Sloupec "Odpovědná osoba" zůstává zachován (volný text — legacy).
--   • Z hlavních seznamů (Equipment, ScheduledTrainings, ScheduledDeadlines,
--     ScheduledExaminations) odstraněna manuální tlačítka "Obnovit" — všechny
--     hooky využívají Supabase realtime kanály a aktualizují se automaticky
--     při INSERT/UPDATE/DELETE. Tlačítka zůstávají v sekcích bez realtime
--     (Historie, Administrace migrací, SystemStatus, PendingUsersPanel).
--   • useAdvancedFilters: backward-compatible — uložené filtry z localStorage
--     se doplní o nová pole resultFilter/workCategoryFilter s hodnotou "all".
SELECT 1;`,
  },
  {
    version: "20260424270000",
    name: "ui_unified_csv_only_import_export",
    sql: `-- UI-only změna (žádné DB schema):
--   • Sjednocení formátu souborů pro import i export napříč všemi moduly:
--     POUZE CSV (středník ";", UTF-8 s BOM, Excel-kompatibilní).
--   • Odstraněna podpora XLSX/XLS pro vstup u všech bulk importů
--     (Employees, Equipment, Trainings, Medical, Deadlines, Types).
--   • Maticový export (ScheduledTrainings = "Matice", ScheduledExaminations
--     = "Přehled") převeden z XLSX na CSV. Funkce v src/lib/matrixExport.ts
--     nyní používají Papa.unparse; aliasy downloadTrainingMatrixXLSX a
--     downloadPLPDetailXLSX zachovány pro zpětnou kompatibilitu volání.
--   • Chybové exporty z bulk importů (chyby_import_*.csv) sjednoceny na CSV.
--   • Tlačítka "Export XLSX" odstraněna; zůstává jen jediné "Export chyb".
--   • Tooltipy ("title") všech import/export tlačítek nyní popisují formát:
--     "Formát: CSV (středník, UTF-8)".
--   • Realtime aktualizace ověřeny — všechny hlavní hooky (useEmployees,
--     useTrainings, useMedicalExaminations, useDeadlines, useEquipment)
--     mají aktivní postgres_changes subscriptions a invalidují cache
--     automaticky při INSERT/UPDATE/DELETE bez nutnosti manuálního refresh.
SELECT 1;`,
  },
  {
    version: "20260424280000",
    name: "ui_unified_filename_filters_legend_refresh",
    sql: `-- UI-only změna (žádné DB schema):
--   • Nový helper src/lib/exportFilename.ts (buildExportFilename) — všechny
--     CSV exporty/chybové soubory napříč moduly nyní používají jednotný
--     název ve formátu "{modul}_{YYYY-MM-DD}.csv" (UTF-8 BOM, ; delimiter).
--   • Bulk importy (Employees, Equipment, Trainings, Medical) sjednoceny:
--     tlačítko jen "Import" + tooltip CSV_IMPORT_TOOLTIP, chybové soubory
--     pojmenovány "{modul}-chyby_{YYYY-MM-DD}.csv".
--   • Maticové exporty (Trainings, PLP) doplněny o LEGENDU symbolů přímo
--     do hlavního CSV listu: ✓ platné, ⚠ brzy vyprší, ✗ prošlé, — chybí.
--     Symbol "warning" v matici nyní rozlišen od "ok" (dříve oba ✓).
--   • Sdílený helper src/lib/importValidation.ts (checkRequiredHeaders,
--     downloadErrorCSV, ImportErrorRow) pro per-řádkové chyby s odkazem.
--   • Nová komponenta src/components/RefreshButton.tsx (záložní mechanismus
--     k Realtime, použitelný napříč všemi přehledy).
--   • useAdvancedFilters rozšířen o setDefaultFilter (★ označení výchozího
--     filtru) + auto-perzistenci posledního stavu filtrů (per-user, localStorage).
--     AdvancedFilters UI: hvězdička pro toggle výchozího, tooltips na
--     akčních ikonách badge.
--   • Souhrnné (weekly) připomínky se v UI skryjí — zůstává jen per-záznam
--     (alert) konfigurace; edge funkce a logy zachovány pro historii,
--     pg_cron joby uživatel deaktivuje samostatně přes Cloud.
SELECT 1;`,
  },
  {
    version: "20260424300000",
    name: "ui_summary_reminders_hidden_and_refresh_button",
    sql: `-- UI-only změny – databázové schéma se neupravuje.
-- 
-- Tato migrace dokumentuje:
--   • Skrytí UI souhrnných (weekly) připomínek v Administraci → Připomínky
--     a v Administraci → Emaily & Šablony. Edge funkce (run-reminders,
--     run-deadline-reminders, run-medical-reminders) zůstávají nasazené
--     pro historii, ale uživatel je v UI nevidí. Per-záznam (alert)
--     připomínky zůstávají plně funkční.
--   • Tlačítko „Znovu načíst" (RefreshButton) přidáno do hlavních přehledů
--     (Equipment, ScheduledTrainings, ScheduledExaminations,
--     ScheduledDeadlines, Employees) jako záložní mechanismus k Realtime.
--   • Propagace volby výchozího filtru (★) napříč všemi stránkami
--     používajícími AdvancedFilters: DeadlineHistory, History,
--     ScheduledDeadlines, ScheduledExaminations, ScheduledTrainings.
--     Hook useAdvancedFilters již obsahuje setDefaultFilter +
--     auto-perzistenci posledního stavu (per-user localStorage).
SELECT 1;`,
  },
  {
    version: "20260424320000",
    name: "ui_bulk_import_header_validation",
    sql: `-- UI-only změna – databázové schéma se neupravuje.
--
-- Sjednocená validace hlaviček CSV ve všech bulk importech:
--   • BulkEmployeeImport (Jméno, Příjmení, Email, Pozice)
--   • BulkEquipmentImport (Inventární číslo, Název, Typ zařízení, Provozovna)
--   • BulkTrainingImport (Typ školení, Provozovna, Datum školení)
--   • BulkMedicalImport (Typ prohlídky, Provozovna, Datum prohlídky)
--   • BulkDeadlineImport (Typ události, Provozovna, Datum kontroly + Inventární číslo, Název pro Equipment)
--
-- Při chybějících povinných sloupcích se zobrazí toast/error s konkrétním
-- výčtem chybějících hlaviček a doporučením stáhnout vzorovou šablonu.
-- Funkcionalita per-row chybové reporty + export chyb (downloadErrorCSV)
-- již existuje v src/lib/importValidation.ts a pokrývá všechny moduly.
SELECT 1;`,
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
