ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'delivery',
ADD COLUMN IF NOT EXISTS bom_scope_id uuid NULL REFERENCES public.bom_scope_of_work(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS unit_cost numeric(15,2) NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount numeric(15,2) NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deliveries_transaction_type_check'
  ) THEN
    ALTER TABLE public.deliveries
    ADD CONSTRAINT deliveries_transaction_type_check
    CHECK (transaction_type IN ('site_purchase', 'delivery'));
  END IF;
END $$;