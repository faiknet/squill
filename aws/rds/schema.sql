-- Squill AWS RDS schema (Supabase-free baseline)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT 'Adventurer',
  avatar_url text,
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  invite_code uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  slug text NOT NULL,
  streak_count integer NOT NULL DEFAULT 0,
  streak_cadence text NOT NULL DEFAULT 'weekly',
  streak_last_period_start date
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaigns_streak_count_non_negative'
      AND conrelid = 'public.campaigns'::regclass
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_streak_count_non_negative
      CHECK (streak_count >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaigns_streak_cadence_valid'
      AND conrelid = 'public.campaigns'::regclass
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_streak_cadence_valid
      CHECK (streak_cadence IN ('weekly', 'biweekly', 'monthly'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_campaigns_slug'
      AND conrelid = 'public.campaigns'::regclass
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT unique_campaigns_slug UNIQUE (slug);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.campaign_members (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  session_date date,
  created_by uuid REFERENCES public.profiles(id),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  slug text NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_campaign_session_slug'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT unique_campaign_session_slug UNIQUE (campaign_id, slug);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.session_notes (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  content_md text,
  liveblocks_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entity_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  label text NOT NULL,
  tag_type text NOT NULL,
  entry_type text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  order_index integer
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'entity_tags_tag_type_check'
      AND conrelid = 'public.entity_tags'::regclass
  ) THEN
    ALTER TABLE public.entity_tags
      ADD CONSTRAINT entity_tags_tag_type_check
      CHECK (tag_type IN ('npc', 'location', 'item', 'pet')) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.campaign_pins (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.session_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  editor_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'revoked', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour'),
  used_at timestamptz,
  revoked_at timestamptz,
  ip_address inet,
  user_agent text,
  notes text,
  success boolean DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS public.password_change_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('password_reset', 'password_update', 'password_failed_attempt')),
  status text DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text,
  reset_token_id uuid REFERENCES public.password_reset_tokens(id) ON DELETE SET NULL,
  notes text
);

CREATE OR REPLACE FUNCTION public.generate_slug(text_input text)
RETURNS text AS $$
BEGIN
  RETURN LOWER(TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(text_input, '[^a-zA-Z0-9\s\-]', '', 'g'),
      '\s+', '-', 'g'
    )
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.campaign_period_start(
  p_date date,
  p_cadence text
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_week_start date;
  v_epoch_monday CONSTANT date := date '1970-01-05';
BEGIN
  IF p_cadence = 'monthly' THEN
    RETURN date_trunc('month', p_date)::date;
  END IF;

  v_week_start := date_trunc('week', p_date)::date;

  IF p_cadence = 'biweekly' THEN
    RETURN v_epoch_monday + (((v_week_start - v_epoch_monday) / 14) * 14);
  END IF;

  RETURN v_week_start;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_campaign_period_start(
  p_period_start date,
  p_cadence text
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_cadence = 'monthly' THEN
    RETURN (p_period_start + interval '1 month')::date;
  END IF;

  IF p_cadence = 'biweekly' THEN
    RETURN p_period_start + 14;
  END IF;

  RETURN p_period_start + 7;
END;
$$;

CREATE OR REPLACE FUNCTION public.previous_campaign_period_start(
  p_period_start date,
  p_cadence text
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_cadence = 'monthly' THEN
    RETURN (p_period_start - interval '1 month')::date;
  END IF;

  IF p_cadence = 'biweekly' THEN
    RETURN p_period_start - 14;
  END IF;

  RETURN p_period_start - 7;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_campaign_streak_for_date(
  p_campaign_id uuid,
  p_activity_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cadence text;
  v_last_period_start date;
  v_new_period_start date;
  v_new_streak_count integer;
BEGIN
  SELECT c.streak_cadence, c.streak_last_period_start
    INTO v_cadence, v_last_period_start
  FROM public.campaigns c
  WHERE c.id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_new_period_start := public.campaign_period_start(
    COALESCE(p_activity_date, current_date), v_cadence
  );

  -- No prior activity → start streak at 1
  IF v_last_period_start IS NULL THEN
    v_new_streak_count := 1;

  -- Same period → no change (no-op)
  ELSIF v_new_period_start = v_last_period_start THEN
    RETURN;

  -- Consecutive period → increment
  ELSIF v_new_period_start = public.next_campaign_period_start(
    v_last_period_start, v_cadence
  ) THEN
    v_new_streak_count := (
      SELECT c.streak_count + 1 FROM public.campaigns c WHERE c.id = p_campaign_id
    );

  -- Gap > 1 period → expired, reset to 0 with null last_period
  ELSIF v_new_period_start > v_last_period_start THEN
    PERFORM set_config('app.allow_streak_write', '1', true);
    UPDATE public.campaigns c
    SET
      streak_count = 0,
      streak_last_period_start = null
    WHERE c.id = p_campaign_id;
    RETURN;

  -- Past activity (activity_date before last_period) → no-op
  ELSE
    RETURN;
  END IF;

  PERFORM set_config('app.allow_streak_write', '1', true);

  UPDATE public.campaigns c
  SET
    streak_count = COALESCE(v_new_streak_count, 0),
    streak_last_period_start = v_new_period_start
  WHERE c.id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_campaign_streak_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW.streak_count IS DISTINCT FROM OLD.streak_count
    OR NEW.streak_last_period_start IS DISTINCT FROM OLD.streak_last_period_start
    OR NEW.streak_cadence IS DISTINCT FROM OLD.streak_cadence
  )
  AND COALESCE(current_setting('app.allow_streak_write', true), '0') <> '1' THEN
    RAISE EXCEPTION 'Campaign streak fields are managed by the system';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_campaign_streak_on_session_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.archived THEN
    RETURN NEW;
  END IF;

  PERFORM public.apply_campaign_streak_for_date(
    NEW.campaign_id,
    COALESCE(NEW.session_date, (NEW.created_at AT TIME ZONE 'utc')::date, current_date)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_campaign_streak_on_session_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  SELECT campaign_id INTO v_campaign_id
  FROM public.sessions
  WHERE id = NEW.session_id;

  IF v_campaign_id IS NOT NULL THEN
    PERFORM public.apply_campaign_streak_for_date(
      v_campaign_id, current_date
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_campaign_streak_on_entity_tag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_campaign_streak_for_date(
    NEW.campaign_id, current_date
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_campaign_streak(
  p_campaign_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cadence text;
  v_periods date[];
  v_len integer;
  v_idx integer;
  v_streak integer;
BEGIN
  SELECT c.streak_cadence
    INTO v_cadence
  FROM public.campaigns c
  WHERE c.id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT array_agg(p.period_start ORDER BY p.period_start DESC)
    INTO v_periods
  FROM (
    SELECT DISTINCT public.campaign_period_start(
      COALESCE(s.session_date, (s.created_at AT TIME ZONE 'utc')::date),
      v_cadence
    ) AS period_start
    FROM public.sessions s
    WHERE s.campaign_id = p_campaign_id
      AND NOT s.archived
  ) p;

  v_len := COALESCE(array_length(v_periods, 1), 0);

  PERFORM set_config('app.allow_streak_write', '1', true);

  IF v_len = 0 THEN
    UPDATE public.campaigns c
    SET
      streak_count = 0,
      streak_last_period_start = null
    WHERE c.id = p_campaign_id;
    RETURN;
  END IF;

  v_streak := 1;
  FOR v_idx IN 2..v_len LOOP
    EXIT WHEN v_periods[v_idx - 1] <> public.next_campaign_period_start(v_periods[v_idx], v_cadence);
    v_streak := v_streak + 1;
  END LOOP;

  -- Check if streak has expired (gap between most recent period and current period)
  IF public.next_campaign_period_start(v_periods[1], v_cadence) < current_date THEN
    v_streak := 0;
  END IF;

  IF v_streak = 0 THEN
    UPDATE public.campaigns c
    SET
      streak_count = 0,
      streak_last_period_start = null
    WHERE c.id = p_campaign_id;
  ELSE
    UPDATE public.campaigns c
    SET
      streak_count = v_streak,
      streak_last_period_start = v_periods[1]
    WHERE c.id = p_campaign_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_campaign_activity()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'sessions' THEN
    UPDATE public.campaigns
    SET updated_at = now()
    WHERE id = COALESCE(NEW.campaign_id, OLD.campaign_id);
  ELSIF TG_TABLE_NAME = 'session_notes' THEN
    UPDATE public.campaigns
    SET updated_at = now()
    WHERE id = (
      SELECT campaign_id
      FROM public.sessions
      WHERE id = COALESCE(NEW.session_id, OLD.session_id)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_session_notes_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.content_md IS DISTINCT FROM OLD.content_md) THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
