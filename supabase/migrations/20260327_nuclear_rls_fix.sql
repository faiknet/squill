-- Migration: 20260327_nuclear_rls_fix.sql
-- NUCLEAR OPTION: Remove ALL cross-table RLS checks
-- Use RPC functions for complex authorization instead

BEGIN;

-- Step 1: Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Step 2: Drop old helper functions
DROP FUNCTION IF EXISTS public.user_is_campaign_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_is_campaign_creator(uuid, uuid);

-- Step 3: Create MINIMAL policies with ZERO cross-table references

-- PROFILES: Everyone can read, only update own
CREATE POLICY profiles_select_all ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- CAMPAIGNS: Simple policies without checking membership
-- Users can see campaigns they created only (for now)
-- We'll add membership-based visibility through RPC functions
CREATE POLICY campaigns_select_creator ON public.campaigns FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

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

-- CAMPAIGN_MEMBERS: Only see/manage own membership
CREATE POLICY campaign_members_select_own ON public.campaign_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY campaign_members_insert_own ON public.campaign_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY campaign_members_delete_own ON public.campaign_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- SESSIONS: Only creators can manage (we'll add membership via RPC)
CREATE POLICY sessions_select_creator ON public.sessions FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY sessions_insert_all ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY sessions_update_creator ON public.sessions FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY sessions_delete_creator ON public.sessions FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- SESSION_NOTES: Allow all authenticated users for now
CREATE POLICY session_notes_all ON public.session_notes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ENTITY_TAGS: Allow all authenticated users for now
CREATE POLICY entity_tags_all ON public.entity_tags FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
