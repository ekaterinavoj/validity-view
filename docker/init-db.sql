-- =============================================
-- Database Initialization Script
-- Pro self-hosted PostgreSQL nasazení
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'manager', 'user', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- Note: Pro kompletní schéma databáze
-- použijte migrace ze složky supabase/migrations/
-- =============================================

-- Placeholder tables (nahraďte plným schématem z migrací)
-- Tyto tabulky jsou pouze pro demonstraci struktury

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    position TEXT,
    department_id UUID,
    employee_id UUID,
    approval_status TEXT NOT NULL DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID
);

-- System settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Facilities table
CREATE TABLE IF NOT EXISTS public.facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- IMPORTANT: Pro plné schéma databáze
-- 
-- Spusťte migrace ze složky supabase/migrations/
-- v pořadí podle jejich timestampů:
--
-- psql -d training_system -f supabase/migrations/YYYYMMDD...sql
--
-- Nebo použijte Supabase CLI:
-- supabase db push
-- =============================================

-- Create default admin user (update with real values)
-- INSERT INTO public.profiles (id, email, first_name, last_name, approval_status)
-- VALUES ('your-admin-uuid', 'admin@example.com', 'Admin', 'User', 'approved');

-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('your-admin-uuid', 'admin');

COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users';
COMMENT ON TABLE public.user_roles IS 'User role assignments';
COMMENT ON TABLE public.system_settings IS 'System-wide configuration settings';
