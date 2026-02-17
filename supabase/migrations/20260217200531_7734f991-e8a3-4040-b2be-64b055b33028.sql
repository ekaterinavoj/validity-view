
-- Table to track applied migrations
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL UNIQUE,
  name text NOT NULL,
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  checksum text
);

-- No RLS needed - only service_role accesses this
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- Only admins can view migration history
CREATE POLICY "Only admins can view migrations"
  ON public.schema_migrations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
