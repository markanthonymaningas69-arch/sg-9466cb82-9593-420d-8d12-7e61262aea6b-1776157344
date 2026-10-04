-- Add INSERT policy for payroll_voucher_deductions
CREATE POLICY "insert_payroll_deductions" ON payroll_voucher_deductions
FOR INSERT TO authenticated
WITH CHECK (true);

-- Add UPDATE and DELETE policies for completeness
CREATE POLICY "update_payroll_deductions" ON payroll_voucher_deductions
FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "delete_payroll_deductions" ON payroll_voucher_deductions
FOR DELETE TO authenticated
USING (true);