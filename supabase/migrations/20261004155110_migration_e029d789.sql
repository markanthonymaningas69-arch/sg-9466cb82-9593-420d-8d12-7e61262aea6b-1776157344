-- Create or replace the trigger function to update cash advance balance
CREATE OR REPLACE FUNCTION update_cash_advance_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the balance and status of the cash advance
  UPDATE cash_advances
  SET 
    balance = amount - (
      SELECT COALESCE(SUM(amount), 0)
      FROM cash_advance_deductions
      WHERE cash_advance_id = COALESCE(NEW.cash_advance_id, OLD.cash_advance_id)
    ),
    status = CASE 
      WHEN amount - (
        SELECT COALESCE(SUM(amount), 0)
        FROM cash_advance_deductions
        WHERE cash_advance_id = COALESCE(NEW.cash_advance_id, OLD.cash_advance_id)
      ) <= 0 THEN 'fully_paid'
      ELSE 'active'
    END,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.cash_advance_id, OLD.cash_advance_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_cash_advance_balance_trigger ON cash_advance_deductions;

-- Create trigger on INSERT, UPDATE, DELETE
CREATE TRIGGER update_cash_advance_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON cash_advance_deductions
FOR EACH ROW
EXECUTE FUNCTION update_cash_advance_balance();