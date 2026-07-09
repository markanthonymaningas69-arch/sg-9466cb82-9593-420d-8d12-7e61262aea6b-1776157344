CREATE TABLE IF NOT EXISTS site_warehouse_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Materials' or 'Tools & Equipments'
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  date_received DATE NOT NULL,
  received_by TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'available', -- 'available', 'in_use', 'depleted'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE site_warehouse_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_company" ON site_warehouse_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = site_warehouse_inventory.project_id
      AND pr.id = auth.uid()
    )
  );

CREATE POLICY "insert_own_company" ON site_warehouse_inventory FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = site_warehouse_inventory.project_id
      AND pr.id = auth.uid()
    )
  );

CREATE POLICY "update_own_company" ON site_warehouse_inventory FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = site_warehouse_inventory.project_id
      AND pr.id = auth.uid()
    )
  );

CREATE POLICY "delete_own_company" ON site_warehouse_inventory FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = site_warehouse_inventory.project_id
      AND pr.id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_site_warehouse_inventory_project ON site_warehouse_inventory(project_id);
CREATE INDEX idx_site_warehouse_inventory_category ON site_warehouse_inventory(category);
CREATE INDEX idx_site_warehouse_inventory_status ON site_warehouse_inventory(status);