-- Create cash_advances table for tracking cash advances given to personnel
CREATE TABLE IF NOT EXISTS cash_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  amount numeric(15,2) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  purpose text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fully_paid', 'cancelled')),
  balance numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  issued_by text NOT NULL,
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES company_settings(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create cash_advance_deductions table for tracking repayments
CREATE TABLE IF NOT EXISTS cash_advance_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_advance_id uuid NOT NULL REFERENCES cash_advances(id) ON DELETE CASCADE,
  deduction_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(15,2) NOT NULL,
  deduction_source text NOT NULL DEFAULT 'manual',
  notes text,
  recorded_by text NOT NULL,
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES company_settings(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE cash_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_advance_deductions ENABLE ROW LEVEL SECURITY;

-- RLS policies for cash_advances
CREATE POLICY tenant_isolation_cash_advances ON cash_advances
  FOR ALL USING (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- RLS policies for cash_advance_deductions
CREATE POLICY tenant_isolation_cash_advance_deductions ON cash_advance_deductions
  FOR ALL USING (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- Create indexes
CREATE INDEX idx_cash_advances_personnel ON cash_advances(personnel_id, date DESC);
CREATE INDEX idx_cash_advances_project ON cash_advances(project_id, date DESC);
CREATE INDEX idx_cash_advances_status ON cash_advances(status);
CREATE INDEX idx_cash_advance_deductions_advance ON cash_advance_deductions(cash_advance_id, deduction_date DESC);

-- Create function to update balance automatically
CREATE OR REPLACE FUNCTION update_cash_advance_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cash_advances
  SET balance = amount - COALESCE((
    SELECT SUM(amount)
    FROM cash_advance_deductions
    WHERE cash_advance_id = NEW.cash_advance_id
  ), 0),
  updated_at = now()
  WHERE id = NEW.cash_advance_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update balance on deduction insert/update/delete
CREATE TRIGGER trigger_update_cash_advance_balance_insert
AFTER INSERT ON cash_advance_deductions
FOR EACH ROW EXECUTE FUNCTION update_cash_advance_balance();

CREATE TRIGGER trigger_update_cash_advance_balance_update
AFTER UPDATE ON cash_advance_deductions
FOR EACH ROW EXECUTE FUNCTION update_cash_advance_balance();

CREATE TRIGGER trigger_update_cash_advance_balance_delete
AFTER DELETE ON cash_advance_deductions
FOR EACH ROW EXECUTE FUNCTION update_cash_advance_balance();