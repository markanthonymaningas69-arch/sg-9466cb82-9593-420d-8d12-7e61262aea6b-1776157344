ALTER TABLE personnel_visas 
ADD COLUMN IF NOT EXISTS visa_issue_date date,
ADD COLUMN IF NOT EXISTS visa_expiry_date date,
ADD COLUMN IF NOT EXISTS passport_issue_date date,
ADD COLUMN IF NOT EXISTS passport_expiry_date date;