-- Function to auto-add site purchases to warehouse inventory
CREATE OR REPLACE FUNCTION auto_add_site_purchase_to_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process site_purchase transactions
  IF NEW.transaction_type = 'site_purchase' THEN
    -- Check if item already exists in warehouse
    DECLARE
      existing_item_id uuid;
      existing_quantity numeric;
    BEGIN
      SELECT id, quantity INTO existing_item_id, existing_quantity
      FROM site_warehouse_inventory
      WHERE project_id = NEW.project_id 
        AND lower(item_name) = lower(NEW.item_name)
        AND unit = NEW.unit
      LIMIT 1;
      
      IF existing_item_id IS NOT NULL THEN
        -- Update existing item: add quantity, update cost (weighted average)
        UPDATE site_warehouse_inventory
        SET 
          quantity = quantity + NEW.quantity,
          unit_cost = ((unit_cost * existing_quantity) + (NEW.unit_cost * NEW.quantity)) / (existing_quantity + NEW.quantity),
          total_value = ((unit_cost * existing_quantity) + (NEW.unit_cost * NEW.quantity)),
          date_received = GREATEST(date_received, NEW.delivery_date),
          supplier = COALESCE(NEW.supplier, supplier),
          received_by = COALESCE(NEW.received_by, received_by),
          updated_at = now()
        WHERE id = existing_item_id;
      ELSE
        -- Insert new item
        INSERT INTO site_warehouse_inventory (
          project_id,
          item_name,
          category,
          quantity,
          unit,
          unit_cost,
          total_value,
          supplier,
          date_received,
          received_by,
          notes,
          status,
          created_at,
          updated_at
        ) VALUES (
          NEW.project_id,
          NEW.item_name,
          'Materials',
          NEW.quantity,
          NEW.unit,
          NEW.unit_cost,
          NEW.unit_cost * NEW.quantity,
          NEW.supplier,
          NEW.delivery_date,
          COALESCE(NEW.received_by, 'System'),
          NEW.notes,
          'available',
          now(),
          now()
        );
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for site purchases
DROP TRIGGER IF EXISTS trigger_auto_add_site_purchase ON deliveries;
CREATE TRIGGER trigger_auto_add_site_purchase
  AFTER INSERT ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_site_purchase_to_inventory();