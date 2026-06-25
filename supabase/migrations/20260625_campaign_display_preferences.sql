-- Create campaign display preferences table
CREATE TABLE IF NOT EXISTS public.campaign_display_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (user_id, campaign_id)
);

-- Enable RLS
ALTER TABLE public.campaign_display_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can read display preferences" ON public.campaign_display_preferences;
DROP POLICY IF EXISTS "Users can insert own display preference" ON public.campaign_display_preferences;
DROP POLICY IF EXISTS "Users can update own display preference" ON public.campaign_display_preferences;
DROP POLICY IF EXISTS "Users can delete own display preference" ON public.campaign_display_preferences;

-- Select policy: Anyone can read all display preferences (needed for displaying user display names to all users)
CREATE POLICY "Anyone can read display preferences"
  ON public.campaign_display_preferences FOR SELECT
  USING (true);

-- Insert own display preferences
CREATE POLICY "Users can insert own display preference"
  ON public.campaign_display_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update own display preferences
CREATE POLICY "Users can update own display preference"
  ON public.campaign_display_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Delete own display preferences
CREATE POLICY "Users can delete own display preference"
  ON public.campaign_display_preferences FOR DELETE
  USING (auth.uid() = user_id);
