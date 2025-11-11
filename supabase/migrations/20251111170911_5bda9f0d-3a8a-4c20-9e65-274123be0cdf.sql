-- Vytvoření tabulky pro audit log
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  user_name TEXT,
  changed_fields TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pro rychlejší vyhledávání
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Pouze admin a manager mohou číst audit log
CREATE POLICY "Admins and managers can view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Audit logy se zapisují automaticky přes trigger (security definer funkce)
-- Nikdo nemůže ručně vkládat, upravovat nebo mazat audit logy
CREATE POLICY "No manual modifications to audit logs"
ON public.audit_logs
FOR ALL
USING (false);

-- Funkce pro logování změn v trainings tabulce
CREATE OR REPLACE FUNCTION public.log_training_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Triggery pro automatické logování změn
CREATE TRIGGER training_audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.trainings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_training_changes();

-- Funkce pro logování změn v user_roles tabulce (změny rolí)
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
  target_user_profile RECORD;
  old_json JSONB;
  new_json JSONB;
BEGIN
  -- Získat informace o uživateli který provádí změnu
  SELECT 
    p.email,
    p.first_name || ' ' || p.last_name as full_name
  INTO user_profile
  FROM public.profiles p
  WHERE p.id = auth.uid();

  -- Získat informace o cílovém uživateli
  SELECT 
    p.email,
    p.first_name || ' ' || p.last_name as full_name
  INTO target_user_profile
  FROM public.profiles p
  WHERE p.id = COALESCE(NEW.user_id, OLD.user_id);

  -- Příprava dat pro log
  IF TG_OP = 'DELETE' THEN
    old_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'role', OLD.role
    );
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'role', NEW.role
    );
  ELSE
    old_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'role', OLD.role
    );
    new_json := jsonb_build_object(
      'user_email', target_user_profile.email,
      'user_name', target_user_profile.full_name,
      'role', NEW.role
    );
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
    'user_roles',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    old_json,
    new_json,
    auth.uid(),
    user_profile.email,
    user_profile.full_name,
    ARRAY['role']
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger pro logování změn rolí
CREATE TRIGGER user_roles_audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_changes();

-- Povolit realtime pro audit_logs (pro live aktualizace v UI)
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;