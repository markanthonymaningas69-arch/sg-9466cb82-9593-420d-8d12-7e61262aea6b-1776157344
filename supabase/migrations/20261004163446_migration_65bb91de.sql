-- Add RLS policies for payroll_voucher_deductions if missing
ALTER TABLE payroll_voucher_deductions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert deductions
DROP POLICY IF EXISTS "allow_insert_payroll_deductions" ON payroll_voucher_deductions;
CREATE POLICY "allow_insert_payroll_deductions" ON payroll_voucher_deductions
FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow authenticated users to read deductions
DROP POLICY IF EXISTS "allow_select_payroll_deductions" ON payroll_voucher_deductions;
CREATE POLICY "allow_select_payroll_deductions" ON payroll_voucher_deductions
FOR SELECT TO authenticated
USING (true);