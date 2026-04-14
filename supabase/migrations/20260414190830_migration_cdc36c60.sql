-- Allow authenticated users (like the GM) to update profiles so they can assign modules/projects
DROP POLICY IF EXISTS "auth_update_profiles_all" ON profiles;
CREATE POLICY "auth_update_profiles_all" ON profiles FOR UPDATE USING (auth.uid() IS NOT NULL);