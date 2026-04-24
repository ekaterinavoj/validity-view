-- Grant usage on public schema to auth admin role
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Grant permissions on tables that triggers touch during user creation/login
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_access TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invites TO supabase_auth_admin;
GRANT SELECT, INSERT ON public.audit_logs TO supabase_auth_admin;
GRANT SELECT ON public.system_settings TO supabase_auth_admin;

-- Grant execute on functions used by auth triggers
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.assign_default_role() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.grant_default_modules() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.get_registration_mode() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.is_email_allowed(text) TO supabase_auth_admin;

-- Grant on sequences (needed for INSERT operations)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- Ensure future objects also get permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT USAGE, SELECT ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT EXECUTE ON FUNCTIONS TO supabase_auth_admin;