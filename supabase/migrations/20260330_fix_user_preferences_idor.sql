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
