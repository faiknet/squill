-- Migration: 20260628_security_advisor_fixes.sql
-- Fixes all Supabase Security Advisor warnings:
--   1. RLS policies with USING(true) / WITH CHECK(true)
--   2. Functions with mutable search_path
--   3. Anon role can execute SECURITY DEFINER functions
--   4. Leaked password protection disabled (requires dashboard toggle)

-- ============================================================================
-- 1. RLS POLICY FIXES
--    Replace permissive (USING true / WITH CHECK true) policies with
--    explicit checks using SECURITY DEFINER helper functions to avoid
--    the RLS recursion that led to the "nuclear" fix.
-- ============================================================================

-- Helper functions for RLS checks (recreated here in case they were dropped by previous migrations)
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


-- 1a. SESSIONS
--    Nuclear fix had: sessions_select_creator, sessions_insert_all (WITH CHECK true),
--    sessions_update_creator, sessions_delete_creator.
--    Replace with: campaign-membership-based FOR ALL using helper.
DROP POLICY IF EXISTS sessions_select_creator ON public.sessions;
DROP POLICY IF EXISTS sessions_insert_all ON public.sessions;
DROP POLICY IF EXISTS sessions_update_creator ON public.sessions;
DROP POLICY IF EXISTS sessions_delete_creator ON public.sessions;

CREATE POLICY sessions_member_access ON public.sessions FOR ALL
  TO authenticated
  USING (public.user_is_campaign_member(campaign_id, auth.uid()))
  WITH CHECK (public.user_is_campaign_member(campaign_id, auth.uid()));

-- 1b. SESSION_NOTES
--    Nuclear fix had: session_notes_all (USING true WITH CHECK true).
--    Replace with: subquery through sessions using SECURITY DEFINER helper.
DROP POLICY IF EXISTS session_notes_all ON public.session_notes;

CREATE POLICY session_notes_member_access ON public.session_notes FOR ALL
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

-- 1c. ENTITY_TAGS
--    Nuclear fix had: entity_tags_all (USING true WITH CHECK true).
--    Replace with: direct campaign_id check using SECURITY DEFINER helper.
DROP POLICY IF EXISTS entity_tags_all ON public.entity_tags;

CREATE POLICY entity_tags_member_access ON public.entity_tags FOR ALL
  TO authenticated
  USING (public.user_is_campaign_member(campaign_id, auth.uid()))
  WITH CHECK (public.user_is_campaign_member(campaign_id, auth.uid()));

-- 1d. SESSION_ACTIVITY_LOGS
--    Fix had: "Allow authenticated users to insert activity logs" WITH CHECK (true).
--    Replace with: insert only if the user_id matches the authenticated user.
DROP POLICY IF EXISTS "Allow authenticated users to insert activity logs" ON public.session_activity_logs;

CREATE POLICY "Users can insert activity logs" ON public.session_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 2. FUNCTION SEARCH PATH
--    Set explicit search_path on all public functions that lack one.
--    This prevents privilege escalation via search_path manipulation.
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
  search_path_already_set boolean;
BEGIN
  FOR rec IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) AS x WHERE x LIKE 'search_path=%'
        )
      )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = ''public''',
        rec.schema_name, rec.func_name, rec.func_args
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not set search_path on function %(%), reason: %',
        rec.func_name, rec.func_args, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- ============================================================================
-- 3. REVOKE ANON EXECUTE ON SECURITY DEFINER FUNCTIONS
--    The anon role should not be able to execute SECURITY DEFINER functions.
--    Authenticated users still can via the GRANTs already in place.
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
        rec.schema_name, rec.func_name, rec.func_args
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not revoke anon execute on function %(%), reason: %',
        rec.func_name, rec.func_args, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- ============================================================================
-- 4. LEAKED PASSWORD PROTECTION
--    This feature must be enabled in the Supabase Dashboard:
--    Project Settings -> Auth -> "Leaked password protection"
--    Toggle ON under "Password Security" section.
--    Cannot be set via SQL for Supabase Auth.
-- ============================================================================
-- To enable: Go to Supabase Dashboard -> Project Settings -> Authentication
-- -> Look for "Leaked password protection" toggle -> Enable it.
