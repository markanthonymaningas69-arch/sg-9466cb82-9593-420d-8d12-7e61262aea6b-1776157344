ALTER TABLE bom_scope_of_work ADD COLUMN quantity numeric(15,2) DEFAULT 1;
ALTER TABLE bom_scope_of_work ADD COLUMN unit text DEFAULT 'lot';