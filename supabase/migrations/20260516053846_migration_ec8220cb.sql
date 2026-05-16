ALTER TABLE purchases ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_purchases_is_deleted ON purchases(is_deleted);