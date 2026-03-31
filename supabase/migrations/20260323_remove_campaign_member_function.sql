-- Create a function to remove a player from a campaign (GM only)
CREATE OR REPLACE FUNCTION remove_campaign_member(
  p_campaign_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_gm BOOLEAN;
  v_first_session_id UUID;
BEGIN
  -- Check if current user is the GM of this campaign
  SELECT EXISTS (
    SELECT 1 FROM campaigns 
    WHERE id = p_campaign_id AND created_by = auth.uid()
  ) INTO v_is_gm;
  
  IF NOT v_is_gm THEN
    RAISE EXCEPTION 'Only the GM can remove campaign members';
  END IF;
  
  -- Delete the campaign member
  DELETE FROM campaign_members
  WHERE campaign_id = p_campaign_id AND user_id = p_user_id;
  
  -- Log leave activity to the first session of the campaign
  SELECT s.id INTO v_first_session_id
  FROM sessions s
  WHERE s.campaign_id = p_campaign_id
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF v_first_session_id IS NOT NULL THEN
    INSERT INTO session_activity_logs (session_id, user_id, action_type, details)
    VALUES (v_first_session_id, p_user_id, 'leave_campaign', '{}'::jsonb);
  END IF;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION remove_campaign_member(UUID, UUID) TO authenticated;
