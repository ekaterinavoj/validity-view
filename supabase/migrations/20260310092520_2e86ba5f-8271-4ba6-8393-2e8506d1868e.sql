
-- Drop existing CHECK constraint on work_category
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_work_category_check;

-- Change column type from integer to text
ALTER TABLE public.employees ALTER COLUMN work_category TYPE text USING work_category::text;

-- Add new CHECK constraint for valid categories (1, 2, 2R, 3, 4)
ALTER TABLE public.employees ADD CONSTRAINT employees_work_category_check 
  CHECK (work_category IN ('1', '2', '2R', '3', '4'));

COMMENT ON COLUMN public.employees.work_category IS 'Kategorie práce: 1, 2, 2R, 3, 4 dle rizikovosti';
