-- Add original_record_id column to track version history
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
  EXECUTE FUNCTION archive_medical_exam_before_edit();