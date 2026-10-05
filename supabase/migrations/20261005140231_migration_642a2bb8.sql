-- Add bom_scope_id to rental_expenses table
ALTER TABLE rental_expenses
ADD COLUMN IF NOT EXISTS bom_scope_id uuid REFERENCES bom_scope_of_work(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_rental_expenses_bom_scope_id ON rental_expenses(bom_scope_id);

-- Update RLS policies to ensure scope belongs to same project
DROP POLICY IF EXISTS "Users can view rental expenses for their organization's projects" ON rental_expenses;
CREATE POLICY "Users can view rental expenses for their organization's projects"
  ON rental_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = rental_expenses.project_id
      AND projects.company_id = auth.jwt() ->> 'company_id'
    )
  );

DROP POLICY IF EXISTS "Users can insert rental expenses for their organization's projects" ON rental_expenses;
CREATE POLICY "Users can insert rental expenses for their organization's projects"
  ON rental_expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = rental_expenses.project_id
      AND projects.company_id = auth.jwt() ->> 'company_id'
    )
  );

DROP POLICY IF EXISTS "Users can update rental expenses for their organization's projects" ON rental_expenses;
CREATE POLICY "Users can update rental expenses for their organization's projects"
  ON rental_expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = rental_expenses.project_id
      AND projects.company_id = auth.jwt() ->> 'company_id'
    )
  );

DROP POLICY IF EXISTS "Users can delete rental expenses for their organization's projects" ON rental_expenses;
CREATE POLICY "Users can delete rental expenses for their organization's projects"
  ON rental_expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = rental_expenses.project_id
      AND projects.company_id = auth.jwt() ->> 'company_id'
    )
  );