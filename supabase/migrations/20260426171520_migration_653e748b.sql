ALTER TABLE public.site_requests 
ADD COLUMN IF NOT EXISTS supplier text,
ADD COLUMN IF NOT EXISTS receipt_number text;