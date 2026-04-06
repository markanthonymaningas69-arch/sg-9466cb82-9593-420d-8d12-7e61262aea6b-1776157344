DROP TABLE IF EXISTS progress_updates CASCADE;
DROP TABLE IF EXISTS scope_of_works CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS site_attendance CASCADE;

CREATE TABLE site_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT DEFAULT 'present',
  hours_worked DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, personnel_id, date)
);

CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity DECIMAL(10,2),
  unit TEXT,
  supplier TEXT NOT NULL,
  received_by TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scope_of_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit TEXT,
  planned_quantity DECIMAL(10,2),
  completed_quantity DECIMAL(10,2) DEFAULT 0,
  order_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'not_started',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID NOT NULL REFERENCES scope_of_works(id) ON DELETE CASCADE,
  update_date DATE NOT NULL,
  quantity_completed DECIMAL(10,2),
  updated_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_site_attendance" ON site_attendance FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_deliveries" ON deliveries FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE scope_of_works ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_scope" ON scope_of_works FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE progress_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_progress" ON progress_updates FOR ALL USING (true) WITH CHECK (true);