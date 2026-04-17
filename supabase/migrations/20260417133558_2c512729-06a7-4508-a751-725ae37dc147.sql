-- Make equipment_id optional on deadlines so we can record general inspections
-- that are not tied to a specific piece of equipment.
ALTER TABLE public.deadlines
  ALTER COLUMN equipment_id DROP NOT NULL;
