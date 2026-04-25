ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS bom_edit_locked boolean NOT NULL DEFAULT false;