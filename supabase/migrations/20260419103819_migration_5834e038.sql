ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS stripe_customer_id text,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

    -- Also add to company_settings as a fallback for customer-level tracking if needed
    ALTER TABLE company_settings
    ADD COLUMN IF NOT EXISTS stripe_customer_id text;