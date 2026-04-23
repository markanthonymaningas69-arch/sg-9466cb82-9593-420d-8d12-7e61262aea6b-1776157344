ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS task_config jsonb NOT NULL DEFAULT '{}'::jsonb;