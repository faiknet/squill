-- Update campaigns.updated_at based on session activity, not campaign metadata edits
-- This ensures "Last Modified" reflects actual campaign activity (new sessions, edited notes)

-- First, ensure updated_at column exists (in case 0011 wasn't run)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        UPDATE campaigns SET updated_at = created_at WHERE updated_at IS NULL;
    END IF;
END $$;

-- Remove the campaign update trigger if it exists (we don't want metadata edits to count as activity)
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;

-- Function to update campaign's updated_at when session activity occurs
CREATE OR REPLACE FUNCTION update_campaign_activity()
RETURNS TRIGGER 
SECURITY DEFINER  -- This allows the function to bypass RLS policies
SET search_path = public
AS $$
BEGIN
    -- For sessions table, use campaign_id directly
    IF TG_TABLE_NAME = 'sessions' THEN
        UPDATE campaigns 
        SET updated_at = NOW() 
        WHERE id = COALESCE(NEW.campaign_id, OLD.campaign_id);
    
    -- For session_notes, we need to join through sessions to get campaign_id
    ELSIF TG_TABLE_NAME = 'session_notes' THEN
        UPDATE campaigns 
        SET updated_at = NOW() 
        WHERE id = (
            SELECT campaign_id 
            FROM sessions 
            WHERE id = COALESCE(NEW.session_id, OLD.session_id)
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger when sessions are created or updated
DROP TRIGGER IF EXISTS update_campaign_on_session_change ON sessions;
CREATE TRIGGER update_campaign_on_session_change
    AFTER INSERT OR UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_activity();

-- Trigger when session notes are created or updated
-- Note: This fires on both INSERT and UPDATE to handle UPSERT operations
DROP TRIGGER IF EXISTS update_campaign_on_notes_change ON session_notes;
CREATE TRIGGER update_campaign_on_notes_change
    AFTER INSERT OR UPDATE ON session_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_activity();

-- Also update session_notes.updated_at automatically when content changes
CREATE OR REPLACE FUNCTION update_session_notes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if content actually changed or this is an insert
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.content_md IS DISTINCT FROM OLD.content_md) THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS session_notes_update_timestamp ON session_notes;
CREATE TRIGGER session_notes_update_timestamp
    BEFORE INSERT OR UPDATE ON session_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_session_notes_timestamp();

-- Backfill: Set campaigns.updated_at to the most recent session or note activity
UPDATE campaigns c
SET updated_at = COALESCE(
    (
        SELECT MAX(GREATEST(
            s.created_at,
            COALESCE(sn.updated_at, s.created_at)
        ))
        FROM sessions s
        LEFT JOIN session_notes sn ON sn.session_id = s.id
        WHERE s.campaign_id = c.id
    ),
    c.created_at
);
