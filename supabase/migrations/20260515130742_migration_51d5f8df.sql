ALTER TABLE public.approval_requests
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;