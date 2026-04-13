ALTER TABLE personnel 
ADD COLUMN IF NOT EXISTS created_source text DEFAULT 'Human Resources',
ADD COLUMN IF NOT EXISTS updated_source text DEFAULT 'Human Resources';