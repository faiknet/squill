-- Diagnostic and Fix Script for entity_tags constraint issue (Postgres 12+ compatible)

-- Step 1: Check current constraint (using pg_get_constraintdef instead of consrc)
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint 
WHERE conrelid = 'entity_tags'::regclass 
AND contype = 'c';

-- Step 2: Check what tag_type values currently exist
SELECT tag_type, COUNT(*) 
FROM entity_tags 
GROUP BY tag_type;

-- Step 3: Force drop ALL check constraints on entity_tags
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Find all check constraints on entity_tags
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'entity_tags'::regclass 
        AND contype = 'c'
    LOOP
        -- Drop them
        EXECUTE 'ALTER TABLE entity_tags DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
    END LOOP;
END $$;

-- Step 4: Clean up any problematic data
-- Convert 'inventory' to 'item'
UPDATE entity_tags SET tag_type = 'item' WHERE tag_type = 'inventory';

-- Convert anything else invalid to 'item' (fallback)
UPDATE entity_tags 
SET tag_type = 'item' 
WHERE tag_type NOT IN ('npc', 'location', 'item', 'pet');

-- Step 5: Add the new constraint
ALTER TABLE entity_tags 
ADD CONSTRAINT entity_tags_tag_type_check 
CHECK (tag_type IN ('npc', 'location', 'item', 'pet'));

-- Step 6: Verify the constraint is working
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint 
WHERE conrelid = 'entity_tags'::regclass 
AND conname = 'entity_tags_tag_type_check';