ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;

UPDATE purchases SET status = 'pending' WHERE status = 'ordered';
UPDATE purchases SET status = 'received' WHERE status = 'delivered';

ALTER TABLE purchases ADD CONSTRAINT purchases_status_check CHECK (status IN ('pending', 'approved', 'received'));