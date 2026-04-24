CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_module TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_record_id UUID NOT NULL,
  request_type TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT NULL,
  latest_comment TEXT NULL,
  reviewed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  company_id UUID NOT NULL DEFAULT auth_company_id() REFERENCES public.company_settings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT approval_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'returned_for_revision')),
  CONSTRAINT approval_requests_source_record_unique UNIQUE (source_table, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_company_status ON public.approval_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_company_module ON public.approval_requests(company_id, source_module);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_at ON public.approval_requests(requested_at DESC);

CREATE TABLE IF NOT EXISTS public.approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action_status TEXT NOT NULL,
  comments TEXT NULL,
  company_id UUID NOT NULL DEFAULT auth_company_id() REFERENCES public.company_settings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT approval_actions_status_check CHECK (action_status IN ('pending', 'approved', 'rejected', 'returned_for_revision'))
);

CREATE INDEX IF NOT EXISTS idx_approval_actions_request_id ON public.approval_actions(approval_request_id, created_at DESC);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_approval_requests ON public.approval_requests;
CREATE POLICY tenant_isolation_approval_requests
ON public.approval_requests
FOR ALL
USING (company_id = auth_company_id())
WITH CHECK (company_id = auth_company_id());

DROP POLICY IF EXISTS tenant_isolation_approval_actions ON public.approval_actions;
CREATE POLICY tenant_isolation_approval_actions
ON public.approval_actions
FOR ALL
USING (company_id = auth_company_id())
WITH CHECK (company_id = auth_company_id());

INSERT INTO public.approval_requests (
  source_module,
  source_table,
  source_record_id,
  request_type,
  requested_by,
  requested_at,
  project_id,
  status,
  summary,
  payload,
  company_id
)
SELECT
  'Site Personnel',
  'site_requests',
  sr.id,
  COALESCE(sr.request_type, 'Materials'),
  sr.requested_by,
  COALESCE(sr.created_at, sr.request_date::timestamp with time zone),
  sr.project_id,
  CASE
    WHEN sr.status = 'approved' OR sr.status = 'fulfilled' THEN 'approved'
    WHEN sr.status = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  CONCAT(sr.item_name, ' (', COALESCE(sr.quantity, 0), ' ', COALESCE(sr.unit, ''), ')'),
  jsonb_build_object(
    'form_number', sr.form_number,
    'item_name', sr.item_name,
    'quantity', sr.quantity,
    'unit', sr.unit,
    'amount', sr.amount,
    'notes', sr.notes
  ),
  sr.company_id
FROM public.site_requests sr
WHERE COALESCE(sr.is_archived, false) = false
ON CONFLICT (source_table, source_record_id) DO UPDATE
SET
  request_type = EXCLUDED.request_type,
  requested_by = EXCLUDED.requested_by,
  requested_at = EXCLUDED.requested_at,
  project_id = EXCLUDED.project_id,
  status = EXCLUDED.status,
  summary = EXCLUDED.summary,
  payload = EXCLUDED.payload,
  company_id = EXCLUDED.company_id,
  updated_at = NOW();

INSERT INTO public.approval_requests (
  source_module,
  source_table,
  source_record_id,
  request_type,
  requested_by,
  requested_at,
  project_id,
  status,
  summary,
  payload,
  company_id
)
SELECT
  'Site Personnel',
  'cash_advance_requests',
  car.id,
  'Cash Advance',
  COALESCE(p.name, 'Site Personnel'),
  COALESCE(car.created_at, car.request_date::timestamp with time zone),
  car.project_id,
  CASE
    WHEN car.status = 'approved' OR car.status = 'paid' THEN 'approved'
    WHEN car.status = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  CONCAT('Cash advance for ', COALESCE(p.name, 'Site Personnel'), ' - ', COALESCE(car.amount, 0)),
  jsonb_build_object(
    'form_number', car.form_number,
    'amount', car.amount,
    'reason', car.reason
  ),
  car.company_id
FROM public.cash_advance_requests car
LEFT JOIN public.personnel p ON p.id = car.personnel_id
WHERE COALESCE(car.is_archived, false) = false
ON CONFLICT (source_table, source_record_id) DO UPDATE
SET
  requested_by = EXCLUDED.requested_by,
  requested_at = EXCLUDED.requested_at,
  project_id = EXCLUDED.project_id,
  status = EXCLUDED.status,
  summary = EXCLUDED.summary,
  payload = EXCLUDED.payload,
  company_id = EXCLUDED.company_id,
  updated_at = NOW();

INSERT INTO public.approval_requests (
  source_module,
  source_table,
  source_record_id,
  request_type,
  requested_by,
  requested_at,
  project_id,
  status,
  summary,
  payload,
  company_id
)
SELECT
  'HR',
  'leave_requests',
  lr.id,
  'Leave Request',
  COALESCE(p.name, 'HR Request'),
  lr.created_at,
  p.project_id,
  CASE
    WHEN lr.status = 'approved' THEN 'approved'
    WHEN lr.status = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  CONCAT(INITCAP(lr.leave_type), ' leave (', lr.days_requested, ' day/s)'),
  jsonb_build_object(
    'leave_type', lr.leave_type,
    'start_date', lr.start_date,
    'end_date', lr.end_date,
    'days_requested', lr.days_requested,
    'reason', lr.reason,
    'notes', lr.notes
  ),
  lr.company_id
FROM public.leave_requests lr
LEFT JOIN public.personnel p ON p.id = lr.personnel_id
WHERE COALESCE(lr.is_archived, false) = false
ON CONFLICT (source_table, source_record_id) DO UPDATE
SET
  requested_by = EXCLUDED.requested_by,
  requested_at = EXCLUDED.requested_at,
  project_id = EXCLUDED.project_id,
  status = EXCLUDED.status,
  summary = EXCLUDED.summary,
  payload = EXCLUDED.payload,
  company_id = EXCLUDED.company_id,
  updated_at = NOW();

INSERT INTO public.approval_requests (
  source_module,
  source_table,
  source_record_id,
  request_type,
  requested_by,
  requested_at,
  project_id,
  status,
  summary,
  payload,
  company_id
)
SELECT
  'Purchasing',
  'purchases',
  pu.id,
  'Purchase Order',
  'Purchasing Team',
  pu.created_at,
  pu.project_id,
  CASE
    WHEN pu.status = 'approved' OR pu.status = 'received' THEN 'approved'
    WHEN pu.status = 'pending_approval' THEN 'pending'
    ELSE 'pending'
  END,
  CONCAT(pu.order_number, ' - ', pu.item_name),
  jsonb_build_object(
    'order_number', pu.order_number,
    'supplier', pu.supplier,
    'item_name', pu.item_name,
    'quantity', pu.quantity,
    'unit', pu.unit,
    'unit_cost', pu.unit_cost,
    'total_cost', pu.total_cost,
    'notes', pu.notes
  ),
  pu.company_id
FROM public.purchases pu
WHERE COALESCE(pu.is_archived, false) = false
  AND pu.status IN ('pending_approval', 'approved', 'received')
ON CONFLICT (source_table, source_record_id) DO UPDATE
SET
  requested_at = EXCLUDED.requested_at,
  project_id = EXCLUDED.project_id,
  status = EXCLUDED.status,
  summary = EXCLUDED.summary,
  payload = EXCLUDED.payload,
  company_id = EXCLUDED.company_id,
  updated_at = NOW();

INSERT INTO public.approval_requests (
  source_module,
  source_table,
  source_record_id,
  request_type,
  requested_by,
  requested_at,
  project_id,
  status,
  summary,
  payload,
  company_id
)
SELECT
  'Accounting',
  'liquidations',
  li.id,
  'Liquidation',
  li.submitted_by,
  li.created_at,
  li.project_id,
  CASE
    WHEN li.status = 'approved' THEN 'approved'
    WHEN li.status = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  CONCAT(li.purpose, ' - ', COALESCE(li.actual_amount, li.advance_amount, 0)),
  jsonb_build_object(
    'advance_amount', li.advance_amount,
    'actual_amount', li.actual_amount,
    'purpose', li.purpose,
    'receipt_attached', li.receipt_attached
  ),
  li.company_id
FROM public.liquidations li
ON CONFLICT (source_table, source_record_id) DO UPDATE
SET
  requested_at = EXCLUDED.requested_at,
  project_id = EXCLUDED.project_id,
  status = EXCLUDED.status,
  summary = EXCLUDED.summary,
  payload = EXCLUDED.payload,
  company_id = EXCLUDED.company_id,
  updated_at = NOW();