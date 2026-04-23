ALTER TABLE public.manpower_rate_catalog
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.manpower_rate_catalog
SET category = CASE
  WHEN lower(coalesce(category, '')) IN ('office', 'office staff') THEN 'office'
  ELSE 'construction'
END
WHERE category IS NULL OR category NOT IN ('office', 'construction');

UPDATE public.manpower_rate_catalog
SET hourly_rate = round((coalesce(daily_rate, 0) / 8.0)::numeric, 2)
WHERE hourly_rate IS NULL OR hourly_rate = 0;

UPDATE public.manpower_rate_catalog m
SET currency = coalesce(nullif(m.currency, ''), cs.currency, 'AED')
FROM public.company_settings cs
WHERE cs.id = m.company_id
  AND (m.currency IS NULL OR m.currency = '');

UPDATE public.manpower_rate_catalog
SET currency = 'AED'
WHERE currency IS NULL OR currency = '';

UPDATE public.manpower_rate_catalog
SET effective_date = coalesce(effective_date, CURRENT_DATE)
WHERE effective_date IS NULL;

UPDATE public.manpower_rate_catalog
SET status = CASE
  WHEN lower(coalesce(status, '')) = 'inactive' THEN 'inactive'
  ELSE 'active'
END
WHERE status IS NULL OR status NOT IN ('active', 'inactive');

ALTER TABLE public.manpower_rate_catalog
  ALTER COLUMN category SET DEFAULT 'construction',
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN hourly_rate SET DEFAULT 0,
  ALTER COLUMN hourly_rate SET NOT NULL,
  ALTER COLUMN currency SET DEFAULT 'AED',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN effective_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN effective_date SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'manpower_rate_catalog_category_check'
  ) THEN
    ALTER TABLE public.manpower_rate_catalog
      ADD CONSTRAINT manpower_rate_catalog_category_check
      CHECK (category IN ('office', 'construction'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'manpower_rate_catalog_status_check'
  ) THEN
    ALTER TABLE public.manpower_rate_catalog
      ADD CONSTRAINT manpower_rate_catalog_status_check
      CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS position_id uuid,
  ADD COLUMN IF NOT EXISTS rate_snapshot jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS employment_type text;

UPDATE public.personnel
SET employment_type = CASE
  WHEN lower(coalesce(employment_type, '')) IN ('contract', 'daily') THEN lower(employment_type)
  ELSE 'full_time'
END
WHERE employment_type IS NULL OR employment_type NOT IN ('full_time', 'contract', 'daily');

UPDATE public.personnel p
SET rate_snapshot = jsonb_build_object(
  'position_id', p.position_id,
  'position_name', p.role,
  'category', CASE
    WHEN lower(coalesce(p.worker_type, '')) = 'office' THEN 'office'
    ELSE 'construction'
  END,
  'daily_rate', coalesce(p.daily_rate, 0),
  'hourly_rate', coalesce(p.hourly_rate, 0),
  'overtime_rate', coalesce(p.overtime_rate, 0),
  'currency', coalesce(
    (SELECT cs.currency FROM public.company_settings cs WHERE cs.id = p.company_id),
    'AED'
  ),
  'effective_date', p.hire_date,
  'status', 'active'
)
WHERE p.rate_snapshot IS NULL OR p.rate_snapshot = '{}'::jsonb;

ALTER TABLE public.personnel
  ALTER COLUMN rate_snapshot SET DEFAULT '{}'::jsonb,
  ALTER COLUMN rate_snapshot SET NOT NULL,
  ALTER COLUMN employment_type SET DEFAULT 'full_time',
  ALTER COLUMN employment_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'personnel_position_id_fkey'
  ) THEN
    ALTER TABLE public.personnel
      ADD CONSTRAINT personnel_position_id_fkey
      FOREIGN KEY (position_id)
      REFERENCES public.manpower_rate_catalog(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'personnel_employment_type_check'
  ) THEN
    ALTER TABLE public.personnel
      ADD CONSTRAINT personnel_employment_type_check
      CHECK (employment_type IN ('full_time', 'contract', 'daily'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_personnel_position_id ON public.personnel(position_id);