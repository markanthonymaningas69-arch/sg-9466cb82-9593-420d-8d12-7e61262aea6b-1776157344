BEGIN;

ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.material_consumption
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.site_requests
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.personnel
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.cash_advance_requests
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.site_attendance
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

ALTER TABLE public.site_attendance
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.bom_progress_updates
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

ALTER TABLE public.bom_progress_updates
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

UPDATE public.site_attendance
SET is_archived = false
WHERE is_archived IS NULL;

UPDATE public.bom_progress_updates
SET is_archived = false
WHERE is_archived IS NULL;

COMMIT;