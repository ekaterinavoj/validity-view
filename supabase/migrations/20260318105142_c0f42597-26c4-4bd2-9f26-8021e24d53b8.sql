ALTER TABLE public.medical_examinations
ADD COLUMN IF NOT EXISTS zdravotni_rizika jsonb NOT NULL DEFAULT jsonb_build_object(
  'pracovni_poloha', null,
  'celkova_fyzicka_zatez', null,
  'hluk', null,
  'vibrace_prenesene_na_ruce', null,
  'zrakova_zatez', null,
  'ultrafialove_zareni', null
);

COMMENT ON COLUMN public.medical_examinations.zdravotni_rizika IS 'Zdravotní rizika pro lékařskou prohlídku: pracovni_poloha, celkova_fyzicka_zatez, hluk, vibrace_prenesene_na_ruce, zrakova_zatez, ultrafialove_zareni';