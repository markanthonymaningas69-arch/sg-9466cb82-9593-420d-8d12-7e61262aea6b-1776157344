ALTER TABLE public.approval_requests
ADD COLUMN IF NOT EXISTS target_module text,
ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'pending_approval',
ADD COLUMN IF NOT EXISTS routed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

UPDATE public.approval_requests
SET target_module = COALESCE(
  target_module,
  CASE
    WHEN source_table = 'site_requests' AND LOWER(COALESCE(payload->>'requestType', request_type, '')) LIKE '%material%' THEN 'Purchasing'
    WHEN source_table = 'site_requests' AND (
      LOWER(COALESCE(payload->>'requestType', request_type, '')) LIKE '%tool%'
      OR LOWER(COALESCE(payload->>'requestType', request_type, '')) LIKE '%equipment%'
    ) THEN 'Purchasing'
    WHEN source_table = 'site_requests' AND LOWER(COALESCE(payload->>'requestType', request_type, '')) LIKE '%cash advance%' THEN 'Accounting'
    WHEN source_table = 'site_requests' AND LOWER(COALESCE(payload->>'requestType', request_type, '')) LIKE '%petty cash%' THEN 'Accounting'
    WHEN source_table = 'cash_advance_requests' THEN 'Accounting'
    WHEN source_table = 'vouchers' THEN 'Accounting'
    WHEN source_table = 'liquidations' THEN 'Accounting'
    WHEN source_table = 'leave_requests' THEN 'HR'
    WHEN source_table = 'purchases' THEN 'Purchasing'
    ELSE NULL
  END
);

UPDATE public.approval_requests
SET workflow_status = CASE
  WHEN status = 'approved' AND target_module = 'Purchasing' THEN 'in_purchasing'
  WHEN status = 'approved' AND target_module = 'Accounting' THEN 'in_accounting'
  WHEN status = 'approved' THEN 'approved'
  WHEN status = 'rejected' THEN 'rejected'
  WHEN status = 'returned_for_revision' THEN 'returned_for_revision'
  ELSE 'pending_approval'
END
WHERE workflow_status IS NULL
   OR workflow_status = 'pending_approval';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'approval_requests_workflow_status_check'
  ) THEN
    ALTER TABLE public.approval_requests
    ADD CONSTRAINT approval_requests_workflow_status_check
    CHECK (
      workflow_status IN (
        'pending_approval',
        'approved',
        'rejected',
        'returned_for_revision',
        'in_purchasing',
        'in_accounting',
        'completed'
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_approval_requests_target_module
ON public.approval_requests (target_module, workflow_status, updated_at DESC);