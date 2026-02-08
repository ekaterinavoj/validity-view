-- Add column to track when non-employed status started
ALTER TABLE public.employees
ADD COLUMN status_start_date date;

-- Set default value for existing records with termination_date
UPDATE public.employees 
SET status_start_date = termination_date 
WHERE status = 'terminated' AND termination_date IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.employees.status_start_date IS 'Date when the current status started (for parental_leave, sick_leave, terminated)';