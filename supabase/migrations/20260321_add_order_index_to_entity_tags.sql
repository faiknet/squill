-- Add order_index column to entity_tags table for drag-and-drop ordering
ALTER TABLE entity_tags 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT NULL;

-- Create index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_entity_tags_order 
ON entity_tags(campaign_id, tag_type, order_index);

-- Optional: Initialize order_index for existing records based on created_at
-- This ensures existing items have an order when the feature is deployed
UPDATE entity_tags 
SET order_index = subquery.row_num - 1
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY campaign_id, tag_type ORDER BY created_at) as row_num
  FROM entity_tags
  WHERE order_index IS NULL
) AS subquery
WHERE entity_tags.id = subquery.id;
