ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_scope_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_indirect_costs ENABLE ROW LEVEL SECURITY;

-- Bill of Materials: allow anonymous insert/update
CREATE POLICY anon_insert_bom
ON bill_of_materials
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY anon_update_bom
ON bill_of_materials
FOR UPDATE
TO public
USING (true);

-- Scope of Work: allow anonymous insert/update/delete
CREATE POLICY anon_insert_scope
ON bom_scope_of_work
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY anon_update_scope
ON bom_scope_of_work
FOR UPDATE
TO public
USING (true);

CREATE POLICY anon_delete_scope
ON bom_scope_of_work
FOR DELETE
TO public
USING (true);

-- Materials: allow anonymous insert/update/delete
CREATE POLICY anon_insert_materials
ON bom_materials
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY anon_update_materials
ON bom_materials
FOR UPDATE
TO public
USING (true);

CREATE POLICY anon_delete_materials
ON bom_materials
FOR DELETE
TO public
USING (true);

-- Labor: allow anonymous insert/update/delete
CREATE POLICY anon_insert_labor
ON bom_labor
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY anon_update_labor
ON bom_labor
FOR UPDATE
TO public
USING (true);

CREATE POLICY anon_delete_labor
ON bom_labor
FOR DELETE
TO public
USING (true);

-- Indirect Costs: allow anonymous insert/update
CREATE POLICY anon_insert_indirect
ON bom_indirect_costs
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY anon_update_indirect
ON bom_indirect_costs
FOR UPDATE
TO public
USING (true);