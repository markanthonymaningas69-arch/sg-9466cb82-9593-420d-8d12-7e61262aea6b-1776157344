ALTER TABLE site_requests 
ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'Materials',
ADD COLUMN IF NOT EXISTS amount numeric(12,2) DEFAULT 0;