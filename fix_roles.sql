-- FIX ROLES CONSTRAINT
-- The previous setup script enforced roles to be ONLY 'Artist', 'Producer', or 'Fan'.
-- But the App uses 'singer', 'musician', etc.
-- This script removes that restriction so you can sign up freely.

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;
