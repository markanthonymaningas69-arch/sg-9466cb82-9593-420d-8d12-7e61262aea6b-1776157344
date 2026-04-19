-- Allow team members to securely read the subscription status of their Company's General Manager (Owner)
DROP POLICY IF EXISTS "shared_company_subscription_read" ON subscriptions;

CREATE POLICY "shared_company_subscription_read" ON subscriptions
FOR SELECT USING (
  auth.uid() = user_id OR
  user_id IN (
    SELECT cs.user_id
    FROM company_settings cs
    JOIN profiles p ON p.company_id = cs.id
    WHERE p.id = auth.uid()
  )
);