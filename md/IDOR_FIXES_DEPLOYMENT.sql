-- 🔒 IDOR CRITICAL FIXES - COMBINED DEPLOYMENT SCRIPT
-- Deploy both fixes in sequence
-- 
-- Fix 1: User Preferences RLS Policy (prevents user enumeration)
-- Fix 2: Password Reset Tokens RLS Policy (prevents audit log forgery)
-- 
-- ⚠️ IMPORTANT: Deploy in order, pause for verification between each
-- ⚠️ If any error occurs, STOP and contact security team

-- ============================================================================
-- FIX 1: USER PREFERENCES - RESTRICT TO CAMPAIGN MEMBERS ONLY
-- ============================================================================

-- IDOR Fix: User Preferences READ Policy
-- Removes overly permissive "Anyone can read all preferences" policy
-- Replaces with scoped policy: only read preferences for campaign members

-- Drop the overly permissive policy that allows reading ALL user preferences
DROP POLICY IF EXISTS "Anyone can read all preferences" ON user_preferences;

-- Create a new restrictive policy: users can only read preferences of:
-- 1. Their own preferences
-- 2. Other users in the same campaigns they're in
CREATE POLICY "Users can read preferences of campaign members"
  ON user_preferences FOR SELECT
  USING (
    -- Can always read own preferences
    auth.uid() = user_id
    OR
    -- Can read preferences of users in same campaigns
    EXISTS (
      SELECT 1 FROM campaign_members cm_self
      INNER JOIN campaign_members cm_other 
        ON cm_self.campaign_id = cm_other.campaign_id
      WHERE cm_self.user_id = auth.uid() 
        AND cm_other.user_id = user_preferences.user_id
    )
  );

-- Update the get_user_colors RPC to respect the new scoped policy
-- Now it will enforce campaign membership even when called directly
CREATE OR REPLACE FUNCTION get_user_colors(user_ids UUID[])
RETURNS TABLE (user_id UUID, editor_color TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT up.user_id, up.editor_color
  FROM user_preferences up
  WHERE up.user_id = ANY(user_ids)
    AND (
      -- Can always read own color
      up.user_id = auth.uid()
      OR
      -- Can read colors of campaign members
      EXISTS (
        SELECT 1 FROM campaign_members cm_self
        INNER JOIN campaign_members cm_other 
          ON cm_self.campaign_id = cm_other.campaign_id
        WHERE cm_self.user_id = auth.uid() 
          AND cm_other.user_id = up.user_id
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Verification check (should show new policy):
-- SELECT * FROM pg_policies WHERE tablename = 'user_preferences';

-- ============================================================================
-- FIX 2: PASSWORD RESET TOKENS - SERVICE ROLE ONLY
-- ============================================================================

-- IDOR Fix: Password Reset Tokens INSERT Policy
-- Removes overly permissive policy that allows authenticated users to insert tokens
-- Restricts to service_role only (edge functions)

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Service can insert password reset tokens" ON password_reset_tokens;

-- Create a new restrictive policy: only service_role can insert
-- This prevents authenticated users from forging password reset audit logs
CREATE POLICY "Service role only can insert password reset tokens"
  ON password_reset_tokens FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Update the existing UPDATE policy to be more restrictive
-- Only service_role or the user themselves (for revocation) can update
DROP POLICY IF EXISTS "Service can update password reset tokens" ON password_reset_tokens;

CREATE POLICY "Service and user can update password reset tokens"
  ON password_reset_tokens FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    (auth.uid() = user_id AND status = 'pending')
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.uid() = user_id AND status IN ('pending', 'revoked'))
  );


-- Verification check (should show service_role policies):
-- SELECT * FROM pg_policies WHERE tablename = 'password_reset_tokens';

-- ============================================================================
-- ALL FIXES DEPLOYED ✅
-- ============================================================================
