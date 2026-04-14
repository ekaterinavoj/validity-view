
-- Remove the overly broad triggers that fire on ANY update
DROP TRIGGER IF EXISTS recalculate_training_dates_on_type_change ON public.training_types;
DROP TRIGGER IF EXISTS recalculate_medical_dates_on_type_change ON public.medical_examination_types;
DROP TRIGGER IF EXISTS recalculate_deadline_dates_on_type_change ON public.deadline_types;
