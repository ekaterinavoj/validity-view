-- RPC pro security scan: vrátí tabulky v public schématu, kde RLS je vypnutá
-- nebo neexistuje žádná RLS politika. Volat smí pouze admini.
CREATE OR REPLACE FUNCTION public.security_scan_rls_coverage()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Pouze admini
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled,
    COALESCE(p.cnt, 0)::integer AS policy_count,
    CASE
      WHEN NOT c.relrowsecurity THEN 'rls_disabled'
      WHEN COALESCE(p.cnt, 0) = 0 THEN 'no_policies'
      ELSE 'ok'
    END AS status
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN (
    SELECT polrelid, COUNT(*) AS cnt
    FROM pg_policy
    GROUP BY polrelid
  ) p ON p.polrelid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE 'pg_%'
  ORDER BY
    CASE
      WHEN NOT c.relrowsecurity THEN 0
      WHEN COALESCE(p.cnt, 0) = 0 THEN 1
      ELSE 2
    END,
    c.relname;
END;
$$;

REVOKE ALL ON FUNCTION public.security_scan_rls_coverage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.security_scan_rls_coverage() TO authenticated;