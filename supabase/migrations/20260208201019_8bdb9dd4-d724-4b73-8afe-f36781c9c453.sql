-- Drop the old check constraint
ALTER TABLE public.user_module_access DROP CONSTRAINT user_module_access_module_check;

-- Add new check constraint with all three modules
ALTER TABLE public.user_module_access 
ADD CONSTRAINT user_module_access_module_check 
CHECK (module = ANY (ARRAY['trainings'::text, 'deadlines'::text, 'plp'::text]));