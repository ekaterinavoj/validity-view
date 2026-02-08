-- Drop the restrictive check constraint on audit_logs.action
-- The action field should allow any descriptive action names like 'REGISTRATION_PENDING', 'USER_APPROVED', etc.
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;