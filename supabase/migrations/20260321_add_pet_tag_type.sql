-- Fix existing data and update entity_tags check constraint to include 'pet' type

-- First, let's see what tag_type values currently exist
-- (This is just for reference, the actual fix is below)
-- SELECT DISTINCT tag_type FROM entity_tags;

-- Update any existing 'inventory' records to 'item' to match the constraint
UPDATE entity_tags SET tag_type = 'item' WHERE tag_type = 'inventory';

-- Update any other invalid tag_type values that might exist
-- Map any unknown types to a valid one (you can adjust this mapping as needed)
UPDATE entity_tags 
SET tag_type = CASE 
  WHEN tag_type NOT IN ('npc', 'location', 'item', 'pet') THEN 'item'
  ELSE tag_type 
END
WHERE tag_type NOT IN ('npc', 'location', 'item', 'pet');

-- Now drop the old constraint
ALTER TABLE entity_tags 
DROP CONSTRAINT IF EXISTS entity_tags_tag_type_check;

-- Add the new constraint with 'pet' included
ALTER TABLE entity_tags 
ADD CONSTRAINT entity_tags_tag_type_check 
CHECK (tag_type IN ('npc', 'location', 'item', 'pet'));
