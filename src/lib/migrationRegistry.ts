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
    version: "20260331120200",
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

  // ===== Added in this session (2026-08-27): reminder cadence overhaul,
  //      duplicate-trigger fixes, self-hosted bug fixes =====
  {
    version: "20260827090000",
    name: "periodic_age_milestone_check",
    sql: `
-- The existing notify_employee_age_50() trigger only fires on INSERT/UPDATE of the
-- employees row itself. In practice an employee record is rarely touched exactly on
-- their birthday, so the notification silently never fires for most people who turn 50.
-- This adds a callable, idempotent function that re-checks ALL active employees and can
-- be invoked from a daily/hourly job (see run-medical-reminders), independent of any
-- write to the employees table.

CREATE OR REPLACE FUNCTION public.check_employee_age_milestones()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
  emp_record RECORD;
  emp_name TEXT;
  emp_age INT;
  notified_count INT := 0;
BEGIN
  FOR emp_record IN
    SELECT id, first_name, last_name, birth_date
    FROM public.employees
    WHERE birth_date IS NOT NULL
      AND status = 'employed'
  LOOP
    emp_age := EXTRACT(YEAR FROM age(CURRENT_DATE, emp_record.birth_date));

    IF emp_age = 50 THEN
      -- Dedup: skip if a notification was already created for this employee
      IF EXISTS (
        SELECT 1 FROM public.notifications
        WHERE related_entity_type = 'employee_age_50'
          AND related_entity_id = emp_record.id
      ) THEN
        CONTINUE;
      END IF;

      emp_name := emp_record.first_name || ' ' || emp_record.last_name;

      FOR admin_record IN
        SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
      LOOP
        INSERT INTO public.notifications (
          user_id, title, message, type, related_entity_type, related_entity_id
        ) VALUES (
          admin_record.user_id,
          'Zaměstnanec dosáhl věku 50 let',
          'Zaměstnanec ' || emp_name || ' dosáhl věku 50 let. Podle platné legislativy ' ||
          '(vyhláška č. 79/2013 Sb., o pracovnělékařských službách) se u zaměstnanců ' ||
          'vykonávajících práci zařazenou do kategorie 2 a vyšší od tohoto věku zkracuje ' ||
          'interval pravidelných lékařských prohlídek. Zkontrolujte prosím zařazení do ' ||
          'rizikové kategorie a v případě potřeby naplánujte mimořádnou lékařskou prohlídku ' ||
          'a upravte periodicitu dalších prohlídek.',
          'warning',
          'employee_age_50',
          emp_record.id
        );
      END LOOP;

      notified_count := notified_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('employees_notified', notified_count, 'checked_at', now());
END;
$function$;

-- Keep the write-time trigger in sync with the same, more informative message text so
-- both paths (immediate trigger + daily periodic check) read identically.
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
        'Zaměstnanec ' || emp_name || ' dosáhl věku 50 let. Podle platné legislativy ' ||
        '(vyhláška č. 79/2013 Sb., o pracovnělékařských službách) se u zaměstnanců ' ||
        'vykonávajících práci zařazenou do kategorie 2 a vyšší od tohoto věku zkracuje ' ||
        'interval pravidelných lékařských prohlídek. Zkontrolujte prosím zařazení do ' ||
        'rizikové kategorie a v případě potřeby naplánujte mimořádnou lékařskou prohlídku ' ||
        'a upravte periodicitu dalších prohlídek.',
        'warning',
        'employee_age_50',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
    `.trim(),
  },
  {
    version: "20260827091500",
    name: "fix_duplicate_default_role_trigger",
    sql: `
-- CRITICAL FIX: two triggers on public.profiles both call assign_default_role()
-- after every INSERT:
--   - assign_default_role_on_signup   (created 2025-11-11, never removed)
--   - on_profile_created_assign_role  (created 2026-02-16 to harden search_path,
--                                       the author assumed it was renaming the
--                                       trigger above but only dropped its own
--                                       older copy, leaving both attached)
--
-- assign_default_role() does a plain INSERT INTO public.user_roles(user_id, role)
-- with no ON CONFLICT clause. With both triggers firing for the same row, the
-- second call always hits the (user_id, role) unique constraint and raises an
-- exception — which aborts the profiles INSERT itself. handle_new_user() catches
-- that, retries a minimal insert, hits the same duplicate trigger again, and
-- gives up silently (RAISE WARNING only). Net effect: every new user (self-signup
-- AND admin-created) ends up with an auth.users row but NO profiles row, so they
-- can log in but see nothing and cannot be approved/managed from the UI.

DROP TRIGGER IF EXISTS assign_default_role_on_signup ON public.profiles;

-- Defense in depth: make the function idempotent regardless of how many times
-- (or from how many trigger names) it ends up firing for the same user/role.
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_exists BOOLEAN;
  reg_mode text;
  invite_record RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  ) INTO admin_exists;

  IF NOT admin_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles SET approval_status = 'approved', approved_at = now() WHERE id = NEW.id;

    RAISE NOTICE 'First user registered - assigned admin role to user %', NEW.id;
    RETURN NEW;
  END IF;

  reg_mode := get_registration_mode();

  SELECT * INTO invite_record
  FROM public.user_invites
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_record.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invite_record.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.user_invites
    SET status = 'used', used_at = now(), used_by = NEW.id
    WHERE id = invite_record.id;

    UPDATE public.profiles
    SET approval_status = 'approved', approved_at = now(), approved_by = invite_record.invited_by
    WHERE id = NEW.id;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
    VALUES ('user_invites', invite_record.id, 'INVITE_USED',
      jsonb_build_object('email', NEW.email, 'role', invite_record.role, 'invited_by', invite_record.invited_by),
      NEW.email, COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

    RAISE NOTICE 'User % registered via invite with role %', NEW.id, invite_record.role;
    RETURN NEW;
  END IF;

  IF reg_mode = 'invite_only' THEN
    RAISE NOTICE 'User % registered in invite-only mode without invite - pending approval', NEW.id;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'User % registered in self-signup mode - pending approval', NEW.id;
  END IF;

  INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_email, user_name)
  VALUES ('profiles', NEW.id, 'REGISTRATION_PENDING',
    jsonb_build_object('email', NEW.email, 'mode', reg_mode),
    NEW.email, COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

  RETURN NEW;
END;
$function$;
    `.trim(),
  },
  {
    version: "20260827093000",
    name: "fix_all_duplicate_triggers",
    sql: `
-- Systemic cleanup: the same mistake found in the profiles trigger (two trigger
-- names both calling the same function on the same table/event, from a migration
-- that re-created triggers under a "hardened" name but forgot to drop the older
-- one) exists on 12 tables. Most calls are idempotent (recompute the same value),
-- but a few insert audit_logs / notifications rows and were firing TWICE per
-- change (confirmed: seeded trainings had exactly 2x the expected audit_logs
-- rows). This drops the redundant/legacy trigger in each pair, keeping exactly
-- one attachment per function per table.

-- Type -> record date recalculation on period_days change (semafor/expiration
-- propagation for Školení / Technické události / PLP). Both triggers are
-- idempotent, but keep only the narrower one (fires on period_days change only).
DROP TRIGGER IF EXISTS recalculate_training_dates_on_type_change ON public.training_types;
DROP TRIGGER IF EXISTS recalculate_deadline_dates_on_type_change ON public.deadline_types;
DROP TRIGGER IF EXISTS recalculate_medical_dates_on_type_change ON public.medical_examination_types;

-- Employee status/activation side-effects on trainings, deadlines, medical exams
DROP TRIGGER IF EXISTS recalculate_training_status_trigger ON public.employees;
DROP TRIGGER IF EXISTS recalculate_examination_status_on_activation_trigger ON public.employees;
DROP TRIGGER IF EXISTS trigger_update_training_active_status ON public.employees;
DROP TRIGGER IF EXISTS update_medical_examination_active_status_trigger ON public.employees;

-- Equipment status -> deadline active-status propagation
DROP TRIGGER IF EXISTS update_deadlines_on_equipment_status ON public.equipment;

-- Audit logging (was writing two identical rows per change)
DROP TRIGGER IF EXISTS training_audit_log_trigger ON public.trainings;
DROP TRIGGER IF EXISTS log_module_access_changes ON public.user_module_access;
DROP TRIGGER IF EXISTS user_roles_audit_log_trigger ON public.user_roles;

-- Last-admin-removal safety check (redundant, not harmful, but wasteful)
DROP TRIGGER IF EXISTS prevent_last_admin_trigger ON public.user_roles;
    `.trim(),
  },
  {
    version: "20260827094500",
    name: "drop_equipment_inventory_number_uniqueness",
    sql: `
-- The hard UNIQUE constraint on equipment.inventory_number blocked legitimate
-- cases where two genuinely different pieces of equipment share the same
-- inventory number (e.g. numbering reused per facility, or numbers assigned by
-- an external system the company doesn't fully control). There was no way to
-- enter such equipment through the UI at all — the insert was rejected outright.
--
-- Duplicate detection already happens at the application layer where it
-- actually matters (bulk import, see src/components/BulkEquipmentImport.tsx),
-- using a composite key of inventory_number + name + equipment_type +
-- manufacturer + serial_number — i.e. equipment only counts as "the same
-- record" when ALL of those match, not just the inventory number.

ALTER TABLE public.equipment DROP CONSTRAINT IF EXISTS equipment_inventory_number_key;
    `.trim(),
  },
  {
    version: "20260827100000",
    name: "unify_reminder_cadence",
    sql: `
-- Reminders were previously sent using inconsistent logic per module:
--   - trainings/medical: resent every \`repeat_days_after\` days continuously,
--     starting the moment a record entered its remind_days_before window (so a
--     30-day-before warning kept repeating every N days all the way through
--     expiration too, not just once).
--   - deadlines: had NO per-record deduplication at all — every time the
--     function ran and found deadlines in-window, it re-sent the full digest
--     (and the individual "responsible person" emails) again, every time,
--     regardless of \`repeat_days_after\`.
--
-- This adds a \`reminder_stage\` column so each module can track, per record,
-- whether the one-shot "before" and "due" reminders were already sent, and
-- when the last repeating "overdue" reminder went out — see
-- supabase/functions/_shared/reminder-cadence.ts for the actual scheduling
-- logic now shared by all three reminder functions.

ALTER TABLE public.reminder_logs ADD COLUMN IF NOT EXISTS reminder_stage TEXT
  CHECK (reminder_stage IS NULL OR reminder_stage IN ('before', 'due', 'overdue'));

ALTER TABLE public.deadline_reminder_logs ADD COLUMN IF NOT EXISTS reminder_stage TEXT
  CHECK (reminder_stage IS NULL OR reminder_stage IN ('before', 'due', 'overdue'));

ALTER TABLE public.medical_reminder_logs ADD COLUMN IF NOT EXISTS reminder_stage TEXT
  CHECK (reminder_stage IS NULL OR reminder_stage IN ('before', 'due', 'overdue'));

CREATE INDEX IF NOT EXISTS idx_reminder_logs_training_stage ON public.reminder_logs (training_id, reminder_stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deadline_reminder_logs_deadline_stage ON public.deadline_reminder_logs (deadline_id, reminder_stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_reminder_logs_exam_stage ON public.medical_reminder_logs (examination_id, reminder_stage, created_at DESC);

-- "Type" tables get their own default reminder timing so new records can be
-- pre-filled consistently instead of everyone independently starting at the
-- hardcoded 30/30 default. NULL means "no type-level default configured yet",
-- in which case the app falls back to the existing per-record default (30).
ALTER TABLE public.training_types ADD COLUMN IF NOT EXISTS default_remind_days_before INTEGER;
ALTER TABLE public.training_types ADD COLUMN IF NOT EXISTS default_repeat_days_after INTEGER;

ALTER TABLE public.deadline_types ADD COLUMN IF NOT EXISTS default_remind_days_before INTEGER;
ALTER TABLE public.deadline_types ADD COLUMN IF NOT EXISTS default_repeat_days_after INTEGER;

ALTER TABLE public.medical_examination_types ADD COLUMN IF NOT EXISTS default_remind_days_before INTEGER;
ALTER TABLE public.medical_examination_types ADD COLUMN IF NOT EXISTS default_repeat_days_after INTEGER;

-- The weekly "run-reminders" digest duplicated/overlapped with the per-record
-- send-training-reminders function and is being retired in favor of the
-- module-specific reminders. Soft-disable it via its existing settings flag
-- rather than deleting the function outright, so it stays available if ever
-- needed again.
UPDATE public.system_settings
SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{enabled}', 'false'::jsonb)
WHERE key = 'reminder_frequency';
    `.trim(),
  },
  {
    version: "20260827110000",
    name: "wire_medical_reminder_templates",
    sql: `
-- medical_reminder_templates already existed (with a working admin UI under
-- Administrace → Emaily & Šablony → Šablony individuálních připomínek → PLP,
-- and a real FK from medical_examinations.reminder_template_id) but the actual
-- run-medical-reminders function never read from it — it only used the
-- system_settings "medical_email_template" blob. Editing a PLP template in
-- that UI silently had no effect on what was actually sent.
--
-- run-medical-reminders now reads its base subject/body from this table (see
-- supabase/functions/run-medical-reminders/index.ts), matching how trainings
-- and deadlines already work, with the settings blob kept as an optional
-- override on top (same pattern as deadlines).
--
-- Seed one active template from whatever was configured in the settings blob,
-- so existing configurations keep working instead of silently reverting to
-- the hardcoded default text.
INSERT INTO public.medical_reminder_templates (name, email_subject, email_body, is_active)
SELECT
  'Výchozí šablona (migrováno z nastavení)',
  COALESCE(s.value->>'subject', 'Souhrn lékařských prohlídek - {reportDate}'),
  COALESCE(s.value->>'body', 'Dobrý den,' || E'\n\n' || 'zasíláme přehled lékařských prohlídek vyžadujících pozornost.' || E'\n\n' || 'Celkem: {totalCount}' || E'\n' || '- Brzy vypršuje: {expiringCount}' || E'\n' || '- Prošlé: {expiredCount}'),
  true
FROM (SELECT 1) AS one_row
LEFT JOIN public.system_settings s ON s.key = 'medical_email_template'
WHERE NOT EXISTS (SELECT 1 FROM public.medical_reminder_templates);
    `.trim(),
  },
  {
    version: "20260827120000",
    name: "fix_manager_notifications_rpc",
    sql: `
-- "Notifikace nadřízeným" (manager notification emails) for Školení and PLP
-- was silently sending to nobody, ever. send-training-reminders and
-- run-medical-reminders call public.get_subordinate_employee_ids(...) using
-- the service-role key (no end-user JWT), so auth.uid() is NULL inside that
-- function. Its own access check reads:
--
--   IF NOT has_role(auth.uid(), 'admin') THEN
--     IF root_employee_id IS DISTINCT FROM (SELECT employee_id FROM profiles WHERE id = auth.uid()) THEN
--       RETURN;  -- empty
--     END IF;
--   END IF;
--
-- auth.uid() = NULL, has_role(NULL, 'admin') = false, and the subquery with
-- "WHERE id = NULL" matches nothing, so root_employee_id is always "distinct
-- from NULL" and the function always returns an empty set for any manager,
-- for every single scheduled run. That check is correct and necessary when a
-- logged-in user calls this RPC from the frontend (e.g. equipment responsible
-- pickers) — it must not be loosened there. Instead, add a second, equivalent
-- function with no auth.uid() gate, and restrict who can call it at the
-- database privilege level to service_role only (i.e. only trusted backend
-- edge functions authenticated with the service role key — never a logged-in
-- user's own token).

CREATE OR REPLACE FUNCTION public.get_subordinate_employee_ids_for_service(root_employee_id uuid)
RETURNS TABLE(employee_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT e.id, 0 AS depth
    FROM public.employees e
    WHERE e.id = root_employee_id
    UNION
    SELECT e2.id, t.depth + 1
    FROM public.employees e2
    JOIN tree t ON e2.manager_employee_id = t.id
    WHERE t.depth < 20
  )
  SELECT tree.id FROM tree;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_subordinate_employee_ids_for_service(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_subordinate_employee_ids_for_service(uuid) TO service_role;
    `.trim(),
  },
  {
    version: "20260827125000",
    name: "fix_graphql_event_trigger_ddl_scope",
    sql: `
-- Fix: issue_pg_graphql_access event trigger fired on EVERY ddl_command_end (no TAG
-- filter), instead of being scoped to 'CREATE FUNCTION' like the other issue_pg_*
-- event triggers (compare issue_pg_cron_access -> 'CREATE SCHEMA', issue_pg_net_access
-- -> 'CREATE EXTENSION'). Its function, grant_pg_graphql_access(), assigns the result of
--   SELECT n.proname = 'resolve' FROM pg_event_trigger_ddl_commands() ev LEFT JOIN pg_proc n ON ev.objid = n.oid
-- into a single boolean, which requires pg_event_trigger_ddl_commands() to return at
-- most one row. Any DDL command that creates more than one catalog object in a single
-- command - e.g. CREATE TABLE with an inline PRIMARY KEY, which creates both the table
-- and its supporting unique index - made that subquery return multiple rows, raising
-- "more than one row returned by a subquery used as an expression" and aborting the
-- whole statement/transaction.
--
-- This silently blocked ANY migration containing a plain CREATE TABLE ... PRIMARY KEY
-- (such as the very next migration, access_debug_tools), and because apply-migrations
-- stops at the first error in a batch, every migration after it was left permanently
-- pending too. This migration MUST stay ordered before access_debug_tools.
--
-- Re-scoping the trigger to CREATE FUNCTION (its actual intent: react when
-- graphql.resolve is (re)created) preserves the original behaviour while no longer
-- firing on unrelated DDL like CREATE TABLE/INDEX/POLICY.
DROP EVENT TRIGGER IF EXISTS issue_pg_graphql_access;
CREATE EVENT TRIGGER issue_pg_graphql_access
  ON ddl_command_end
  WHEN TAG IN ('CREATE FUNCTION')
  EXECUTE PROCEDURE extensions.grant_pg_graphql_access();
    `.trim(),
  },
  {
    version: "20260827130000",
    name: "access_debug_tools",
    sql: `
-- RLS diagnostic tooling (backported from a later app version):
--   - employee_access_logs: best-effort audit trail of who listed/viewed employees
--   - debug_employee_visibility(uuid): admin-only "what would this user see and why"
--   - debug_medical_document_access(uuid): same, for medical examination documents
-- Intentionally does NOT touch any real RLS policy or the audit_logs table —
-- these are read-only diagnostic helpers, not behavior changes.

-- 1) Audit log table for employees reads
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
ON public.employee_access_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users can insert their access logs" ON public.employee_access_logs;
CREATE POLICY "Authenticated users can insert their access logs"
ON public.employee_access_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND action IN ('list', 'detail', 'inactive_list', 'export')
  AND (rows_returned IS NULL OR rows_returned BETWEEN 0 AND 100000)
);

DROP POLICY IF EXISTS "Admins can delete employee access logs" ON public.employee_access_logs;
CREATE POLICY "Admins can delete employee access logs"
ON public.employee_access_logs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Debug RPC: which employees would the given user see and why?
DROP FUNCTION IF EXISTS public.debug_employee_visibility(uuid);

CREATE OR REPLACE FUNCTION public.debug_employee_visibility(_target_user_id uuid)
RETURNS TABLE(
  employee_id uuid,
  employee_name text,
  employee_email text,
  reason text,
  policy_name text,
  policy_branch text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    RETURN QUERY
      SELECT
        e.id,
        (e.first_name || ' ' || e.last_name),
        e.email,
        'admin: full access'::text,
        'Role-based employee visibility'::text,
        'has_role(auth.uid(), ''admin'')'::text
      FROM public.employees e
      ORDER BY e.last_name;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
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
    WHERE e.id = own_employee
       OR public.is_manager_of(_target_user_id, e.id)
    ORDER BY e.last_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.debug_employee_visibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_employee_visibility(uuid) TO authenticated;

-- 3) Debug RPC: which medical documents would the given user see and why?
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
    `.trim(),
  },
  {
    version: "20260827150000",
    name: "allow_independent_long_term_fitness_loss",
    sql: `
-- Allow long_term_fitness_loss_date to be set for ANY result, not only 'lost_long_term'.
-- The date is now treated as an independent fact: an employee can be 'passed' AND have
-- lost long-term fitness for a different, specific activity (e.g. after returning from
-- sick leave). This is NOT an invalid examination — it's a doctor's note that must stay
-- visible (see the "Současně pozbyl(a) dlouhodobě zdravotní způsobilosti" checkbox in
-- NewMedicalExamination/EditMedicalExamination and the additional badge in ResultBadge/
-- ScheduledExaminations).
--
-- The previous trigger (20260318175404) forced this column to NULL whenever
-- result != 'lost_long_term', which blocked the combined flow entirely.
CREATE OR REPLACE FUNCTION public.validate_medical_examination_result_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Legacy behaviour: if the main result is still the old 'lost_long_term' value,
  -- the date remains mandatory.
  IF NEW.result = 'lost_long_term' AND NEW.long_term_fitness_loss_date IS NULL THEN
    RAISE EXCEPTION 'long_term_fitness_loss_date is required when result = lost_long_term';
  END IF;

  -- The date is now allowed independently for any result — do NOT clear it any more.
  RETURN NEW;
END;
$function$;

    `.trim(),
  },
  {
    version: "20260827200000",
    name: "fix_storage_admin_role_grants",
    sql: `
-- Fix: supabase_storage_admin was missing membership in anon/authenticated/service_role.
--
-- storage-api (the Supabase Storage service) connects to Postgres as
-- supabase_storage_admin and, on every request, issues \`set_config('role', <jwt role>, true)\`
-- to switch into whichever role the caller's JWT claims (anon / authenticated / service_role)
-- before evaluating RLS on storage.objects/storage.buckets. That role switch is a plain
-- Postgres \`SET ROLE\`, which requires supabase_storage_admin to be a member of the target role.
--
-- On this instance that membership was missing (only \`authenticator\`, used by PostgREST,
-- had it), so every storage.object upload and every signed-URL request failed with
-- "new row violates row-level security policy" / 42501 (Postgres's error for a denied
-- SET ROLE, mis-reported by storage-api as an RLS violation) - regardless of bucket,
-- file type, or caller. This broke general-document uploads (Dokumenty) and was also the
-- likely cause of attached PDFs failing to preview in production (signed URL creation for
-- the PDF viewer went through the same broken path).
GRANT anon, authenticated, service_role TO supabase_storage_admin;
    `.trim(),
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
