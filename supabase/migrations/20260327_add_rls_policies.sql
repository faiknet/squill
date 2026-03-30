-- Migration: 20260327_add_rls_policies.sql
-- Add Row-Level Security policies to protect campaigns, sessions, session_notes, entity_tags,
-- tighten campaign_members, profiles, and remove overly-permissive preferences policy.

BEGIN;

-- 1) campaigns
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

DROP POLICY IF EXISTS "Users can insert campaigns" ON public.campaigns;
CREATE POLICY "Users can insert campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Campaign creators can update campaigns" ON public.campaigns;
CREATE POLICY "Campaign creators can update campaigns"
  ON public.campaigns FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Campaign creators can delete campaigns" ON public.campaigns;
CREATE POLICY "Campaign creators can delete campaigns"
  ON public.campaigns FOR DELETE
  USING (auth.uid() = created_by);

-- 2) sessions (scoped to campaign membership)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access sessions in their campaigns" ON public.sessions;
CREATE POLICY "Users can access sessions in their campaigns"
  ON public.sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = public.sessions.campaign_id AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = public.sessions.campaign_id AND cm.user_id = auth.uid()
    )
  );

-- 3) session_notes (only accessible to users in the parent campaign)
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access notes for sessions in their campaigns" ON public.session_notes;
CREATE POLICY "Users can access notes for sessions in their campaigns"
  ON public.session_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.campaign_members cm ON s.campaign_id = cm.campaign_id
      WHERE s.id = public.session_notes.session_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.campaign_members cm ON s.campaign_id = cm.campaign_id
      WHERE s.id = public.session_notes.session_id
        AND cm.user_id = auth.uid()
    )
  );

-- 4) entity_tags (scoped by campaign_id)
ALTER TABLE public.entity_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access tags for campaigns they are in" ON public.entity_tags;
CREATE POLICY "Users can access tags for campaigns they are in"
  ON public.entity_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = public.entity_tags.campaign_id AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = public.entity_tags.campaign_id AND cm.user_id = auth.uid()
    )
  );

-- 5) campaign_members (allow users to view membership for campaigns they're in; inserts only for self or by GM)
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select campaign members for campaigns they're in or their own membership" ON public.campaign_members;
CREATE POLICY "Users can select campaign members for campaigns they're in or their own membership"
  ON public.campaign_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.campaign_members cm2 WHERE cm2.campaign_id = public.campaign_members.campaign_id AND cm2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own membership or GM can add members" ON public.campaign_members;
CREATE POLICY "Users can insert their own membership or GM can add members"
  ON public.campaign_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.campaigns c WHERE c.id = public.campaign_members.campaign_id AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "GMs can update campaign_members" ON public.campaign_members;
CREATE POLICY "GMs can update campaign_members"
  ON public.campaign_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c WHERE c.id = public.campaign_members.campaign_id AND c.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c WHERE c.id = public.campaign_members.campaign_id AND c.created_by = auth.uid()
    )
  );

-- Recreate delete policy (overwrite existing safe policy)
DROP POLICY IF EXISTS "GMs can remove campaign members" ON public.campaign_members;
CREATE POLICY "GMs can remove campaign members"
  ON public.campaign_members FOR DELETE
  USING (
    campaign_id IN (SELECT id FROM public.campaigns WHERE created_by = auth.uid())
  );

-- 6) profiles (allow reading own profile and profiles of users that share a campaign)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view profiles of campaign members" ON public.profiles;
CREATE POLICY "Users can view profiles of campaign members"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm_self
      JOIN public.campaign_members cm_other ON cm_self.campaign_id = cm_other.campaign_id
      WHERE cm_self.user_id = auth.uid() AND cm_other.user_id = public.profiles.id
    )
  );

-- 7) Tighten user_preferences: remove overly-permissive policy allowing anyone to read all preferences
DROP POLICY IF EXISTS "Anyone can read all preferences" ON public.user_preferences;
-- Keep the existing "Users can read/update/insert their own preferences" policies that were created earlier.

COMMIT;
