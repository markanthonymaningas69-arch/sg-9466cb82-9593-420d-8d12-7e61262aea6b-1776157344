ALTER TABLE site_requests ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE material_consumption ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE cash_advance_requests ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;