-- Create project_billing table
CREATE TABLE IF NOT EXISTS project_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  billing_number TEXT NOT NULL,
  billing_date DATE NOT NULL,
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  payment_received DECIMAL(15, 2) NOT NULL DEFAULT 0,
  payment_date DATE,
  balance DECIMAL(15, 2) GENERATED ALWAYS AS (amount - payment_received) STORED,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  company_id UUID NOT NULL DEFAULT auth_company_id(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, billing_number)
);

-- Enable RLS
ALTER TABLE project_billing ENABLE ROW LEVEL SECURITY;

-- Create RLS policies using company_id for tenant isolation
CREATE POLICY "tenant_isolation_project_billing"
  ON project_billing
  FOR ALL
  USING (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_project_billing_project_id ON project_billing(project_id);
CREATE INDEX IF NOT EXISTS idx_project_billing_status ON project_billing(status);
CREATE INDEX IF NOT EXISTS idx_project_billing_date ON project_billing(billing_date);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_project_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_billing_updated_at
  BEFORE UPDATE ON project_billing
  FOR EACH ROW
  EXECUTE FUNCTION update_project_billing_updated_at();