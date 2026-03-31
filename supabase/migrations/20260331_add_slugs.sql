-- Add slug columns to campaigns and sessions tables with temporary defaults
ALTER TABLE public.campaigns ADD COLUMN slug TEXT;
ALTER TABLE public.sessions ADD COLUMN slug TEXT;

-- Function to generate URL-friendly slugs from text
CREATE OR REPLACE FUNCTION generate_slug(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(text_input, '[^a-zA-Z0-9\s\-]', '', 'g'),
      '\s+', '-', 'g'
    )
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Populate slugs for existing campaigns
UPDATE public.campaigns
SET slug = CONCAT(
  generate_slug(name),
  CASE
    WHEN generate_slug(name) != '' THEN '-' || SUBSTR(id::text, 1, 4)
    ELSE SUBSTR(id::text, 1, 8)
  END
);

-- Populate slugs for existing sessions
UPDATE public.sessions
SET slug = CONCAT(
  generate_slug(name),
  CASE
    WHEN generate_slug(name) != '' THEN '-' || SUBSTR(id::text, 1, 4)
    ELSE SUBSTR(id::text, 1, 8)
  END
);

-- Make slug columns NOT NULL now that they're populated
ALTER TABLE public.campaigns ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.sessions ALTER COLUMN slug SET NOT NULL;

-- Add unique constraint for campaigns slug
ALTER TABLE public.campaigns ADD CONSTRAINT unique_campaigns_slug UNIQUE (slug);

-- Create unique constraint on campaign_id + slug for sessions (allows same slug in different campaigns)
ALTER TABLE public.sessions ADD CONSTRAINT unique_campaign_session_slug UNIQUE (campaign_id, slug);

-- Create indexes for faster lookups
CREATE INDEX idx_campaigns_slug ON public.campaigns(slug);
CREATE INDEX idx_sessions_slug ON public.sessions(campaign_id, slug);
