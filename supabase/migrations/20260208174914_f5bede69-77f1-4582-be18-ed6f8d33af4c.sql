-- Add work_category column to employees table
ALTER TABLE public.employees 
ADD COLUMN work_category integer CHECK (work_category >= 1 AND work_category <= 4);

-- Add comment for documentation
COMMENT ON COLUMN public.employees.work_category IS 'Kategorie práce 1-4 dle rizikovosti (1=nejnižší, 4=nejvyšší)';