-- Migration: 20260330_fix_profiles_insert_policy.sql
-- Add INSERT policy to profiles table to allow users to create their own profile rows

BEGIN;

-- Add INSERT policy for profiles (allow users to insert their own profile only)
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

COMMIT;
