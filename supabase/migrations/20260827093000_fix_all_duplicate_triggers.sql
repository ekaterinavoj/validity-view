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
