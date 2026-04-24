CREATE TABLE IF NOT EXISTS public.subscription_billing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  price_amount NUMERIC(10,2) NOT NULL,
  currency_code TEXT NOT NULL,
  country TEXT NOT NULL,
  billing_cycle TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT subscription_billing_snapshots_price_amount_check CHECK (price_amount > 0),
  CONSTRAINT subscription_billing_snapshots_currency_code_check CHECK (currency_code IN ('AED', 'PHP')),
  CONSTRAINT subscription_billing_snapshots_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'annual')),
  CONSTRAINT subscription_billing_snapshots_status_check CHECK (status IN ('pending', 'paid', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_subscription_billing_snapshots_user_id
  ON public.subscription_billing_snapshots(user_id);

CREATE INDEX IF NOT EXISTS idx_subscription_billing_snapshots_session_id
  ON public.subscription_billing_snapshots(stripe_session_id);

ALTER TABLE public.subscription_billing_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_billing_snapshots'
      AND policyname = 'select_own_subscription_billing_snapshots'
  ) THEN
    CREATE POLICY select_own_subscription_billing_snapshots
      ON public.subscription_billing_snapshots
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_billing_snapshots'
      AND policyname = 'insert_own_subscription_billing_snapshots'
  ) THEN
    CREATE POLICY insert_own_subscription_billing_snapshots
      ON public.subscription_billing_snapshots
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_billing_snapshots'
      AND policyname = 'update_own_subscription_billing_snapshots'
  ) THEN
    CREATE POLICY update_own_subscription_billing_snapshots
      ON public.subscription_billing_snapshots
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.stripe_subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES public.subscription_billing_snapshots(id) ON DELETE SET NULL,
  plan_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency_code TEXT NOT NULL,
  country TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT stripe_subscription_transactions_amount_check CHECK (amount > 0),
  CONSTRAINT stripe_subscription_transactions_currency_code_check CHECK (currency_code IN ('AED', 'PHP')),
  CONSTRAINT stripe_subscription_transactions_status_check CHECK (status IN ('pending', 'paid', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_stripe_subscription_transactions_user_id
  ON public.stripe_subscription_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_stripe_subscription_transactions_snapshot_id
  ON public.stripe_subscription_transactions(snapshot_id);

ALTER TABLE public.stripe_subscription_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stripe_subscription_transactions'
      AND policyname = 'select_own_stripe_subscription_transactions'
  ) THEN
    CREATE POLICY select_own_stripe_subscription_transactions
      ON public.stripe_subscription_transactions
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stripe_subscription_transactions'
      AND policyname = 'insert_own_stripe_subscription_transactions'
  ) THEN
    CREATE POLICY insert_own_stripe_subscription_transactions
      ON public.stripe_subscription_transactions
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;