CREATE TABLE IF NOT EXISTS public.voucher_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  site_request_id uuid REFERENCES public.site_requests(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  source_approval_request_id uuid REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  supplier text,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  description text,
  requested_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'returned_for_revision')),
  voucher_number text,
  accounting_status text NOT NULL DEFAULT 'pending_accounting' CHECK (accounting_status IN ('pending_accounting', 'ready_for_delivery', 'received')),
  approved_at timestamp with time zone,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES public.company_settings(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_voucher_requests_purchase_id ON public.voucher_requests (purchase_id);
CREATE INDEX IF NOT EXISTS idx_voucher_requests_project_status ON public.voucher_requests (project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.request_execution_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_request_id uuid NOT NULL UNIQUE REFERENCES public.site_requests(id) ON DELETE CASCADE,
  initial_approval_request_id uuid UNIQUE REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  purchase_id uuid UNIQUE REFERENCES public.purchases(id) ON DELETE SET NULL,
  voucher_request_id uuid UNIQUE REFERENCES public.voucher_requests(id) ON DELETE SET NULL,
  voucher_id uuid REFERENCES public.vouchers(id) ON DELETE SET NULL,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  target_module text,
  lifecycle_status text NOT NULL DEFAULT 'pending_approval' CHECK (
    lifecycle_status IN (
      'pending_approval',
      'approved',
      'rejected',
      'returned_for_revision',
      'in_purchasing',
      'in_accounting',
      'voucher_pending_approval',
      'voucher_approved',
      'ready_for_delivery',
      'received'
    )
  ),
  supplier text,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  voucher_number text,
  received_by text,
  received_at timestamp with time zone,
  actual_quantity numeric(12,2),
  remarks text,
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES public.company_settings(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_execution_tracking_module_status
ON public.request_execution_tracking (target_module, lifecycle_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_execution_tracking_project
ON public.request_execution_tracking (project_id, updated_at DESC);

ALTER TABLE public.voucher_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_execution_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_voucher_requests ON public.voucher_requests;
CREATE POLICY tenant_isolation_voucher_requests
ON public.voucher_requests
FOR ALL
USING (company_id = auth_company_id())
WITH CHECK (company_id = auth_company_id());

DROP POLICY IF EXISTS tenant_isolation_request_execution_tracking ON public.request_execution_tracking;
CREATE POLICY tenant_isolation_request_execution_tracking
ON public.request_execution_tracking
FOR ALL
USING (company_id = auth_company_id())
WITH CHECK (company_id = auth_company_id());