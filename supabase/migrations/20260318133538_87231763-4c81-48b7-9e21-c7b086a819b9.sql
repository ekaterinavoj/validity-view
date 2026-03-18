ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS period_days_override INTEGER;

ALTER TABLE public.medical_examinations
ADD COLUMN IF NOT EXISTS period_days_override INTEGER;

ALTER TABLE public.deadlines
ADD COLUMN IF NOT EXISTS period_days_override INTEGER;