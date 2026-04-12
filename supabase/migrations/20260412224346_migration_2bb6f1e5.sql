ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_order_number_key;
DROP INDEX IF EXISTS purchases_order_number_key;