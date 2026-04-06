-- Create bill_of_materials table
CREATE TABLE IF NOT EXISTS bill_of_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bom_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  total_direct_cost NUMERIC(15,2) DEFAULT 0,
  total_indirect_cost NUMERIC(15,2) DEFAULT 0,
  grand_total NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT bom_status_check CHECK (status IN ('draft', 'approved', 'revised', 'final'))
);

-- Create scope_of_work table
CREATE TABLE IF NOT EXISTS bom_scope_of_work (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_id UUID NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_number INTEGER NOT NULL,
  total_materials NUMERIC(15,2) DEFAULT 0,
  total_labor NUMERIC(15,2) DEFAULT 0,
  subtotal NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bom_materials table
CREATE TABLE IF NOT EXISTS bom_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope_id UUID NOT NULL REFERENCES bom_scope_of_work(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,
  quantity NUMERIC(15,2) NOT NULL,
  unit_cost NUMERIC(15,2) NOT NULL,
  total_cost NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bom_labor table
CREATE TABLE IF NOT EXISTS bom_labor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope_id UUID NOT NULL REFERENCES bom_scope_of_work(id) ON DELETE CASCADE,
  labor_type TEXT NOT NULL,
  description TEXT,
  hours NUMERIC(10,2) NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(15,2) GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  crew_size INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bom_indirect_costs table
CREATE TABLE IF NOT EXISTS bom_indirect_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_id UUID NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
  vat_percentage NUMERIC(5,2) DEFAULT 0,
  vat_amount NUMERIC(15,2) DEFAULT 0,
  tax_percentage NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  ocm_percentage NUMERIC(5,2) DEFAULT 0,
  ocm_amount NUMERIC(15,2) DEFAULT 0,
  profit_percentage NUMERIC(5,2) DEFAULT 0,
  profit_amount NUMERIC(15,2) DEFAULT 0,
  other_costs JSONB DEFAULT '[]'::jsonb,
  total_indirect NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all BOM tables
ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_scope_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_indirect_costs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bill_of_materials
CREATE POLICY "public_read_bom" ON bill_of_materials FOR SELECT USING (true);
CREATE POLICY "auth_insert_bom" ON bill_of_materials FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_bom" ON bill_of_materials FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_bom" ON bill_of_materials FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create RLS policies for bom_scope_of_work
CREATE POLICY "public_read_scope" ON bom_scope_of_work FOR SELECT USING (true);
CREATE POLICY "auth_insert_scope" ON bom_scope_of_work FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_scope" ON bom_scope_of_work FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_scope" ON bom_scope_of_work FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create RLS policies for bom_materials
CREATE POLICY "public_read_materials" ON bom_materials FOR SELECT USING (true);
CREATE POLICY "auth_insert_materials" ON bom_materials FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_materials" ON bom_materials FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_materials" ON bom_materials FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create RLS policies for bom_labor
CREATE POLICY "public_read_labor" ON bom_labor FOR SELECT USING (true);
CREATE POLICY "auth_insert_labor" ON bom_labor FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_labor" ON bom_labor FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_labor" ON bom_labor FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create RLS policies for bom_indirect_costs
CREATE POLICY "public_read_indirect" ON bom_indirect_costs FOR SELECT USING (true);
CREATE POLICY "auth_insert_indirect" ON bom_indirect_costs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_indirect" ON bom_indirect_costs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_indirect" ON bom_indirect_costs FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_bom_project ON bill_of_materials(project_id);
CREATE INDEX idx_scope_bom ON bom_scope_of_work(bom_id);
CREATE INDEX idx_materials_scope ON bom_materials(scope_id);
CREATE INDEX idx_labor_scope ON bom_labor(scope_id);
CREATE INDEX idx_indirect_bom ON bom_indirect_costs(bom_id);