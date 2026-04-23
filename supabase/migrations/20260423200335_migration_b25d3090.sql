CREATE TABLE IF NOT EXISTS public.project_scurve_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date date NOT NULL,
  planned_value numeric(15,2) NOT NULL DEFAULT 0,
  actual_value numeric(15,2) NOT NULL DEFAULT 0,
  earned_value numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES public.company_settings(id) ON DELETE CASCADE,
  CONSTRAINT project_scurve_daily_project_date_key UNIQUE (project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_project_scurve_daily_project_date
  ON public.project_scurve_daily(project_id, date);

ALTER TABLE public.project_scurve_daily ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_scurve_daily'
      AND policyname = 'tenant_isolation_project_scurve_daily'
  ) THEN
    CREATE POLICY "tenant_isolation_project_scurve_daily"
      ON public.project_scurve_daily
      FOR ALL
      USING (company_id = auth_company_id())
      WITH CHECK (company_id = auth_company_id());
  END IF;
END $$;