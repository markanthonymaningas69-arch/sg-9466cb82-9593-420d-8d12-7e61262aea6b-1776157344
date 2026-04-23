CREATE TABLE IF NOT EXISTS public.manpower_rate_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_name text NOT NULL,
  daily_rate numeric(10,2) NOT NULL DEFAULT 0,
  overtime_rate numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES public.company_settings(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manpower_rate_catalog_company_position
  ON public.manpower_rate_catalog (company_id, lower(position_name));

ALTER TABLE public.manpower_rate_catalog ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manpower_rate_catalog'
      AND policyname = 'tenant_isolation_manpower_rate_catalog'
  ) THEN
    CREATE POLICY tenant_isolation_manpower_rate_catalog
      ON public.manpower_rate_catalog
      FOR ALL
      USING (company_id = auth_company_id())
      WITH CHECK (company_id = auth_company_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_material_delivery_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.bom_materials(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  delivery_schedule_type text NOT NULL DEFAULT 'one_time' CHECK (delivery_schedule_type IN ('one_time', 'staggered')),
  delivery_start_date date NULL,
  delivery_frequency text NOT NULL DEFAULT 'daily' CHECK (delivery_frequency IN ('daily', 'weekly', 'custom')),
  delivery_duration_days integer NOT NULL DEFAULT 1,
  custom_interval_days integer NULL,
  quantity_mode text NOT NULL DEFAULT 'even' CHECK (quantity_mode IN ('even')),
  delivery_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  planned_usage_period jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_quantity numeric(15,4) NOT NULL DEFAULT 0,
  unit text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES public.company_settings(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_material_delivery_plans_task_material
  ON public.task_material_delivery_plans (task_id, material_id);

ALTER TABLE public.task_material_delivery_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'task_material_delivery_plans'
      AND policyname = 'tenant_isolation_task_material_delivery_plans'
  ) THEN
    CREATE POLICY tenant_isolation_task_material_delivery_plans
      ON public.task_material_delivery_plans
      FOR ALL
      USING (company_id = auth_company_id())
      WITH CHECK (company_id = auth_company_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_labor_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  daily_cost numeric(15,2) NOT NULL DEFAULT 0,
  total_cost numeric(15,2) NOT NULL DEFAULT 0,
  duration_days integer NOT NULL DEFAULT 1,
  rate_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES public.company_settings(id) ON DELETE CASCADE
);

ALTER TABLE public.task_labor_costs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'task_labor_costs'
      AND policyname = 'tenant_isolation_task_labor_costs'
  ) THEN
    CREATE POLICY tenant_isolation_task_labor_costs
      ON public.task_labor_costs
      FOR ALL
      USING (company_id = auth_company_id())
      WITH CHECK (company_id = auth_company_id());
  END IF;
END $$;