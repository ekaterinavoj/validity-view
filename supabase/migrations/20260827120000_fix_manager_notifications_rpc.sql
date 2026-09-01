-- "Notifikace nadřízeným" (manager notification emails) for Školení and PLP
-- was silently sending to nobody, ever. send-training-reminders and
-- run-medical-reminders call public.get_subordinate_employee_ids(...) using
-- the service-role key (no end-user JWT), so auth.uid() is NULL inside that
-- function. Its own access check reads:
--
--   IF NOT has_role(auth.uid(), 'admin') THEN
--     IF root_employee_id IS DISTINCT FROM (SELECT employee_id FROM profiles WHERE id = auth.uid()) THEN
--       RETURN;  -- empty
--     END IF;
--   END IF;
--
-- auth.uid() = NULL, has_role(NULL, 'admin') = false, and the subquery with
-- "WHERE id = NULL" matches nothing, so root_employee_id is always "distinct
-- from NULL" and the function always returns an empty set for any manager,
-- for every single scheduled run. That check is correct and necessary when a
-- logged-in user calls this RPC from the frontend (e.g. equipment responsible
-- pickers) — it must not be loosened there. Instead, add a second, equivalent
-- function with no auth.uid() gate, and restrict who can call it at the
-- database privilege level to service_role only (i.e. only trusted backend
-- edge functions authenticated with the service role key — never a logged-in
-- user's own token).

CREATE OR REPLACE FUNCTION public.get_subordinate_employee_ids_for_service(root_employee_id uuid)
RETURNS TABLE(employee_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT e.id, 0 AS depth
    FROM public.employees e
    WHERE e.id = root_employee_id
    UNION
    SELECT e2.id, t.depth + 1
    FROM public.employees e2
    JOIN tree t ON e2.manager_employee_id = t.id
    WHERE t.depth < 20
  )
  SELECT tree.id FROM tree;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_subordinate_employee_ids_for_service(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_subordinate_employee_ids_for_service(uuid) TO service_role;
