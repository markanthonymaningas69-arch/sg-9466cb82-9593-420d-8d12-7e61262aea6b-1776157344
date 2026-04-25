ALTER TABLE public.site_attendance
ADD COLUMN IF NOT EXISTS time_in time without time zone;