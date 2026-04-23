CREATE TABLE IF NOT EXISTS public.master_team_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  company_id uuid NULL REFERENCES public.company_settings(id) ON DELETE CASCADE
);

ALTER TABLE public.master_team_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_master_team_templates ON public.master_team_templates;

CREATE POLICY tenant_isolation_master_team_templates
ON public.master_team_templates
FOR ALL
USING (company_id = auth_company_id())
WITH CHECK (company_id = auth_company_id());

ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS team_template_id uuid NULL REFERENCES public.master_team_templates(id) ON DELETE SET NULL;

ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS number_of_teams integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_project_tasks_team_template_id
ON public.project_tasks(team_template_id);