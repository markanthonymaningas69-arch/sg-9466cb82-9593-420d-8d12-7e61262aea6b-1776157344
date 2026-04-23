ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS scope_quantity numeric(15,2) DEFAULT 1,
ADD COLUMN IF NOT EXISTS scope_unit text DEFAULT 'lot',
ADD COLUMN IF NOT EXISTS productivity_rate_per_hour numeric(12,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS productivity_rate_per_day numeric(12,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS working_hours_per_day numeric(6,2) DEFAULT 8,
ADD COLUMN IF NOT EXISTS team_composition jsonb DEFAULT '[{"id":"mason","role":"Mason","count":1},{"id":"helper","role":"Helper","count":1}]'::jsonb,
ADD COLUMN IF NOT EXISTS resource_labor jsonb DEFAULT '[{"id":"mason","role":"Mason","count":1},{"id":"helper","role":"Helper","count":1}]'::jsonb,
ADD COLUMN IF NOT EXISTS equipment jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cost_links jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS duration_source text DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.project_tasks AS pt
SET
  scope_quantity = COALESCE(bsw.quantity, pt.scope_quantity, 1),
  scope_unit = COALESCE(bsw.unit, pt.scope_unit, 'lot')
FROM public.bom_scope_of_work AS bsw
WHERE pt.bom_scope_id = bsw.id;