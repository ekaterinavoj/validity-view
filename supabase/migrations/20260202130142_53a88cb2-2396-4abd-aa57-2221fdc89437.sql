-- Phase 1a: Add viewer role to enum (must be separate transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';