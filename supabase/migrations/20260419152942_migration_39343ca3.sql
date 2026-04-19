-- Ensure users have full permission to upsert their own profiles during onboarding
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON profiles;

CREATE POLICY "Enable insert for users based on user_id" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Enable update for users based on user_id" ON profiles FOR UPDATE USING (auth.uid() = id);