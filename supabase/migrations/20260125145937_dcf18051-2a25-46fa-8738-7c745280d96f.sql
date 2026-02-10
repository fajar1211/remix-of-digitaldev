ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS state text;

CREATE INDEX IF NOT EXISTS idx_businesses_country_state_city
ON public.businesses (country, state, city);