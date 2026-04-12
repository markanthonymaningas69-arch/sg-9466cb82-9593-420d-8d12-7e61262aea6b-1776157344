CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);