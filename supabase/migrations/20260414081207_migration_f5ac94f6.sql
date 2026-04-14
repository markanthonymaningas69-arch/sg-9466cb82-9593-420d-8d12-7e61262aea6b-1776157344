CREATE TABLE IF NOT EXISTS bom_progress_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_scope_id UUID REFERENCES bom_scope_of_work(id) ON DELETE CASCADE,
  percentage_completed NUMERIC,
  update_date DATE,
  updated_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bom_progress_updates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "allow_all_progress_reads" ON bom_progress_updates FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "allow_all_progress_inserts" ON bom_progress_updates FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "allow_all_progress_updates" ON bom_progress_updates FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "allow_all_progress_deletes" ON bom_progress_updates FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;