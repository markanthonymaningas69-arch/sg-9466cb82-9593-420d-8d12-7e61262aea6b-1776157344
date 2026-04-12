CREATE TABLE IF NOT EXISTS master_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  default_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE master_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON master_items;
CREATE POLICY "Allow all" ON master_items FOR ALL USING (true) WITH CHECK (true);