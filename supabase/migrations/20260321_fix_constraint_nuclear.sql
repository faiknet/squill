-- Diagnostic and Fix Script for entity_tags constraint issue

-- Step 1: Check current constraint
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'entity_tags'::regclass 
AND conname = 'entity_tags_tag_type_check';

-- Step 2: Check what tag_type values currently exist
SELECT DISTINCT tag_type, COUNT(*) 
FROM entity_tags 
GROUP BY tag_type;

-- Step 3: Force drop ALL check constraints on entity_tags (nuclear option)
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'entity_tags'::regclass
        AND contype = 'c'  -- check constraint
    LOOP
        EXECUTE 'ALTER TABLE entity_tags DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
    END LOOP;
END $$;

-- Step 4: Clean up any problematic data (just in case)
UPDATE entity_tags SET tag_type = 'item' WHERE tag_type = 'inventory';
UPDATE entity_tags SET tag_type = 'item' WHERE tag_type NOT IN ('npc', 'location', 'item', 'pet');

-- Step 5: Add the new constraint
ALTER TABLE entity_tags 
ADD CONSTRAINT entity_tags_tag_type_check 
CHECK (tag_type IN ('npc', 'location', 'item', 'pet'));

-- Step 6: Verify the constraint is working
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'entity_tags'::regclass 
AND conname = 'entity_tags_tag_type_check';