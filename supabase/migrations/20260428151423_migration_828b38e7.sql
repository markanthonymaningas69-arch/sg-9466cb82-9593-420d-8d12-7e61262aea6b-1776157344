CREATE TABLE IF NOT EXISTS public.project_manpower_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position_name text NOT NULL,
  standard_rate numeric(10,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'day',
  description text,
  company_id uuid NOT NULL DEFAULT auth_company_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_manpower_catalog_unit_check CHECK (unit IN ('day', 'hour'))
);

CREATE INDEX IF NOT EXISTS idx_project_manpower_catalog_project
  ON public.project_manpower_catalog(project_id, position_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_manpower_catalog_unique_position
  ON public.project_manpower_catalog(company_id, project_id, lower(position_name));

ALTER TABLE public.project_manpower_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_project_manpower_catalog ON public.project_manpower_catalog;
CREATE POLICY tenant_isolation_project_manpower_catalog
  ON public.project_manpower_catalog
  FOR ALL
  USING (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());