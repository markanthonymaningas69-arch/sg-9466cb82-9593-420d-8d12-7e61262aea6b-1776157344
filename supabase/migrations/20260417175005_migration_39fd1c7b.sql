ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id) ON DELETE SET NULL;
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE;

-- Ensure broad access to company settings so all logged-in users can read their company details
DROP POLICY IF EXISTS "Public read for company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can manage their own company settings" ON company_settings;
CREATE POLICY "anon_all_company_settings" ON company_settings FOR ALL USING (true) WITH CHECK (true);