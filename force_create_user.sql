-- FORCE CREATE USER
-- Run this in Supabase SQL Editor to manually create a user.
-- Use this to verify if the Database is working, bypassing the App.

-- 1. Enable Encryption Extension
create extension if not exists pgcrypto;

-- 2. Insert User (auth.users)
-- Email: test@jamwave.com
-- Password: password123
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test@jamwave.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "TestUser", "role": "Producer"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Note: The 'handle_new_user' trigger should run automatically and create the Profile.
