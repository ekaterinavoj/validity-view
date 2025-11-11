-- Vytvořit trigger pro automatické přiřazení role při registraci
-- Trigger se spustí po vytvoření nového profilu
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_role();

-- Pokud už trigger existuje, nejprve ho smažeme a vytvoříme znovu
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;