ALTER TABLE site_requests ADD COLUMN IF NOT EXISTS form_number text;
ALTER TABLE cash_advance_requests ADD COLUMN IF NOT EXISTS form_number text;