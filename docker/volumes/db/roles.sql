-- NOTE: change to your own passwords for production environments
-- POSTGRES_PASSWORD is passed as env variable to the db container
\set pgpass `echo "$POSTGRES_PASSWORD"`

-- Set passwords for all service roles
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_functions_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';

-- Also set for supabase_admin if needed
ALTER USER supabase_admin WITH PASSWORD :'pgpass';
