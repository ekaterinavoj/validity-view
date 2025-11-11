-- Přidat pole duration_hours do tabulky training_types
ALTER TABLE public.training_types
ADD COLUMN duration_hours DECIMAL(5,2) DEFAULT 1.0;

COMMENT ON COLUMN public.training_types.duration_hours IS 'Délka trvání školení v hodinách';

-- Aktualizovat existující typy školení s typickými hodnotami
UPDATE public.training_types
SET duration_hours = CASE
  WHEN name ILIKE '%BOZP%' THEN 2.0
  WHEN name ILIKE '%první pomoc%' OR name ILIKE '%HSE%' OR name ILIKE '%REA%' THEN 4.0
  WHEN name ILIKE '%výšk%' THEN 8.0
  WHEN name ILIKE '%jeřáb%' OR name ILIKE '%VZV%' OR name ILIKE '%řidič%' THEN 16.0
  ELSE 2.0
END
WHERE duration_hours IS NULL OR duration_hours = 1.0;