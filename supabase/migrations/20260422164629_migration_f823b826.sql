CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  bom_scope_id UUID REFERENCES bom_scope_of_work(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INTEGER,
  progress NUMERIC DEFAULT 0,
  dependencies JSONB DEFAULT '[]'::jsonb, 
  assigned_team TEXT,
  priority TEXT DEFAULT 'Medium',
  constraint_type TEXT DEFAULT 'ASAP',
  status TEXT DEFAULT 'pending',
  sort_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_project_tasks" ON project_tasks FOR ALL USING (auth.uid() IS NOT NULL);