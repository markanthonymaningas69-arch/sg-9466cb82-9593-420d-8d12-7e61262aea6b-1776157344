-- Create Site Personnel tables for daily operations

-- Daily site attendance (different from HR attendance - this is project-specific)
CREATE TABLE site_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_in TIME,
  time_out TIME,
  hours_worked DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, personnel_id, date)
);

-- Deliveries tracking
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  supplier TEXT NOT NULL,
  items TEXT NOT NULL,
  quantity DECIMAL(10,2),
  unit TEXT,
  received_by TEXT,
  notes TEXT,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'verified', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scope of works
CREATE TABLE scope_of_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_name TEXT NOT NULL,
  description TEXT,
  estimated_hours DECIMAL(10,2),
  estimated_cost DECIMAL(12,2),
  start_date DATE,
  target_end_date DATE,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily progress updates per scope
CREATE TABLE progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID NOT NULL REFERENCES scope_of_works(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  update_date DATE NOT NULL,
  progress_percentage DECIMAL(5,2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  hours_spent DECIMAL(10,2),
  work_completed TEXT,
  issues TEXT,
  photos TEXT[], -- Array of photo URLs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (allow all operations without login)
ALTER TABLE site_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_site_attendance" ON site_attendance FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_deliveries" ON deliveries FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE scope_of_works ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_scope" ON scope_of_works FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE progress_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_progress" ON progress_updates FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_site_attendance_project ON site_attendance(project_id);
CREATE INDEX idx_site_attendance_date ON site_attendance(date);
CREATE INDEX idx_deliveries_project ON deliveries(project_id);
CREATE INDEX idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX idx_scope_project ON scope_of_works(project_id);
CREATE INDEX idx_progress_scope ON progress_updates(scope_id);
CREATE INDEX idx_progress_date ON progress_updates(update_date);