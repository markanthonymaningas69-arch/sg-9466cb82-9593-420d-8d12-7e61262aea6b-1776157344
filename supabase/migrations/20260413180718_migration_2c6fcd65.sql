CREATE TABLE IF NOT EXISTS cash_advance_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  request_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cash_advance_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON cash_advance_requests;
CREATE POLICY "Enable all for authenticated users" ON cash_advance_requests FOR ALL USING (auth.uid() IS NOT NULL);