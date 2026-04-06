-- Drop existing restrictive policies
DROP POLICY IF EXISTS "auth_insert" ON projects;
DROP POLICY IF EXISTS "auth_update" ON projects;
DROP POLICY IF EXISTS "auth_delete" ON projects;

-- Add new policies that allow anonymous operations
CREATE POLICY "anon_insert" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON projects FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON projects FOR DELETE USING (true);