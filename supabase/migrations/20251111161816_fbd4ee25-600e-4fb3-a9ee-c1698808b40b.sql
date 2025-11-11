-- Přidat sloupec notes do tabulky employees
ALTER TABLE public.employees 
ADD COLUMN notes text;

-- Vytvořit trigger pro automatické nastavení poznámky u ukončených zaměstnanců
CREATE OR REPLACE FUNCTION public.set_termination_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Když se změní status na terminated, nastavit poznámku
  IF NEW.status = 'terminated' AND NEW.termination_date IS NOT NULL THEN
    NEW.notes = 'Ukončen ke dni ' || TO_CHAR(NEW.termination_date, 'DD.MM.YYYY');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger pro automatické nastavení poznámky
CREATE TRIGGER set_termination_note_trigger
  BEFORE INSERT OR UPDATE OF status, termination_date ON public.employees
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_termination_note();

-- Trigger pro přepočítání statusu školení při aktivaci zaměstnance
CREATE OR REPLACE FUNCTION public.recalculate_training_status_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Když se změní status na employed (aktivní), přepočítat status všech školení
  IF NEW.status = 'employed' AND OLD.status != 'employed' THEN
    UPDATE public.trainings
    SET status = calculate_training_status(next_training_date)
    WHERE employee_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger pro přepočítání statusu školení
CREATE TRIGGER recalculate_training_status_trigger
  AFTER UPDATE OF status ON public.employees
  FOR EACH ROW 
  EXECUTE FUNCTION public.recalculate_training_status_on_activation();