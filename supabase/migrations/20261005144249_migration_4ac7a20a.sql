-- Function to auto-deduct material consumption from warehouse inventory
CREATE OR REPLACE FUNCTION auto_deduct_material_consumption()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to deduct from warehouse inventory
  UPDATE site_warehouse_inventory
  SET 
    quantity = quantity - NEW.quantity,
    total_value = unit_cost * (quantity - NEW.quantity),
    updated_at = now()
  WHERE project_id = NEW.project_id 
    AND lower(item_name) = lower(NEW.item_name)
    AND unit = NEW.unit
    AND quantity >= NEW.quantity;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for material consumption
DROP TRIGGER IF EXISTS trigger_auto_deduct_consumption ON material_consumption;
CREATE TRIGGER trigger_auto_deduct_consumption
  AFTER INSERT ON material_consumption
  FOR EACH ROW
  EXECUTE FUNCTION auto_deduct_material_consumption();