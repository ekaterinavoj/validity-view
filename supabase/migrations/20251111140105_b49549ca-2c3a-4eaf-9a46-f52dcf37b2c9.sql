-- Přidání sloupce is_active do trainings tabulky
ALTER TABLE public.trainings 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Vytvoření indexu pro rychlejší dotazy
CREATE INDEX idx_trainings_is_active ON public.trainings(is_active);
CREATE INDEX idx_trainings_employee_active ON public.trainings(employee_id, is_active);

-- Funkce pro aktualizaci is_active podle statusu zaměstnance
CREATE OR REPLACE FUNCTION public.update_training_active_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Když se změní status zaměstnance
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Deaktivovat školení pro neaktivní statusy
    IF NEW.status IN ('parental_leave', 'sick_leave', 'terminated') THEN
      UPDATE public.trainings
      SET is_active = false
      WHERE employee_id = NEW.id;
    -- Aktivovat školení pro aktivní status
    ELSIF NEW.status = 'employed' THEN
      UPDATE public.trainings
      SET is_active = true
      WHERE employee_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger na employees tabulce
CREATE TRIGGER trigger_update_training_active_status
AFTER UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_training_active_status();

-- Nastavit is_active podle aktuálního statusu zaměstnanců
UPDATE public.trainings t
SET is_active = CASE 
  WHEN e.status IN ('parental_leave', 'sick_leave', 'terminated') THEN false
  ELSE true
END
FROM public.employees e
WHERE t.employee_id = e.id;

-- Přidat komentáře pro dokumentaci
COMMENT ON COLUMN public.trainings.is_active IS 'Určuje, zda je školení aktivní. Automaticky se mění podle statusu zaměstnance (deaktivováno pro: rodičovská dovolená, nemocenská, již nepracuje)';
COMMENT ON FUNCTION public.update_training_active_status() IS 'Automaticky aktualizuje is_active pro všechna školení zaměstnance při změně jeho statusu';