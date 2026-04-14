CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  module TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all invite_codes" ON invite_codes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_module TEXT DEFAULT 'GM';