-- Migration: 20260327_final_rls_fix.sql
-- FINAL FIX for RLS recursion between campaigns and campaign_members
-- This migration creates a security definer helper function and uses it
-- to break the recursive policy evaluation loop.

BEGIN;

-- Step 1: Drop ALL existing policies to start fresh (including any from previous migration attempts)
DROP POLICY IF EXISTS "profiles read all authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles update own row" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "campaigns create own" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns read membership" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns update owner" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns delete owner" ON public.campaigns;
DROP POLICY IF EXISTS "Users can select campaigns they belong to or created" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_select_member_or_creator" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_update_by_creator" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_delete_by_creator" ON public.campaigns;
DROP POLICY IF EXISTS "Campaign creators can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Campaign creators can delete campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_insert_own" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_update_creator" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_delete_creator" ON public.campaigns;

DROP POLICY IF EXISTS "campaign_members read own campaign" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members join self" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can select campaign members for campaigns they're in or their own membership" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can select own membership only" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_select_own" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_insert_own_or_gm" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_update_by_gm" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_delete_by_gm" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can insert their own membership or GM can add members" ON public.campaign_members;
DROP POLICY IF EXISTS "GMs can update campaign_members" ON public.campaign_members;
DROP POLICY IF EXISTS "GMs can remove campaign members" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_insert" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_insert_own" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_update_gm" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_delete_gm" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_delete_own" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_manage_as_gm" ON public.campaign_members;

DROP POLICY IF EXISTS "sessions read campaign members" ON public.sessions;
DROP POLICY IF EXISTS "sessions write campaign members" ON public.sessions;
DROP POLICY IF EXISTS "sessions_access_by_membership" ON public.sessions;

DROP POLICY IF EXISTS "session_notes access by session membership" ON public.session_notes;
DROP POLICY IF EXISTS "session_notes_access_by_membership" ON public.session_notes;

DROP POLICY IF EXISTS "entity_tags access by campaign membership" ON public.entity_tags;
DROP POLICY IF EXISTS "entity_tags_access_by_membership" ON public.entity_tags;

-- Step 2: Create SECURITY DEFINER helper functions
-- These run as postgres role which bypasses RLS, breaking the recursion cycle

CREATE OR REPLACE FUNCTION public.user_is_campaign_member(p_campaign_id uuid, p_user_id uuid)
RETURNS boolean 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.campaign_members 
    WHERE campaign_id = p_campaign_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_campaign_creator(p_campaign_id uuid, p_user_id uuid)
RETURNS boolean 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.campaigns 
    WHERE id = p_campaign_id AND created_by = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_is_campaign_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_campaign_creator(uuid, uuid) TO authenticated;

-- Step 3: Create NEW policies using the helper function

-- PROFILES: Everyone can read all profiles, only update own
CREATE POLICY profiles_select_all ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- CAMPAIGNS: Use helper function to avoid recursion
CREATE POLICY campaigns_select_member_or_creator ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.user_is_campaign_member(id, auth.uid())
  );

CREATE POLICY campaigns_insert_own ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY campaigns_update_creator ON public.campaigns FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY campaigns_delete_creator ON public.campaigns FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- CAMPAIGN_MEMBERS: Simple policies without cross-table checks
-- SELECT: Users can only see their own memberships
CREATE POLICY campaign_members_select_own ON public.campaign_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: Allow users to insert their own membership only
-- (GMs will use a separate RPC function to add members)
CREATE POLICY campaign_members_insert_own ON public.campaign_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Not allowed (memberships are simple join/leave)
-- DELETE: Users can remove themselves
CREATE POLICY campaign_members_delete_own ON public.campaign_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- SESSIONS: Members can read/write sessions in their campaigns
CREATE POLICY sessions_access_by_membership ON public.sessions FOR ALL
  TO authenticated
  USING (public.user_is_campaign_member(campaign_id, auth.uid()))
  WITH CHECK (public.user_is_campaign_member(campaign_id, auth.uid()));

-- SESSION_NOTES: Members can access notes for sessions they're members of
CREATE POLICY session_notes_access_by_membership ON public.session_notes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id 
      AND public.user_is_campaign_member(s.campaign_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id 
      AND public.user_is_campaign_member(s.campaign_id, auth.uid())
    )
  );

-- ENTITY_TAGS: Members can access tags for their campaigns
CREATE POLICY entity_tags_access_by_membership ON public.entity_tags FOR ALL
  TO authenticated
  USING (public.user_is_campaign_member(campaign_id, auth.uid()))
  WITH CHECK (public.user_is_campaign_member(campaign_id, auth.uid()));

COMMIT;
