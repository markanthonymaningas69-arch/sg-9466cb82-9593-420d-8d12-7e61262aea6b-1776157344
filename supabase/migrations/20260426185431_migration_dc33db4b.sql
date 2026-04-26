CREATE TABLE IF NOT EXISTS public.approval_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  audience_module TEXT NOT NULL,
  target_surface TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  company_id UUID NOT NULL DEFAULT auth_company_id(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_approval_notifications ON public.approval_notifications;
CREATE POLICY tenant_isolation_approval_notifications
ON public.approval_notifications
FOR ALL
USING (company_id = auth_company_id())
WITH CHECK (company_id = auth_company_id());

CREATE INDEX IF NOT EXISTS idx_approval_notifications_company_surface_created
ON public.approval_notifications (company_id, target_surface, created_at DESC);

CREATE TABLE IF NOT EXISTS public.approval_notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.approval_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL DEFAULT auth_company_id(),
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT approval_notification_reads_unique UNIQUE (notification_id, user_id)
);

ALTER TABLE public.approval_notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_approval_notification_reads ON public.approval_notification_reads;
CREATE POLICY tenant_isolation_approval_notification_reads
ON public.approval_notification_reads
FOR ALL
USING (company_id = auth_company_id())
WITH CHECK (company_id = auth_company_id());

CREATE INDEX IF NOT EXISTS idx_approval_notification_reads_user
ON public.approval_notification_reads (user_id, read_at DESC);