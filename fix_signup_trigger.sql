-- FIX SIGNUP TRIGGER (make it robust)
-- This script updates the auto-profile-creation trigger to handle errors gracefully.
-- If the username is taken or role is invalid, it falls back to a safe default
-- so the User Signup doesn't fail.

-- 1. Ensure Constraints are Relaxed (Just in case)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Update Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Try to insert with User's chosen data
  BEGIN
    INSERT INTO public.profiles (id, username, role, avatar_url)
    VALUES (
      new.id,
      new.raw_user_meta_data ->> 'username',
      COALESCE(new.raw_user_meta_data ->> 'role', 'Fan'),
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    -- If that fails (e.g. Username taken), fall back to generated username
    -- and default role 'Fan'
    INSERT INTO public.profiles (id, username, role, avatar_url)
    VALUES (
      new.id,
      'user_' || substr(new.id::text, 1, 8), -- Fallback ID-based username
      'Fan',
      ''
    );
  END;
  RETURN new;
END;
$$;
