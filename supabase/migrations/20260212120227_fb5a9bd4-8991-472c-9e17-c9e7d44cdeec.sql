-- Partial unique index: each employee can be linked to at most one profile
CREATE UNIQUE INDEX IF NOT EXISTS profiles_employee_id_unique 
ON public.profiles (employee_id) 
WHERE employee_id IS NOT NULL;