-- Migration: 20260327_membership_fn_and_safe_policies.sql
-- Create SECURITY DEFINER helper to check campaign membership without invoking RLS on campaign_members,
-- then create safe campaigns SELECT policy that calls the helper.

BEGIN;

-- 1) Create helper function to check membership
CREATE OR REPLACE FUNCTION public.is_user_campaign_member(p_campaign_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.campaign_members WHERE campaign_id = p_campaign_id AND user_id = auth.uid()
  );
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.is_user_campaign_member(uuid) TO authenticated;

-- 2) Ensure campaign_members SELECT is safe: only allow own membership
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_members_select_own ON public.campaign_members;
CREATE POLICY campaign_members_select_own ON public.campaign_members FOR SELECT
  USING (user_id = auth.uid());

-- 3) Use helper function in campaigns SELECT policy (avoids recursion)
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaigns_select_member_or_creator ON public.campaigns;
CREATE POLICY campaigns_select_member_or_creator ON public.campaigns FOR SELECT
  USING (
    auth.uid() = created_by
    OR public.is_user_campaign_member(public.campaigns.id)
  );

COMMIT;
