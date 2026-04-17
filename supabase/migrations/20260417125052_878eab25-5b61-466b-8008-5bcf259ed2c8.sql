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
AS $function$
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
$function$;

-- Update archive trigger for deadlines analogously
CREATE OR REPLACE FUNCTION public.archive_deadline_before_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;