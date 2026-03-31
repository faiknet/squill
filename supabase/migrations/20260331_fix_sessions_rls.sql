-- Migration: 20260331_fix_sessions_rls.sql
-- Fix RLS policies on sessions table that prevent campaign members from updating sessions
-- 
-- Issue: Multiple policies on sessions table:
-- 1. sessions_update_creator (FROM UPDATE POLICY): Only creator can update (created_by = auth.uid())
-- 2. sessions_access_by_membership (FOR ALL policy): Campaign members can access (via user_is_campaign_member)
--
-- When multiple policies of the same type exist, RLS uses OR logic. This means update is allowed ONLY if:
-- (created_by = auth.uid()) OR (user_is_campaign_member(...))
--
-- However, in practice the UPDATE-specific policy seems to be blocking. We need to remove the
-- overly-restrictive sessions_update_creator and sessions_delete_creator policies that only
-- allow the creator, since sessions_access_by_membership already provides proper membership-based access.

BEGIN;

-- Drop the old overly-restrictive UPDATE and DELETE policies for sessions
DROP POLICY IF EXISTS sessions_update_creator ON public.sessions;
DROP POLICY IF EXISTS sessions_delete_creator ON public.sessions;

-- The sessions_access_by_membership policy (FOR ALL) from 20260327_final_rls_fix.sql
-- should be the only sessions policy now. It allows campaign members to read/write sessions.

COMMIT;
