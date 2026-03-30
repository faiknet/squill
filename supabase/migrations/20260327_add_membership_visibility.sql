-- Migration: 20260327_add_membership_visibility.sql
-- Add RPC functions for membership-based queries without RLS recursion

BEGIN;

-- Function to get campaigns user is member of or created
CREATE OR REPLACE FUNCTION public.get_user_campaigns()
RETURNS SETOF public.campaigns
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.campaigns c
  WHERE c.created_by = auth.uid()
     OR EXISTS (
       SELECT 1 FROM public.campaign_members cm
       WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid()
     );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_campaigns() TO authenticated;

-- Function to get sessions for campaigns user has access to
CREATE OR REPLACE FUNCTION public.get_user_sessions()
RETURNS SETOF public.sessions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.sessions s
  WHERE EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = s.campaign_id
      AND (c.created_by = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.campaign_members cm
             WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid()
           ))
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_sessions() TO authenticated;

-- Function to get sessions for a specific campaign
CREATE OR REPLACE FUNCTION public.get_campaign_sessions(p_campaign_id uuid)
RETURNS SETOF public.sessions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.sessions s
  WHERE s.campaign_id = p_campaign_id
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = p_campaign_id
        AND (c.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.campaign_members cm
               WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid()
             ))
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_sessions(uuid) TO authenticated;

-- Add policies to allow reading campaigns/sessions through membership
-- These use SECURITY DEFINER to avoid recursion
DROP POLICY IF EXISTS campaigns_select_creator ON public.campaigns;
DROP POLICY IF EXISTS sessions_select_creator ON public.sessions;

-- New campaign select policy with membership check
CREATE POLICY campaigns_select_member_or_creator ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = campaigns.id AND cm.user_id = auth.uid()
    )
  );

-- New session select policy with membership check
CREATE POLICY sessions_select_by_campaign_access ON public.sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = sessions.campaign_id
        AND (c.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.campaign_members cm
               WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid()
             ))
    )
  );

COMMIT;
