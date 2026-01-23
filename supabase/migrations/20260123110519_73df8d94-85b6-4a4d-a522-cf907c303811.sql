-- Add soft-delete column to trainings table
ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient filtering of non-deleted records
CREATE INDEX IF NOT EXISTS idx_trainings_deleted_at ON public.trainings(deleted_at) WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.trainings.deleted_at IS 'Timestamp when the training was soft-deleted/archived. NULL means active record.';

-- Update the log_training_changes function to track deleted_at changes
CREATE OR REPLACE FUNCTION public.log_training_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
  changed_fields TEXT[];
  old_json JSONB;
  new_json JSONB;
BEGIN
  -- Získat informace o uživateli
  SELECT 
    p.email,
    p.first_name || ' ' || p.last_name as full_name
  INTO user_profile
  FROM public.profiles p
  WHERE p.id = auth.uid();

  -- Detekce změněných polí při UPDATE
  IF TG_OP = 'UPDATE' THEN
    changed_fields := ARRAY[]::TEXT[];
    
    IF OLD.facility IS DISTINCT FROM NEW.facility THEN
      changed_fields := array_append(changed_fields, 'facility');
    END IF;
    IF OLD.employee_id IS DISTINCT FROM NEW.employee_id THEN
      changed_fields := array_append(changed_fields, 'employee_id');
    END IF;
    IF OLD.training_type_id IS DISTINCT FROM NEW.training_type_id THEN
      changed_fields := array_append(changed_fields, 'training_type_id');
    END IF;
    IF OLD.last_training_date IS DISTINCT FROM NEW.last_training_date THEN
      changed_fields := array_append(changed_fields, 'last_training_date');
    END IF;
    IF OLD.next_training_date IS DISTINCT FROM NEW.next_training_date THEN
      changed_fields := array_append(changed_fields, 'next_training_date');
    END IF;
    IF OLD.trainer IS DISTINCT FROM NEW.trainer THEN
      changed_fields := array_append(changed_fields, 'trainer');
    END IF;
    IF OLD.company IS DISTINCT FROM NEW.company THEN
      changed_fields := array_append(changed_fields, 'company');
    END IF;
    IF OLD.note IS DISTINCT FROM NEW.note THEN
      changed_fields := array_append(changed_fields, 'note');
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      changed_fields := array_append(changed_fields, 'status');
    END IF;
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      changed_fields := array_append(changed_fields, 'is_active');
    END IF;
    -- Track deleted_at (archive/unarchive) changes
    IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
      changed_fields := array_append(changed_fields, 'deleted_at');
    END IF;
  END IF;

  -- Příprava dat pro log
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := to_jsonb(NEW);
  ELSE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
  END IF;

  -- Zápis do audit logu
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    user_email,
    user_name,
    changed_fields
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    old_json,
    new_json,
    auth.uid(),
    user_profile.email,
    user_profile.full_name,
    changed_fields
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;