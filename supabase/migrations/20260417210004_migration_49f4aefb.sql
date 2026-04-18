-- 1. Drop the old policies with the "OR company_id IS NULL" loophole
DROP POLICY IF EXISTS "tenant_isolation" ON master_items;
DROP POLICY IF EXISTS "tenant_isolation" ON master_scopes;

-- 2. Clean up old global records that were causing cross-account visibility
DELETE FROM master_items WHERE company_id IS NULL;
DELETE FROM master_scopes WHERE company_id IS NULL;

-- 3. Install strict tenant isolation policies
CREATE POLICY "tenant_isolation" ON master_items FOR ALL USING (company_id = public.auth_company_id()) WITH CHECK (company_id = public.auth_company_id());
CREATE POLICY "tenant_isolation" ON master_scopes FOR ALL USING (company_id = public.auth_company_id()) WITH CHECK (company_id = public.auth_company_id());