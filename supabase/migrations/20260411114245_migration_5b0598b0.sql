ALTER TABLE personnel ADD COLUMN IF NOT EXISTS daily_rate numeric(10,2) DEFAULT 0;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS overtime_rate numeric(10,2) DEFAULT 0;