
-- Add result column to trainings table
ALTER TABLE public.trainings 
ADD COLUMN result text DEFAULT 'passed';

-- Add result column to deadlines table
ALTER TABLE public.deadlines 
ADD COLUMN result text DEFAULT 'passed';

-- Add comment: result values are 'passed', 'passed_with_reservations', 'failed'
COMMENT ON COLUMN public.trainings.result IS 'Training result: passed, passed_with_reservations, failed';
COMMENT ON COLUMN public.deadlines.result IS 'Deadline result: passed (compliant), passed_with_reservations, failed (non_compliant)';
