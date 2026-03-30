-- Migration: 20260327_fix_campaign_members_policy.sql
-- Fix campaign_members SELECT policy to avoid recursive policy evaluation.

BEGIN;

DROP POLICY IF EXISTS "Users can select campaign members for campaigns they're in or their own membership" ON public.campaign_members;

CREATE POLICY "Users can select own membership only"
  ON public.campaign_members FOR SELECT
  USING (
    user_id = auth.uid()
  );

COMMIT;
