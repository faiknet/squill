-- Create user preferences table to store editor colors
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  editor_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own preferences
CREATE POLICY "Users can read their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to update their own preferences
CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow users to insert their own preferences
CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow anyone to read all preferences (needed for displaying member colors)
CREATE POLICY "Anyone can read all preferences"
  ON user_preferences FOR SELECT
  USING (true);

-- Create function to get all user colors for a campaign's members
CREATE OR REPLACE FUNCTION get_user_colors(user_ids UUID[])
RETURNS TABLE (user_id UUID, editor_color TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT up.user_id, up.editor_color
  FROM user_preferences up
  WHERE up.user_id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to upsert user color preference
CREATE OR REPLACE FUNCTION set_user_color_preference(color_hex TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_preferences (user_id, editor_color)
  VALUES (auth.uid(), color_hex)
  ON CONFLICT (user_id) DO UPDATE
  SET editor_color = color_hex, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
