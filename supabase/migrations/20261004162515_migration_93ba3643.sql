-- Create table to store payroll deductions linked to vouchers
CREATE TABLE IF NOT EXISTS payroll_voucher_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE,
  personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
  deduction_type TEXT NOT NULL CHECK (deduction_type IN ('cash_advance', 'other')),
  amount DECIMAL(12,2) NOT NULL,
  deduction_date DATE NOT NULL,
  notes TEXT,
  cash_advance_id UUID REFERENCES cash_advances(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE payroll_voucher_deductions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to view payroll deductions"
  ON payroll_voucher_deductions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert payroll deductions"
  ON payroll_voucher_deductions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update payroll deductions"
  ON payroll_voucher_deductions FOR UPDATE
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_payroll_voucher_deductions_voucher ON payroll_voucher_deductions(voucher_id);
CREATE INDEX idx_payroll_voucher_deductions_personnel ON payroll_voucher_deductions(personnel_id);