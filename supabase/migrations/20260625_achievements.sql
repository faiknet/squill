-- Create achievements system tables

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  criteria_type TEXT NOT NULL,
  criteria_value INTEGER NOT NULL DEFAULT 0,
  reward_type TEXT,
  reward_value TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read achievements" ON public.achievements;
CREATE POLICY "Anyone can read achievements"
  ON public.achievements FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can insert own achievement" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can update own achievement" ON public.user_achievements;

CREATE POLICY "Users can read own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievement"
  ON public.user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievement"
  ON public.user_achievements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.award_achievement(p_achievement_slug TEXT)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  icon TEXT,
  category TEXT,
  earned_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_achievement_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT a.id INTO v_achievement_id
  FROM achievements a
  WHERE a.slug = p_achievement_slug;

  IF v_achievement_id IS NULL THEN
    RAISE EXCEPTION 'Achievement not found: %', p_achievement_slug;
  END IF;

  INSERT INTO user_achievements (user_id, achievement_id, progress, earned_at)
  VALUES (v_user_id, v_achievement_id, 0, now())
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  RETURN QUERY
  SELECT a.id, a.slug, a.name, a.description, a.icon, a.category, ua.earned_at
  FROM achievements a
  LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = v_user_id
  WHERE a.slug = p_achievement_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.award_achievement(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_achievement(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_achievements()
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  icon TEXT,
  category TEXT,
  criteria_type TEXT,
  criteria_value INTEGER,
  reward_type TEXT,
  reward_value TEXT,
  sort_order INTEGER,
  earned_at TIMESTAMPTZ,
  progress INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.slug, a.name, a.description, a.icon, a.category,
    a.criteria_type, a.criteria_value, a.reward_type, a.reward_value,
    a.sort_order, ua.earned_at, COALESCE(ua.progress, 0)
  FROM achievements a
  LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = v_user_id
  ORDER BY a.sort_order;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_achievements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_achievements() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_achievement_progress(
  p_achievement_slug TEXT,
  p_progress INTEGER
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  icon TEXT,
  category TEXT,
  earned_at TIMESTAMPTZ,
  progress INTEGER,
  just_awarded BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_achievement_id UUID;
  v_criteria_value INTEGER;
  v_just_awarded BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT a.id, a.criteria_value INTO v_achievement_id, v_criteria_value
  FROM achievements a
  WHERE a.slug = p_achievement_slug;

  IF v_achievement_id IS NULL THEN
    RAISE EXCEPTION 'Achievement not found: %', p_achievement_slug;
  END IF;

  INSERT INTO user_achievements (user_id, achievement_id, progress, earned_at)
  VALUES (v_user_id, v_achievement_id, p_progress, CASE WHEN p_progress >= v_criteria_value THEN now() ELSE NULL END)
  ON CONFLICT (user_id, achievement_id) DO UPDATE SET
    progress = GREATEST(user_achievements.progress, p_progress),
    earned_at = CASE
      WHEN p_progress >= v_criteria_value AND user_achievements.earned_at IS NULL THEN now()
      ELSE user_achievements.earned_at
    END,
    updated_at = now();

  IF p_progress >= v_criteria_value THEN
    v_just_awarded := true;
  END IF;

  RETURN QUERY
  SELECT
    a.id, a.slug, a.name, a.description, a.icon, a.category,
    ua.earned_at, ua.progress, v_just_awarded
  FROM achievements a
  LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = v_user_id
  WHERE a.slug = p_achievement_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.update_achievement_progress(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_achievement_progress(TEXT, INTEGER) TO authenticated;

