CREATE TABLE IF NOT EXISTS site_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  item_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit TEXT NOT NULL,
  bom_scope_id UUID REFERENCES bom_scope_of_work(id) ON DELETE SET NULL,
  requested_by TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE site_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_site_requests" ON site_requests FOR ALL USING (true) WITH CHECK (true);