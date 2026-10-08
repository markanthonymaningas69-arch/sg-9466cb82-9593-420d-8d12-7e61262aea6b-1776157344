ALTER TABLE subcontractor_payments
ADD COLUMN bom_scope_id uuid REFERENCES bom_scope_of_work(id) ON DELETE SET NULL;

CREATE INDEX idx_subcontractor_payments_scope ON subcontractor_payments(bom_scope_id);

COMMENT ON COLUMN subcontractor_payments.bom_scope_id IS 'Links payment to specific BOM scope for analytics tracking';