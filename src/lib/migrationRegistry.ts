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
