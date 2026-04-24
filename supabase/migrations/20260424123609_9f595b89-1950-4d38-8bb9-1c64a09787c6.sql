CREATE OR REPLACE FUNCTION public.validate_probation_obstacles_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.probation_obstacles po
    WHERE po.employee_id = NEW.employee_id
      AND po.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NOT (po.date_to < NEW.date_from OR po.date_from > NEW.date_to)
  ) THEN
    RAISE EXCEPTION 'Překážka se překrývá s jiným záznamem pro tohoto zaměstnance';
  END IF;
  RETURN NEW;
END;
$$;