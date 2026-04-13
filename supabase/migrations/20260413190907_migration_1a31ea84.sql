UPDATE vouchers SET status = 'approved' WHERE status = 'draft';
ALTER TABLE vouchers ALTER COLUMN status SET DEFAULT 'approved';