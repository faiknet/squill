-- Migration: 20260327_cleanup_rls.sql
-- Consolidate and clean up RLS policies to remove recursive cross-table references

BEGIN;

-- DROP problematic/duplicate campaign_members SELECT policies that reference campaigns
DROP POLICY IF EXISTS "Users can select own membership or GMs can view members" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can select campaign members for campaigns they're in or their own membership" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can select own membership only" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_select_self" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_select_self" ON public.campaign_members; -- idempotent

-- Create a single safe SELECT policy for campaign_members: only own membership
CREATE POLICY campaign_members_select_own ON public.campaign_members FOR SELECT
  USING (user_id = auth.uid());

-- Ensure insert/update/delete policies remain but drop any that reference campaigns in USING
DROP POLICY IF EXISTS "Users can insert their own membership or GM can add members" ON public.campaign_members;
CREATE POLICY campaign_members_insert_own_or_gm ON public.campaign_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = public.campaign_members.campaign_id AND c.created_by = auth.uid()));

DROP POLICY IF EXISTS "GMs can update campaign_members" ON public.campaign_members;
CREATE POLICY campaign_members_update_by_gm ON public.campaign_members FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = public.campaign_members.campaign_id AND c.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = public.campaign_members.campaign_id AND c.created_by = auth.uid()));

DROP POLICY IF EXISTS "GMs can remove campaign members" ON public.campaign_members;
CREATE POLICY campaign_members_delete_by_gm ON public.campaign_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = public.campaign_members.campaign_id AND c.created_by = auth.uid()));

-- Clean up campaigns SELECT policies and create a single consolidated policy
DROP POLICY IF EXISTS "Users can select campaigns they belong to or created" ON public.campaigns;
DROP POLICY IF EXISTS "Users can select campaigns they belong to or created" ON public.campaigns;
DROP POLICY IF EXISTS "Members read campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can select campaigns they belong to or created" ON public.campaigns;

CREATE POLICY campaigns_select_member_or_creator ON public.campaigns FOR SELECT
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = public.campaigns.id AND cm.user_id = auth.uid()
    )
  );

-- Keep creators' update/delete policies; ensure they're present and consistent
DROP POLICY IF EXISTS "Campaign creators can update campaigns" ON public.campaigns;
CREATE POLICY campaigns_update_by_creator ON public.campaigns FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Campaign creators can delete campaigns" ON public.campaigns;
CREATE POLICY campaigns_delete_by_creator ON public.campaigns FOR DELETE
  USING (auth.uid() = created_by);

COMMIT;
