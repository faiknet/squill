-- Migration: 20260327_resolve_rls_recursion.sql
-- Resolve recursive RLS policies between campaigns and campaign_members
-- This migration ensures campaign_members SELECT is non-recursive (own membership only)
-- and campaigns SELECT references campaign_members safely.

BEGIN;

-- 1) campaigns: enable RLS and create safe SELECT policy
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select campaigns they belong to or created" ON public.campaigns;
CREATE POLICY "Users can select campaigns they belong to or created"
  ON public.campaigns FOR SELECT
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = public.campaigns.id AND cm.user_id = auth.uid()
    )
  );

-- 2) campaign_members: enable RLS and restrict SELECT to own membership only
-- This avoids cross-table SELECTs that can cause recursive policy evaluation.
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select campaign members for campaigns they're in or their own membership" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can select own membership only" ON public.campaign_members;

CREATE POLICY "Users can select own membership only"
  ON public.campaign_members FOR SELECT
  USING (user_id = auth.uid());

COMMIT;
