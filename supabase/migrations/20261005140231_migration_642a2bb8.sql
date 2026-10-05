-- Create rental_expenses table
CREATE TABLE IF NOT EXISTS rental_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rental_type text NOT NULL CHECK (rental_type IN ('Tools', 'Equipment', 'Accommodation', 'Other')),
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'unit',
  rate_per_unit numeric NOT NULL DEFAULT 0,
  rental_start_date date NOT NULL,
  rental_end_date date,
  supplier text,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_rental_expenses_project_id ON rental_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_rental_expenses_company_id ON rental_expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_rental_expenses_is_archived ON rental_expenses(is_archived);
CREATE INDEX IF NOT EXISTS idx_rental_expenses_rental_start_date ON rental_expenses(rental_start_date);

-- Enable RLS
ALTER TABLE rental_expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view rental expenses from their company" ON rental_expenses;
DROP POLICY IF EXISTS "Users can insert rental expenses for their company" ON rental_expenses;
DROP POLICY IF EXISTS "Users can update rental expenses from their company" ON rental_expenses;
DROP POLICY IF EXISTS "Users can delete rental expenses from their company" ON rental_expenses;

-- RLS Policies
CREATE POLICY "Users can view rental expenses from their company"
  ON rental_expenses FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert rental expenses for their company"
  ON rental_expenses FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update rental expenses from their company"
  ON rental_expenses FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete rental expenses from their company"
  ON rental_expenses FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_rental_expenses_updated_at ON rental_expenses;
CREATE TRIGGER update_rental_expenses_updated_at
  BEFORE UPDATE ON rental_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();