-- Post-import cleanup and backfills for AWS RDS migration

UPDATE public.entity_tags
SET tag_type = 'item'
WHERE tag_type = 'inventory';

UPDATE public.entity_tags
SET tag_type = 'item'
WHERE tag_type IS NULL OR tag_type NOT IN ('npc', 'location', 'item', 'pet');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'entity_tags_tag_type_check'
      AND conrelid = 'public.entity_tags'::regclass
  ) THEN
    ALTER TABLE public.entity_tags VALIDATE CONSTRAINT entity_tags_tag_type_check;
  END IF;
END $$;

UPDATE public.campaigns
SET slug = CONCAT(
  public.generate_slug(name),
  '-',
  substring(id::text from 1 for 8)
)
WHERE slug IS NULL OR slug = '';

UPDATE public.sessions
SET slug = CONCAT(
  public.generate_slug(name),
  '-',
  substring(id::text from 1 for 8)
)
WHERE slug IS NULL OR slug = '';

UPDATE public.entity_tags
SET order_index = ordering.row_num - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY session_id, tag_type
    ORDER BY created_at
  ) AS row_num
  FROM public.entity_tags
) AS ordering
WHERE public.entity_tags.id = ordering.id
  AND public.entity_tags.order_index IS NULL;

UPDATE public.campaigns
SET updated_at = created_at
WHERE updated_at IS NULL;

UPDATE public.campaigns c
SET updated_at = COALESCE(
  (
    SELECT MAX(GREATEST(
      s.created_at,
      COALESCE(sn.updated_at, s.created_at)
    ))
    FROM public.sessions s
    LEFT JOIN public.session_notes sn ON sn.session_id = s.id
    WHERE s.campaign_id = c.id
  ),
  c.created_at
);

DO $$
DECLARE
  v_campaign record;
  v_periods date[];
  v_len integer;
  v_idx integer;
  v_streak integer;
BEGIN
  FOR v_campaign IN
    SELECT c.id, c.streak_cadence
    FROM public.campaigns c
  LOOP
    SELECT array_agg(p.period_start ORDER BY p.period_start DESC)
      INTO v_periods
    FROM (
      SELECT DISTINCT public.campaign_period_start(
        COALESCE(s.session_date, (s.created_at AT TIME ZONE 'utc')::date),
        v_campaign.streak_cadence
      ) AS period_start
      FROM public.sessions s
      WHERE s.campaign_id = v_campaign.id
        AND NOT s.archived
    ) p;

    v_len := COALESCE(array_length(v_periods, 1), 0);

    PERFORM set_config('app.allow_streak_write', '1', true);

    IF v_len = 0 THEN
      UPDATE public.campaigns c
      SET streak_count = 0, streak_last_period_start = null
      WHERE c.id = v_campaign.id;
      CONTINUE;
    END IF;

    v_streak := 1;

    FOR v_idx IN 2..v_len LOOP
      EXIT WHEN v_periods[v_idx - 1] <> public.next_campaign_period_start(v_periods[v_idx], v_campaign.streak_cadence);
      v_streak := v_streak + 1;
    END LOOP;

    -- Check if streak has expired (gap between most recent period and current period)
    IF public.next_campaign_period_start(v_periods[1], v_campaign.streak_cadence) < current_date THEN
      v_streak := 0;
    END IF;

    UPDATE public.campaigns c
    SET
      streak_count = v_streak,
      streak_last_period_start = CASE WHEN v_streak > 0 THEN v_periods[1] ELSE null END
    WHERE c.id = v_campaign.id;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS update_campaign_on_session_change ON public.sessions;
CREATE TRIGGER update_campaign_on_session_change
AFTER INSERT OR UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_campaign_activity();

DROP TRIGGER IF EXISTS update_campaign_on_notes_change ON public.session_notes;
CREATE TRIGGER update_campaign_on_notes_change
AFTER INSERT OR UPDATE ON public.session_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_campaign_activity();

DROP TRIGGER IF EXISTS session_notes_update_timestamp ON public.session_notes;
CREATE TRIGGER session_notes_update_timestamp
BEFORE INSERT OR UPDATE ON public.session_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_session_notes_timestamp();

DROP TRIGGER IF EXISTS trg_protect_campaign_streak_fields ON public.campaigns;
CREATE TRIGGER trg_protect_campaign_streak_fields
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.protect_campaign_streak_fields();

DROP TRIGGER IF EXISTS trg_apply_campaign_streak_on_session_insert ON public.sessions;
CREATE TRIGGER trg_apply_campaign_streak_on_session_insert
AFTER INSERT ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.apply_campaign_streak_on_session_insert();

DROP TRIGGER IF EXISTS trg_apply_campaign_streak_on_session_update ON public.sessions;
CREATE TRIGGER trg_apply_campaign_streak_on_session_update
AFTER UPDATE ON public.sessions
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION public.apply_campaign_streak_on_session_insert();

DROP TRIGGER IF EXISTS trg_apply_campaign_streak_on_session_note ON public.session_notes;
CREATE TRIGGER trg_apply_campaign_streak_on_session_note
AFTER INSERT OR UPDATE ON public.session_notes
FOR EACH ROW
EXECUTE FUNCTION public.apply_campaign_streak_on_session_note();

DROP TRIGGER IF EXISTS trg_apply_campaign_streak_on_entity_tag ON public.entity_tags;
CREATE TRIGGER trg_apply_campaign_streak_on_entity_tag
AFTER INSERT ON public.entity_tags
FOR EACH ROW
EXECUTE FUNCTION public.apply_campaign_streak_on_entity_tag();

CREATE INDEX IF NOT EXISTS idx_sessions_campaign_created
  ON public.sessions (campaign_id, created_at DESC)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_entity_tags_campaign_created
  ON public.entity_tags (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_tags_session
  ON public.entity_tags (session_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_session_created
  ON public.session_activity_logs (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign
  ON public.campaign_members (campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_created_by_created
  ON public.campaigns (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_pins_user
  ON public.campaign_pins (user_id, pinned_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user
  ON public.user_preferences (user_id)
  WHERE editor_color IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON public.password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON public.password_reset_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_status
  ON public.password_reset_tokens (status);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_created_at
  ON public.password_reset_tokens (created_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_status
  ON public.password_reset_tokens (user_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_password_change_audit_user_id
  ON public.password_change_audit (user_id);

CREATE INDEX IF NOT EXISTS idx_password_change_audit_created_at
  ON public.password_change_audit (created_at);

CREATE INDEX IF NOT EXISTS idx_entity_tags_order
  ON public.entity_tags (campaign_id, tag_type, order_index);

CREATE INDEX IF NOT EXISTS idx_campaigns_slug
  ON public.campaigns (slug);

CREATE INDEX IF NOT EXISTS idx_sessions_slug
  ON public.sessions (slug);
