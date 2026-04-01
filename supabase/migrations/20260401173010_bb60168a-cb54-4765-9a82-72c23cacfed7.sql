
-- Attach recalculate triggers to type tables (functions already exist)

CREATE TRIGGER recalculate_training_dates_on_type_change
AFTER UPDATE ON public.training_types
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_training_dates_on_type_change();

CREATE TRIGGER recalculate_deadline_dates_on_type_change
AFTER UPDATE ON public.deadline_types
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_deadline_dates_on_type_change();

CREATE TRIGGER recalculate_medical_dates_on_type_change
AFTER UPDATE ON public.medical_examination_types
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_medical_dates_on_type_change();
