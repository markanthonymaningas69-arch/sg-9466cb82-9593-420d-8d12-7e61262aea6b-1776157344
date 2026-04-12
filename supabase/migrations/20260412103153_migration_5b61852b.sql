CREATE TABLE IF NOT EXISTS material_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bom_scope_id UUID REFERENCES bom_scope_of_work(id) ON DELETE SET NULL,
  date_used DATE NOT NULL DEFAULT CURRENT_DATE,
  item_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit TEXT NOT NULL,
  recorded_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE material_consumption ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'material_consumption' AND policyname = 'Allow all'
  ) THEN
      CREATE POLICY "Allow all" ON material_consumption FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;