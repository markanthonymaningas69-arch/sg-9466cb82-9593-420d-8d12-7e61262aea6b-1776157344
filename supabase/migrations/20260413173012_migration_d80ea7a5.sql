CREATE TABLE IF NOT EXISTS personnel_visas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
  visa_number TEXT NOT NULL,
  country TEXT NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE personnel_visas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable full access for authenticated users" ON personnel_visas FOR ALL USING (auth.uid() IS NOT NULL);