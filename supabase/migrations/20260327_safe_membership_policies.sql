-- Migration: 20260327_safe_membership_policies.sql
-- Add back membership-based visibility using LEFT JOIN to avoid recursion

BEGIN;

-- Drop the overly restrictive policies
DROP POLICY IF EXISTS campaigns_select_creator ON public.campaigns;
DROP POLICY IF EXISTS sessions_select_creator ON public.sessions;

-- CAMPAIGNS: Allow select if user created it OR is a member
-- This avoids recursion by using a subquery that doesn't trigger campaign_members SELECT policy
CREATE POLICY campaigns_select_member_or_creator ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT campaign_id FROM public.campaign_members WHERE user_id = auth.uid()
    )
  );

-- SESSIONS: Allow select if user has access to the campaign
-- Again using IN subquery to avoid policy recursion
CREATE POLICY sessions_select_by_membership ON public.sessions FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns
      WHERE created_by = auth.uid()
         OR id IN (SELECT campaign_id FROM public.campaign_members WHERE user_id = auth.uid()
        )
    )
  );

COMMIT;
