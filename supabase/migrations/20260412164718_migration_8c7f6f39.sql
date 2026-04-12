CREATE TABLE IF NOT EXISTS master_scopes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE master_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON master_scopes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE master_items ADD COLUMN IF NOT EXISTS associated_scopes JSONB DEFAULT '[]'::jsonb;