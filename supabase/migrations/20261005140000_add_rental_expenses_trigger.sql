-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for rental_expenses updated_at
DROP TRIGGER IF EXISTS update_rental_expenses_updated_at ON rental_expenses;
CREATE TRIGGER update_rental_expenses_updated_at
  BEFORE UPDATE ON rental_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();