-- 1. Backfill Active Subscriptions for existing users without one
INSERT INTO subscriptions (user_id, plan, status, start_date, end_date, amount, features)
SELECT 
    id, 
    'professional', 
    'active', 
    CURRENT_DATE, 
    CURRENT_DATE + INTERVAL '1 month', 
    99.00, 
    '{"maxProjects": -1, "maxUsers": -1}'::jsonb
FROM profiles
WHERE id NOT IN (SELECT user_id FROM subscriptions WHERE user_id IS NOT NULL);

-- 2. Fix the Invite Code visibility for new users
DROP POLICY IF EXISTS "tenant_isolation_invites" ON invite_codes;
DROP POLICY IF EXISTS "tenant_isolation" ON invite_codes;

-- Anyone can read an invite code to validate it during onboarding
CREATE POLICY "public_read_invites" ON invite_codes FOR SELECT USING (true);

-- Users can only create/delete invite codes for their own company
CREATE POLICY "tenant_insert_invites" ON invite_codes FOR INSERT WITH CHECK (company_id = public.auth_company_id());
CREATE POLICY "tenant_delete_invites" ON invite_codes FOR DELETE USING (company_id = public.auth_company_id());

-- Allow anyone to update an invite code (to mark it as 'used' during onboarding)
CREATE POLICY "public_update_invites" ON invite_codes FOR UPDATE USING (true);