ALTER TABLE public.equipment DROP CONSTRAINT IF EXISTS equipment_inventory_number_key;
DROP INDEX IF EXISTS public.equipment_inventory_number_key;
CREATE INDEX IF NOT EXISTS equipment_inventory_number_idx ON public.equipment (inventory_number);