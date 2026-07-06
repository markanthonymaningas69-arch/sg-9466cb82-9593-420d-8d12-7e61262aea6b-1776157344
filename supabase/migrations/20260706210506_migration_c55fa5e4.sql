-- Add item_type column to inventory table if it doesn't exist
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS item_type TEXT CHECK (item_type IN ('material', 'tool_equipment'));

-- Set default value for existing records
UPDATE inventory 
SET item_type = 'material' 
WHERE item_type IS NULL;