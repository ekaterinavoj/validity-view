-- Make employee_number nullable (optional field)
ALTER TABLE public.employees ALTER COLUMN employee_number DROP NOT NULL;
ALTER TABLE public.employees ALTER COLUMN employee_number SET DEFAULT '';