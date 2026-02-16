
-- Use DROP IF EXISTS + CREATE pattern for all triggers

-- profiles triggers
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;
CREATE TRIGGER on_profile_created_assign_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

DROP TRIGGER IF EXISTS on_profile_created_grant_modules ON public.profiles;
CREATE TRIGGER on_profile_created_grant_modules
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_default_modules();

DROP TRIGGER IF EXISTS on_profile_approval_change ON public.profiles;
CREATE TRIGGER on_profile_approval_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_approval_changes();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles triggers
DROP TRIGGER IF EXISTS prevent_last_admin_removal ON public.user_roles;
CREATE TRIGGER prevent_last_admin_removal
  BEFORE DELETE OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_removal();

DROP TRIGGER IF EXISTS on_role_change ON public.user_roles;
CREATE TRIGGER on_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_role_changes();

-- user_module_access triggers
DROP TRIGGER IF EXISTS on_module_access_change ON public.user_module_access;
CREATE TRIGGER on_module_access_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_module_access
  FOR EACH ROW EXECUTE FUNCTION public.log_module_access_changes();

-- trainings triggers
DROP TRIGGER IF EXISTS on_training_change ON public.trainings;
CREATE TRIGGER on_training_change
  AFTER INSERT OR UPDATE OR DELETE ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION public.log_training_changes();

DROP TRIGGER IF EXISTS update_trainings_updated_at ON public.trainings;
CREATE TRIGGER update_trainings_updated_at
  BEFORE UPDATE ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- employees triggers
DROP TRIGGER IF EXISTS on_employee_status_change_trainings ON public.employees;
CREATE TRIGGER on_employee_status_change_trainings
  AFTER UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_training_active_status();

DROP TRIGGER IF EXISTS on_employee_activation_trainings ON public.employees;
CREATE TRIGGER on_employee_activation_trainings
  AFTER UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_training_status_on_activation();

DROP TRIGGER IF EXISTS on_employee_status_change_medical ON public.employees;
CREATE TRIGGER on_employee_status_change_medical
  AFTER UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_medical_examination_active_status();

DROP TRIGGER IF EXISTS on_employee_activation_medical ON public.employees;
CREATE TRIGGER on_employee_activation_medical
  AFTER UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_examination_status_on_activation();

DROP TRIGGER IF EXISTS on_employee_termination ON public.employees;
CREATE TRIGGER on_employee_termination
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_termination_note();

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- equipment triggers
DROP TRIGGER IF EXISTS on_equipment_status_change_deadlines ON public.equipment;
CREATE TRIGGER on_equipment_status_change_deadlines
  AFTER UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_deadline_active_status();

DROP TRIGGER IF EXISTS update_equipment_updated_at ON public.equipment;
CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- deadlines triggers
DROP TRIGGER IF EXISTS update_deadlines_updated_at ON public.deadlines;
CREATE TRIGGER update_deadlines_updated_at
  BEFORE UPDATE ON public.deadlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- medical_examinations triggers
DROP TRIGGER IF EXISTS update_medical_examinations_updated_at ON public.medical_examinations;
CREATE TRIGGER update_medical_examinations_updated_at
  BEFORE UPDATE ON public.medical_examinations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- system_settings triggers
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- responsibility_groups triggers
DROP TRIGGER IF EXISTS update_responsibility_groups_updated_at ON public.responsibility_groups;
CREATE TRIGGER update_responsibility_groups_updated_at
  BEFORE UPDATE ON public.responsibility_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
