ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS zip_code text;

CREATE INDEX IF NOT EXISTS idx_businesses_zip_code
ON public.businesses (zip_code);