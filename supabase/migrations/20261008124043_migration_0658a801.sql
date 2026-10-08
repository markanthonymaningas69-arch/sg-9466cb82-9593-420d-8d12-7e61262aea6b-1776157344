-- Create subcontractors table
CREATE TABLE IF NOT EXISTS subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope_of_work TEXT NOT NULL,
  contract_amount NUMERIC(15, 2) NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'suspended', 'cancelled')),
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  payment_terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create subcontractor_payments table
CREATE TABLE IF NOT EXISTS subcontractor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  payment_number INTEGER NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  accomplishment_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  description TEXT,
  retention_amount NUMERIC(15, 2) DEFAULT 0,
  deductions NUMERIC(15, 2) DEFAULT 0,
  net_amount NUMERIC(15, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_subcontractors_project ON subcontractors(project_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_subcontractor ON subcontractor_payments(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_project ON subcontractor_payments(project_id);

-- Enable RLS
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subcontractors
CREATE POLICY "authenticated_read_subcontractors" ON subcontractors
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_subcontractors" ON subcontractors
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_subcontractors" ON subcontractors
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_subcontractors" ON subcontractors
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for subcontractor_payments
CREATE POLICY "authenticated_read_subcontractor_payments" ON subcontractor_payments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_subcontractor_payments" ON subcontractor_payments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_subcontractor_payments" ON subcontractor_payments
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_subcontractor_payments" ON subcontractor_payments
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_subcontractor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subcontractors_updated_at
  BEFORE UPDATE ON subcontractors
  FOR EACH ROW
  EXECUTE FUNCTION update_subcontractor_updated_at();

CREATE TRIGGER update_subcontractor_payments_updated_at
  BEFORE UPDATE ON subcontractor_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_subcontractor_updated_at();