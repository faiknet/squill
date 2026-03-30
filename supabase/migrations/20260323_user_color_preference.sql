-- Store user's preferred editor color in user metadata
-- This allows the color preference to persist across devices and logout/login

-- Create a function to safely update user metadata
CREATE OR REPLACE FUNCTION set_user_color_preference(user_id UUID, color_hex TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{editor_color}',
    to_jsonb(color_hex)
  )
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get user's color preference
CREATE OR REPLACE FUNCTION get_user_color_preference(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN auth.users.raw_user_meta_data->>'editor_color'
  FROM auth.users
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
